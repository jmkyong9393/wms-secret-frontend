import { useEffect, useRef, useState, type RefObject } from 'react';
import { BrowserMultiFormatReader as ZXingBrowserReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { validateIsbn13, isLpnCode } from '../isbnValidation';

/**
 * 이중 바코드 스캔 엔진 (ZXing + BarcodeDetector 병렬) + 오독 방어 게이트.
 * 검증 규칙: ISBN-13 체크디지트 + 동일 코드 2회 일치(최소 250ms 간격).
 * 채택 확정된 코드만 opts.onCode로 넘긴다 - LPN/ISBN 분기는 호출측(페이지) 소관.
 */
export function useBarcodeScanEngine(opts: {
  /** 스캔 화면 활성 여부 (step === 'SCAN_BARCODE') */
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 채택 확정 코드 처리 (LPN 재촬영 / 신품 / 중고 채번 분기) */
  onCode: (text: string) => void | Promise<void>;
}) {
  // 실제 바코드(ISBN) 스캐닝 로직 (ZXing Browser)
  const codeReader = useRef<ZXingBrowserReader | null>(null);

  // 바코드 인식 처리 중복 방지 잠금.
  //
  // 스캔은 두 엔진(ZXing 콜백 + BarcodeDetector rAF 루프)이 동시에 돌고, 화면을
  // SCAN_BARCODE로 되돌아올 때마다 새 세션이 시작된다. 세션 안의 지역 플래그로는
  // 다른 세션의 중복 처리를 막지 못해, 한 번 스캔에 LPN이 여러 개 채번된 적이 있다.
  // ref는 컴포넌트에 하나뿐이라 모든 세션·콜백이 같은 잠금을 공유한다.
  const isHandlingScanRef = useRef(false);

  // --- 오독 방어 ---
  // 스캔 거절 사유를 화면에 띄운다. 아무 반응 없이 계속 스캔만 되면 작업자는
  // "왜 안 잡히지"만 반복하게 되므로, 무엇이 잘못됐는지 그 자리에서 알려준다.
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  // 같은 코드가 두 번 나와야 채택한다. ZXing과 BarcodeDetector가 이미 동시에 돌고 있어
  // 추가 비용 없이 교차 확인이 된다. 광학 오독은 접두어·체크디지트를 통과하더라도
  // 똑같은 값으로 재현되는 일이 드물어, 접두어 검사가 놓친 오독까지 여기서 걸린다.
  // 단, 두 히트 사이에 최소 간격을 둔다 - BarcodeDetector rAF 루프는 연속 프레임
  // (약 16ms 간격)에서 같은 흐린 순간을 두 번 읽을 수 있는데, 그건 독립 확인이 아니라
  // 같은 오독의 반복이다. 간격을 강제하면 손 떨림으로 프레임이 바뀐 뒤의 재확인이 된다.
  const scanCandidateRef = useRef<{ code: string; hits: number; lastHitAt: number } | null>(null);
  const SCAN_CONFIRM_HITS = 2;
  const SCAN_CONFIRM_MIN_GAP_MS = 250;

  useEffect(() => {
    if (opts.active) {
      // 스캔 화면에 들어올 때만 잠금을 푼다. 직전 스캔 처리가 끝났다는 뜻이다.
      isHandlingScanRef.current = false;
      scanCandidateRef.current = null;
      setScanWarning(null);

      if (!codeReader.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, 
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE // LPN 재촬영을 위해 QR코드 인식 추가
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        // 스캔 시도 간격 기본 500ms → 200ms. 손에 든 폰은 미세하게 흔들려서 초점이
        // 맞는 순간이 짧다 - 시도 빈도를 올려 그 순간을 잡을 확률을 높인다.
        codeReader.current = new ZXingBrowserReader(hints, { delayBetweenScanAttempts: 200 });
      }

      let scanning = true;
      let controlsRef: IScannerControls | null = null;

      const startScanning = async () => {
        if (!opts.videoRef.current) return;

        // 스캔 결과를 채택할지 판정한다. 통과한 것만 onSuccess로 넘어간다.
        // LPN 재촬영 QR은 ISBN이 아니므로 검증 대상에서 제외한다.
        const gateScan = (text: string): boolean => {
          if (isLpnCode(text)) return true;

          const verdict = validateIsbn13(text);
          if (!verdict.valid) {
            // 거절된 코드는 후보 누적에서도 지운다 - 잘못된 값이 두 번 읽혀 채택되면 안 된다.
            scanCandidateRef.current = null;
            setScanWarning(verdict.message || '바코드를 다시 스캔해 주세요.');
            return false;
          }

          const now = Date.now();
          const prev = scanCandidateRef.current;
          if (prev && prev.code === text) {
            // 같은 프레임 순간의 반복 판독은 세지 않는다 (독립 표본이 아님).
            if (now - prev.lastHitAt < SCAN_CONFIRM_MIN_GAP_MS) return false;
            scanCandidateRef.current = { code: text, hits: prev.hits + 1, lastHitAt: now };
          } else {
            scanCandidateRef.current = { code: text, hits: 1, lastHitAt: now };
          }
          if (scanCandidateRef.current.hits < SCAN_CONFIRM_HITS) {
            setScanWarning('바코드 확인 중… 잠시만 그대로 유지해 주세요.');
            return false;
          }
          setScanWarning(null);
          return true;
        };

        // 스캔 채택 판정 (동기). true를 돌려준 경우에만 잠금·엔진 정지가 끝난 상태다.
        // 판정과 처리를 분리한 이유: 두 엔진(ZXing 콜백 / BarcodeDetector rAF 루프)이
        // "거절이면 계속, 채택이면 정지"를 각자 판단해야 하는데, 비동기 처리 함수의
        // 부수효과(ref)를 들여다보게 하면 그 사이 다른 콜백이 끼어들 틈이 생긴다.
        // 채택 여부를 동기 반환값으로 확정하면 그 틈 자체가 없다.
        const tryAcceptScan = (text: string): boolean => {
          if (!scanning || isHandlingScanRef.current) return false;
          if (!gateScan(text)) return false;
          // 잠금은 비동기 경계 없이 여기서 즉시 건다. 뒤에 비동기 채번이 있어서, 늦게
          // 걸면 남은 세션들이 그 사이에 같은 바코드를 함께 통과시킨다.
          isHandlingScanRef.current = true;
          scanCandidateRef.current = null;
          scanning = false;
          if (controlsRef) {
            controlsRef.stop();
            controlsRef = null;
          }
          return true;
        };

        // 채택 확정된 스캔의 후속 처리. tryAcceptScan이 true일 때만 호출한다.
        const onSuccess = async (text: string) => {
          const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
          audio.play().catch(() => {});
          await opts.onCode(text);
        };

        // 1. ZXing Browser 오픈소스 엔진 (최적화)
        try {
          // 반환된 controls를 즉시 보관한다. 콜백 인자로만 받으면 바코드를 한 번도 못 읽고
          // 화면을 벗어났을 때 정리 함수가 세션을 멈추지 못해 세션이 계속 쌓인다.
          const controls = await codeReader.current?.decodeFromVideoElement(opts.videoRef.current, (result, error, controls) => {
            controlsRef = controls ?? null;
            if (result && scanning) {
              const text = result.getText();
              if (text && text.length >= 4 && tryAcceptScan(text)) {
                onSuccess(text);
              }
            }
          });
          controlsRef = controlsRef || controls || null;
          // 대기 중 화면을 벗어났다면 정리 함수는 이미 지나갔다. 직접 멈춘다.
          if (!scanning) {
            controls?.stop();
            controlsRef = null;
          }
        } catch (err) {
          console.warn("ZXing decode error:", err);
        }

        // 2. 최신 브라우저 내장 하드웨어 가속 바코드 디텍터 (병렬 실행)
        if ('BarcodeDetector' in window) {
          try {
            // @ts-expect-error BarcodeDetector는 표준 lib.dom에 없다
            const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'qr_code'] }); 
            
            const detectLoop = async () => {
              if (!scanning || !opts.videoRef.current) return;
              try {
                const barcodes = await barcodeDetector.detect(opts.videoRef.current);
                if (barcodes.length > 0) {
                  const text = barcodes[0].rawValue;
                  // 채택 확정일 때만 이 엔진 루프를 끝낸다. 종전에는 판독만 되면 무조건
                  // return이라, 검증 게이트에 걸러진 스캔 한 번에 엔진이 영구히 멈췄다 -
                  // "2회 일치"가 붙은 뒤로는 첫 판독이 항상 보류되므로 매번 멈추게 된다.
                  if (text && text.length >= 4 && tryAcceptScan(text)) {
                    onSuccess(text);
                    return;
                  }
                }
              } catch {
                // 무시 (비디오 덜 로딩됨 등)
              }
              if (scanning) {
                requestAnimationFrame(detectLoop);
              }
            };
            
            detectLoop();
          } catch (e) {
            console.warn("BarcodeDetector 병렬 실행 불가:", e);
          }
        }
      };

      // 비디오가 켜지고 약간의 지연 후 스캐닝 시작
      const timeoutId = setTimeout(startScanning, 500);

      return () => {
        scanning = false;
        clearTimeout(timeoutId);
        if (controlsRef) {
          controlsRef.stop();
          controlsRef = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.active]);

  return { scanWarning };
}
