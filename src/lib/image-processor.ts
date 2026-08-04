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

import imageCompression from 'browser-image-compression';

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
  // [2026-08-05] 1080 -> 1920 상향: 백엔드가 책 ROI를 다시 크롭한 뒤 YOLO(imgsz=800)에
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

  // 흔들림 검사를 위해 중앙부 400x400 영역 크롭 추출 (이전과 동일)
  const cropSize = Math.min(targetWidth, targetHeight, 400);
  const startX = (targetWidth - cropSize) / 2;
  const startY = (targetHeight - cropSize) / 2;
  const imageData = ctx.getImageData(startX, startY, cropSize, cropSize);

  const blurScore = calculateBlurScore(imageData);
  const BLUR_THRESHOLD = 80;
  const isBlurred = blurScore < BLUR_THRESHOLD;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        
        try {
          // 브라우저 이미지 압축 적용.
          // [2026-08-05] 1MB -> 2.5MB 상향: FHD 디테일 이미지를 1MB로 누르면 JPEG
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
          });
        } catch (error) {
          console.error("Image compression failed, fallback to canvas blob:", error);
          resolve({
            blob,
            previewUrl: URL.createObjectURL(blob),
            isBlurred,
            blurScore,
          });
        }
      },
      "image/jpeg",
      0.9
    );
  });
}
