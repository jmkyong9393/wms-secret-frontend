import type { BookMeta } from '../types';
import { useMutation } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { API_BASE_URL } from '@/shared/api/api-client';
import { uploadQueueAtom } from '@/entities/upload-task/model/uploadQueueAtoms';

// 작업 진행 현황 패널이 유지하는 최대 행 수 (초과분은 오래된 것부터 선입선출로 밀어낸다)
const QUEUE_VISIBLE_MAX = 10;

/**
 * 검수 전송 + SSE 진행 스트림 + 원장 폴링 복구 훅.
 * 낙관적 큐 적재 → SSE 진행률 → (연결 유실 시) 원장 REST 폴링의 3중 경로로 최종 상태를
 * 확정한다. 큐(uploadQueueAtom) 갱신은 전부 이 훅이 담당한다.
 */
export function useEvaluationStream(opts: {
  workerId: string | null | undefined;
  /** 낙관적 전환 시점 - 페이지가 RESULT로 넘어가고 촬영분을 비운다 */
  onOptimisticQueued: () => void;
  /** 서버 접수 확정 시점 - 페이지가 작업 초안을 폐기한다 */
  onAccepted: () => void;
}) {
  const setUploadQueue = useSetAtom(uploadQueueAtom);

  // ---------------------------------------------------------------------------
  // [UX 렌더링 최적화 1] TanStack Query (React Query) Mutation
  // ---------------------------------------------------------------------------
  // 사용자가 '촬영 완료'를 눌렀을 때, 백엔드의 응답 시간(네트워크 지연)을 기다리지 않고
  // 화면을 즉각적으로 전환(0초 지연)시키는 '낙관적 업데이트(Optimistic Update)' 기법을 적용합니다.
  //
  // 큐(uploadQueueAtom) 갱신도 전부 이 mutation이 담당한다. 화면 전환만 낙관적으로
  // 앞당기고, 큐에 찍히는 상태는 요청·SSE의 실제 결과를 따른다.
  const evaluateMutation = useMutation({
    mutationFn: async (data: { lpn: string, images: Blob[], previewUrl: string, book_metadata?: BookMeta }) => {
      const getBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const base64Images = await Promise.all(data.images.map(getBase64));

      // worker_id 누락 - 백엔드는 이미 이 값을 받아 agent_logs.
      // inbound_worker_id에 저장하고 "내 검수만" 필터(returns/inspections?worker_id=)가
      // 그 값을 기준으로 거른다. 이 필드가 빠져 있으면 서버에 저장되는 값이 항상 null이라,
      // 실제로 촬영·검수한 작업자 본인의 "나의 검수 내역"이 매번 0건으로 뜬다.
      const res = await fetch(`${API_BASE_URL}/api/v1/inbound/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: data.lpn, images: base64Images, book_metadata: data.book_metadata, worker_id: opts.workerId || null })
      });
      if (!res.ok) throw new Error("Evaluation failed");
      return res.json();
    },
    onMutate: async (newEvaluation) => {
      // 임시 ID(tempJobId)로 큐에 먼저 자리를 잡아 두고, 화면은 곧바로 다음 단계로 넘긴다.
      // 상태는 '전송 중'이며, 완료로 바뀌는 시점은 서버 응답·SSE가 결정한다.
      const tempJobId = `temp-${Date.now()}`;
      // 상한 초과분은 오래된 것부터 밀어낸다. 진행 중인 건은 항상 최신 쪽에 있어 잘리지 않는다.
      setUploadQueue(prev => [...prev, {
        id: tempJobId,
        lpn: newEvaluation.lpn,
        title: newEvaluation.book_metadata?.title || '미등록 도서',
        previewUrl: newEvaluation.previewUrl,
        status: 'UPLOADING' as const,
        progress: 0,
        message: '전송 중...',
        timestamp: Date.now()
      }].slice(-QUEUE_VISIBLE_MAX));

      // 화면 전환·촬영분 정리는 페이지 소관 (RESULT 전환 + capturedImages 비움)
      opts.onOptimisticQueued();
      return { tempJobId };
    },
    onSuccess: (data, variables, context) => {
      // 2. 서버 통신이 '진짜로' 성공하면, 서버가 발급한 진짜 Job ID를 받아옴
      const { job_id, lpn } = data;

      // 서버가 작업을 접수한 시점에만 초안을 버린다 (전송 실패 시 촬영분 보존).
      opts.onAccepted();

      // 임시 ID로 잡아둔 자리를 실제 job_id로 치환하고 분석 대기 상태로 넘긴다.
      setUploadQueue(prev => prev.map(q => q.id === context?.tempJobId
        ? { ...q, id: job_id, status: 'ANALYZING' as const, message: '분석 대기 중...' }
        : q));

      // -----------------------------------------------------------------------
      // [UX 렌더링 최적화 2] SSE (Server-Sent Events) 단방향 스트리밍 구독
      // -----------------------------------------------------------------------
      // 무거운 WebSocket을 쓰지 않고, HTTP/1.1 표준인 EventSource를 활용해
      // AI 분석이 끝날 때까지 10% 단위의 진행률(Progress)을 쪼개서 받아옵니다.
      const evtSource = new EventSource(`${API_BASE_URL}/api/v1/inbound/stream/${job_id}`);

      // 이 job의 최종 상태가 이미 확정됐는지 여부. onmessage(정상 종료) / onerror(연결 끊김) /
      // 체류 시간 상한(무응답) 세 경로가 경합할 수 있으므로, 먼저 확정한 쪽이 이기고 나머지는
      // 무시한다.
      let resolved = false;
      let staleTimer: ReturnType<typeof setTimeout> | null = null;
      let staleRecheckTimer: ReturnType<typeof setTimeout> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let pollCount = 0;
      const clearStaleTimers = () => {
        if (staleTimer) clearTimeout(staleTimer);
        if (staleRecheckTimer) clearTimeout(staleRecheckTimer);
        if (pollTimer) clearInterval(pollTimer);
        document.removeEventListener('visibilitychange', onVisible);
      };

      const persistEvaluation = (
        grade: string,
        ubciScore: number | null | undefined,
        defectDescription: string | null | undefined,
        message: string | null | undefined
      ) => {
        // 모의 데이터 대신 실제 AI 등급 결과와 도서 정보를 Local Storage에 누적 저장
        const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
        const newEval = {
          job_id, lpn, grade,
          score: ubciScore,
          reasonCode: defectDescription || message,
          message,
          timestamp: new Date().toISOString(),
          isbn: variables.book_metadata?.isbn || '알 수 없음',
          title: variables.book_metadata?.title || '스캔된 도서',
          author: variables.book_metadata?.author || '-',
          publisher: variables.book_metadata?.publisher || '-',
          category: variables.book_metadata?.categoryName?.split('>').pop() || '일반'
        };

        const existingIndex = localEvals.findIndex((item: { lpn?: string }) => item.lpn === lpn);
        if (existingIndex >= 0) {
          // 이전에 저장된 동일 LPN이 있다면 덮어쓰기 (재검수 시 중복 방지)
          localEvals[existingIndex] = newEval;
        } else {
          localEvals.push(newEval);
        }
        localStorage.setItem('local_evaluations', JSON.stringify(localEvals));
      };

      const finalizeCompleted = (
        grade: string,
        ubciScore: number | null | undefined,
        defectDescription: string | null | undefined,
        message: string | null | undefined
      ) => {
        if (resolved) return;
        resolved = true;
        clearStaleTimers();
        evtSource.close();
        setUploadQueue(prev => prev.map(q => q.id === job_id
          ? { ...q, status: 'COMPLETED' as const, progress: 100, grade, message: message || undefined }
          : q));
        persistEvaluation(grade, ubciScore, defectDescription, message);
      };

      const finalizeFailed = (message: string) => {
        if (resolved) return;
        resolved = true;
        clearStaleTimers();
        evtSource.close();
        setUploadQueue(prev => prev.map(q => q.id === job_id
          ? { ...q, status: 'FAILED' as const, message }
          : q));
      };

      // Redis Pub/Sub은 재생이 없다 — SSE 연결이 끊기거나 이벤트를 놓치면 그 순간의 진행률은
      // 영구히 사라진다. 원장(DB) 단건 조회(GET /inbound/result/{job_id})가 유일한 복구
      // 경로이므로, 연결 오류 시 즉시 / 무응답 장기화 시 주기적으로 이걸로 최종 상태를 확정한다.
      const checkJobStatusViaRest = async (): Promise<'resolved' | 'pending'> => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/inbound/result/${job_id}`);
          if (!res.ok) return 'pending';
          const body = await res.json();

          if (body.status === 'PENDING' || body.status === 'PROCESSING') return 'pending';

          if (body.status === 'FAILED') {
            finalizeFailed('AI 파이프라인 오류 (원장 조회로 확인)');
            return 'resolved';
          }

          // APPROVED / REJECTED / HITL_REQUIRED
          const grade = body.status === 'HITL_REQUIRED' ? 'HITL_REQUIRED' : body.result?.grade;
          if (!grade) {
            finalizeFailed('등급 미수신 (원장 조회로 확인)');
            return 'resolved';
          }
          finalizeCompleted(grade, body.result?.ubci_score, body.result?.defect_description, '완료 (재연결로 확인)');
          return 'resolved';
        } catch {
          // 네트워크 순단 등 조회 자체가 실패한 경우 - 판단을 보류하고 다음 재시도에 맡긴다
          return 'pending';
        }
      };

      evtSource.onmessage = (event) => {
        // 서버에서 던져준 데이터("디코딩 중... 20%")를 실시간으로 UI 프로그레스 바에 반영
        const parsed = JSON.parse(event.data);

        if (parsed.progress !== 100) {
          if (!resolved) {
            setUploadQueue(prev => prev.map(q => q.id === job_id
              ? { ...q, progress: parsed.progress, message: parsed.message }
              : q));
          }
          return;
        }

        // 워커는 파이프라인 실패도 progress 100으로 발행하며 grade에 'ERROR'를 담는다.
        // 등급으로 취급하면 실패가 완료로 표시된다.
        if (parsed.grade === 'ERROR') {
          finalizeFailed(parsed.message || 'AI 파이프라인 오류');
          return;
        }
        // 100%인데 등급이 없으면 판정을 받지 못한 것이다. 완료로 올리지 않는다.
        if (!parsed.grade) {
          finalizeFailed(parsed.message || '등급 미수신');
          return;
        }
        finalizeCompleted(parsed.grade, parsed.ubci_score, parsed.defect_description, parsed.message);
      };

      // 연결이 끊겼지만 원장상 작업이 살아 있는 경우의 복구 경로. 작업은 서버 큐에서
      // 계속 진행되므로(acks_late) FAILED로 단정하면 오표기다 — 15초 간격 원장 폴링으로
      // 전환해 최종 상태를 추적한다. 상한 40회(10분) 초과 시에만 지연 실패로 확정한다.
      const enterPollingMode = (reason: string) => {
        if (resolved || pollTimer) return;
        setUploadQueue(prev => prev.map(q => q.id === job_id
          ? { ...q, message: `${reason} — 상태 자동 추적 중...` }
          : q));
        pollTimer = setInterval(() => {
          pollCount += 1;
          if (pollCount > 40) {
            finalizeFailed('처리 지연 — 관리자 확인이 필요합니다');
            return;
          }
          checkJobStatusViaRest();
        }, 15000);
      };

      // 화면이 꺼졌다 켜지면(모바일 절전) 즉시 원장을 재확인한다 — SSE가 죽은 채로
      // 사용자가 돌아왔을 때 결과를 바로 복원하기 위한 경로.
      const onVisible = () => {
        if (document.visibilityState === 'visible' && !resolved) {
          checkJobStatusViaRest().then(outcome => {
            if (outcome === 'pending' && evtSource.readyState === EventSource.CLOSED) {
              enterPollingMode('연결 복구');
            }
          });
        }
      };
      document.addEventListener('visibilitychange', onVisible);

      evtSource.onerror = (err) => {
        console.error("SSE Error:", err);
        // 연결이 끊긴 즉시 원장을 확인한다. 서버는 실제로 성공했는데 연결만 끊겼을 수도
        // 있고, 아직 처리 중일 수도 있다 — 어느 쪽이든 확인 없이 FAILED로 단정하지 않는다.
        checkJobStatusViaRest().then(outcome => {
          if (outcome === 'pending') enterPollingMode('진행 상황 수신이 끊김');
        });
      };

      // 연결은 살아 있는데 3분 넘게 완료 신호가 없는 경우의 안전망(SSE 자체가 조용히
      // 멎는 경우 - 예: 화면이 백그라운드로 밀려 렌더링이 정지됨). 한 번 확인해서 아직
      // 처리 중이면 60초 뒤 한 번 더 확인하고, 그래도 안 끝나면 폴링 모드로 전환한다.
      staleTimer = setTimeout(() => {
        checkJobStatusViaRest().then(outcome => {
          if (outcome !== 'pending') return;
          setUploadQueue(prev => prev.map(q => q.id === job_id
            ? { ...q, message: '처리 지연 확인 중...' }
            : q));
          staleRecheckTimer = setTimeout(() => {
            checkJobStatusViaRest().then(outcome2 => {
              if (outcome2 === 'pending') enterPollingMode('처리 지연');
            });
          }, 60000);
        });
      }, 180000);
    },
    onError: (err, newEvaluation, context) => {
      // 3. 서버 통신이 실패했다면(네트워크 단절 등) 큐 항목을 실패로 표시한다.
      // 삭제하지 않는 이유는 작업자가 어떤 LPN을 다시 보내야 하는지 알아야 하기 때문이다.
      if (context?.tempJobId) {
        setUploadQueue(prev => prev.map(q => q.id === context.tempJobId
          ? { ...q, status: 'FAILED' as const, message: '전송 실패 — 재촬영이 필요합니다' }
          : q));
      }
      alert("AI 판독 큐 전송에 실패했습니다. 다시 시도해주세요.");
    }
  });

  return evaluateMutation;
}
