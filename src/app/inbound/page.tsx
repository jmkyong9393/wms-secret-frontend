'use client';
import type { BookMeta } from '@/features/inbound/types';
import { API_BASE_URL } from '@/shared/api/api-client';

import { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCcw, Package, CheckCircle2, ScanLine, Printer, ChevronLeft } from 'lucide-react';
import { labelsAPI } from '@/shared/api/api';
import { useCamera } from '@/shared/lib/useCamera';
import { processImage } from '@/shared/lib/image-processor';
import { useAtomValue, useSetAtom } from 'jotai';
import { uploadQueueAtom } from '@/entities/upload-task/model/uploadQueueAtoms';
import { currentUserAtom } from '@/entities/user/model/authAtoms';
import { getSystemSettings } from '@/shared/lib/systemSettings';
import { TRACK1_IMAGE_COUNT, TRACK1_SHOTS, shotAt } from '@/features/inbound/captureSequence';
import { saveDraft, loadDraft, clearDraft } from '@/features/inbound/inspectionDraft';
import { ScanBarcodePanel } from '@/features/inbound/components/ScanBarcodePanel';
import { PrintStickerPanel } from '@/features/inbound/components/PrintStickerPanel';
import { CaptureControlsPanel } from '@/features/inbound/components/CaptureControlsPanel';
import { ResultPanel } from '@/features/inbound/components/ResultPanel';
import { InboundQueuePanel } from '@/features/inbound/components/InboundQueuePanel';
import { useEvaluationStream } from '@/features/inbound/hooks/useEvaluationStream';
import { useBarcodeScanEngine } from '@/features/inbound/hooks/useBarcodeScanEngine';
import { InboundIntroBanner } from '@/features/inbound/components/InboundIntroBanner';
import { TypeSelectCards } from '@/features/inbound/components/TypeSelectCards';
import { ScanViewfinder } from '@/features/inbound/components/ScanViewfinder';
import { LabelPreviewStage } from '@/features/inbound/components/LabelPreviewStage';
import { CaptureStage } from '@/features/inbound/components/CaptureStage';
import { ResultStage } from '@/features/inbound/components/ResultStage';

type Step = 'SELECT_TYPE' | 'SCAN_BARCODE' | 'PRINT_STICKER' | 'VISION_EVALUATION' | 'RESULT';
type InboundType = 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';
// 채번 응답: LPN 문자열 + 원장에 있는 도서 메타(없으면 null)
type IssuedLpn = { lpn: string; book: BookMeta | null };

