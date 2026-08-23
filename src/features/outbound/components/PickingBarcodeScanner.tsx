'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flashlight, FlashlightOff, Loader2 } from 'lucide-react';
import { useCamera } from '@/shared/lib/useCamera';
import { mapGuideToVideoRoi } from '@/shared/lib/camera-roi';

/**
 * 출고 피킹 전용 바코드 스캐너 (LPN QR / ISBN EAN-13).
 *
 * 촬영 기능은 없다 - 피킹은 "무엇을 집었는지"만 확인하면 되므로 사진을 남기지 않는다.
 * 대신 인식 속도와 성공률에 자원을 몰아준다:
 *  1) 가이드박스 안쪽만 잘라 디코딩 (ROI) - 배경 잡음이 빠져 오독이 줄고 연산량도 준다
 *  2) 네이티브 BarcodeDetector 즉시 가동 + ZXing은 지연 로딩 - 첫 스캔까지의 대기가 없다
 *  3) 실패가 이어지면 전체 프레임도 주기적으로 훑어 가이드를 살짝 벗어난 코드도 건진다
 */
interface Props {
  onDetected: (code: string) => void;
  /** 서버 검증 중에는 멈춰 같은 책이 연속 제출되지 않게 한다. */
  paused?: boolean;
  /**
   * 형식 게이트. 도메인 규칙(LPN 패턴 / ISBN 접두어·체크디지트)은 화면이 알고 있으므로
   * 판정을 주입받는다. 거절되면 입력창을 건드리지 않고 사유만 띄운다 -
   * 택배 송장 QR처럼 무관한 코드가 조용히 채워지는 것을 막는다.
   */
  validate?: (raw: string) => { ok: boolean; message?: string };
}

// 같은 코드를 다시 받기까지의 최소 간격. 바코드를 대고 있는 동안 초당 수십 번 읽히는데,
// 그대로 넘기면 한 번 스캔에 검증 요청이 폭주한다.
const RESCAN_COOLDOWN_MS = 2500;
// 디코딩 주기. rAF(초당 60회)는 과하다 - 초당 8회면 체감 지연이 없고 발열·배터리를 아낀다.
const DECODE_INTERVAL_MS = 120;
// ROI를 가이드보다 이만큼 넓게 잡는다. 가이드에 딱 맞춘 사람은 드물다.
const ROI_PAD_RATIO = 0.12;
// ROI 캔버스 상한. LPN 라벨(50x31mm) 안의 16mm QR을 모듈당 여러 픽셀로 담기에 충분하고,
// 이 이상 키우면 디코딩만 느려진다.
const ROI_MAX_WIDTH = 1280;
// N회마다 한 번은 전체 프레임을 훑는다 (가이드 밖 코드 구제).
const FULL_FRAME_EVERY = 6;

