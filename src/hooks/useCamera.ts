import { useState, useCallback, useRef, useEffect } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      // 이미 스트림이 있다면 재사용
      if (streamRef.current && videoRef.current && videoRef.current.srcObject) {
        setIsReady(true);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // 모바일 후면 카메라 우선
          width: { ideal: 1280 },    // 바코드 인식을 위해 해상도를 너무 높이지 않고 720p로 최적화
          height: { ideal: 720 },
          // @ts-ignore
          advanced: [{ focusMode: "continuous" }] // 지원되는 기기에서 자동 초점 활성화
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // iOS Safari 전체화면 방지
        await videoRef.current.play();
        setIsReady(true);
      }
      setError(null);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError(err.message || "카메라 접근에 실패했습니다.");
      setIsReady(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  // 컴포넌트 언마운트 시 메모리 누수 방지
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    startCamera,
    stopCamera,
    isReady,
    error
  };
}