// 서버가 조회 실패 시 Book.title에 넣는 자리표시자. 이 값이면 도서 조회를 다시 시도한다.
const UNKNOWN_BOOK_TITLE = '미확인 도서';

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
  const [bookInfo, setBookInfo] = useState<BookMeta | null>(null);
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
  const lookupBookByLpn = async (lpn: string): Promise<BookMeta | null> => {
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

    const localEvals: (BookMeta & { lpn?: string })[] = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
    const hit = [...localEvals].reverse().find((e) => e.lpn === lpn);
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
  const resolveBookInfo = async (isbnValue: string, seed: BookMeta | null) => {
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
        const body = await res.json().catch(() => ({} as { detail?: string; message?: string }));
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

  // 검수 전송·SSE 스트림·폴링 복구는 features/inbound 훅이 담당한다.
  const evaluateMutation = useEvaluationStream({
    workerId: user?.employeeId,
    onOptimisticQueued: () => {
      // 카메라 뷰파인더 닫고 즉시 RESULT로 전환 (낙관적 업데이트). 촬영분은 이미
      // blob으로 mutate()에 넘겼으므로 비워도 전송에 영향이 없다.
      setStep('RESULT');
      setCapturedImages([]);
    },
    onAccepted: () => {
      clearDraft();
      setResumedDraft(null);
    },
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

  /**
   * 식별 코드 처리 통일 경로 - LPN 재촬영 / 신품 Fast-track / 중고 채번 분기.
   * 스캐너 채택 확정과 수동 입력 조회가 같은 함수를 쓴다 (종전에는 두 벌 중복).
   */
  const identifyAndProceed = async (code: string) => {
                  // LPN 재촬영 모드 전환
                  if (code.toUpperCase().startsWith('LPN-')) {
                    const lpn = code.toUpperCase();
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
                  setIsbn(code);
                  if (inboundType === 'NEW_FASTTRACK') {
                    setCurrentLpn('');
                    setLpnIssuedNow(false);
                    setBookInfo(null);
                    setIsLoadingBook(true);
                    setFasttrackQty(1);
                    setStep('PRINT_STICKER');
                    await resolveBookInfo(code, null);
                    return;
                  }

                  setBookInfo(null);
                  setIsLoadingBook(true);
                  setStep('PRINT_STICKER');
                  let issued: IssuedLpn;
                  try {
                    issued = await issueLPN(code);
                    setCurrentLpn(issued.lpn);
                    setLpnIssuedNow(true);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'LPN 채번 실패');
                    setCurrentLpn('');
                    setLpnIssuedNow(false);
                    setIsLoadingBook(false);
                    setStep('SCAN_BARCODE');
                    return;
                  }

                  await resolveBookInfo(code, issued.book);
  };

  // 수동 입력 조회 - 최소 길이 검증 후 통일 경로로 위임
  const handleManualLookup = async () => {
    const inputVal = isbn.trim();
    if (!inputVal || inputVal.length < 4) {
      alert('유효한 바코드를 입력해주세요.');
      return;
    }
    await identifyAndProceed(inputVal);
  };

  // 이중 엔진 스캔·오독 방어는 features/inbound 훅이 담당한다. 채택 코드는 통일 경로로.
  const { scanWarning } = useBarcodeScanEngine({
    active: step === 'SCAN_BARCODE',
    videoRef,
    onCode: identifyAndProceed,
  });

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

  // 신품 Fast-track 즉시 입고  // 신품 Fast-track 즉시 입고 (사진 없이 수량 입고)
  const handleFasttrackSubmit = async () => {
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
                  } catch {
                    alert('패스트트랙 서버 통신 에러');
                  } finally {
                    setIsAnalyzing(false);
                  }
  };

  // 라벨 인쇄 후 촬영 단계 진입 (자동 인쇄 꺼짐 시 즉시 촬영). 재출력·신규 버튼 공통 경로.
  const printLabelThenCapture = async () => {
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
  };

  // 촬영 완료 - 필수 컷 검증 후 단일 mutation으로 전송 (큐 적재 포함)
  const handleSubmitEvaluation = () => {
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
                    book_metadata: bookInfo ?? undefined
                  });
  };

  // 다음 도서 스캔 준비 - 로컬 상태·초안 정리
  const resetForNextScan = () => {
                setStep('SCAN_BARCODE');
                setIsbn('');
                setIsPrinting(false);
                setIsAnalyzing(false);
                setCapturedImages([]);
                clearDraft();
                setResumedDraft(null);
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
      <InboundIntroBanner
        activeStation={activeStation}
        onStationChange={handleStationChange}
        onResetType={resetToTypeSelect}
      />

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
            <TypeSelectCards
              onSelect={(t) => {
                setInboundType(t);
                setStep('SCAN_BARCODE');
              }}
            />
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
          <ScanViewfinder scanWarning={scanWarning} />
        )}

        {step === 'PRINT_STICKER' && (
          <LabelPreviewStage
            inboundType={inboundType}
            isbn={isbn}
            currentLpn={currentLpn}
            bookInfo={bookInfo}
            workerLabel={user?.name ? `${user.employeeId} (${user.name})` : 'WM2608001 (최초관리자)'}
          />
        )}

        {step === 'VISION_EVALUATION' && (
          <CaptureStage
            guideBoxRef={guideBoxRef}
            currentShot={currentShot}
            isAnalyzing={isAnalyzing}
            capturedImages={capturedImages}
            onTakePhoto={takePhoto}
          />
        )}

        {step === 'RESULT' && (
          <ResultStage currentLpn={currentLpn} title={bookInfo?.title || '미등록 도서'} />
        )}
      </div>
      </div>

      {/* Bottom Control Panel (Light & Dark Mode Full Compatibility) */}
      {step !== 'SELECT_TYPE' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 z-20 shadow-2xl border border-slate-200 dark:border-slate-800 min-h-[180px] flex flex-col justify-end animate-in slide-in-from-bottom-4 duration-200">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto absolute top-3 left-1/2 -translate-x-1/2"></div>
        
        {step === 'SCAN_BARCODE' && (
          <ScanBarcodePanel isbn={isbn} setIsbn={setIsbn} onLookup={handleManualLookup} />
        )}

        {step === 'PRINT_STICKER' && (
          <PrintStickerPanel
            isbn={isbn}
            bookInfo={bookInfo}
            isLoadingBook={isLoadingBook}
            inboundType={inboundType}
            fasttrackQty={fasttrackQty}
            setFasttrackQty={setFasttrackQty}
            currentLpn={currentLpn}
            isPrinting={isPrinting}
            onFasttrack={handleFasttrackSubmit}
            onPrintAndCapture={printLabelThenCapture}
            onSkipPrintCapture={() => setStep('VISION_EVALUATION')}
            onConfirmPrintAndCapture={() => {
              // 촬영 단계로 넘어가면 그 LPN은 사용 확정이다. 이후 뒤로가기로 회수하지 않는다.
              setLpnIssuedNow(false);
              printLabelThenCapture();
            }}
          />
        )}

        {step === 'VISION_EVALUATION' && (
          <CaptureControlsPanel
            capturedCount={capturedImages.length}
            isAnalyzing={isAnalyzing}
            isSubmitting={evaluateMutation.isPending}
            onTakePhoto={takePhoto}
            onSubmit={handleSubmitEvaluation}
          />
        )}

        {step === 'RESULT' && (
          <ResultPanel onNextScan={resetForNextScan} />
        )}
      </div>
      )}
      
      <InboundQueuePanel
        visibleQueue={visibleQueue}
        inFlightCount={inFlightCount}
        finishedCount={finishedCount}
        reprintingLpn={reprintingLpn}
        onClearFinished={clearFinishedTasks}
        onReprint={reprintLpnLabel}
      />
    </div>
    </div>
  );
}
