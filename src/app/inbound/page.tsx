'use client';
import { API_BASE_URL } from '@/lib/api-client';

import { useState, useEffect, useRef } from 'react';
import BookCover from '@/components/BookCover';
import { useMutation } from '@tanstack/react-query';
import { Camera, Flashlight, RefreshCcw, Keyboard, Package, CheckCircle2, AlertTriangle, ScanLine, Printer, ArrowRight, BookOpen, ChevronLeft, User, Zap } from 'lucide-react';
import { labelsAPI } from '@/lib/api';
import { useCamera } from '@/features/inbound/hooks/useCamera';
import { processImage } from '@/lib/image-processor';
import { useAtomValue, useSetAtom } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { getSystemSettings } from '@/lib/systemSettings';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { BrowserMultiFormatReader as ZXingBrowserReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel } from '@/features/inbound/components/LpnPrintLabel';
import { TRACK1_IMAGE_COUNT, TRACK1_SHOTS, shotAt, shotLabel } from '@/features/inbound/captureSequence';

type Step = 'SELECT_TYPE' | 'SCAN_BARCODE' | 'PRINT_STICKER' | 'VISION_EVALUATION' | 'RESULT';
type InboundType = 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';

export default function InboundScannerPage() {
  const [step, setStep] = useState<Step>('SELECT_TYPE');
  const [inboundType, setInboundType] = useState<InboundType>('NEW_FASTTRACK');
  const [isbn, setIsbn] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentLpn, setCurrentLpn] = useState('');
  const [bookInfo, setBookInfo] = useState<any | null>(null);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [fasttrackQty, setFasttrackQty] = useState<number>(1);
  const [activeStation, setActiveStation] = useState<string>('A');

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

  // 정상 완료 건은 5초 뒤 이 목록에서만 감춘다(집계에는 남는다).
  const visibleQueue = uploadQueue.filter(t => !t.autoHidden);
  const inFlightCount = uploadQueue.filter(t => t.status === 'UPLOADING' || t.status === 'ANALYZING').length;

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
  const issueLPN = async (isbnValue: string): Promise<string> => {
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
      throw new Error(detail?.detail || 'LPN 채번에 실패했습니다. 네트워크를 확인하세요.');
    }
    const json = await res.json();
    if (!json?.lpn_barcode) throw new Error('서버가 LPN을 반환하지 않았습니다.');
    return json.lpn_barcode;
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

      const res = await fetch(`${API_BASE_URL}/api/v1/inbound/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: data.lpn, images: base64Images, book_metadata: data.book_metadata })
      });
      if (!res.ok) throw new Error("Evaluation failed");
      return res.json();
    },
    onMutate: async (newEvaluation) => {
      // 임시 ID(tempJobId)로 큐에 먼저 자리를 잡아 두고, 화면은 곧바로 다음 단계로 넘긴다.
      // 상태는 '전송 중'이며, 완료로 바뀌는 시점은 서버 응답·SSE가 결정한다.
      const tempJobId = `temp-${Date.now()}`;
      setUploadQueue(prev => [...prev, {
        id: tempJobId,
        lpn: newEvaluation.lpn,
        title: newEvaluation.book_metadata?.title || '미등록 도서',
        previewUrl: newEvaluation.previewUrl,
        status: 'UPLOADING',
        progress: 0,
        message: '전송 중...',
        timestamp: Date.now()
      }]);

      // 카메라 뷰파인더 닫고, 즉시(0.001초만에) 다음 화면(RESULT)으로 전환하여 체감속도 극대화
      setStep('RESULT');
      return { tempJobId };
    },
    onSuccess: (data, variables, context) => {
      // 2. 서버 통신이 '진짜로' 성공하면, 서버가 발급한 진짜 Job ID를 받아옴
      const { job_id, lpn } = data;

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

        // 완료된 건 중 S/A 등급(정상)은 5초 뒤 현장 촬영 화면 목록에서만 감춘다.
        // 큐에서 지우지는 않는다 — Header·대시보드의 세션 집계가 근거를 잃는다.
        // 반려나 예외 상황은 사용자가 직접 확인할 수 있게 계속 남는다.
        if (grade.includes('S') || grade.includes('A') || grade.includes('NORMAL') || grade.includes('MINT')) {
          setTimeout(() => {
            setUploadQueue(prev => prev.map(q => q.id === job_id ? { ...q, autoHidden: true } : q));
          }, 5000);
        }
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

  // 실제 바코드(ISBN) 스캐닝 로직 (ZXing Browser)
  const codeReader = useRef<any>(null);

  // 바코드 인식 처리 중복 방지 잠금.
  //
  // 스캔은 두 엔진(ZXing 콜백 + BarcodeDetector rAF 루프)이 동시에 돌고, 화면을
  // SCAN_BARCODE로 되돌아올 때마다 새 세션이 시작된다. 세션 안의 지역 플래그로는
  // 다른 세션의 중복 처리를 막지 못해, 한 번 스캔에 LPN이 여러 개 채번된 적이 있다.
  // ref는 컴포넌트에 하나뿐이라 모든 세션·콜백이 같은 잠금을 공유한다.
  const isHandlingScanRef = useRef(false);

  useEffect(() => {
    if (step === 'SCAN_BARCODE') {
      // 스캔 화면에 들어올 때만 잠금을 푼다. 직전 스캔 처리가 끝났다는 뜻이다.
      isHandlingScanRef.current = false;

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
        codeReader.current = new ZXingBrowserReader(hints);
      }

      let scanning = true;
      let controlsRef: any = null;
      let timeoutId: NodeJS.Timeout;

      const startScanning = async () => {
        if (!videoRef.current) return;

        const onSuccess = async (text: string) => {
          if (!scanning || isHandlingScanRef.current) return;
          // 잠금은 await 이전에 동기적으로 건다. 뒤에 비동기 채번이 있어서, 여기서
          // 양보하면 남은 세션들이 그 사이에 같은 바코드를 함께 통과시킨다.
          isHandlingScanRef.current = true;
          scanning = false;
          if (controlsRef) {
            controlsRef.stop();
            controlsRef = null;
          }

          const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
          audio.play().catch(() => {});

          // --- LPN 재촬영 (Retake) 워크플로우 ---
          if (text.toUpperCase().startsWith('LPN-')) {
            const lpn = text.toUpperCase();
            setCurrentLpn(lpn);
            
            // 로컬 스토리지에서 기존 도서 정보 조회 (가장 최신 데이터를 가져오기 위해 뒤에서부터 검색)
            const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
            const existingBook = [...localEvals].reverse().find((e: any) => e.lpn === lpn);
            
            if (existingBook) {
              setIsbn(existingBook.isbn || '');
              setBookInfo({
                isbn: existingBook.isbn,
                title: existingBook.title,
                author: existingBook.author,
                publisher: existingBook.publisher,
                categoryName: existingBook.category,
                isRescan: true
              });
            } else {
              setIsbn('');
              setBookInfo({ title: '정보 없음 (재촬영 진행)', categoryName: 'LPN 재스캔', isRescan: true });
            }
            
            setIsLoadingBook(false);
            setStep('PRINT_STICKER');
            return;
          }

          // --- 신규 ISBN 입고 워크플로우 ---
          setIsbn(text);
          if (inboundType === 'NEW_FASTTRACK') {
            // [조장님 기획 지침] 신품 도서는 개별 LPN 라벨 스티커 출력 100% 스킵!
            setCurrentLpn('');
            setBookInfo(null);
            setIsLoadingBook(true);
            setFasttrackQty(1);
            setStep('PRINT_STICKER'); // 하단 패스트트랙 수량 카드 렌더링
          } else {
            // 중고/반품 도서만 개별 LPN 채번 및 스티커 출력.
            // 서버 채번이므로 비동기다. 실패 시 라벨을 만들지 않고 스캔 단계에 머문다.
            setBookInfo(null);
            setIsLoadingBook(true);
            setStep('PRINT_STICKER');
            try {
              setCurrentLpn(await issueLPN(text));
            } catch (e: any) {
              alert(e?.message || 'LPN 채번 실패');
              setCurrentLpn('');
              setIsLoadingBook(false);
              setStep('SCAN_BARCODE');
              return;
            }
          }

          // 백그라운드에서 알라딘 API 연동 도서 정보 조회
          try {
            const res = await fetch(`${API_BASE_URL}/api/v1/inbound/book-lookup?isbn=${text}`);
            if (res.ok) {
              const data = await res.json();
              setBookInfo(data);
            } else {
              // isbn을 반드시 함께 넘긴다 - 없으면 이후 evaluate 요청의 book_metadata에서
              // isbn이 빠져 서버가 Book row를 만들지 못하고 500(book_id NOT NULL)을 낸다.
              setBookInfo({ title: '도서 정보 조회 실패 (API 키 확인 필요)', isbn: text });
            }
          } catch (e) {
            setBookInfo({ title: '도서 정보 조회 에러', isbn: text });
          } finally {
            setIsLoadingBook(false);
          }
        };

        // 1. ZXing Browser 오픈소스 엔진 (최적화)
        try {
          // 반환된 controls를 즉시 보관한다. 콜백 인자로만 받으면 바코드를 한 번도 못 읽고
          // 화면을 벗어났을 때 정리 함수가 세션을 멈추지 못해 세션이 계속 쌓인다.
          const controls = await codeReader.current?.decodeFromVideoElement(videoRef.current, (result: any, error: any, controls: any) => {
            controlsRef = controls;
            if (result && scanning) {
              const text = result.getText();
              if (text && text.length >= 4) {
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
                  if (text && text.length >= 4) {
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
  // [2026-08-06 수정] 종전에는 localStorage 카운터를 1 되돌려 번호를 재사용했다.
  // 서버 채번으로 이관하면서 이 롤백은 제거한다. 발급된 LPN은 이미 DB에 선부착
  // 등록(PENDING_INSPECTION)되어 있으므로, 되돌려 재사용하면 서로 다른 실물이 같은
  // 번호를 갖게 된다. **결번은 정상이다** — 폐기된 라벨 번호를 재사용하면 추적성이 깨진다.
  const handleBack = () => {
    if (step === 'PRINT_STICKER') {
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
      [수정 이력 2026-08-06] 종전에는 이 페이지가 <Header />와 배경 래퍼를 직접 렌더했다
      (/inbound에 layout.tsx가 없었기 때문). 이제 app/inbound/layout.tsx가 역할 적응형
      셸(WORKER=모바일 셸+하단 탭바 / ADMIN=MainLayout)을 제공하므로 헤더·배경·스크롤
      컨테이너는 셸에 위임하고 여기서는 콘텐츠만 렌더한다 (헤더 이중 렌더 방지).
    */
    <div className="space-y-6 pb-10 px-4 sm:px-0 pt-4 max-w-5xl mx-auto font-sans">
      {/*
        1. Top Banner Header (관제 표준 패턴)
        [수정 이력 2026-08-04] 다크 그라데이션 고정 배너가 라이트 모드에서 겉돌아
        admin/inventory 등과 동일한 화이트 카드 + dark: 변형 패턴으로 교체.
      */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4 transition-colors">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-bold font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              INBOUND CONTROL CENTER v2.14.0.0
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
            onClick={() => setStep('SELECT_TYPE')}
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
            {step !== 'SELECT_TYPE' && (
              <button onClick={() => setStep('SELECT_TYPE')} className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
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
                    
                    const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
                    const existingBook = [...localEvals].reverse().find((e: any) => e.lpn === lpn);
                    
                    if (existingBook) {
                      setIsbn(existingBook.isbn || '');
                      setBookInfo({
                        isbn: existingBook.isbn,
                        title: existingBook.title,
                        author: existingBook.author,
                        publisher: existingBook.publisher,
                        categoryName: existingBook.category,
                        isRescan: true
                      });
                    } else {
                      setIsbn('');
                      setBookInfo({ title: '정보 없음 (재촬영 진행)', categoryName: 'LPN 재스캔', isRescan: true });
                    }
                    
                    setIsLoadingBook(false);
                    setStep('PRINT_STICKER');
                    return;
                  }

                  // 신규 입고 모드
                  setIsbn(inputVal);
                  if (inboundType === 'NEW_FASTTRACK') {
                    setCurrentLpn('');
                    setBookInfo(null);
                    setIsLoadingBook(true);
                    setFasttrackQty(1);
                    setStep('PRINT_STICKER');
                  } else {
                    setBookInfo(null);
                    setIsLoadingBook(true);
                    setStep('PRINT_STICKER');
                    try {
                      setCurrentLpn(await issueLPN(inputVal));
                    } catch (e: any) {
                      alert(e?.message || 'LPN 채번 실패');
                      setCurrentLpn('');
                      setIsLoadingBook(false);
                      setStep('SCAN_BARCODE');
                      return;
                    }
                  }

                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/inbound/book-lookup?isbn=${inputVal}`);
                    if (res.ok) {
                      const data = await res.json();
                      setBookInfo(data);
                    } else {
                      // isbn을 반드시 함께 넘긴다 - 없으면 이후 evaluate 요청의 book_metadata에서
                      // isbn이 빠져 서버가 Book row를 만들지 못하고 500(book_id NOT NULL)을 낸다.
                      setBookInfo({ title: '도서 정보 조회 실패 (API 키 확인 필요)', isbn: inputVal });
                    }
                  } catch (e) {
                    setBookInfo({ title: '도서 정보 조회 에러', isbn: inputVal });
                  } finally {
                    setIsLoadingBook(false);
                  }
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
                        qty: fasttrackQty
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">작업 진행 현황</h3>
          <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">
            대기 {inFlightCount}건
          </span>
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
