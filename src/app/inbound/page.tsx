'use client';
import { API_BASE_URL } from '@/shared/api/api-client';

import { useState, useEffect, useRef } from 'react';
import BookCover from '@/entities/book/ui/BookCover';
import { useMutation } from '@tanstack/react-query';
import { Camera, Flashlight, RefreshCcw, Keyboard, Package, CheckCircle2, AlertTriangle, ScanLine, Printer, ArrowRight, BookOpen, ChevronLeft, User, Zap } from 'lucide-react';
import { labelsAPI } from '@/shared/api/api';
import { useCamera } from '@/shared/lib/useCamera';
import { processImage } from '@/shared/lib/image-processor';
import { useAtomValue, useSetAtom } from 'jotai';
import { uploadQueueAtom } from '@/entities/upload-task/model/uploadQueueAtoms';
import { currentUserAtom } from '@/entities/user/model/authAtoms';
import { getSystemSettings } from '@/shared/lib/systemSettings';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { BrowserMultiFormatReader as ZXingBrowserReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel } from '@/entities/label/ui/LpnPrintLabel';
import { validateIsbn13, isLpnCode } from '@/features/inbound/isbnValidation';
import { TRACK1_IMAGE_COUNT, TRACK1_SHOTS, shotAt, shotLabel } from '@/features/inbound/captureSequence';
import { saveDraft, loadDraft, clearDraft } from '@/features/inbound/inspectionDraft';

type Step = 'SELECT_TYPE' | 'SCAN_BARCODE' | 'PRINT_STICKER' | 'VISION_EVALUATION' | 'RESULT';
type InboundType = 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';
// 채번 응답: LPN 문자열 + 원장에 있는 도서 메타(없으면 null)
type IssuedLpn = { lpn: string; book: any | null };

// 서버가 조회 실패 시 Book.title에 넣는 자리표시자. 이 값이면 도서 조회를 다시 시도한다.
const UNKNOWN_BOOK_TITLE = '미확인 도서';
// 작업 진행 현황 패널이 유지하는 최대 행 수 (초과분은 오래된 것부터 선입선출로 밀어낸다)
const QUEUE_VISIBLE_MAX = 10;

