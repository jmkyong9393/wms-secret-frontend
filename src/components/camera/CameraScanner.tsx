'use client';

import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useCamera } from '@/hooks/useCamera';
import { processImage } from '@/lib/image-processor';
import { uploadQueueAtom, UploadTask } from '@/stores/atoms';

export default function CameraScanner() {
  const { videoRef, startCamera, stopCamera, error } = useCamera();
  const setUploadQueue = useSetAtom(uploadQueueAtom);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 컴포넌트 마운트 시 카메라 자동 시작
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // [임시 기능] 풋페달 대용: 스마트폰 물리 볼륨 버튼 및 하드웨어 키보드(Space/Enter) 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 볼륨키 또는 스페이스바/엔터키 감지
      if (
        ['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', ' ', 'Enter'].includes(e.key) ||
        e.keyCode === 24 || e.keyCode === 25 // 일부 안드로이드 볼륨 키코드
      ) {
        const btn = document.getElementById('capture-btn');
        if (btn && !btn.hasAttribute('disabled')) {
          e.preventDefault();
          btn.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || isProcessing) return;
    
    setIsProcessing(true);
    setToastMsg(null);
    
    try {
      // 1. 이미지 압축 및 흔들림 감지 연산 (클라이언트단)
      const result = await processImage(videoRef.current);
      
      if (result.isBlurred) {
        setToastMsg("⚠️ 사진이 너무 흔들렸습니다. 다시 촬영해 주세요.");
        setIsProcessing(false);
        return; // 업로드 중단
      }

      // 2. 낙관적 UI를 위한 큐(Queue) 적재
      const newTask: UploadTask = {
        id: `local_${Date.now()}`,
        blob: result.blob,
        previewUrl: result.previewUrl,
        status: 'PENDING',
      };
      
      setUploadQueue((prev) => [...prev, newTask]);
      
      // 3. 셔터 이펙트 및 다음 촬영 유도
      setToastMsg("✅ 촬영 완료! 백그라운드에서 업로드됩니다.");
      
      // Toast 자동 제거
      setTimeout(() => setToastMsg(null), 2000);
      
    } catch (err) {
      console.error(err);
      setToastMsg("❌ 촬영 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="relative w-full max-w-md mx-auto aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-2xl cursor-pointer"
      onClick={() => {
        const btn = document.getElementById('capture-btn');
        if (btn && !btn.hasAttribute('disabled')) btn.click();
      }}
    >
      {/* 카메라 에러 처리 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white p-4 text-center">
          {error}
        </div>
      )}

      {/* 실시간 비디오 프리뷰 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* 도서 정렬용 BBox 가이드라인 (Overlay) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
        <div className="w-full h-[70%] border-4 border-dashed border-white/70 rounded-lg flex flex-col items-center justify-center relative">
          <div className="absolute -top-8 text-white/90 text-sm font-semibold bg-black/50 px-3 py-1 rounded-full">
            이 선 안에 책을 맞춰주세요
          </div>
          {/* 중앙 크로스헤어 */}
          <div className="w-8 h-1 bg-white/50 absolute" />
          <div className="w-1 h-8 bg-white/50 absolute" />
        </div>
      </div>

      {/* 흔들림 경고 및 성공 토스트 메시지 */}
      {toastMsg && (
        <div className="absolute top-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-top-4">
          <div className={`px-4 py-3 rounded-lg shadow-lg font-medium text-sm text-center backdrop-blur-md ${
            toastMsg.includes('⚠️') || toastMsg.includes('❌') 
              ? 'bg-red-500/90 text-white' 
              : 'bg-green-500/90 text-white'
          }`}>
            {toastMsg}
          </div>
        </div>
      )}

      {/* 하단 촬영 컨트롤 영역 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-end h-32">
        <button
          id="capture-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleCapture();
          }}
          disabled={isProcessing}
          className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95 ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'
          }`}
        >
          <div className="w-12 h-12 bg-white rounded-full" />
        </button>
      </div>
    </div>
  );
}
