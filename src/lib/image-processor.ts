/**
 * 이미지 전처리 유틸리티 (WASM OpenCV 대체용 순수 Canvas 버전)
 */

export interface ProcessedImage {
  blob: Blob;
  previewUrl: string;
  isBlurred: boolean;
  blurScore: number;
}

// 라플라시안 분산(Laplacian Variance) 알고리즘 구현 - 엣지 검출을 통한 흔들림 감지
function calculateBlurScore(imageData: ImageData): number {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // 회색조 변환
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  // 간단한 3x3 라플라시안 커널 적용 (엣지 검출)
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

  // 분산(Variance) 계산 -> 값이 작을수록 엣지가 적음 = 흔들린 사진
  let variance = 0;
  for (let i = 0; i < laplacian.length; i++) {
    if (laplacian[i] !== 0) { // 테두리 제외
      variance += Math.pow(laplacian[i] - mean, 2);
    }
  }
  
  return variance / count;
}

/**
 * 10MB 원본을 1MB 내외로 압축하고 흔들림을 검사합니다.
 */
export async function processImage(video: HTMLVideoElement): Promise<ProcessedImage> {
  const canvas = document.createElement('canvas');
  // 디바이스 원본 해상도
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // FHD(1920x1080) 기준으로 리사이징 (종횡비 유지)
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

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas context is not supported");

  // 비디오 프레임을 캔버스에 그리기
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  // 흔들림 검사를 위해 중앙부 픽셀 일부만 추출 (전체 검사는 너무 무거움)
  const cropSize = Math.min(targetWidth, targetHeight, 400); // 중앙 400x400 픽셀
  const startX = (targetWidth - cropSize) / 2;
  const startY = (targetHeight - cropSize) / 2;
  const imageData = ctx.getImageData(startX, startY, cropSize, cropSize);
  
  const blurScore = calculateBlurScore(imageData);
  
  // 임계값 (상황에 따라 튜닝 필요. 테스트상 50~100 이하면 많이 흔들림)
  const BLUR_THRESHOLD = 80; 
  const isBlurred = blurScore < BLUR_THRESHOLD;

  // 클라이언트 단독 초고속 압축 (JPEG, Quality 0.7)
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
      'image/jpeg',
      0.7
    );
  });
}
