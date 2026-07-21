'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { uploadImageToCloudFront } from '@/lib/s3_helper';
import { Camera, Printer, CheckCircle, Loader2, ScanLine } from 'lucide-react';
import { useReturnMutation } from '@/hooks/useReturnMutation';
import { useInspectionStream } from '@/hooks/useInspectionStream';
import { processImage } from '@/lib/image-processor';
import { useAtom } from 'jotai';
import { uploadQueueAtom } from '@/stores/uploadQueueAtoms';
import { v4 as uuidv4 } from 'uuid';
import { OfflineQueue } from '@/lib/offlineQueue';

/**
 * 물류 입고(Inbound) 과정을 4단계로 제어하는 상태(State) 머신 타입니다.
 * 1. SCAN_ISBN: 책의 바코드 인식 대기
 * 2. FETCH_BOOK: 바코드 인식 후 서버에 도서 정보 요청
 * 3. PRINT_LPN: 자체 LPN 바코드 생성 후 라벨 프린터(블루투스) 인쇄 대기
 * 4. CAPTURE_PHOTO: 라벨 부착 후 책의 상태를 사진으로 캡처
 * 5. UPLOADING: 사진을 S3로 다이렉트 업로드 중
 * 6. SUCCESS: 업로드 완료 (잠시 후 초기 상태로 복귀)
 */
type ScannerStep = 'SCAN_ISBN' | 'FETCH_BOOK' | 'PRINT_LPN' | 'CAPTURE_PHOTO' | 'UPLOADING' | 'SUCCESS';

