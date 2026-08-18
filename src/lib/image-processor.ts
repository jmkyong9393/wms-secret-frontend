/**
 * 이미지 전처리 유틸리티 (WASM OpenCV 대체용 순수 Canvas 버전)
 *
 * Laplacian Variance 엣지 검출 알고리즘을 사용해 이미지 흔들림 점수를 계산합니다.
 * 모바일 기기 성능을 위해 프레임 전체를 480px 이하로 축소한 뒤 연산합니다
 * (종전에는 중앙 400x400만 봤으나 그 창이 단색 영역에 걸리면 오탐이 났다 - 아래 정정 이력 참조).
 */

export interface ProcessedImage {
  blob: Blob;
  previewUrl: string;
  isBlurred: boolean;
  blurScore: number;
  /**
   * 피사체 대비가 너무 낮아 흔들림 판정 자체가 무의미한 경우 true.
   * 이때 isBlurred는 항상 false다 (판정 불가를 '흔들림'으로 처리하지 않는다).
   */
  blurIndeterminate: boolean;
}

import imageCompression from 'browser-image-compression';

/**
 * 라플라시안 분산(Laplacian Variance) 기반 흔들림 점수.
 * 값이 낮을수록 경계선(Edge)이 뭉개진 상태이므로 흔들림이 심한 사진입니다.
 *
 * [2026-08-06 정정] 종전 구현에는 두 가지 결함이 있어 **선명한 사진도 반복 반려**됐다.
 *  1) 분산 합계는 `laplacian[i] !== 0`인 픽셀만 더하면서 나누기는 전체 픽셀 수로 했다.
 *     평탄한 면(벽, 민무늬 표지 여백)은 라플라시안이 정확히 0이라 분자에서 빠지고
 *     분모에만 남아, 흔들리지 않았는데도 점수가 0에 수렴한다.
 *  2) 배열 전체(테두리 포함)를 순회하는데 테두리는 커널을 적용하지 않아 항상 0이었다.
 *
 * 이제 커널이 실제로 적용된 내부 픽셀만으로 평균과 분산을 일관되게 계산한다.
 * 대비(contrast)도 함께 돌려준다 - 피사체가 평탄하면 라플라시안 분산은 흔들림이 아니라
 * "볼 엣지가 없음"을 뜻하므로, 그 구분 없이 반려하면 안 된다.
 */
function calculateBlurScore(imageData: ImageData): { score: number; contrast: number } {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // 1. 회색조(Grayscale) 변환
  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  // 2. 3x3 라플라시안 커널 적용 (엣지 추출)
  // [ 0,  1,  0 ]
  // [ 1, -4,  1 ]
  // [ 0,  1,  0 ]
  const interior = Math.max(0, (width - 2) * (height - 2));
  if (interior === 0) return { score: 0, contrast: 0 };

  const laplacian = new Float32Array(interior);
  let sum = 0;
  let k = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        grayscale[(y - 1) * width + x] +
        grayscale[(y + 1) * width + x] +
        grayscale[y * width + (x - 1)] +
        grayscale[y * width + (x + 1)] -
        4 * grayscale[idx];

      laplacian[k++] = val;
      sum += val;
    }
  }

  // 3. 분산(Variance) - 합계와 개수의 모집단을 일치시킨다
  const mean = sum / interior;
  let variance = 0;
  for (let i = 0; i < interior; i++) {
    const d = laplacian[i] - mean;
    variance += d * d;
  }

  // 4. 명암 대비(표준편차) - 흔들림 판정의 유효성 판단에 쓴다
  let gSum = 0;
  for (let i = 0; i < grayscale.length; i++) gSum += grayscale[i];
  const gMean = gSum / grayscale.length;
  let gVar = 0;
  for (let i = 0; i < grayscale.length; i++) {
    const d = grayscale[i] - gMean;
    gVar += d * d;
  }

  return {
    score: variance / interior,
    contrast: Math.sqrt(gVar / grayscale.length),
  };
}

/**
 * 10MB 상당의 원본 비디오 프레임을 모바일 화면 해상도에 맞춰 압축하고 흔들림을 측정합니다.
 * @param video 카메라 스트림이 나오는 비디오 엘리먼트
 * @param guideBox UI 상에 그려진 흰색 점선 영역 엘리먼트 (이 영역만 크롭하기 위함)
 */
