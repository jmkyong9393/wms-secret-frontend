import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCameraOptions {
  idealFacingMode?: 'environment' | 'user';
}

/**
 * 카메라 품질 모드 - 용도별 해상도 분리.
 * - barcode: FHD + 광학/디지털 줌 2x. 스마트폰 후면 기본 렌즈는 웹캠보다 화각이 넓어
 *   같은 거리에서 바코드가 차지하는 픽셀이 훨씬 적다. 720p에서는 EAN-13 최소 바 폭이
 *   1px 아래로 떨어져 디코딩이 안 되고, 가까이 대면 최소 초점거리(약 8~10cm) 안쪽이라
 *   초점이 안 잡히는 딜레마가 생긴다. 줌으로 초점거리 밖에서 픽셀 밀도를 확보한다.
 * - inspection: AI 검수 촬영용 FHD, 줌 없음(원본 화각). S3 원본 화질을 확보해 백엔드
 *   책 ROI 크롭 후에도 미세 결함(Wornout) 픽셀이 보존되게 한다.
 */
export type CameraQuality = 'barcode' | 'inspection';

const QUALITY_PRESETS: Record<CameraQuality, { width: number; height: number }> = {
  barcode: { width: 1920, height: 1080 },
  inspection: { width: 1920, height: 1080 },
};

const BARCODE_ZOOM = 2.0;

/**
 * 줌과 연속 초점을 **한 번에** 건다.
 *
 * [2026-08-13 수정 — 초점 유실 버그]
 * 종전에는 줌만 `applyConstraints({ advanced: [{ zoom }] })`로 걸었다. `advanced`는
 * 병합이 아니라 **집합 전체를 교체**하므로, getUserMedia 시점에 걸어둔
 * `focusMode: "continuous"`가 이 호출로 지워졌다. 바코드 모드는 항상 줌을 걸기 때문에
 * **스캔 화면에서만 연속 초점이 꺼지는** 상태였다 — 조장 실측 "초점을 못 잡는 것 같다",
 * "카메라 좋은 S23 Ultra는 거의 이상 없다"와 정확히 맞는 증상이다(AF가 강한 기기는
 * 연속 초점이 꺼져도 단발 AF로 버티지만, 그렇지 않은 기기는 흐린 프레임이 계속 남는다).
 * 흐린 프레임은 디코더가 바를 잘못 읽게 만들어 6->9 같은 광학 오독으로 이어진다.
 *
 * 기기가 지원하는 항목만 골라 넣는다 - 미지원 키가 섞이면 브라우저가 호출 전체를
 * 거부해 줌도 초점도 못 걸리기 때문이다.
 */
async function applyCameraTuning(track: MediaStreamTrack | undefined, quality: CameraQuality) {
  if (!track) return;
  try {
    const caps = (track.getCapabilities?.() ?? {}) as {
      zoom?: { min: number; max: number };
      focusMode?: string[];
    };

    const advanced: Record<string, unknown>[] = [];

    // 연속 초점은 두 모드 모두에 필요하다 (검수 촬영도 초점이 맞아야 결함이 보인다).
    if (caps.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }
    if (caps.zoom) {
      const target = quality === 'barcode'
        ? Math.min(BARCODE_ZOOM, caps.zoom.max)
        : caps.zoom.min;
      advanced.push({ zoom: target });
    }

    if (advanced.length === 0) return;
    await track.applyConstraints({ advanced } as any);
  } catch (e) {
    console.warn(`카메라 튜닝(${quality}) 적용 실패 - 기본값 유지:`, e);
  }
}

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
        await applyCameraTuning(track, quality);
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

      // 스트림 확보 직후 줌 + 연속 초점을 함께 건다 (지원 기기 한정, 실패해도 스캔 계속).
      // getUserMedia의 advanced는 best-effort라 여기서 실제 capabilities 기준으로 다시 확정한다.
      await applyCameraTuning(mediaStream.getVideoTracks()[0], quality);

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
