import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCameraOptions {
  idealFacingMode?: 'environment' | 'user';
}

export function useCamera({ idealFacingMode = 'environment' }: UseCameraOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      // 1. 디바이스 최대 화질을 가져오되, 모바일 브라우저 한계상 max 제약조건 사용 (디바이스 의존)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: idealFacingMode,
          // 해상도는 디바이스 최대로 요청
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera start failed:", err);
      setError("카메라 접근 권한이 없거나, 지원하지 않는 브라우저입니다.");
    }
  }, [idealFacingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // 컴포넌트 마운트 해제 시 카메라 즉시 종료 (메모리 및 배터리 누수 방지)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { stream, error, videoRef, startCamera, stopCamera };
}
