import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCameraOptions {
  idealFacingMode?: 'environment' | 'user';
}

export function useCamera({ idealFacingMode = 'environment' }: UseCameraOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (retryCount = 0) => {
    if (streamRef.current) return; // 방어 로직: 이미 카메라가 켜져 있으면 중복 실행 방지
    try {
      // 1. 디바이스 최대 화질을 가져오되, 모바일 브라우저 한계상 max 제약조건 사용 (디바이스 의존)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: idealFacingMode,
          // 해상도가 너무 높으면(FHD/4K) 브라우저 ZXing 엔진이 1D 바코드(EAN-13) 픽셀 연산을 따라가지 못해 인식을 실패합니다.
          // 바코드 스캔의 최적 스윗스팟인 720p(HD) 해상도로 하향 조정하여 스캔 속도와 인식률을 극대화합니다.
          width: { ideal: 1280 },
          height: { ideal: 720 },
          advanced: [{ focusMode: "continuous" } as any]
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
    } catch (err: any) {
      console.error("Camera start failed:", err);
      // NotReadableError (Device in use) 발생 시 OS 하드웨어 락 해제 지연으로 인한 것일 수 있으므로 재시도
      if (err.name === 'NotReadableError' && retryCount < 3) {
        console.warn(`Camera in use, retrying... (${retryCount + 1}/3)`);
        setTimeout(() => startCamera(retryCount + 1), 500);
        return;
      }
      setError("카메라 접근 권한이 없거나, 지원하지 않는 브라우저입니다.");
    }
  }, [idealFacingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // [중요] 리렌더링 시 간혹 srcObject가 유실되거나 멈추는 현상(검은 화면) 방지용 Enforcer
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  });

  // 컴포넌트 마운트 해제 시 카메라 즉시 종료 (메모리 및 배터리 누수 방지)
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return { stream, error, videoRef, startCamera, stopCamera };
}
