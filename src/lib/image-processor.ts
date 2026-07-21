/**
 * 이미지 전처리 유틸리티 (WASM OpenCV 대체용 순수 Canvas 버전)
 *
 * Laplacian Variance 엣지 검출 알고리즘을 사용해 이미지 흔들림 점수를 계산합니다.
 * 모바일 기기 브라우저 성능을 위해 중앙 400x400 영역만 한정 크롭하여 연산합니다.
 */

export interface ProcessedImage {
  blob: Blob;
  previewUrl: string;
  isBlurred: boolean;
  blurScore: number;
}

/**
 * 라플라시안 분산(Laplacian Variance) 알고리즘 구현
 * 값이 낮을수록 경계선(Edge)이 뭉개진 상태이므로 흔들림이 심한 사진입니다.
 */
function calculateBlurScore(imageData: ImageData): number {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // 1. 회색조(Grayscale) 변환
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] =
      data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  // 2. 3x3 라플라시안 커널 적용 (엣지 추출)
  // [ 0,  1,  0 ]
  // [ 1, -4,  1 ]
  // [ 0,  1,  0 ]
  const laplacian = new Float32Array(width * height);
  let mean = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        grayscale[(y - 1) * width + x] +
        grayscale[(y + 1) * width + x] +
        grayscale[y * width + (x - 1)] +
        grayscale[y * width + (x + 1)] -
        4 * grayscale[idx];

      laplacian[idx] = val;
      mean += val;
      count++;
    }
  }

  mean /= count;

  // 3. 분산(Variance) 산출
  let variance = 0;
  for (let i = 0; i < laplacian.length; i++) {
    if (laplacian[i] !== 0) {
      variance += Math.pow(laplacian[i] - mean, 2);
    }
  }

  return variance / count;
}

/**
 * 10MB 상당의 원본 비디오 프레임을 모바일 화면 해상도에 맞춰 압축하고 흔들림을 측정합니다.
 */
export async function processImage(video: HTMLVideoElement): Promise<ProcessedImage> {
  const canvas = document.createElement("canvas");
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // FHD(1920x1080) 기준으로 리사이징
  const MAX_SIZE = 1920;
  let targetWidth = vw;
  let targetHeight = vh;

  if (vw > vh && vw > MAX_SIZE) {
    targetHeight = Math.round((vh * MAX_SIZE) / vw);
    targetWidth = MAX_SIZE;
  } else if (vh > vw && vh > MAX_SIZE) {
    targetWidth = Math.round((vw * MAX_SIZE) / vh);
    targetHeight = MAX_SIZE;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not supported");

  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  // 흔들림 검사를 위해 중앙부 400x400 영역 크롭 추출
  const cropSize = Math.min(targetWidth, targetHeight, 400);
  const startX = (targetWidth - cropSize) / 2;
  const startY = (targetHeight - cropSize) / 2;
  const imageData = ctx.getImageData(startX, startY, cropSize, cropSize);

  const blurScore = calculateBlurScore(imageData);
  const BLUR_THRESHOLD = 80;
  const isBlurred = blurScore < BLUR_THRESHOLD;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        resolve({
          blob,
          previewUrl: URL.createObjectURL(blob),
          isBlurred,
          blurScore,
        });
      },
      "image/jpeg",
      0.7
    );
  });
}