export default function InboundScannerPage() {
  const [step, setStep] = useState<Step>('SELECT_TYPE');
  const [inboundType, setInboundType] = useState<InboundType>('NEW_FASTTRACK');
  const [isbn, setIsbn] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentLpn, setCurrentLpn] = useState('');
  // 이번 화면에서 방금 채번했고 아직 인쇄하지 않은 상태인지. 뒤로가기 시 이 값이 true일
  // 때만 LPN을 회수한다 - 재촬영으로 스캔한 기존 LPN을 지우면 안 되기 때문이다.
  const [lpnIssuedNow, setLpnIssuedNow] = useState(false);
  // 재출력 진행 중인 LPN (해당 행 버튼만 스피너로 잠근다)
  const [reprintingLpn, setReprintingLpn] = useState<string | null>(null);
  const [bookInfo, setBookInfo] = useState<any | null>(null);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [fasttrackQty, setFasttrackQty] = useState<number>(1);
  const [activeStation, setActiveStation] = useState<string>('A');
  // 화면 꺼짐·새로고침으로 페이지가 재생성된 뒤 이전 작업을 되살렸을 때 띄우는 안내.
  // null이면 평소 진입(복원 없음)이다.
  const [resumedDraft, setResumedDraft] = useState<{ lpn: string; shots: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('active_workstation_line') || 'A';
      setActiveStation(saved);
      localStorage.setItem('active_workstation_line', saved);
    }
  }, []);

  const handleStationChange = (line: string) => {
    setActiveStation(line);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_workstation_line', line);
    }
  };

  // Multi-Capture State
  const [capturedImages, setCapturedImages] = useState<{ url: string, blob: Blob }[]>([]);
  // 촬영 단계는 별도 state로 두지 않고 찍은 장수에서 파생시킨다.
  // 종전에는 setCapturePhase를 촬영·초기화 지점마다 따로 호출해야 해서 한 군데만
  // 빠뜨려도 안내 문구와 실제 장수가 어긋났다.
  const currentShot = shotAt(capturedImages.length);
  
  const { videoRef, startCamera, stopCamera } = useCamera();
  const guideBoxRef = useRef<HTMLDivElement>(null);
  // 검수 큐는 전역 atom 하나만 쓴다. 화면 로컬 사본을 따로 두면 Header·대시보드가
  // 보는 값과 어긋난다.
  const uploadQueue = useAtomValue(uploadQueueAtom);
  const setUploadQueue = useSetAtom(uploadQueueAtom);
  const user = useAtomValue(currentUserAtom);

  // 목록은 최신 건이 위로 오도록 뒤집어 보여준다 (큐 자체는 전송 순서로 쌓인다).
  const visibleQueue = [...uploadQueue].reverse();
  const inFlightCount = uploadQueue.filter(t => t.status === 'UPLOADING' || t.status === 'ANALYZING').length;
  const finishedCount = uploadQueue.filter(t => t.status === 'COMPLETED' || t.status === 'FAILED').length;

  // 진행 중이 아닌 완료·실패 건만 목록에서 비운다.
  const clearFinishedTasks = () => {
    setUploadQueue(prev => prev.filter(t => t.status === 'UPLOADING' || t.status === 'ANALYZING'));
  };

  // 목록에서 바로 라벨을 다시 뽑는다 (라벨 훼손·인쇄 실패 시 재고 화면까지 가지 않아도 되게).
  const reprintLpnLabel = async (lpn: string, title?: string) => {
    setReprintingLpn(lpn);
    try {
      const result = await labelsAPI.printLpn(
        lpn,
        title,
        undefined,
        user?.name ? `${user.employeeId} (${user.name})` : undefined
      );
      if (result.skipped) alert('라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).');
      else if (!result.sent && !result.queued) alert('라벨 전송에 실패했습니다.');
    } catch {
      alert('라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.');
    } finally {
      setReprintingLpn(null);
    }
  };

  /**
   * LPN 채번 — 반드시 서버(POST /inventory/lpn)에서 받아온다.
   *
   * [2026-08-06 수정 — 데이터 손상 사고 수정]
   * 종전에는 이 함수가 localStorage 카운터로 LPN을 직접 만들었다. DB를 한 번도 조회하지
   * 않았기 때문에 아래 세 증상이 동시에 발생했다.
   *   1) 이미 재고/HITL에 존재하는 번호를 새 도서에 다시 발급
   *   2) 다른 스마트폰·브라우저에서는 카운터가 공유되지 않아 항상 001부터 재시작
   *   3) Cloudflare 임시 터널(trycloudflare.com)은 재시작마다 서브도메인이 바뀌는데,
   *      도메인이 바뀌면 브라우저가 별개 사이트로 취급해 localStorage가 초기화됨
   *
   * 단순 중복이 아니라 **조용한 데이터 손상**이었다. inventory_used_items.lpn_barcode는
   * UNIQUE지만, 검수 확정 시 assign_rack_location_after_inspection()이 같은 LPN의 기존
   * row를 찾아 UPDATE하므로 앞선 도서의 등급·점수·랙 위치가 통째로 덮어써진다.
   *
   * 서버는 존·날짜별 max(순번)+1로 채번하며 UNIQUE 충돌 시 재시도한다. 실패하면
   * 라벨을 발급하지 않고 예외를 던진다 — 잘못된 번호를 실물에 붙이는 것보다 낫다.
   */
  /**
   * LPN 재검수 시 원본 도서 정보 조회.
   *
   * 종전에는 localStorage('local_evaluations')만 뒤졌다. 그 기록은
   * **최초 입고를 수행한 그 브라우저에만** 남으므로, 다른 작업자 단말로 스캔하거나
   * 캐시가 지워졌거나 도메인이 바뀌면(터널 URL 변경 등) 항상 미스가 나
   * `{title:'정보 없음 (재촬영 진행)', categoryName:'LPN 재스캔'}`이 그대로 서버로 갔다.
   * 그 값은 단순 표시용이 아니다 — 워커가 `agent_logs.book_metadata.title`을 읽어
   * Policy Agent의 수험서 낙서 Cap(is_workbook) 판정과 보증서 본문 생성에 쓰므로,
   * 같은 책인데 재검수만 하면 판정 근거와 고객 보증서 문구가 달라진다.
   *
   * 원장(서버)에는 최초 입고 때 연결된 book이 그대로 있으므로 그것을 정본으로 쓴다.
   * 오프라인이거나 조회에 실패하면 종전 localStorage 경로로 폴백한다.
   */
  const lookupBookByLpn = async (lpn: string): Promise<any | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/inventory/${encodeURIComponent(lpn)}`);
      if (res.ok) {
        const item = await res.json();
        const b = item?.book;
        if (b?.title) {
          return {
            isbn: b.isbn || '',
            title: b.title,
            author: b.author,
            publisher: b.publisher,
            imageUrl: b.cover_image_url,
            price: b.base_price,
            isRescan: true,
          };
        }
      }
    } catch {
      // 네트워크 단절 - 아래 로컬 기록으로 폴백한다.
    }

    const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
    const hit = [...localEvals].reverse().find((e: any) => e.lpn === lpn);
    if (!hit) return null;
    return {
      isbn: hit.isbn || '',
      title: hit.title,
      author: hit.author,
      publisher: hit.publisher,
      categoryName: hit.category,
      isRescan: true,
    };
  };

  const issueLPN = async (isbnValue: string): Promise<IssuedLpn> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/inventory/lpn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isbn: isbnValue,
        zone: (typeof window !== 'undefined' && localStorage.getItem('active_workstation_line')) || 'A',
        worker_id: user?.employeeId || null,
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail?.detail || detail?.message || 'LPN 채번에 실패했습니다. 네트워크를 확인하세요.');
    }
    const json = await res.json();
    if (!json?.lpn_barcode) throw new Error('서버가 LPN을 반환하지 않았습니다.');
    return { lpn: json.lpn_barcode, book: json.book || null };
  };

  /**
   * 도서 정보 확정. 채번 응답에 실려 온 원장 메타를 1순위로 쓰고, 쓸 수 없을 때만
   * 도서 조회 API를 호출한다. 이미 입고된 적 있는 도서는 외부 API 없이 화면이 채워진다.
   */
  const resolveBookInfo = async (isbnValue: string, seed: any | null) => {
    if (seed?.title && seed.title !== UNKNOWN_BOOK_TITLE) {
      setBookInfo(seed);
      setIsLoadingBook(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/inbound/book-lookup?isbn=${isbnValue}`);
      if (res.ok) {
        setBookInfo(await res.json());
      } else {
        // isbn을 반드시 함께 넘긴다 - 없으면 이후 evaluate 요청의 book_metadata에서
        // isbn이 빠져 서버가 Book row를 만들지 못하고 500(book_id NOT NULL)을 낸다.
        const body = await res.json().catch(() => ({} as any));
        setBookInfo({
          title: body?.detail || body?.message ||
            (res.status === 503 ? '도서 정보 서버 연결 실패 (다시 스캔해주세요)' : '등록되지 않은 ISBN'),
          isbn: isbnValue,
          lookupFailed: true,
        });
      }
    } catch {
      setBookInfo({ title: '네트워크 오류로 도서 정보를 불러오지 못했습니다', isbn: isbnValue, lookupFailed: true });
    } finally {
      setIsLoadingBook(false);
    }
  };

  /**
   * 인쇄 전 미부착 LPN 회수. 실패해도 작업 흐름은 막지 않는다 - 라벨이 실물에 붙지
   * 않았으므로 서버에 남아도 다음 정리 대상이 될 뿐이다.
   */
  const cancelIssuedLpn = async (lpn: string) => {
    if (!lpn) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/inventory/lpn/${encodeURIComponent(lpn)}`, { method: 'DELETE' });
    } catch {
      // 네트워크 단절 - 회수 실패는 무시한다
    }
  };

  // ---------------------------------------------------------------------------
  // [UX 렌더링 최적화 1] TanStack Query (React Query) Mutation
  // ---------------------------------------------------------------------------
  // 사용자가 '촬영 완료'를 눌렀을 때, 백엔드의 응답 시간(네트워크 지연)을 기다리지 않고
  // 화면을 즉각적으로 전환(0초 지연)시키는 '낙관적 업데이트(Optimistic Update)' 기법을 적용합니다.
  //
  // 큐(uploadQueueAtom) 갱신도 전부 이 mutation이 담당한다. 화면 전환만 낙관적으로
  // 앞당기고, 큐에 찍히는 상태는 요청·SSE의 실제 결과를 따른다.
  const evaluateMutation = useMutation({
    mutationFn: async (data: { lpn: string, images: Blob[], previewUrl: string, book_metadata?: any }) => {
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
        body: JSON.stringify({ lpn: data.lpn, images: base64Images, book_metadata: data.book_metadata, worker_id: user?.employeeId || null })
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

      // 카메라 뷰파인더 닫고, 즉시(0.001초만에) 다음 화면(RESULT)으로 전환하여 체감속도 극대화
      setStep('RESULT');
      // 전송 시점에 이미지를 blob으로 이미 캡처해 mutate()에 넘겼으므로
      // (위 mutationFn의 data.images) 여기서 비워도 전송에는 영향이 없다. 종전에는 "다음 도서
      // 스캔하기" 버튼이나 뒤로가기 버튼을 눌러야만 비워졌다 - RESULT 화면에서 SSE 진행이
      // 멈추거나(백그라운드 탭 스로틀링 등) 화면이 꺼졌다 켜진 뒤 그 버튼들을 거치지 않고
      // 촬영 화면(VISION_EVALUATION)에 재진입하면, 이전 도서의 사진 3장이 그대로 남아
      // "이미 다 찍힌 것"처럼 보였다.
      setCapturedImages([]);
      return { tempJobId };
    },
    onSuccess: (data, variables, context) => {
      // 2. 서버 통신이 '진짜로' 성공하면, 서버가 발급한 진짜 Job ID를 받아옴
      const { job_id, lpn } = data;

      // 서버가 작업을 접수한 시점에만 초안을 버린다. onMutate(낙관적 전환)에서 지우면
      // 전송이 실패했을 때 촬영분까지 사라져 처음부터 다시 찍어야 한다.
      clearDraft();
      setResumedDraft(null);

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

        const existingIndex = localEvals.findIndex((item: any) => item.lpn === lpn);
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

  useEffect(() => {
    if (step === 'SCAN_BARCODE' || step === 'VISION_EVALUATION') {
      // 바코드 스캔은 ZXing 스윗스팟(720p), AI 검수 촬영은 S3 원본 화질 확보용 FHD
      startCamera(step === 'VISION_EVALUATION' ? 'inspection' : 'barcode');
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---------------------------------------------------------------------------
  // 작업 이어하기 (화면 꺼짐·새로고침 복구) — features/inbound/inspectionDraft.ts
  // ---------------------------------------------------------------------------
  // 비동기 복원 도중 작업자가 먼저 새 작업을 시작했는지 판별하기 위한 현재 단계 스냅샷.
  // state를 직접 읽으면 이펙트 생성 시점 값에 고정되므로 ref로 최신값을 본다.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 진행 중이던 작업 복원 (마운트 1회).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      if (cancelled || !draft?.currentLpn) return;
      // 복원을 기다리지 않고 이미 다음 작업에 들어갔다면 덮어쓰지 않는다.
      if (stepRef.current !== 'SELECT_TYPE') return;

      // 촬영분은 Blob으로 보존된다. 객체 URL은 페이지가 새로 뜨면 무효라 다시 만든다.
      const images = (draft.images || []).map((blob) => ({
        url: URL.createObjectURL(blob),
        blob,
      }));

      setInboundType(draft.inboundType as InboundType);
      setIsbn(draft.isbn || '');
      setCurrentLpn(draft.currentLpn);
      setLpnIssuedNow(false); // 복원된 작업의 라벨은 이미 인쇄됐다고 본다 (회수 금지)
      setBookInfo(draft.bookInfo ?? null);
      setCapturedImages(images);
      setStep(draft.step as Step);  // 카메라는 step 변화에 반응하는 위 이펙트가 되살린다
      setResumedDraft({ lpn: draft.currentLpn, shots: images.length });
    })();
    return () => { cancelled = true; };
  }, []);

  // 진행 상태 저장.
  //
  // LPN이 발급된 뒤(= 실물에 라벨이 붙은 뒤)의 단계만 저장한다. 그 앞 단계는 되돌릴
  // 것이 없고, 애매한 중간 상태를 복원하면 오히려 혼란스럽다. 전송 완료 후(RESULT)는
  // 저장 대상이 아니므로 아래 조건에서 자연히 빠진다.
  useEffect(() => {
    if (!currentLpn) return;
    if (step !== 'PRINT_STICKER' && step !== 'VISION_EVALUATION') return;
    saveDraft({
      step,
      inboundType,
      isbn,
      currentLpn,
      bookInfo,
      images: capturedImages.map((i) => i.blob),
    });
  }, [step, inboundType, isbn, currentLpn, bookInfo, capturedImages]);

  /** 이어하기 안내를 닫고 초안을 버린 뒤 처음 화면으로 돌아간다. */
  const discardResumedDraft = () => {
    clearDraft();
    setResumedDraft(null);
    setCapturedImages([]);
    setCurrentLpn('');
    setIsbn('');
    setBookInfo(null);
    setStep('SELECT_TYPE');
  };

  // 실제 바코드(ISBN) 스캐닝 로직 (ZXing Browser)
  const codeReader = useRef<any>(null);

  // 바코드 인식 처리 중복 방지 잠금.
  //
  // 스캔은 두 엔진(ZXing 콜백 + BarcodeDetector rAF 루프)이 동시에 돌고, 화면을
  // SCAN_BARCODE로 되돌아올 때마다 새 세션이 시작된다. 세션 안의 지역 플래그로는
  // 다른 세션의 중복 처리를 막지 못해, 한 번 스캔에 LPN이 여러 개 채번된 적이 있다.
  // ref는 컴포넌트에 하나뿐이라 모든 세션·콜백이 같은 잠금을 공유한다.
  const isHandlingScanRef = useRef(false);

  // --- 오독 방어 ---
  // 스캔 거절 사유를 화면에 띄운다. 아무 반응 없이 계속 스캔만 되면 작업자는
  // "왜 안 잡히지"만 반복하게 되므로, 무엇이 잘못됐는지 그 자리에서 알려준다.
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  // 같은 코드가 두 번 나와야 채택한다. ZXing과 BarcodeDetector가 이미 동시에 돌고 있어
  // 추가 비용 없이 교차 확인이 된다. 광학 오독은 접두어·체크디지트를 통과하더라도
  // 똑같은 값으로 재현되는 일이 드물어, 접두어 검사가 놓친 오독까지 여기서 걸린다.
  // 단, 두 히트 사이에 최소 간격을 둔다 - BarcodeDetector rAF 루프는 연속 프레임
  // (약 16ms 간격)에서 같은 흐린 순간을 두 번 읽을 수 있는데, 그건 독립 확인이 아니라
  // 같은 오독의 반복이다. 간격을 강제하면 손 떨림으로 프레임이 바뀐 뒤의 재확인이 된다.
  const scanCandidateRef = useRef<{ code: string; hits: number; lastHitAt: number } | null>(null);
  const SCAN_CONFIRM_HITS = 2;
  const SCAN_CONFIRM_MIN_GAP_MS = 250;

  useEffect(() => {
    if (step === 'SCAN_BARCODE') {
      // 스캔 화면에 들어올 때만 잠금을 푼다. 직전 스캔 처리가 끝났다는 뜻이다.
      isHandlingScanRef.current = false;
      scanCandidateRef.current = null;
      setScanWarning(null);

      if (!codeReader.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, 
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE // LPN 재촬영을 위해 QR코드 인식 추가
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        // 스캔 시도 간격 기본 500ms → 200ms. 손에 든 폰은 미세하게 흔들려서 초점이
        // 맞는 순간이 짧다 - 시도 빈도를 올려 그 순간을 잡을 확률을 높인다.
        codeReader.current = new ZXingBrowserReader(hints, { delayBetweenScanAttempts: 200 });
      }

      let scanning = true;
      let controlsRef: any = null;
      let timeoutId: NodeJS.Timeout;

      const startScanning = async () => {
        if (!videoRef.current) return;

        // 스캔 결과를 채택할지 판정한다. 통과한 것만 onSuccess로 넘어간다.
        // LPN 재촬영 QR은 ISBN이 아니므로 검증 대상에서 제외한다.
        const gateScan = (text: string): boolean => {
          if (isLpnCode(text)) return true;

          const verdict = validateIsbn13(text);
          if (!verdict.valid) {
            // 거절된 코드는 후보 누적에서도 지운다 - 잘못된 값이 두 번 읽혀 채택되면 안 된다.
            scanCandidateRef.current = null;
            setScanWarning(verdict.message || '바코드를 다시 스캔해 주세요.');
            return false;
          }

          const now = Date.now();
          const prev = scanCandidateRef.current;
          if (prev && prev.code === text) {
            // 같은 프레임 순간의 반복 판독은 세지 않는다 (독립 표본이 아님).
            if (now - prev.lastHitAt < SCAN_CONFIRM_MIN_GAP_MS) return false;
            scanCandidateRef.current = { code: text, hits: prev.hits + 1, lastHitAt: now };
          } else {
            scanCandidateRef.current = { code: text, hits: 1, lastHitAt: now };
          }
          if (scanCandidateRef.current.hits < SCAN_CONFIRM_HITS) {
            setScanWarning('바코드 확인 중… 잠시만 그대로 유지해 주세요.');
            return false;
          }
          setScanWarning(null);
          return true;
        };

        // 스캔 채택 판정 (동기). true를 돌려준 경우에만 잠금·엔진 정지가 끝난 상태다.
        // 판정과 처리를 분리한 이유: 두 엔진(ZXing 콜백 / BarcodeDetector rAF 루프)이
        // "거절이면 계속, 채택이면 정지"를 각자 판단해야 하는데, 비동기 처리 함수의
        // 부수효과(ref)를 들여다보게 하면 그 사이 다른 콜백이 끼어들 틈이 생긴다.
        // 채택 여부를 동기 반환값으로 확정하면 그 틈 자체가 없다.
        const tryAcceptScan = (text: string): boolean => {
          if (!scanning || isHandlingScanRef.current) return false;
          if (!gateScan(text)) return false;
          // 잠금은 비동기 경계 없이 여기서 즉시 건다. 뒤에 비동기 채번이 있어서, 늦게
          // 걸면 남은 세션들이 그 사이에 같은 바코드를 함께 통과시킨다.
          isHandlingScanRef.current = true;
          scanCandidateRef.current = null;
          scanning = false;
          if (controlsRef) {
            controlsRef.stop();
            controlsRef = null;
          }
          return true;
        };

        // 채택 확정된 스캔의 후속 처리. tryAcceptScan이 true일 때만 호출한다.
        const onSuccess = async (text: string) => {

          const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
          audio.play().catch(() => {});

          // --- LPN 재촬영 (Retake) 워크플로우 ---
          if (text.toUpperCase().startsWith('LPN-')) {
            const lpn = text.toUpperCase();
            setCurrentLpn(lpn);
            setIsLoadingBook(true);

            // 원장(서버)이 정본. 실패 시에만 단말 로컬 기록으로 폴백한다 (lookupBookByLpn 주석 참조).
            const existingBook = await lookupBookByLpn(lpn);

            if (existingBook) {
              setIsbn(existingBook.isbn || '');
              setBookInfo(existingBook);
            } else {
              setIsbn('');
              setBookInfo({ title: '정보 없음 (재촬영 진행)', categoryName: 'LPN 재스캔', isRescan: true });
            }

            setIsLoadingBook(false);
            setLpnIssuedNow(false); // 기존 LPN이므로 뒤로가기로 회수하지 않는다
            setStep('PRINT_STICKER');
            return;
          }

          // --- 신규 ISBN 입고 워크플로우 ---
          setIsbn(text);
          if (inboundType === 'NEW_FASTTRACK') {
            // [조장님 기획 지침] 신품 도서는 개별 LPN 라벨 스티커 출력 100% 스킵!
            setCurrentLpn('');
            setLpnIssuedNow(false);
            setBookInfo(null);
            setIsLoadingBook(true);
            setFasttrackQty(1);
            setStep('PRINT_STICKER'); // 하단 패스트트랙 수량 카드 렌더링
            await resolveBookInfo(text, null);
            return;
          }

          // 중고/반품 도서만 개별 LPN 채번 및 스티커 출력.
          // 서버 채번이므로 비동기다. 실패 시 라벨을 만들지 않고 스캔 단계에 머문다.
          setBookInfo(null);
          setIsLoadingBook(true);
          setStep('PRINT_STICKER');
          let issued: IssuedLpn;
          try {
            issued = await issueLPN(text);
            setCurrentLpn(issued.lpn);
            setLpnIssuedNow(true);
          } catch (e: any) {
            alert(e?.message || 'LPN 채번 실패');
            setCurrentLpn('');
            setLpnIssuedNow(false);
            setIsLoadingBook(false);
            setStep('SCAN_BARCODE');
            return;
          }

          await resolveBookInfo(text, issued.book);
        };

        // 1. ZXing Browser 오픈소스 엔진 (최적화)
        try {
          // 반환된 controls를 즉시 보관한다. 콜백 인자로만 받으면 바코드를 한 번도 못 읽고
          // 화면을 벗어났을 때 정리 함수가 세션을 멈추지 못해 세션이 계속 쌓인다.
          const controls = await codeReader.current?.decodeFromVideoElement(videoRef.current, (result: any, error: any, controls: any) => {
            controlsRef = controls;
            if (result && scanning) {
              const text = result.getText();
              if (text && text.length >= 4 && tryAcceptScan(text)) {
                onSuccess(text);
              }
            }
          });
          controlsRef = controlsRef || controls;
          // 대기 중 화면을 벗어났다면 정리 함수는 이미 지나갔다. 직접 멈춘다.
          if (!scanning) {
            controls?.stop();
            controlsRef = null;
          }
        } catch (err) {
          console.warn("ZXing decode error:", err);
        }

        // 2. 최신 브라우저 내장 하드웨어 가속 바코드 디텍터 (병렬 실행)
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'qr_code'] }); 
            
            const detectLoop = async () => {
              if (!scanning || !videoRef.current) return;
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const text = barcodes[0].rawValue;
                  // 채택 확정일 때만 이 엔진 루프를 끝낸다. 종전에는 판독만 되면 무조건
                  // return이라, 검증 게이트에 걸러진 스캔 한 번에 엔진이 영구히 멈췄다 -
                  // "2회 일치"가 붙은 뒤로는 첫 판독이 항상 보류되므로 매번 멈추게 된다.
                  if (text && text.length >= 4 && tryAcceptScan(text)) {
                    onSuccess(text);
                    return;
                  }
                }
              } catch (err) {
                // 무시 (비디오 덜 로딩됨 등)
              }
              if (scanning) {
                requestAnimationFrame(detectLoop);
              }
            };
            
            detectLoop();
          } catch (e) {
            console.warn("BarcodeDetector 병렬 실행 불가:", e);
          }
        }
      };

      // 비디오가 켜지고 약간의 지연 후 스캐닝 시작
      timeoutId = setTimeout(startScanning, 500);

      return () => {
        scanning = false;
        clearTimeout(timeoutId);
        if (controlsRef) {
          controlsRef.stop();
          controlsRef = null;
        }
      };
    }
  }, [step]);

  // 뒤로가기 핸들러 (부착 미완료 시 화면 상태 초기화)
  //
  // 인쇄 전에 되돌아간 LPN은 서버에서 회수(DELETE)한다. 실물에 붙지 않은 번호를 DB에
  // 남기면 유령 LPN이 되고 채번만 밀려 올라간다. 회수분이 그날 마지막 번호였다면 다음
  // 스캔이 같은 번호를 다시 받는다. 인쇄 후에는 회수하지 않는다 - 결번이 정상이다.
  // 유형 선택 화면으로 이탈. 인쇄 전 LPN을 들고 나가면 그대로 유령이 되므로 함께 회수한다.
  const resetToTypeSelect = () => {
    if (lpnIssuedNow && currentLpn) void cancelIssuedLpn(currentLpn);
    setLpnIssuedNow(false);
    setCurrentLpn('');
    setIsbn('');
    setBookInfo(null);
    setStep('SELECT_TYPE');
  };

  const handleBack = () => {
    if (step === 'SCAN_BARCODE') {
      setStep('SELECT_TYPE');
    }
    if (step === 'PRINT_STICKER') {
      if (lpnIssuedNow && currentLpn) void cancelIssuedLpn(currentLpn);
      setLpnIssuedNow(false);
      setCurrentLpn('');
      setIsbn('');
      setBookInfo(null);
      setStep('SCAN_BARCODE');
    }
    if (step === 'VISION_EVALUATION') {
      if (capturedImages.length > 0) {
        setCapturedImages([]);
      } else {
        setStep('PRINT_STICKER');
      }
    }
    if (step === 'RESULT') {
      setStep('SCAN_BARCODE');
      setIsbn('');
      setCurrentLpn('');
      setCapturedImages([]);
      clearDraft();
      setResumedDraft(null);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !guideBoxRef.current) {
      alert("카메라 또는 가이드 영역을 찾을 수 없습니다.");
      return;
    }
    try {
      const result = await processImage(videoRef.current, guideBoxRef.current);
      // 흔들림 판정은 **차단이 아니라 확인**이다. 라플라시안 분산은 피사체 질감에 따라
      // 크게 흔들리는 지표라, 하드 차단으로 두면 선명한 사진인데도 빠져나갈 방법이
      // 없는 상황이 생긴다(실제 발생). 판단은 눈으로 보는 작업자에게 맡긴다.
      if (result.isBlurred) {
        const useAnyway = window.confirm(
          `흔들림이 의심됩니다 (선명도 ${result.blurScore.toFixed(0)}).\n` +
          `[취소] 다시 촬영  /  [확인] 이대로 사용`
        );
        if (!useAnyway) return;
      }


      // 단계 전환은 capturedImages.length에서 파생되므로 별도 갱신이 필요 없다.
      setCapturedImages(prev => [...prev, { url: result.previewUrl, blob: result.blob }]);
    } catch (e) {
      console.error(e);
    }
  };

  // 블루투스 키보드/마우스 원버튼 셔터: 촬영 단계에서 Space/Enter로 takePhoto 트리거.
  // 거치대에 폰을 고정하고 화면을 만지지 않는 촬영 워크스테이션 운용의 전제 기능.
  const isShutterBusyRef = useRef(false);
  useEffect(() => {
    if (step !== 'VISION_EVALUATION') return;

    const onShutterKey = async (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;

      const target = e.target as HTMLElement | null;
      // 입력 필드 타이핑 중이면 무시. 버튼에 포커스가 있으면 브라우저 네이티브 클릭에
      // 맡기고 여기서는 스킵한다 (이중 촬영 방지).
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault(); // Space 스크롤 방지

      if (isShutterBusyRef.current || isAnalyzing) return;
      isShutterBusyRef.current = true;
      try {
        await takePhoto();
      } finally {
        isShutterBusyRef.current = false;
      }
    };

    window.addEventListener('keydown', onShutterKey);
    return () => window.removeEventListener('keydown', onShutterKey);
    // takePhoto가 참조하는 최신 촬영 상태 클로저 유지를 위해 장수를 의존성에 포함
  }, [step, capturedImages.length, isAnalyzing]);

  return (
    /*
      종전에는 이 페이지가 <Header />와 배경 래퍼를 직접 렌더했다
      (/inbound에 layout.tsx가 없었기 때문). 이제 app/inbound/layout.tsx가 역할 적응형
      셸(WORKER=모바일 셸+하단 탭바 / ADMIN=MainLayout)을 제공하므로 헤더·배경·스크롤
      컨테이너는 셸에 위임하고 여기서는 콘텐츠만 렌더한다 (헤더 이중 렌더 방지).
    */
    <div className="space-y-6 pb-10 px-4 sm:px-0 pt-4 max-w-5xl mx-auto font-sans">
      {/*
        1. Top Banner Header (관제 표준 패턴)
        다크 그라데이션 고정 배너가 라이트 모드에서 겉돌아
        admin/inventory 등과 동일한 화이트 카드 + dark: 변형 패턴으로 교체.
      */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4 transition-colors">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-bold font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              INBOUND CONTROL CENTER v2.15.0.1
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">Real-time Vision AI & Fast-track Pipeline</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            현장 입고 & AI 훼손 정밀 검수 관제
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-4xl leading-relaxed">
            신품 도서는 사진 촬영 없이 <strong className="text-indigo-600 dark:text-indigo-300 font-black">ISBN 바코드 스캔만으로 0초 만에 재고 입고</strong>되며, 중고/반품 도서는 <strong className="text-amber-600 dark:text-amber-300 font-black">4-Agent AI 비전 파이프라인</strong>을 통해 훼손 등급과 매입가를 정밀 평가합니다.
          </p>
        </div>

        {/* 파이프라인 설명 텍스트 종료 후 하단 컨트롤 배치 구역 */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200">
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              📍 배정 라인:
            </span>
            <select
              value={activeStation}
              onChange={(e) => handleStationChange(e.target.value)}
              className="bg-transparent text-emerald-700 dark:text-emerald-300 font-black px-1.5 py-1 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs"
            >
              <option value="A" className="dark:bg-gray-800">Line A (Workstation A - 메인 입고 라인)</option>
              <option value="B" className="dark:bg-gray-800">Line B (Workstation B)</option>
              <option value="C" className="dark:bg-gray-800">Line C (Workstation C)</option>
              <option value="D" className="dark:bg-gray-800">Line D (Workstation D)</option>
              <option value="E" className="dark:bg-gray-800">Line E (Workstation E)</option>
            </select>
          </div>

          <button
            onClick={resetToTypeSelect}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCcw className="w-4 h-4" />
            검수 유형 재선택
          </button>
        </div>
      </div>

      {/* 2. Main Scanner App Container (Expanded PC/Mobile Responsive Viewport) */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-900 min-h-[640px] rounded-3xl overflow-hidden relative flex flex-col shadow-xl border-4 border-slate-200 dark:border-slate-800 transition-all duration-300">
        
        {/* CSS for Scanner Laser Animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scan {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .animate-scan-laser { animation: scan 2.5s infinite linear; }
          
          @keyframes print {
            0% { transform: translateY(-100%); opacity: 0; }
            50% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .animate-print { animation: print 1.5s ease-out forwards; }
        `}} />

        {/* Header */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 flex items-center justify-between z-20 absolute top-0 w-full text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center">
            {/* 한 단계 뒤로. 유형 화면으로 한 번에 나가려면 상단 '검수 유형 재선택'을 쓴다.
                이 버튼이 handleBack을 거쳐야 미인쇄 LPN 회수·촬영분 정리가 수행된다. */}
            {step !== 'SELECT_TYPE' && (
              <button onClick={handleBack} className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <h1 className="text-base sm:text-lg font-extrabold flex items-center tracking-tight">
              {step === 'SELECT_TYPE' && <><Package className="w-5 h-5 mr-2 text-indigo-400" /> 입고 검수 유형 선택</>}
              {step === 'SCAN_BARCODE' && <><ScanLine className="w-5 h-5 mr-2 text-emerald-400" /> {inboundType === 'NEW_FASTTRACK' ? '신품 도서 ISBN 스캔 (0초 입고)' : '도서 바코드 식별'}</>}
              {step === 'PRINT_STICKER' && <><Printer className="w-5 h-5 mr-2 text-blue-400" /> 검열지 출력 및 부착</>}
              {step === 'VISION_EVALUATION' && <><Camera className="w-5 h-5 mr-2 text-purple-400" /> 외관 촬영 및 평가</>}
              {step === 'RESULT' && <><CheckCircle2 className="w-5 h-5 mr-2 text-emerald-400" /> 입고 처리 완료</>}
            </h1>
          </div>
        </div>

        {/*
          이어하기 안내. 화면이 꺼졌다 켜지거나 새로고침으로 페이지가 새로 뜬 뒤
          직전 작업을 되살렸을 때만 나타난다. 작업자가 "왜 이 화면부터 시작하지?"라고
          의심하지 않도록 복원 사실과 근거(LPN·촬영 장수)를 명시하고, 잘못 되살아난
          경우를 위해 새로 시작할 출구를 함께 둔다.
        */}
        {resumedDraft && (
          <div className="absolute top-16 w-full z-30 px-3 pt-2 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-amber-50 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg backdrop-blur-sm">
              <RefreshCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-black text-amber-900 dark:text-amber-200">이전 작업을 이어서 진행합니다</p>
                <p className="text-[11px] font-mono text-amber-800/80 dark:text-amber-300/80 truncate">
                  {resumedDraft.lpn} · 촬영 {resumedDraft.shots}장 복원됨
                </p>
              </div>
              <button
                onClick={() => setResumedDraft(null)}
                className="text-[11px] font-bold text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 shrink-0 cursor-pointer"
              >
                확인
              </button>
              <button
                onClick={discardResumedDraft}
                className="text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg shrink-0 cursor-pointer"
              >
                새로 시작
              </button>
            </div>
          </div>
        )}

        {/* Simulated Viewport / Content Area (Light/Dark Glassmorphism Compatible) */}
        <div className="flex-1 relative bg-gradient-to-br from-slate-100 via-white to-indigo-100/70 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/80 border-b border-gray-200 dark:border-slate-800 flex items-center justify-center overflow-hidden pt-16 min-h-[480px] transition-colors">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute inset-0 opacity-0 dark:opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-slate-700 to-black z-0"></div>

          {step === 'SELECT_TYPE' && (
            <div className="z-10 p-6 space-y-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">📋 입고 검수 유형 선택</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">현장 상황 및 도서 상태에 맞는 입고 프로세스를 선택해 주세요.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Card 1: Fast-track New Book Inbound (Skip Photo 100%) */}
                <button
                  onClick={() => {
                    setInboundType('NEW_FASTTRACK');
                    setStep('SCAN_BARCODE');
                  }}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-indigo-950/90 dark:via-slate-900 dark:to-slate-950 border-2 border-indigo-200 dark:border-indigo-500/60 hover:border-indigo-500 dark:hover:border-indigo-400 text-left transition-all hover:scale-[1.02] shadow-lg dark:shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-indigo-500 text-white px-3 py-1 rounded-full animate-pulse shadow-md">0초 고속 입고</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    ⚡ 신품 도서 (ISBN 바코드 고속 입고)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    사진 촬영 과정을 <strong>100% 스킵</strong>하고, 바코드 스캔 즉시 알라딘 도서 정보를 연동하여 <strong>0초 만에 바로 재고 입고 확정</strong>합니다.
                  </p>
                </button>

                {/* Card 2: Used / Returned Book AI Inspection */}
                <button
                  onClick={() => {
                    setInboundType('USED_RETURN_INSPECTION');
                    setStep('SCAN_BARCODE');
                  }}
                  className="p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-amber-950/90 dark:via-slate-900 dark:to-slate-950 border-2 border-amber-200 dark:border-amber-500/60 hover:border-amber-500 dark:hover:border-amber-400 text-left transition-all hover:scale-[1.02] shadow-lg dark:shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-amber-500 text-slate-950 px-3 py-1 rounded-full shadow-md">AI 훼손 정밀 검수</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                    🔍 중고 / 반품 도서 (AI 정밀 검수)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    표지 및 속지 카메라 촬영 후 <strong>4-Agent AI 비전 파이프라인(YOLOv8)</strong>으로 훼손 등급 및 매입/반품가를 정밀 평가합니다.
                  </p>
                </button>
              </div>
            </div>
          )}
        <div className="absolute inset-0 opacity-0 dark:opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-600 to-black z-0"></div>
        
        {(step === 'SCAN_BARCODE' || step === 'VISION_EVALUATION') && (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        
        {step === 'SCAN_BARCODE' && (
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 z-10">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_3px_rgba(16,185,129,0.7)] animate-scan-laser z-10 w-full"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 dark:text-white/40 text-sm font-semibold tracking-wider text-center">도서 뒷면의 ISBN<br/>또는 재촬영 LPN QR 스캔</span>
            </div>
            {/* 오독 거절 안내. 아무 반응이 없으면 작업자는 원인을 모른 채 스캔만 반복한다. */}
            {scanWarning && (
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[19rem] max-w-[88vw] px-4 py-3 rounded-xl bg-amber-500/95 text-white text-xs font-bold text-center leading-relaxed shadow-lg z-20">
                {scanWarning}
              </div>
            )}
          </div>
        )}

        {step === 'PRINT_STICKER' && (
          <div className="relative z-10 flex flex-col items-center">
            {inboundType === 'NEW_FASTTRACK' ? (
              <div className="bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/30 p-8 rounded-3xl text-center space-y-4 shadow-xl dark:shadow-2xl max-w-md animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-transform">
                  <Zap className="w-9 h-9 text-yellow-300 fill-yellow-300 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">⚡ 신품 도서 Fast-track 입고</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-medium">
                    사진 촬영 및 개별 LPN 발급을 <strong className="text-emerald-600 dark:text-emerald-400">100% 생략</strong>하고<br/>수량 확인 후 즉시 재고로 편입됩니다.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-500/40 px-4 py-1.5 rounded-full text-xs font-mono font-bold text-indigo-700 dark:text-indigo-200 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>ISBN: {isbn}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-48 h-12 bg-slate-200 dark:bg-slate-800 border-b-4 border-slate-300 dark:border-slate-700 rounded-t-xl z-20 flex items-center justify-center mb-1">
                  <span className="text-slate-600 dark:text-slate-400 text-xs font-bold">라벨 프린터 (연동됨)</span>
                </div>
                {/* 50x31mm(가로형) 라벨 렌더링 */}
                <div className="relative z-10 animate-print shadow-2xl bg-white border border-gray-300 transform scale-[1.7] origin-top mb-20 mt-4 rounded-sm">
                  <LpnPrintLabel data={{
                    lpn_barcode: currentLpn,
                    book: {
                      title: bookInfo?.title || '미등록 도서',
                      author: bookInfo?.author || '-',
                      isbn: isbn || '-'
                    },
                    worker_id: user?.name ? `${user.employeeId} (${user.name})` : 'WM2608001 (최초관리자)'
                  }} />
                </div>
              </>
            )}
          </div>
        )}

        {step === 'VISION_EVALUATION' && (
          <div className="absolute inset-0 w-full h-full z-10">
            {/* 오버레이 및 뷰파인더 가이드 */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none pb-2 pt-12">
              {/* 바깥 영역을 어둡게 처리하기 위한 그림자 꼼수 */}
              {/* 가이드박스 크기는 촬영 단계마다 다르다. processImage()가 이 박스 영역만
                  도려내므로, 책등처럼 좁고 긴 피사체를 표지용 박스로 찍으면 배경이 대부분을
                  차지해 결함이 상대적으로 작아진다. */}
              <div
                ref={guideBoxRef}
                className={`relative ${currentShot.guideClass} max-h-[90%] border-4 border-dashed border-white/60 rounded-3xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]`}
              >
                
                {/* 십자선 */}
                <div className="absolute w-8 h-1 bg-white/40 rounded-full"></div>
                <div className="absolute w-1 h-8 bg-white/40 rounded-full"></div>

                {/* 툴팁 버블 */}
                <div className="absolute -top-12 bg-gray-800/80 backdrop-blur-sm text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg text-center whitespace-nowrap">
                  {currentShot.tip}
                </div>

                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-20">
                    <RefreshCcw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                    <span className="text-emerald-400 font-bold animate-pulse text-xl drop-shadow-lg shadow-black">AI 렌즈 판독 중...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 화면 안 셔터.
                카드 하단의 촬영 버튼은 한 손으로 폰을 들고 책을 잡은 자세에서 엄지가
                닿지 않는다. 프리뷰 위에 큰 원형 셔터를 겹쳐 두어 손을 옮기지 않고 찍는다.
                (썸네일 갤러리보다 위에 배치해 서로 가리지 않게 한다.) */}
            <button
              type="button"
              onClick={takePhoto}
              disabled={isAnalyzing}
              aria-label="사진 촬영"
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-20 h-20 rounded-full bg-white/95 disabled:bg-white/40 shadow-2xl ring-4 ring-white/40 active:scale-90 transition-transform flex flex-col items-center justify-center cursor-pointer"
            >
              <Camera className="w-7 h-7 text-slate-900" />
              <span className="text-[10px] font-black text-slate-900 mt-0.5">{capturedImages.length}장</span>
            </button>

            {/* 썸네일 갤러리 */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex space-x-2 overflow-x-auto pb-2">
              {capturedImages.map((img, idx) => (
                <div key={idx} className="w-14 h-20 bg-slate-800 rounded-lg border-2 border-emerald-500 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                  <span className="absolute top-1 text-[10px] font-bold text-white z-10 drop-shadow-md bg-black/40 px-1 rounded">{shotLabel(idx)}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="capture" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-white/10 pointer-events-none"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="relative z-10 bg-white p-8 rounded-2xl flex flex-col items-center animate-in zoom-in-95 shadow-xl w-72 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="bg-gray-100 px-3 py-1 rounded mb-2 border border-gray-200">
              <span className="text-xs font-mono font-bold text-gray-600 tracking-wider">{currentLpn}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              {bookInfo?.title || '미등록 도서'}
            </h2>
            <div className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mb-5 shadow-sm">
              <span className="text-emerald-700 font-extrabold">AI 검수 큐 등록 완료</span>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              AI 판독 에이전트가 검수를 시작했습니다.<br/>다음 도서 스캔을 진행하세요.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Bottom Control Panel (Light & Dark Mode Full Compatibility) */}
      {step !== 'SELECT_TYPE' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 z-20 shadow-2xl border border-slate-200 dark:border-slate-800 min-h-[180px] flex flex-col justify-end animate-in slide-in-from-bottom-4 duration-200">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto absolute top-3 left-1/2 -translate-x-1/2"></div>
        
        {step === 'SCAN_BARCODE' && (
          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">도서 식별</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ISBN 또는 LPN (재촬영) 수동 입력"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                /* min-w-0: flex 자식의 기본 min-width는 auto라 내용 폭 아래로 줄지 않는다.
                   이게 없으면 좁은 화면에서 입력창이 버튼을 밀어 버튼 글자가 세로로 접힌다. */
                className="flex-1 min-w-0 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
              />
              <button 
                onClick={async () => {
                  const inputVal = isbn.trim();
                  if (!inputVal || inputVal.length < 4) {
                    alert('유효한 바코드를 입력해주세요.');
                    return;
                  }
                  
                  // LPN 재촬영 모드 전환
                  if (inputVal.toUpperCase().startsWith('LPN-')) {
                    const lpn = inputVal.toUpperCase();
                    setCurrentLpn(lpn);
                    setIsLoadingBook(true);

                    // 스캐너 경로와 동일하게 원장(서버) 우선 조회 (lookupBookByLpn 주석 참조).
                    const existingBook = await lookupBookByLpn(lpn);

                    if (existingBook) {
                      setIsbn(existingBook.isbn || '');
                      setBookInfo(existingBook);
                    } else {
                      setIsbn('');
                      setBookInfo({ title: '정보 없음 (재촬영 진행)', categoryName: 'LPN 재스캔', isRescan: true });
                    }

                    setIsLoadingBook(false);
                    setLpnIssuedNow(false); // 기존 LPN이므로 뒤로가기로 회수하지 않는다
                    setStep('PRINT_STICKER');
                    return;
                  }

                  // 신규 입고 모드
                  setIsbn(inputVal);
                  if (inboundType === 'NEW_FASTTRACK') {
                    setCurrentLpn('');
                    setLpnIssuedNow(false);
                    setBookInfo(null);
                    setIsLoadingBook(true);
                    setFasttrackQty(1);
                    setStep('PRINT_STICKER');
                    await resolveBookInfo(inputVal, null);
                    return;
                  }

                  setBookInfo(null);
                  setIsLoadingBook(true);
                  setStep('PRINT_STICKER');
                  let issued: IssuedLpn;
                  try {
                    issued = await issueLPN(inputVal);
                    setCurrentLpn(issued.lpn);
                    setLpnIssuedNow(true);
                  } catch (e: any) {
                    alert(e?.message || 'LPN 채번 실패');
                    setCurrentLpn('');
                    setLpnIssuedNow(false);
                    setIsLoadingBook(false);
                    setStep('SCAN_BARCODE');
                    return;
                  }

                  await resolveBookInfo(inputVal, issued.book);
                }}
                /* shrink-0 + whitespace-nowrap: 버튼이 글자 폭 아래로 눌리면 '조 회'로 접힌다 */
                className="shrink-0 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-1.5"
              >
                <ScanLine className="w-4 h-4" />
                조회
              </button>
            </div>
          </div>
        )}

        {step === 'PRINT_STICKER' && (
          <div className="space-y-4 pt-4 animate-in slide-in-from-right-4">
            <div className="bg-slate-50 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 mb-2 shadow-inner transition-colors">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">인식된 도서 정보 (ISBN: {isbn})</p>
              
              {isLoadingBook ? (
                <div className="flex items-center space-x-2 py-2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">알라딘 API 정보 불러오는 중...</span>
                </div>
              ) : bookInfo?.title ? (
                <div className="flex gap-3 items-start">
                  <BookCover
                    src={bookInfo?.imageUrl}
                    title={bookInfo?.title || '입고 도서'}
                    author={bookInfo?.author || ''}
                    isbn={isbn}
                    className="w-16 h-24"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-0.5 truncate">{bookInfo.categoryName?.split('>').pop()}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">{bookInfo.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{bookInfo.author} | {bookInfo.publisher}</p>
                    {bookInfo.price && <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">{bookInfo.price.toLocaleString()}원</p>}
                    {bookInfo.description && (
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                        {bookInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="font-bold text-gray-800 dark:text-gray-100">{bookInfo?.title || '미등록 도서'}</p>
              )}

              {inboundType === 'NEW_FASTTRACK' ? (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">⚡ 입고 수량 (수량 기입 가능)</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFasttrackQty(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-slate-800 dark:text-slate-100 text-base flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={fasttrackQty}
                      onChange={(e) => setFasttrackQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-8 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg text-center font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFasttrackQty(prev => prev + 1)}
                      className="w-8 h-8 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 font-bold text-indigo-700 dark:text-indigo-300 text-base flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">발급 예정 LPN</span>
                  <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">{currentLpn}</span>
                </div>
              )}
            </div>

            {inboundType === 'NEW_FASTTRACK' ? (
              <button 
                onClick={async () => {
                  try {
                    setIsAnalyzing(true);
                    const res = await fetch(`${API_BASE_URL}/api/v1/inbound/fasttrack`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        isbn: isbn,
                        title: bookInfo?.title || '신품 도서',
                        imageUrl: bookInfo?.imageUrl || '',
                        qty: fasttrackQty,
                        // 신품 입고 작업자. 이 값이 있어야 "나의 검수 내역"이 신품 입고분을
                        // 걸러낼 수 있다 (중고 /evaluate의 worker_id와 같은 역할).
                        worker_id: user?.employeeId || null
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      alert(data.message || `⚡ [신품 패스트트랙] '${bookInfo?.title || '신품 도서'}' ${fasttrackQty}권이 재고로 즉시 입고되었습니다!`);
                      // 결과 초기화 및 다음 스캔 준비
                      setStep('SCAN_BARCODE');
                      setIsbn('');
                      setBookInfo(null);
                      setFasttrackQty(1);
                    } else {
                      alert('패스트트랙 입고 처리 실패');
                    }
                  } catch (e) {
                    alert('패스트트랙 서버 통신 에러');
                  } finally {
                    setIsAnalyzing(false);
                  }
                }}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all text-base"
              >
                <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
                <span>⚡ 신품 도서 Fast-track 입고 완료 ({fasttrackQty}권)</span>
              </button>
            ) : bookInfo?.isRescan ? (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    // 시스템 설정에서 자동 인쇄를 끈 경우 프린터 전송 없이 바로 촬영 단계로
                    if (!getSystemSettings().autoPrintTrigger) {
                      setStep('VISION_EVALUATION');
                      return;
                    }
                    setIsPrinting(true);
                    try {
                      const result = await labelsAPI.printLpn(
                        currentLpn,
                        bookInfo?.title,
                        isbn,
                        user?.name ? `${user.employeeId} (${user.name})` : undefined
                      );
                      if (result.skipped) {
                        alert("라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).");
                      } else if (!result.sent && !result.queued) {
                        alert("라벨 전송에 실패했습니다.");
                      }
                    } catch (e) {
                      console.error(e);
                      alert("라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.");
                    } finally {
                      setIsPrinting(false);
                      setStep('VISION_EVALUATION');
                    }
                  }}
                  disabled={isPrinting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  <span>스티커 재출력 & 촬영</span>
                </button>
                <button 
                  onClick={() => setStep('VISION_EVALUATION')}
                  className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-purple-200 dark:shadow-none"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  기존 라벨지 유지 및 재촬영 진행
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  // 촬영 단계로 넘어가면 그 LPN은 사용 확정이다. 이후 뒤로가기로 회수하지 않는다.
                  setLpnIssuedNow(false);
                  // 시스템 설정에서 자동 인쇄를 끈 경우 프린터 전송 없이 바로 촬영 단계로
                  if (!getSystemSettings().autoPrintTrigger) {
                    setStep('VISION_EVALUATION');
                    return;
                  }
                  setIsPrinting(true);
                  try {
                    const result = await labelsAPI.printLpn(
                      currentLpn,
                      bookInfo?.title,
                      isbn,
                      user?.name ? `${user.employeeId} (${user.name})` : undefined
                    );
                    if (result.skipped) {
                      alert("라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).");
                    } else if (!result.sent && !result.queued) {
                      alert("라벨 전송에 실패했습니다.");
                    }
                  } catch (e) {
                    console.error(e);
                    alert("라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.");
                  } finally {
                    setIsPrinting(false);
                    setStep('VISION_EVALUATION');
                  }
                }}
                disabled={isPrinting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-200 dark:shadow-none"
              >
                {isPrinting ? <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> : <Printer className="w-5 h-5 mr-2" />}
                {isPrinting ? '라벨 출력 중...' : '검열지 프린트 및 부착 완료'}
              </button>
            )}
          </div>
        )}

        {step === 'VISION_EVALUATION' && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-right-4">
            <p className="text-center text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">
              {TRACK1_SHOTS.map((s) => s.short).join(' · ')} 필수 {TRACK1_IMAGE_COUNT}장 + 훼손 부위 N장
            </p>
            {/* 남은 필수 컷을 명시한다. 버튼만 비활성화해 두면 왜 못 넘어가는지 알 수 없다. */}
            {capturedImages.length < TRACK1_IMAGE_COUNT && (
              <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400 -mt-1 mb-1">
                남은 필수 촬영: {TRACK1_SHOTS.slice(capturedImages.length).map((s) => s.short).join(', ')}
              </p>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={takePhoto}
                disabled={isAnalyzing}
                className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all shadow-lg"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span>사진 촬영 ({capturedImages.length}장)</span>
                <span className="text-[10px] font-medium opacity-70 mt-0.5">화면 셔터 · Space/Enter</span>
              </button>

              <button 
                onClick={() => {
                  if (capturedImages.length < TRACK1_IMAGE_COUNT) {
                    const missing = TRACK1_SHOTS.slice(capturedImages.length).map((s) => s.short).join(', ');
                    alert(`필수 ${TRACK1_IMAGE_COUNT}장이 필요합니다. 남은 촬영: ${missing}`);
                    return;
                  }
                  
                  // 전송 경로는 이 mutation 하나뿐이다. 큐 적재도 mutation이 담당한다.
                  evaluateMutation.mutate({
                    lpn: currentLpn,
                    images: capturedImages.map(img => img.blob),
                    previewUrl: capturedImages[0].url,
                    book_metadata: bookInfo
                  });
                }}
                disabled={evaluateMutation.isPending || capturedImages.length < TRACK1_IMAGE_COUNT}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all shadow-lg shadow-purple-200"
              >
                <CheckCircle2 className="w-6 h-6 mb-1" />
                <span>촬영 완료 (AI 전송)</span>
              </button>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="pt-4 animate-in fade-in">
            <button 
              onClick={() => {
                setStep('SCAN_BARCODE');
                setIsbn('');
                setIsPrinting(false);
                setIsAnalyzing(false);
                setCapturedImages([]);
                clearDraft();
                setResumedDraft(null);
              }}
              className="w-full bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-gray-300 dark:shadow-none"
            >
              <RefreshCcw className="w-5 h-5 mr-2" />
              다음 도서 스캔하기
            </button>
          </div>
        )}
      </div>
      )}
      
      {/* 작업 진행 현황 패널 (비동기 큐 모니터링) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 mx-2 sm:mx-0 transition-all">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm shrink-0">작업 진행 현황</h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {finishedCount > 0 && (
              <button
                onClick={clearFinishedTasks}
                className="text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                완료 기록 지우기 ({finishedCount})
              </button>
            )}
            <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              대기 {inFlightCount}건
            </span>
          </div>
        </div>

        {visibleQueue.length === 0 ? (
          <div className="py-6 flex justify-center items-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">아직 촬영된 도서가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQueue.map(item => {
              const isInFlight = item.status === 'UPLOADING' || item.status === 'ANALYZING';
              return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${
                  item.status === 'COMPLETED'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
                    : item.status === 'FAILED'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3 w-1/2">
                  {isInFlight ? (
                    <RefreshCcw className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
                  ) : item.status === 'FAILED' ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{item.title}</p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{item.lpn}</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-end justify-center">
                  {isInFlight ? (
                    <div className="w-full max-w-[120px] text-right">
                      <div className="flex justify-between text-[10px] text-indigo-600 dark:text-indigo-300 font-bold mb-1">
                        <span className="truncate pr-1">{item.message || '대기 중...'}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="w-full bg-indigo-100 dark:bg-indigo-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap ${
                          item.status === 'FAILED'
                            ? 'text-red-700 dark:text-red-300 bg-red-200 dark:bg-red-900'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-900'
                        }`}>
                          {item.status === 'FAILED' ? '실패' : item.grade}
                        </span>
                        {item.message && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right max-w-[120px] truncate" title={item.message}>{item.message}</span>}
                      </div>
                      <button
                        onClick={() => reprintLpnLabel(item.lpn, item.title)}
                        disabled={reprintingLpn === item.lpn}
                        title="LPN 라벨 재출력"
                        className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {reprintingLpn === item.lpn
                          ? <RefreshCcw className="w-4 h-4 animate-spin" />
                          : <Printer className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