export async function processImage(video: HTMLVideoElement, guideBox?: HTMLDivElement | null): Promise<ProcessedImage> {
  const canvas = document.createElement("canvas");
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  // --- [핵심 개선] 스마트폰/PC 화면 크기에 상관없이 UI 가이드박스 영역만 정확히 도려내기 (Dynamic BBox Crop) ---
  
  // 1. 화면에 렌더링된 비디오와 가이드박스의 실제 물리적 크기 및 위치 가져오기
  const videoRect = video.getBoundingClientRect();
  const guideRect = guideBox ? guideBox.getBoundingClientRect() : videoRect;

  // 2. object-cover 속성으로 인해 잘려나간 비디오의 스케일(비율) 계산
  // object-cover는 가로/세로 중 더 많이 꽉 차는 쪽을 기준으로 스케일업합니다.
  const scale = Math.max(videoRect.width / vw, videoRect.height / vh);

  // 3. 화면 상에서 비디오가 렌더링될 때 중앙 정렬(object-position: center)되면서 생기는 오프셋(잘린 여백) 계산
  // 실제 비디오가 렌더링된 물리적 크기
  const renderedVideoWidth = vw * scale;
  const renderedVideoHeight = vh * scale;
  // 화면 중앙에 렌더링되므로, 비디오 영역(videoRect)과 실제 그려진 영역의 차이 절반이 오프셋
  const offsetX = (videoRect.width - renderedVideoWidth) / 2;
  const offsetY = (videoRect.height - renderedVideoHeight) / 2;

  // 4. 가이드박스의 화면상 좌표를 순수 원본 비디오(Raw Video) 픽셀 좌표로 역산(Mapping)
  // guideRect.left - videoRect.left : 비디오 컨테이너 좌상단 기준 가이드박스의 X 위치
  const sourceX = Math.max(0, (guideRect.left - videoRect.left - offsetX) / scale);
  const sourceY = Math.max(0, (guideRect.top - videoRect.top - offsetY) / scale);
  const sourceW = Math.min(vw - sourceX, guideRect.width / scale);
  const sourceH = Math.min(vh - sourceY, guideRect.height / scale);

  // 최종 캔버스 해상도 결정.
  // 1080 -> 1920 상향: 백엔드가 책 ROI를 다시 크롭한 뒤 YOLO(imgsz=800)에
  // 넣으므로, 소스가 작으면 크롭 시점에 업샘플링이 일어나 미세 마모(Wornout) 픽셀이
  // 뭉개진다. 스마트폰 센서가 더 높아도 이 값이 하드 캡으로 규격화한다 (업스케일은 없음).
  const MAX_CANVAS_WIDTH = 1920;
  const targetWidth = Math.min(sourceW, MAX_CANVAS_WIDTH);
  const targetHeight = targetWidth * (sourceH / sourceW);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not supported");

  // 역산된 정확한 픽셀 좌표(sourceX, Y)에서 가이드박스 크기(sourceW, H)만큼만 캔버스에 그리기
  ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, targetWidth, targetHeight);

  // 흔들림 검사 영역.
  // [2026-08-06 정정] 종전에는 중앙 400x400만 봤다. 1920폭 기준 화면의 20%에 불과해,
  // 표지 중앙의 단색 여백이나 배경 벽이 그 창에 들어오면 **선명한 사진도 반려**됐다
  // (실제로 5장째부터 계속 반려되는 증상). 프레임 전체를 축소해 판정한다 -
  // 글자·모서리 등 엣지가 어디에 있든 점수에 반영되고, 연산량도 오히려 준다.
  const SAMPLE_MAX = 480;
  const sampleScale = Math.min(1, SAMPLE_MAX / Math.max(targetWidth, targetHeight));
  const sw = Math.max(3, Math.round(targetWidth * sampleScale));
  const sh = Math.max(3, Math.round(targetHeight * sampleScale));

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) throw new Error("Canvas context is not supported");
  sampleCtx.drawImage(canvas, 0, 0, sw, sh);

  const { score: blurScore, contrast } = calculateBlurScore(sampleCtx.getImageData(0, 0, sw, sh));

  // 대비가 바닥이면 라플라시안 분산은 "흔들렸다"가 아니라 "볼 엣지가 없다"는 뜻이다.
  // 이 경우 판정을 포기한다 - 판정 불가를 흔들림으로 처리하면 사용자가 빠져나갈 수 없다.
  const MIN_CONTRAST = 12;
  const BLUR_THRESHOLD = 25;
  const blurIndeterminate = contrast < MIN_CONTRAST;
  const isBlurred = !blurIndeterminate && blurScore < BLUR_THRESHOLD;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        
        try {
          // 브라우저 이미지 압축 적용.
          // 1MB -> 2.5MB 상향: FHD 디테일 이미지를 1MB로 누르면 JPEG
          // 아티팩트가 스크래치처럼 보여 Wornout 오탐을 유발한다. S3 비용은 무시 가능 수준.
          const options = {
            maxSizeMB: 2.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: "image/jpeg"
          };
          
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          const compressedFile = await imageCompression(file, options);

          resolve({
            blob: compressedFile,
            previewUrl: URL.createObjectURL(compressedFile),
            isBlurred,
            blurScore,
            blurIndeterminate,
          });
        } catch (error) {
          console.error("Image compression failed, fallback to canvas blob:", error);
          resolve({
            blob,
            previewUrl: URL.createObjectURL(blob),
            isBlurred,
            blurScore,
            blurIndeterminate,
          });
        }
      },
      "image/jpeg",
      0.9
    );
  });
}