export default function PickingBarcodeScanner({ onDetected, paused = false, validate }: Props) {
  const { videoRef, startCamera, stopCamera, stream, error } = useCamera();
  const guideRef = useRef<HTMLDivElement | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<any>(null);
  const detectorRef = useRef<any>(null);
  const lastHitRef = useRef<{ code: string; at: number } | null>(null);
  const tickRef = useRef(0);

  const [engineReady, setEngineReady] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // 콜백을 ref로 들고 디코딩 루프의 의존성에서 뺀다. 부모가 인라인 함수를 넘기면
  // 리렌더마다 루프가 재시작되어 스캔이 계속 끊긴다.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);
  const validateRef = useRef(validate);
  useEffect(() => { validateRef.current = validate; }, [validate]);

  // 바코드 모드(FHD + 줌 2x)로 켠다. 검수 촬영용 화각은 넓어 바코드 픽셀 밀도가 부족하다.
  useEffect(() => {
    startCamera('barcode');
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // 손전등 지원 여부 확인 (창고 저조도 대응)
  useEffect(() => {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
    setTorchSupported(!!caps.torch);
  }, [stream]);

  const toggleTorch = useCallback(async () => {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] } as any);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [stream, torchOn]);

  // --- 엔진 준비 ---
  // BarcodeDetector는 브라우저 내장이라 즉시 쓴다. ZXing은 번들이 무거우므로
  // 동적 import로 뒤에서 받아온다 - 카메라가 켜지는 순간부터 스캔이 가능해야 한다.
  useEffect(() => {
    let cancelled = false;

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      // code_128 미지원 기기는 생성 자체가 throw하므로 축소 세트로 재시도한다.
      for (const formats of [
        ['qr_code', 'ean_13', 'ean_8', 'code_128'],
        ['qr_code', 'ean_13', 'ean_8'],
      ]) {
        try {
          // @ts-ignore
          detectorRef.current = new window.BarcodeDetector({ formats });
          setEngineReady(true);
          break;
        } catch {
          detectorRef.current = null;
        }
      }
    }

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelled) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        readerRef.current = new BrowserMultiFormatReader(hints);
        setEngineReady(true);
      } catch (e) {
        console.warn('ZXing 로딩 실패 - 내장 디텍터로만 동작합니다:', e);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // --- 디코딩 루프 ---
  useEffect(() => {
    if (paused) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const emit = (text: string) => {
      const now = Date.now();
      const prev = lastHitRef.current;
      if (prev && prev.code === text && now - prev.at < RESCAN_COOLDOWN_MS) return;
      lastHitRef.current = { code: text, at: now };

      // 형식 게이트 — 지연 없이 걸러낸다. 지시서와의 대조는 서버가 하므로
      // 여기서는 "애초에 LPN/ISBN이 아닌 것"만 막는다.
      const verdict = validateRef.current?.(text);
      if (verdict && !verdict.ok) {
        setWarning(verdict.message || '인식된 코드가 LPN·ISBN 형식이 아닙니다.');
        return;
      }

      setWarning(null);
      setLastCode(text);
      setFlash(true);
      setTimeout(() => setFlash(false), 320);
      new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
        .play().catch(() => {});
      onDetectedRef.current(text);
    };

    const grabRoi = (): HTMLCanvasElement | null => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;

      // 주기적으로 전체 프레임을 본다 - 가이드를 살짝 벗어난 코드를 구제한다.
      const useFull = tickRef.current % FULL_FRAME_EVERY === FULL_FRAME_EVERY - 1;
      const roi = useFull
        ? { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight }
        : mapGuideToVideoRoi(video, guideRef.current, ROI_PAD_RATIO);
      if (!roi.sw || !roi.sh) return null;

      if (!roiCanvasRef.current) roiCanvasRef.current = document.createElement('canvas');
      const canvas = roiCanvasRef.current;
      const targetW = Math.min(roi.sw, ROI_MAX_WIDTH);
      const targetH = Math.max(1, Math.round(targetW * (roi.sh / roi.sw)));
      canvas.width = Math.round(targetW);
      canvas.height = targetH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, roi.sx, roi.sy, roi.sw, roi.sh, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    const tick = async () => {
      if (!alive) return;
      tickRef.current += 1;

      const canvas = grabRoi();
      if (canvas) {
        // 1) 네이티브 디텍터 (하드웨어 가속)
        if (detectorRef.current) {
          try {
            const found = await detectorRef.current.detect(canvas);
            if (alive && found?.length) {
              const text = String(found[0].rawValue || '').trim();
              if (text.length >= 4) emit(text);
            }
          } catch {
            // 프레임이 아직 안 올라옴 등 - 다음 주기에 재시도
          }
        }
        // 2) ZXing (다른 실패 양상을 덮는다)
        if (alive && readerRef.current) {
          try {
            const result = readerRef.current.decodeFromCanvas(canvas);
            const text = String(result?.getText?.() || '').trim();
            if (text.length >= 4) emit(text);
          } catch {
            // NotFoundException - 이 프레임에 코드가 없다는 뜻이므로 정상 흐름
          }
        }
      }

      if (alive) timer = setTimeout(tick, DECODE_INTERVAL_MS);
    };

    timer = setTimeout(tick, DECODE_INTERVAL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [paused, videoRef]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-2xl">
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900 text-white p-4 text-center text-sm">
          {error}
        </div>
      )}

      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

      {/* 인식 성공 플래시 */}
      {flash && <div className="absolute inset-0 z-20 bg-emerald-400/30 pointer-events-none" />}

      {/* 가이드 - LPN 라벨(50x31mm) 비율에 맞춘 창.
          라벨을 이 안에 꽉 채우면 16mm QR이 모듈당 충분한 픽셀로 잡힌다. */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center gap-2">
        <div
          ref={guideRef}
          className="relative w-[76%] rounded-lg"
          style={{ aspectRatio: '50 / 31' }}
        >
          {/* 모서리 브래킷 (점선 테두리보다 조준이 쉽다) */}
          {[
            'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
            'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
            'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
          ].map((cls) => (
            <span key={cls} className={`absolute w-7 h-7 border-emerald-400 ${cls}`} />
          ))}
          {!paused && (
            <span className="absolute left-2 right-2 top-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          )}
        </div>
        <p className="text-[11px] font-bold text-white/90 bg-black/50 px-2.5 py-1 rounded-full">
          LPN 라벨 또는 ISBN 바코드를 사각형에 꽉 채워주세요
        </p>
      </div>

      {/* 상태 배지 */}
      <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded-md bg-black/60 text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1">
        {paused ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> 검증 중…</>
        ) : engineReady ? (
          'QR · 바코드 인식 중'
        ) : (
          <><Loader2 className="w-3 h-3 animate-spin" /> 인식기 준비 중…</>
        )}
      </div>

      {/* 손전등 (창고 저조도) */}
      {torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          className={`absolute top-2 right-2 z-20 p-2 rounded-full cursor-pointer transition-colors ${
            torchOn ? 'bg-amber-400 text-gray-900' : 'bg-black/60 text-white'
          }`}
          title="손전등"
        >
          {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
        </button>
      )}

      {warning ? (
        <div className="absolute bottom-2 left-2 right-2 z-20 px-3 py-2 rounded-lg bg-rose-500/95 text-white text-[11px] font-bold text-center">
          ⚠️ {warning}
        </div>
      ) : lastCode ? (
        <div className="absolute bottom-2 left-2 right-2 z-20 px-3 py-2 rounded-lg bg-emerald-500/90 text-white text-xs font-mono font-black text-center truncate">
          {lastCode}
        </div>
      ) : null}
    </div>
  );
}
