'use client';

import { useState, useEffect, useRef } from 'react';
import BookCover from '@/components/BookCover';
import { useMutation } from '@tanstack/react-query';
import { Camera, Flashlight, RefreshCcw, Keyboard, Package, CheckCircle2, ScanLine, Printer, ArrowRight, BookOpen, ChevronLeft, User, Zap } from 'lucide-react';
import { PrinterHelper } from '@/lib/printerHelper';
import { useCamera } from '@/features/inbound/hooks/useCamera';
import { processImage } from '@/lib/image-processor';
import { useAtomValue, useSetAtom } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import Header from '@/components/layout/Header';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { BrowserMultiFormatReader as ZXingBrowserReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel } from '@/features/inbound/components/LpnPrintLabel';

type Step = 'SELECT_TYPE' | 'SCAN_BARCODE' | 'PRINT_STICKER' | 'VISION_EVALUATION' | 'RESULT';
type InboundType = 'NEW_FASTTRACK' | 'USED_RETURN_INSPECTION';

type QueueItem = {
  id: string; // job_id
  lpn: string;
  title: string;
  status: 'ANALYZING' | 'COMPLETED';
  progress?: number;
  message?: string;
  grade?: string;
  timestamp: number;
};

export default function InboundScannerPage() {
  const [step, setStep] = useState<Step>('SELECT_TYPE');
  const [inboundType, setInboundType] = useState<InboundType>('NEW_FASTTRACK');
  const [isbn, setIsbn] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
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
  const [capturePhase, setCapturePhase] = useState<'FRONT' | 'BACK' | 'INNER'>('FRONT');
  
  const { videoRef, startCamera, stopCamera } = useCamera();
  const guideBoxRef = useRef<HTMLDivElement>(null);
  const setUploadQueue = useSetAtom(uploadQueueAtom);
  const user = useAtomValue(currentUserAtom);

  const generateLPN = () => {
    const today = new Date();
    const dateStr = today.getFullYear().toString().slice(-2) + 
                    ('0' + (today.getMonth() + 1)).slice(-2) + 
                    ('0' + today.getDate()).slice(-2);
    
    // MVP 시연용 Workstation Station Line A 기본 고정
    const activeStationLine = (typeof window !== 'undefined' && localStorage.getItem('active_workstation_line')) || 'A';
    
    // Line A 기준 순차 시퀀스 관리 (A001, A002, A003 ...)
    let seq = parseInt(localStorage.getItem(`lpn_seq_${activeStationLine}_${dateStr}`) || '1', 10);
    const seqStr = String(seq).padStart(3, '0');
    localStorage.setItem(`lpn_seq_${activeStationLine}_${dateStr}`, String(seq + 1));
    
    return `LPN-${dateStr}-${activeStationLine}${seqStr}`;
  };

  // ---------------------------------------------------------------------------
  // [UX 렌더링 최적화 1] TanStack Query (React Query) Mutation
  // ---------------------------------------------------------------------------
  // 사용자가 '촬영 완료'를 눌렀을 때, 백엔드의 응답 시간(네트워크 지연)을 기다리지 않고
  // 화면을 즉각적으로 전환(0초 지연)시키는 '낙관적 업데이트(Optimistic Update)' 기법을 적용합니다.
  const evaluateMutation = useMutation({
    mutationFn: async (data: { lpn: string, images: Blob[], book_metadata?: any }) => {
      const getBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const base64Images = await Promise.all(data.images.map(getBase64));

      const res = await fetch("http://localhost:8000/api/v1/inbound/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpn: data.lpn, images: base64Images, book_metadata: data.book_metadata })
      });
      if (!res.ok) throw new Error("Evaluation failed");
      return res.json();
    },
    onMutate: async (newEvaluation) => {
      // [핵심 로직] 낙관적 업데이트 발동 지점
      // 서버 응답이 오기도 전에(심지어 요청이 실패할지도 모르지만) 무조건 성공했다고 '가정'하고,
      // 임시 ID(tempJobId)를 발급하여 즉시 모바일 하단 작업 대기열(Queue)에 데이터를 밀어 넣습니다.
      const tempJobId = `temp-${Date.now()}`;
      setQueue(prev => [...prev, {
        id: tempJobId,
        lpn: newEvaluation.lpn,
        title: '클린 아키텍처',
        status: 'ANALYZING',
        progress: 0,
        message: '대기 중...',
        timestamp: Date.now()
      }]);
      
      // 카메라 뷰파인더 닫고, 즉시(0.001초만에) 다음 화면(RESULT)으로 전환하여 체감속도 극대화
      setStep('RESULT'); 
      return { tempJobId };
    },
    onSuccess: (data, variables, context) => {
      // 2. 서버 통신이 '진짜로' 성공하면, 서버가 발급한 진짜 Job ID를 받아옴
      const { job_id, lpn } = data;
      
      // 앞서 가짜(tempJobId)로 그렸던 큐 데이터를 실제 job_id로 은밀하게 치환 (사용자는 눈치채지 못함)
      setQueue(prev => prev.map(q => q.id === context?.tempJobId ? { ...q, id: job_id } : q));
      
      // -----------------------------------------------------------------------
      // [UX 렌더링 최적화 2] SSE (Server-Sent Events) 단방향 스트리밍 구독
      // -----------------------------------------------------------------------
      // 무거운 WebSocket을 쓰지 않고, HTTP/1.1 표준인 EventSource를 활용해 
      // AI 분석이 끝날 때까지 10% 단위의 진행률(Progress)을 쪼개서 받아옵니다.
      const evtSource = new EventSource(`http://localhost:8000/api/v1/inbound/stream/${job_id}`);
      
      evtSource.onmessage = (event) => {
        // 서버에서 던져준 데이터("디코딩 중... 20%")를 실시간으로 UI 프로그레스 바에 반영
        const parsed = JSON.parse(event.data);
        setQueue(prev => prev.map(q => {
          if (q.id === job_id) {
            return {
              ...q,
              progress: parsed.progress,
              message: parsed.message,
              ...(parsed.grade ? { status: 'COMPLETED', grade: parsed.grade } : {})
            };
          }
          return q;
        }));
        
        // 100% 완료 시 연결을 끊고 불필요한 네트워크 리소스 낭비 방지
        if (parsed.progress === 100) {
          evtSource.close();
          
          // [추가] 모의 데이터 대신 실제 AI 등급 결과와 도서 정보를 Local Storage에 누적 저장
          const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
          const newEval = { 
            job_id: job_id,
            lpn: lpn, 
            grade: parsed.grade, 
            score: parsed.ubci_score,
            reasonCode: parsed.defect_description || parsed.message,
            message: parsed.message, 
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
          // 완료된 건 중 S/A 등급(정상)은 5초 뒤에 큐에서 스르륵 사라지도록 UX 처리.
          // 반려나 예외 상황은 사용자가 직접 확인할 수 있게 사라지지 않음.
          if (parsed.grade && (parsed.grade.includes('S') || parsed.grade.includes('A') || parsed.grade.includes('NORMAL') || parsed.grade.includes('MINT'))) {
            setTimeout(() => {
              setQueue(prev => prev.filter(q => q.id !== job_id));
            }, 5000);
          }
        }
      };
      
      evtSource.onerror = (err) => {
        console.error("SSE Error:", err);
        evtSource.close();
      };
    },
    onError: (err, newEvaluation, context) => {
      // 3. 만약 서버 통신이 실패했다면(네트워크 단절 등), 
      // 낙관적으로 그려버렸던 큐 아이템(tempJobId)을 롤백(삭제)시켜서 유저에게 에러를 알림
      if (context?.tempJobId) {
        setQueue(prev => prev.filter(q => q.id !== context.tempJobId));
      }
      alert("AI 판독 큐 전송에 실패했습니다. 다시 시도해주세요.");
    }
  });

  useEffect(() => {
    if (step === 'SCAN_BARCODE' || step === 'VISION_EVALUATION') {
      startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 실제 바코드(ISBN) 스캐닝 로직 (ZXing Browser)
  const codeReader = useRef<any>(null);

  useEffect(() => {
    if (step === 'SCAN_BARCODE') {
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
          if (!scanning) return;
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
            // 중고/반품 도서만 개별 LPN 채번 및 스티커 출력
            setCurrentLpn(generateLPN());
            setBookInfo(null);
            setIsLoadingBook(true);
            setStep('PRINT_STICKER');
          }

          // 백그라운드에서 알라딘 API 연동 도서 정보 조회
          try {
            const res = await fetch(`http://localhost:8000/api/v1/inbound/book-lookup?isbn=${text}`);
            if (res.ok) {
              const data = await res.json();
              setBookInfo(data);
            } else {
              setBookInfo({ title: '도서 정보 조회 실패 (API 키 확인 필요)' });
            }
          } catch (e) {
            setBookInfo({ title: '도서 정보 조회 에러' });
          } finally {
            setIsLoadingBook(false);
          }
        };

        // 1. ZXing Browser 오픈소스 엔진 (최적화)
        try {
          await codeReader.current?.decodeFromVideoElement(videoRef.current, (result: any, error: any, controls: any) => {
            controlsRef = controls;
            if (result && scanning) {
              const text = result.getText();
              if (text && text.length >= 4) {
                onSuccess(text);
              }
            }
          });
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

  // 뒤로가기 핸들러 (부착 미완료 시 LPN 채번 롤백 및 데이터 초기화)
  const handleBack = () => {
    if (step === 'PRINT_STICKER') {
      const today = new Date();
      const dateStr = today.getFullYear().toString().slice(-2) + 
                      ('0' + (today.getMonth() + 1)).slice(-2) + 
                      ('0' + today.getDate()).slice(-2);
      let seq = parseInt(localStorage.getItem(`lpn_seq_${dateStr}`) || '1', 10);
      if (seq > 1) {
        localStorage.setItem(`lpn_seq_${dateStr}`, String(seq - 1));
      }
      setCurrentLpn('');
      setIsbn('');
      setBookInfo(null);
      setStep('SCAN_BARCODE');
    }
    if (step === 'VISION_EVALUATION') {
      if (capturedImages.length > 0) {
        setCapturedImages([]);
        setCapturePhase('FRONT');
      } else {
        setStep('PRINT_STICKER');
      }
    }
    if (step === 'RESULT') {
      setStep('SCAN_BARCODE');
      setIsbn('');
      setCurrentLpn('');
      setCapturedImages([]);
      setCapturePhase('FRONT');
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !guideBoxRef.current) {
      alert("카메라 또는 가이드 영역을 찾을 수 없습니다.");
      return;
    }
    try {
      const result = await processImage(videoRef.current, guideBoxRef.current);
      if (result.isBlurred) {
        alert("사진이 너무 흔들렸습니다. 다시 촬영해 주세요.");
        return;
      }
      
      setCapturedImages(prev => [...prev, { url: result.previewUrl, blob: result.blob }]);
      
      if (capturePhase === 'FRONT') setCapturePhase('BACK');
      else if (capturePhase === 'BACK') setCapturePhase('INNER');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-5xl mx-auto font-sans">
      <Header />
      {/* 1. Top Luxury Executive Dashboard Banner (Matching Admin Dashboard Standard) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black tracking-widest uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                INBOUND CONTROL CENTER v2.11.0.0
              </span>
              <span className="text-xs text-slate-400 font-mono">Real-time Vision AI & Fast-track Pipeline</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Camera className="w-7 h-7 text-indigo-400" />
              현장 입고 & AI 훼손 정밀 검수 관제
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-4xl leading-relaxed">
              신품 도서는 사진 촬영 없이 <strong className="text-indigo-300 font-black">ISBN 바코드 스캔만으로 0초 만에 재고 입고</strong>되며, 중고/반품 도서는 <strong className="text-amber-300 font-black">4-Agent AI 비전 파이프라인</strong>을 통해 훼손 등급과 매입가를 정밀 평가합니다.
            </p>
          </div>

          {/* 파이프라인 설명 텍스트 종료 후 하단 컨트롤 배치 구역 */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                📍 배정 라인:
              </span>
              <select
                value={activeStation}
                onChange={(e) => handleStationChange(e.target.value)}
                className="bg-indigo-950 text-emerald-300 font-black px-2.5 py-1 rounded-lg border border-emerald-500/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs"
              >
                <option value="A">Line A (Workstation A - 메인 입고 라인)</option>
                <option value="B">Line B (Workstation B)</option>
                <option value="C">Line C (Workstation C)</option>
                <option value="D">Line D (Workstation D)</option>
                <option value="E">Line E (Workstation E)</option>
              </select>
            </div>

            <button
              onClick={() => setStep('SELECT_TYPE')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCcw className="w-4 h-4" />
              검수 유형 재선택
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Scanner App Container (Expanded PC/Mobile Responsive Viewport) */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-900 min-h-[640px] rounded-3xl overflow-hidden relative flex flex-col shadow-2xl border-4 border-slate-800 transition-all duration-300">
        
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
        <div className="bg-slate-900/90 backdrop-blur-md p-4 flex items-center justify-between z-20 absolute top-0 w-full text-white border-b border-slate-800">
          <div className="flex items-center">
            {step !== 'SELECT_TYPE' && (
              <button onClick={() => setStep('SELECT_TYPE')} className="mr-2 p-1 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
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
        <div className="flex-1 relative bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-center overflow-hidden pt-16 min-h-[480px]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-slate-700 to-black z-0"></div>

          {step === 'SELECT_TYPE' && (
            <div className="z-10 p-6 space-y-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight">📋 입고 검수 유형 선택</h2>
                <p className="text-xs text-slate-400">현장 상황 및 도서 상태에 맞는 입고 프로세스를 선택해 주세요.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Card 1: Fast-track New Book Inbound (Skip Photo 100%) */}
                <button
                  onClick={() => {
                    setInboundType('NEW_FASTTRACK');
                    setStep('SCAN_BARCODE');
                  }}
                  className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border-2 border-indigo-500/60 hover:border-indigo-400 text-left transition-all hover:scale-[1.02] shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-indigo-500 text-white px-3 py-1 rounded-full animate-pulse shadow-md">0초 고속 입고</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-white group-hover:text-indigo-300 transition-colors">
                    ⚡ 신품 도서 (ISBN 바코드 고속 입고)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    사진 촬영 과정을 <strong>100% 스킵</strong>하고, 바코드 스캔 즉시 알라딘 도서 정보를 연동하여 <strong>0초 만에 바로 재고 입고 확정</strong>합니다.
                  </p>
                </button>

                {/* Card 2: Used / Returned Book AI Inspection */}
                <button
                  onClick={() => {
                    setInboundType('USED_RETURN_INSPECTION');
                    setStep('SCAN_BARCODE');
                  }}
                  className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 border-2 border-amber-500/60 hover:border-amber-400 text-left transition-all hover:scale-[1.02] shadow-2xl group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black bg-amber-500 text-slate-950 px-3 py-1 rounded-full shadow-md">AI 훼손 정밀 검수</span>
                  </div>
                  <h3 className="font-extrabold text-lg text-white group-hover:text-amber-300 transition-colors">
                    🔍 중고 / 반품 도서 (AI 정밀 검수)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    표지 및 속지 카메라 촬영 후 <strong>4-Agent AI 비전 파이프라인(YOLOv8)</strong>으로 훼손 등급 및 매입/반품가를 정밀 평가합니다.
                  </p>
                </button>
              </div>
            </div>
          )}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-600 to-black z-0"></div>
        
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
              <span className="text-white/40 text-sm font-semibold tracking-wider text-center">도서 뒷면의 ISBN<br/>또는 재촬영 LPN QR 스캔</span>
            </div>
          </div>
        )}

        {step === 'PRINT_STICKER' && (
          <div className="relative z-10 flex flex-col items-center">
            {inboundType === 'NEW_FASTTRACK' ? (
              <div className="bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 p-8 rounded-3xl text-center space-y-4 shadow-2xl max-w-md animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 transform hover:scale-105 transition-transform">
                  <Zap className="w-9 h-9 text-yellow-300 fill-yellow-300 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white tracking-tight">⚡ 신품 도서 Fast-track 입고</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    사진 촬영 및 개별 LPN 발급을 <strong className="text-emerald-400">100% 생략</strong>하고<br/>수량 확인 후 즉시 재고로 편입됩니다.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 bg-indigo-950/80 border border-indigo-500/40 px-4 py-1.5 rounded-full text-xs font-mono font-bold text-indigo-200 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>ISBN: {isbn}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-48 h-12 bg-slate-800 border-b-4 border-slate-700 rounded-t-xl z-20 flex items-center justify-center mb-1">
                  <span className="text-slate-400 text-xs font-bold">라벨 프린터 (연동됨)</span>
                </div>
                {/* 50x30mm(가로형) 라벨 렌더링 */}
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
              <div 
                ref={guideBoxRef}
                className="relative w-[90%] md:w-[75%] aspect-[1/1.45] max-h-[90%] border-4 border-dashed border-white/60 rounded-3xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              >
                
                {/* 십자선 */}
                <div className="absolute w-8 h-1 bg-white/40 rounded-full"></div>
                <div className="absolute w-1 h-8 bg-white/40 rounded-full"></div>

                {/* 툴팁 버블 */}
                <div className="absolute -top-12 bg-gray-800/80 backdrop-blur-sm text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg text-center whitespace-nowrap">
                  {capturePhase === 'FRONT' && "1. 도서 정면(표지)을 촬영하세요"}
                  {capturePhase === 'BACK' && "2. 도서 후면(뒷표지)을 촬영하세요"}
                  {capturePhase === 'INNER' && "3. 내부 훼손 부위(모서리, 내지 등) 자유 촬영"}
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
                  <span className="absolute top-1 text-[10px] font-bold text-white z-10 drop-shadow-md bg-black/40 px-1 rounded">{idx === 0 ? '정면' : idx === 1 ? '후면' : '내지'}</span>
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
            <h3 className="font-bold text-gray-800 mb-2 text-center">도서 식별</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ISBN 또는 LPN (재촬영) 수동 입력" 
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
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
                    setCurrentLpn(generateLPN());
                    setBookInfo(null);
                    setIsLoadingBook(true);
                    setStep('PRINT_STICKER');
                  }

                  try {
                    const res = await fetch(`http://localhost:8000/api/v1/inbound/book-lookup?isbn=${inputVal}`);
                    if (res.ok) {
                      const data = await res.json();
                      setBookInfo(data);
                    } else {
                      setBookInfo({ title: '도서 정보 조회 실패 (API 키 확인 필요)' });
                    }
                  } catch (e) {
                    setBookInfo({ title: '도서 정보 조회 에러' });
                  } finally {
                    setIsLoadingBook(false);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-200"
              >
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
                  <span className="text-sm text-gray-600 font-medium">알라딘 API 정보 불러오는 중...</span>
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
                <p className="font-bold text-gray-800">{bookInfo?.title || '미등록 도서'}</p>
              )}

              {inboundType === 'NEW_FASTTRACK' ? (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-xs font-bold text-slate-700">⚡ 입고 수량 (수량 기입 가능)</span>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => setFasttrackQty(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 text-base flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      min={1}
                      value={fasttrackQty}
                      onChange={(e) => setFasttrackQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-8 border border-slate-300 rounded-lg text-center font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button 
                      type="button" 
                      onClick={() => setFasttrackQty(prev => prev + 1)}
                      className="w-8 h-8 rounded-lg bg-indigo-100 hover:bg-indigo-200 font-bold text-indigo-700 text-base flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="text-xs text-blue-600 font-bold">발급 예정 LPN</span>
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{currentLpn}</span>
                </div>
              )}
            </div>

            {inboundType === 'NEW_FASTTRACK' ? (
              <button 
                onClick={async () => {
                  try {
                    setIsAnalyzing(true);
                    const res = await fetch("http://localhost:8000/api/v1/inbound/fasttrack", {
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
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all text-base"
              >
                <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
                <span>⚡ 신품 도서 Fast-track 입고 완료 ({fasttrackQty}권)</span>
              </button>
            ) : bookInfo?.isRescan ? (
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={async () => {
                    setIsPrinting(true);
                    try {
                      const printer = new PrinterHelper();
                      const connected = await printer.connect();
                      if (connected) {
                        await printer.printLpnTag(currentLpn, bookInfo?.title || "재촬영 도서");
                        await printer.disconnect();
                      } else {
                        alert("프린터 연결 실패 (WebUSB 연동을 확인해주세요)");
                      }
                    } catch (e) {
                      console.error(e);
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
                  className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-purple-200"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  기존 라벨지 유지 및 재촬영 진행
                </button>
              </div>
            ) : (
              <button 
                onClick={async () => {
                  setIsPrinting(true);
                  try {
                    const printer = new PrinterHelper();
                    const connected = await printer.connect();
                    if (connected) {
                      await printer.printLpnTag(currentLpn, bookInfo?.title || "도서");
                      await printer.disconnect();
                    } else {
                      alert("프린터 연결 실패 (WebUSB 연동을 확인해주세요)");
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsPrinting(false);
                    setStep('VISION_EVALUATION');
                  }
                }}
                disabled={isPrinting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-200"
              >
                {isPrinting ? <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> : <Printer className="w-5 h-5 mr-2" />}
                {isPrinting ? '라벨 출력 중...' : '검열지 프린트 및 부착 완료'}
              </button>
            )}
          </div>
        )}

        {step === 'VISION_EVALUATION' && (
          <div className="space-y-4 pt-2 animate-in slide-in-from-right-4">
            <p className="text-center text-xs font-bold text-gray-600 mb-2">
              정면 1장, 후면 1장, 훼손 부위 N장 촬영
            </p>
            
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
                  if (capturedImages.length < 2) {
                    alert("정면과 후면 최소 2장의 사진이 필요합니다.");
                    return;
                  }
                  
                  // 백그라운드 큐 업로더에 작업 적재
                  setUploadQueue(prev => [
                    ...prev,
                    ...capturedImages.map((img, i) => ({
                      id: `local_${Date.now()}_${i}`,
                      blob: img.blob,
                      previewUrl: img.url,
                      status: 'PENDING' as const,
                    }))
                  ]);

                  // 낙관적 UI 진행
                  evaluateMutation.mutate({
                    lpn: currentLpn,
                    images: capturedImages.map(img => img.blob),
                    book_metadata: bookInfo
                  });
                }}
                disabled={evaluateMutation.isPending || capturedImages.length < 2}
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
                setCapturePhase('FRONT');
              }}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-gray-300"
            >
              <RefreshCcw className="w-5 h-5 mr-2" />
              다음 도서 스캔하기
            </button>
          </div>
        )}
      </div>
      )}
      
      {/* 작업 진행 현황 패널 (비동기 큐 모니터링) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mx-2 sm:mx-0 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">작업 진행 현황</h3>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            대기 {queue.filter(q => q.status === 'ANALYZING').length}건
          </span>
        </div>
        
        {queue.length === 0 ? (
          <div className="py-6 flex justify-center items-center">
            <p className="text-gray-400 text-sm font-medium">아직 촬영된 도서가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map(item => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${
                  item.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center space-x-3 w-1/2">
                  {item.status === 'ANALYZING' ? (
                    <RefreshCcw className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="text-sm font-bold text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs font-mono text-gray-500 truncate">{item.lpn}</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-end justify-center">
                  {item.status === 'ANALYZING' ? (
                    <div className="w-full max-w-[120px] text-right">
                      <div className="flex justify-between text-[10px] text-indigo-600 font-bold mb-1">
                        <span className="truncate pr-1">{item.message || '대기 중...'}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-200 px-2 py-1 rounded shadow-sm whitespace-nowrap">{item.grade}</span>
                      {item.message && <span className="text-[10px] text-gray-500 mt-1 text-right max-w-[120px] truncate" title={item.message}>{item.message}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
