'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader as ZXingBrowserReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useCamera } from '@/features/inbound/hooks/useCamera';

/**
 * 출고 피킹용 바코드 스캐너.
 * LPN(중고, CODE_128/QR)과 ISBN(신품, EAN-13)을 모두 읽어 onDetected로 넘긴다.
 * 입고 검수와 동일하게 ZXing + 브라우저 내장 BarcodeDetector를 병렬로 돌린다 -
 * 두 엔진의 실패 양상이 달라 서로를 덮는다.
 */
interface Props {
  onDetected: (code: string) => void;
  /** 서버 검증 중에는 멈춰 같은 책이 연속 제출되지 않게 한다. */
  paused?: boolean;
}

// 같은 코드를 다시 받기까지의 최소 간격. 바코드를 대고 있는 동안 초당 수십 번
// 읽히는데, 그대로 넘기면 한 번 스캔에 검증 요청이 폭주한다.
const RESCAN_COOLDOWN_MS = 2500;

export default function PickingBarcodeScanner({ onDetected, paused = false }: Props) {
  const { videoRef, startCamera, stopCamera, error } = useCamera();
  const codeReader = useRef<ZXingBrowserReader | null>(null);
  const lastHitRef = useRef<{ code: string; at: number } | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // 콜백을 ref로 들고 스캔 루프의 의존성에서 뺀다. 부모가 인라인 함수를 넘기면
  // 리렌더마다 엔진이 재시작되어 스캔이 계속 끊긴다.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  // 바코드 모드로 켠다 (FHD + 줌 2x). 검수 촬영용 inspection 모드는 화각이 넓어
  // 바코드가 차지하는 픽셀이 부족하다.
  useEffect(() => {
    startCamera('barcode');
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (paused) return;

    if (!codeReader.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      // 손에 든 폰은 미세하게 흔들려 초점이 맞는 순간이 짧다 - 시도 빈도를 올린다.
      codeReader.current = new ZXingBrowserReader(hints, { delayBetweenScanAttempts: 200 });
    }

    let scanning = true;
    let controlsRef: any = null;

    const accept = (text: string): boolean => {
      if (!scanning || !text || text.length < 4) return false;
      const now = Date.now();
      const prev = lastHitRef.current;
      if (prev && prev.code === text && now - prev.at < RESCAN_COOLDOWN_MS) return false;
      lastHitRef.current = { code: text, at: now };
      return true;
    };

    const emit = (text: string) => {
      setLastCode(text);
      new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
        .play().catch(() => {});
      onDetectedRef.current(text);
    };

    const run = async () => {
      if (!videoRef.current) return;

      // 1. ZXing
      try {
        const controls = await codeReader.current?.decodeFromVideoElement(
          videoRef.current,
          (result: any, _err: any, c: any) => {
            controlsRef = c;
            if (result && scanning) {
              const text = result.getText();
              if (accept(text)) emit(text);
            }
          },
        );
        controlsRef = controlsRef || controls;
        // 대기 중 화면을 벗어났다면 정리 함수는 이미 지나갔다. 직접 멈춘다.
        if (!scanning) {
          controls?.stop();
          controlsRef = null;
        }
      } catch (e) {
        console.warn('ZXing decode error:', e);
      }

      // 2. 브라우저 내장 디텍터 (하드웨어 가속, 병렬)
      if ('BarcodeDetector' in window) {
        // code_128 미지원 기기는 생성 자체가 throw하므로 축소 세트로 재시도한다.
        let detector: any = null;
        for (const formats of [
          ['ean_13', 'ean_8', 'code_128', 'qr_code'],
          ['ean_13', 'ean_8', 'qr_code'],
        ]) {
          try {
            // @ts-ignore
            detector = new window.BarcodeDetector({ formats });
            break;
          } catch {
            detector = null;
          }
        }
        if (detector) {
          const loop = async () => {
            if (!scanning || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                const text = codes[0].rawValue;
                if (accept(text)) emit(text);
              }
            } catch {
              // 비디오가 아직 안 올라온 프레임 등 - 다음 프레임에서 재시도
            }
            if (scanning) requestAnimationFrame(loop);
          };
          loop();
        }
      }
    };
    run();

    return () => {
      scanning = false;
      controlsRef?.stop();
      controlsRef = null;
    };
  }, [paused]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-2xl">
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900 text-white p-4 text-center text-sm">
          {error}
        </div>
      )}

      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

      {/* 바코드 조준 가이드 */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[78%] h-[32%] border-4 border-dashed border-emerald-400/80 rounded-lg relative">
          <div className="absolute -top-7 left-0 right-0 text-center text-white/90 text-xs font-bold">
            바코드를 이 안에 맞춰주세요 (15~25cm)
          </div>
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-emerald-400/70" />
        </div>
      </div>

      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 text-[10px] font-mono font-bold text-emerald-300">
        {paused ? '검증 중…' : 'LPN / ISBN 스캔 중'}
      </div>

      {lastCode && (
        <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg bg-emerald-500/90 text-white text-xs font-mono font-black text-center truncate">
          {lastCode}
        </div>
      )}
    </div>
  );
}
