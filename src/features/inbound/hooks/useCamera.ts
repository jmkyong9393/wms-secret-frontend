import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCameraOptions {
  idealFacingMode?: 'environment' | 'user';
}

/**
 * 카메라 품질 모드 - 용도별 해상도 분리.
 * - barcode: ZXing 1D 바코드(EAN-13) 픽셀 연산의 스윗스팟인 720p. 해상도가 높으면
 *   오히려 스캔 속도/인식률이 떨어진다.
 * - inspection: AI 검수 촬영용 FHD. S3 원본 화질을 확보해 백엔드 책 ROI 크롭 후에도
 *   미세 결함(Wornout) 픽셀이 보존되게 한다. (그 이상은 GPT-4o 타일 과금만 늘어 비추천)
 */
export type CameraQuality = 'barcode' | 'inspection';

const QUALITY_PRESETS: Record<CameraQuality, { width: number; height: number }> = {
  barcode: { width: 1280, height: 720 },
  inspection: { width: 1920, height: 1080 },
};

export function useCamera({ idealFacingMode = 'environment' }: UseCameraOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qualityRef = useRef<CameraQuality>('barcode');

  const startCamera = useCallback(async (quality: CameraQuality = 'barcode', retryCount = 0) => {
    const preset = QUALITY_PRESETS[quality];

    if (streamRef.current) {
      // 이미 켜져 있으면 스트림 재생성 없이 품질만 전환 (검은 화면 깜빡임 방지).
      // applyConstraints 미지원/실패 시엔 기존 해상도 유지 - 촬영 자체는 계속 가능해야 한다.
      if (qualityRef.current !== quality) {
        qualityRef.current = quality;
        const track = streamRef.current.getVideoTracks()[0];
        try {
          await track?.applyConstraints({ width: { ideal: preset.width }, height: { ideal: preset.height } });
        } catch (e) {
          console.warn(`Camera quality switch(${quality}) failed, keeping current resolution:`, e);
        }
      }
      return;
    }

    qualityRef.current = quality;
    try {
      // 디바이스 최대 화질을 가져오되, 모바일 브라우저 한계상 ideal 제약조건 사용 (디바이스 의존)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: idealFacingMode,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
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
        setTimeout(() => startCamera(quality, retryCount + 1), 500);
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
