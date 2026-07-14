'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, Flashlight, RefreshCcw, Keyboard, Package, CheckCircle2, ScanLine, Printer, ArrowRight, BookOpen, ChevronLeft, User } from 'lucide-react';

type Step = 'SCAN_BARCODE' | 'PRINT_STICKER' | 'VISION_EVALUATION' | 'RESULT';

type QueueItem = {
  id: string; // LPN
  title: string;
  status: 'ANALYZING' | 'COMPLETED';
  grade?: string;
  timestamp: number;
};

export default function InboundScannerPage() {
  const [step, setStep] = useState<Step>('SCAN_BARCODE');
  const [isbn, setIsbn] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentLpn, setCurrentLpn] = useState('LPN-260713-A001');

  const videoRef = useRef<HTMLVideoElement>(null);

  // 카메라 제어 Effect
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      if (step === 'VISION_EVALUATION') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("카메라 접근 실패:", err);
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (step === 'PRINT_STICKER') setStep('SCAN_BARCODE');
    if (step === 'VISION_EVALUATION') setStep('PRINT_STICKER');
    if (step === 'RESULT') {
      setStep('SCAN_BARCODE');
      setIsbn('');
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      {/* Main Scanner App Container */}
      <div className="bg-slate-900 h-[75vh] min-h-[600px] rounded-3xl overflow-hidden relative flex flex-col shadow-2xl border-4 border-slate-800">
      
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
      <div className="bg-slate-900/80 backdrop-blur-md p-4 flex items-center justify-between z-20 absolute top-0 w-full text-white">
        <div className="flex items-center">
          {step !== 'SCAN_BARCODE' && (
            <button onClick={handleBack} className="mr-2 p-1 hover:bg-slate-800 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-lg font-bold flex items-center">
            {step === 'SCAN_BARCODE' && <><ScanLine className="w-5 h-5 mr-2 text-emerald-400" /> 도서 식별 (바코드)</>}
            {step === 'PRINT_STICKER' && <><Printer className="w-5 h-5 mr-2 text-blue-400" /> 검열지 출력 및 부착</>}
            {step === 'VISION_EVALUATION' && <><Camera className="w-5 h-5 mr-2 text-purple-400" /> 외관 촬영 및 평가</>}
            {step === 'RESULT' && <><CheckCircle2 className="w-5 h-5 mr-2 text-emerald-400" /> 평가 완료</>}
          </h1>
        </div>
      </div>

      {/* Simulated Viewport / Content Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-600 to-black"></div>
        
        {step === 'SCAN_BARCODE' && (
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_3px_rgba(16,185,129,0.7)] animate-scan-laser z-10 w-full"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-white/40 text-sm font-semibold tracking-wider text-center">도서 뒷면의<br/>ISBN 바코드를 스캔하세요</span>
            </div>
          </div>
        )}

        {step === 'PRINT_STICKER' && (
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-48 h-12 bg-slate-800 border-b-4 border-slate-700 rounded-t-xl z-20 flex items-center justify-center">
              <span className="text-slate-400 text-xs font-bold">라벨 프린터 (연동됨)</span>
            </div>
            <div className="relative w-40 h-56 bg-white shadow-2xl overflow-hidden flex flex-col justify-between p-3 -mt-2 z-10 animate-print">
              <div className="border-2 border-dashed border-gray-300 w-full h-full p-2 flex flex-col items-center text-center justify-between">
                <div className="flex flex-col w-full">
                  <span className="text-[9px] text-gray-500 font-bold bg-gray-100 py-0.5 w-full uppercase tracking-widest">WMS LPN Label</span>
                  <span className="text-[11px] font-mono text-gray-900 font-extrabold mt-1 tracking-tighter">{currentLpn}</span>
                </div>
                
                <div className="w-20 h-20 bg-gray-200 p-1 my-1 flex-shrink-0">
                  {/* 가짜 QR 코드 이미지 영역 */}
                  <div className="w-full h-full bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg')] bg-contain bg-no-repeat bg-center opacity-90"></div>
                </div>
                
                <div className="w-full text-left bg-gray-50 p-1.5 border border-gray-200 mt-1">
                  <p className="text-[8px] text-gray-500 mb-0.5">담당자 (Worker)</p>
                  <p className="text-[10px] font-bold text-gray-800 flex items-center">
                    <User className="w-3 h-3 mr-1 text-gray-500"/>
                    WKR-9901 (박준희)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'VISION_EVALUATION' && (
          <div className="absolute inset-0 w-full h-full bg-black z-0">
            {/* 실제 카메라 비디오 스트림 */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* 오버레이 및 뷰파인더 가이드 */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none pb-20">
              {/* 바깥 영역을 어둡게 처리하기 위한 그림자 꼼수 */}
              <div className="relative w-3/5 md:w-1/2 aspect-[1/1.4] max-h-[75%] border-4 border-dashed border-white/60 rounded-3xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                
                {/* 십자선 */}
                <div className="absolute w-8 h-1 bg-white/40 rounded-full"></div>
                <div className="absolute w-1 h-8 bg-white/40 rounded-full"></div>

                {/* 툴팁 버블 */}
                <div className="absolute -top-12 bg-gray-800/80 backdrop-blur-sm text-white text-sm font-bold px-5 py-2 rounded-full shadow-lg">
                  이 선 안에 책을 맞춰주세요
                </div>

                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl z-20">
                    <RefreshCcw className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                    <span className="text-emerald-400 font-bold animate-pulse text-xl drop-shadow-lg shadow-black">AI 렌즈 판독 중...</span>
                  </div>
                )}
              </div>
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
            <h2 className="text-xl font-bold text-gray-800 mb-3">클린 아키텍처</h2>
            <div className="px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mb-5 shadow-sm">
              <span className="text-emerald-700 font-extrabold">UBCI: S등급 (최상)</span>
            </div>
            <p className="text-sm text-gray-500 font-medium">
              AI 검수 및 등급 매핑이 완료되었습니다.<br/>S구역 컨베이어 벨트에 올려주세요.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Control Panel */}
      <div className="bg-white rounded-t-3xl p-6 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] min-h-[220px] flex flex-col justify-end">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto absolute top-3 left-1/2 -translate-x-1/2"></div>
        
        {step === 'SCAN_BARCODE' && (
          <div className="space-y-4 pt-4">
            <h3 className="font-bold text-gray-800 mb-2 text-center">도서 식별</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ISBN 수동 입력 (13자리)" 
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
              />
              <button 
                onClick={() => {
                  setCurrentLpn('LPN-260713-A' + String(Math.floor(Math.random() * 900) + 100));
                  setStep('PRINT_STICKER');
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
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2 shadow-inner">
              <p className="text-xs text-gray-500 mb-1">인식된 도서 (ISBN)</p>
              <p className="font-bold text-gray-800">클린 아키텍처 (9788966263158)</p>
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                <span className="text-xs text-blue-600 font-bold">발급 예정 LPN</span>
                <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{currentLpn}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsPrinting(true);
                setTimeout(() => {
                  setIsPrinting(false);
                  setStep('VISION_EVALUATION');
                }, 1500);
              }}
              disabled={isPrinting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-blue-200"
            >
              {isPrinting ? <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> : <Printer className="w-5 h-5 mr-2" />}
              {isPrinting ? '라벨 출력 중...' : '검열지 프린트 및 부착 완료'}
            </button>
          </div>
        )}

        {step === 'VISION_EVALUATION' && (
          <div className="space-y-4 pt-4 animate-in slide-in-from-right-4">
            <p className="text-center text-sm font-semibold text-gray-600">검열지가 부착된 도서의 외관을 촬영합니다</p>
            <button 
              onClick={() => {
                setIsAnalyzing(true);
                const newItemId = currentLpn;
                
                // Add to queue as pending
                setQueue(prev => [...prev, { id: newItemId, title: '클린 아키텍처', status: 'ANALYZING', timestamp: Date.now() }]);

                setTimeout(() => {
                  setIsAnalyzing(false);
                  setStep('RESULT');
                  
                  // Update queue item to COMPLETED
                  setQueue(prev => prev.map(q => q.id === newItemId ? { ...q, status: 'COMPLETED', grade: 'S등급 (최상)' } : q));
                  
                  // Auto-remove completed item after 4 seconds
                  setTimeout(() => {
                    setQueue(prev => prev.filter(q => q.id !== newItemId));
                  }, 4000);

                }, 2500);
              }}
              disabled={isAnalyzing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all shadow-lg shadow-purple-200"
            >
              <Camera className="w-6 h-6 mb-1" />
              <span>촬영 및 AI 평가 요청</span>
            </button>
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
              }}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg shadow-gray-300"
            >
              <RefreshCcw className="w-5 h-5 mr-2" />
              다음 도서 스캔하기
            </button>
          </div>
        )}

      </div>
      </div>
      
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
                <div className="flex items-center space-x-3">
                  {item.status === 'ANALYZING' ? (
                    <RefreshCcw className="w-5 h-5 text-indigo-500 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-800">{item.title}</p>
                    <p className="text-xs font-mono text-gray-500">{item.id}</p>
                  </div>
                </div>
                <div>
                  {item.status === 'ANALYZING' ? (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">판독 중...</span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-200 px-2 py-1 rounded shadow-sm">{item.grade}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