export default function InboundScanner() {
  // WebRTC 기반의 후면 카메라 제어 커스텀 훅
  const { videoRef, startCamera, stopCamera, isReady } = useCamera();
  
  // 현재 스캐너의 워크플로우 진행 상태
  const [step, setStep] = useState<ScannerStep>('SCAN_ISBN');
  
  // 인식된 도서 바코드 번호 보관
  const [isbn, setIsbn] = useState<string | null>(null);
  
  // 서버로부터 발급받은 WMS 내부 식별 바코드(LPN) 보관
  const [lpn, setLpn] = useState<string | null>(null);
  
  // ZXing 라이브러리의 바코드 디코딩 객체 (메모리 낭비 방지를 위해 useRef로 1회만 할당)
  const readerRef = useRef(new BrowserMultiFormatReader());
  
  // 비디오 화면을 일시정지(캡처)하여 이미지 파일(Blob)로 변환하기 위한 숨겨진 캔버스
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React Query Mutation & SSE 연동
  const { mutateAsync } = useReturnMutation();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const { status: sseStatus, error: sseError } = useInspectionStream(currentJobId);

  // Jotai Optimistic Upload Queue
  const [uploadQueue, setUploadQueue] = useAtom(uploadQueueAtom);

  // 1. 컴포넌트 마운트 시 카메라 켜기
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  /**
   * [Step 2] ISBN 스캔 루프 (ZXing 연동)
   * 카메라가 켜져있고, 현재 단계가 SCAN_ISBN일 때 비디오 스트림 프레임을 지속적으로 분석합니다.
   */
  useEffect(() => {
    if (step === 'SCAN_ISBN' && isReady && videoRef.current) {
      let isDecoding = true;
      const startDecoding = async () => {
        try {
          // 비디오 엘리먼트를 ZXing에 넘겨 백그라운드 프레임 분석 시작
          await readerRef.current.decodeFromVideoElement(videoRef.current!, (result, err, controls) => {
            if (result && isDecoding) {
              const text = result.getText();
              
              // 도서 바코드(EAN-13) 정규식 검증: 정확히 13자리 숫자일 때만 통과
              if (/^\d{13}$/.test(text)) {
                isDecoding = false;
                controls.stop(); // 리소스 절약을 위해 디코딩 엔진 중지
                setIsbn(text);
                setStep('FETCH_BOOK'); // 다음 워크플로우로 상태 전이
              }
            }
          });
        } catch (e) {
          console.error("ZXing Error:", e);
        }
      };
      startDecoding();

      return () => {
        isDecoding = false; // 컴포넌트 해제 시 루프 중단
      };
    }
  }, [step, isReady, videoRef]);

  /**
   * [Step 3] 서버 통신 (도서 정보 조회 및 LPN 발급)
   * FETCH_BOOK 상태가 되면 서버 API를 찔러 데이터를 가져온다고 가정합니다 (Mock).
   */
  useEffect(() => {
    if (step === 'FETCH_BOOK' && isbn) {
      // 실제로는 Axios/Fetch를 통해 FastAPI로 GET 요청을 보내는 부분입니다.
      const timer = setTimeout(() => {
        // 서버에서 도서 정보 확인 후 고유 LPN 코드를 발급했다고 가정 (예: LPN-1234-9999)
        const mockLPN = `LPN-${isbn.slice(-4)}-${Math.floor(Math.random() * 10000)}`;
        setLpn(mockLPN);
        setStep('PRINT_LPN'); // 라벨 프린트 대기 상태로 전이
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, isbn]);

  /**
   * [Step 4] 블루투스 라벨 프린터 제어 (Web Bluetooth API)
   * 화면의 "라벨지 출력하기" 버튼 클릭 시 작동합니다.
   */
  const handlePrint = async () => {
    // 향후 Web Bluetooth API (navigator.bluetooth) 를 활용하여 Xprinter에 TSPL 명령을 쏘는 로직이 들어갈 자리입니다.
    console.log(`[Bluetooth] 프린터로 TSPL 바이트 명령어 전송 시도... LPN: ${lpn}`);
    alert(`[모의 프린트] ${lpn} 바코드 라벨지가 출력되었습니다!`);
    
    // 출력이 완료되면 즉시 책의 파손 여부를 찍기 위한 사진 캡처 단계로 전이합니다.
    setStep('CAPTURE_PHOTO');
  };

  /**
   * [Step 5] 카메라 렌즈 캡처 및 큐(Queue) 적재 (Optimistic UI)
   * 작업자가 셔터 버튼을 누를 때 작동합니다.
   */
  const handleCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    setStep('UPLOADING'); // 잠시 로딩 (블러 계산용)
    
    try {
      // 1. WASM 대체용 라플라시안 분산 알고리즘으로 블러(흔들림) 검증 및 압축
      const processed = await processImage(video);
      
      if (processed.isBlurred) {
        alert("사진이 심하게 흔들렸습니다. 다시 촬영해주세요!");
        setStep('CAPTURE_PHOTO');
        return;
      }
      
      // 2. 블러 테스트를 통과하면 Jotai 전역 큐에 PENDING 상태로 적재 (Optimistic UI)
      const taskId = uuidv4();
      setUploadQueue(prev => [...prev, {
        id: taskId,
        blob: processed.blob,
        previewUrl: processed.previewUrl,
        status: 'PENDING',
        isbn: isbn || 'UNKNOWN',
        lpn: lpn || 'UNKNOWN'
      }]);
      
      // 3. UI는 업로드 대기 없이 즉각적으로 다음 책을 스캔할 수 있게 리셋 (True Optimistic UI)
      setIsbn(null);
      setLpn(null);
      setStep('SCAN_ISBN');
      
    } catch (err) {
      console.error("Capture processing error:", err);
      alert("이미지 전처리 실패!");
      setStep('CAPTURE_PHOTO');
    }
  };

  /**
   * [Background Worker] 큐에 적재된 사진을 순차적으로 S3 업로드하고 AI 워커(FastAPI)로 쏘는 백그라운드 태스크
   */
  useEffect(() => {
    const processQueue = async () => {
      const pendingTask = uploadQueue.find(t => t.status === 'PENDING');
      if (!pendingTask) return;
      
      // 상태를 UPLOADING으로 변경
      setUploadQueue(prev => prev.map(t => 
        t.id === pendingTask.id ? { ...t, status: 'UPLOADING' } : t
      ));
      
      try {
        const filename = `condition_${pendingTask.lpn}_${pendingTask.id}.jpg`;
        // 실제로는 백엔드 /api/v1/uploads/presigned-url 로직을 거쳐야 함. 지금은 S3_helper 목업 호출.
        const uploadedUrl = await uploadImageToCloudFront(pendingTask.blob, filename);
        
        // AI 파이프라인 트리거 (FastAPI)
        const response = await mutateAsync({
          book_id: pendingTask.isbn || 'UNKNOWN',
          location_id: pendingTask.lpn || 'UNKNOWN',
          image_urls: [uploadedUrl || 'https://mock-image-url.com/image.jpg']
        });
        
        if (response && response.job_id) {
          setCurrentJobId(response.job_id);
        }
        
        // 성공 처리
        setUploadQueue(prev => prev.map(t => 
          t.id === pendingTask.id ? { ...t, status: 'COMPLETED' } : t
        ));
      } catch (err: any) {
        console.error("Background Upload Error:", err);
        
        // [FE-4.1] 네트워크 오류 발생 시 IndexedDB 오프라인 큐에 백업 (방어막)
        if (!navigator.onLine || err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
          console.log("[OfflineQueue] Network error detected. Saving task to offline queue...");
          const offlineQueue = new OfflineQueue();
          await offlineQueue.enqueue({
            taskId: pendingTask.id,
            blob: pendingTask.blob,
            isbn: pendingTask.isbn || 'UNKNOWN',
            lpn: pendingTask.lpn || 'UNKNOWN'
          });
        }

        setUploadQueue(prev => prev.map(t => 
          t.id === pendingTask.id ? { ...t, status: 'FAILED' } : t
        ));
      }
    };
    
    processQueue();
  }, [uploadQueue, mutateAsync, setUploadQueue]);

  return (
    <div className="relative w-full max-w-md mx-auto h-[100dvh] bg-black text-white flex flex-col overflow-hidden shadow-xl rounded-lg">
      
      {/* 카메라 뷰포트 (항상 떠있음) */}
      <div className="relative flex-1">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover"
          autoPlay 
          playsInline 
          muted 
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* BBox 가이드라인 오버레이 */}
        {step === 'SCAN_ISBN' && (
          <div className="absolute inset-0 border-[6px] border-blue-500/50 m-12 rounded-xl flex items-center justify-center">
            <ScanLine className="w-16 h-16 text-blue-500 animate-pulse" />
          </div>
        )}

        {step === 'CAPTURE_PHOTO' && (
          <div className="absolute inset-0 border-[4px] border-green-500/50 m-8 rounded-xl flex items-center justify-center">
            <span className="text-green-500 font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">도서를 가이드에 맞추세요</span>
          </div>
        )}
      </div>

      {/* 상태 및 컨트롤 패널 */}
      <div className="absolute bottom-0 w-full bg-slate-900/90 backdrop-blur-md rounded-t-3xl p-6 min-h-[250px] flex flex-col items-center justify-center border-t border-slate-700">
        
        {step === 'SCAN_ISBN' && (
          <div className="text-center animate-fade-in">
            <h2 className="text-xl font-bold mb-2">1단계: 도서 바코드 스캔</h2>
            <p className="text-slate-400 text-sm">입고할 책의 ISBN 13자리 바코드를 카메라에 비춰주세요.</p>
          </div>
        )}

        {step === 'FETCH_BOOK' && (
          <div className="flex flex-col items-center justify-center animate-fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="font-semibold text-lg">도서 정보 조회 중...</p>
            <p className="text-slate-400 text-sm mt-1">ISBN: {isbn}</p>
          </div>
        )}

        {step === 'PRINT_LPN' && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            <div className="bg-slate-800 w-full p-4 rounded-xl border border-slate-700 mb-6 shadow-inner">
              <p className="text-sm text-slate-400 mb-1">발급된 고유 번호</p>
              <p className="text-2xl font-mono text-green-400 font-bold tracking-wider">{lpn}</p>
            </div>
            <button 
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
            >
              <Printer className="w-5 h-5" />
              라벨지 출력하기 (Bluetooth)
            </button>
          </div>
        )}

        {step === 'CAPTURE_PHOTO' && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            <p className="text-center text-slate-300 mb-6">라벨지를 부착한 후,<br/>도서 전체 훼손 상태가 보이게 촬영하세요.</p>
            <button 
              onClick={handleCapture}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-[0_0_0_4px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-90 transition-all"
            >
              <div className="w-16 h-16 rounded-full border-4 border-slate-900 flex items-center justify-center">
                <Camera className="w-8 h-8 text-slate-900" />
              </div>
            </button>
          </div>
        )}

        {step === 'UPLOADING' && (
          <div className="flex flex-col items-center justify-center animate-fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="font-semibold text-lg">이미지 처리 중...</p>
            <p className="text-slate-400 text-sm mt-1">블러 검사 및 압축 진행 중</p>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="flex flex-col items-center justify-center animate-fade-in w-full">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">큐 적재 완료</h2>
            <p className="text-slate-400 text-sm mt-4">다음 도서 스캔을 준비합니다...</p>
          </div>
        )}
      </div>

      {/* 글로벌 SSE 실시간 프로그레스 바 UI (Background Worker 상태 표시) */}
      {currentJobId && (
        <div className="absolute top-4 left-4 right-4 p-4 bg-slate-900/95 backdrop-blur-md rounded-xl border border-blue-500/30 shadow-2xl z-50 animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-400">
              {sseStatus ? sseStatus.message : 'AI 비전 검수 큐 진입 중...'}
            </span>
            <span className="text-xs text-slate-400">
              {sseStatus ? `${sseStatus.progress}%` : '0%'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${sseStatus ? sseStatus.progress : 0}%` }}
            ></div>
          </div>
          {sseError && <p className="text-red-400 text-xs mt-2">{sseError}</p>}
          
          {sseStatus?.status === 'COMPLETED' && sseStatus.result_data && (
             <div className="mt-3 p-2 bg-green-900/50 rounded-lg text-xs text-green-200 break-words whitespace-pre-wrap text-left max-h-32 overflow-y-auto">
               <p className="font-bold mb-1">최근 검수 결과 요약:</p>
               {JSON.stringify(sseStatus.result_data, null, 2)}
             </div>
          )}
        </div>
      )}
    </div>
  );
}
