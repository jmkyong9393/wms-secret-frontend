/**
 * 화면에 그려진 가이드박스를 원본 비디오 픽셀 좌표로 역산한다.
 *
 * `object-cover`는 가로/세로 중 더 많이 채우는 쪽 기준으로 확대한 뒤 중앙 정렬하므로,
 * 화면 좌표를 그대로 쓰면 잘려나간 여백만큼 어긋난다. 스케일과 중앙 오프셋을 되돌려야
 * "작업자가 가이드 안에 넣은 것"과 "실제로 잘라낸 픽셀"이 일치한다.
 *
 * 입고 검수(image-processor.ts)가 촬영본을 자를 때 쓰는 것과 같은 원리다.
 */
export interface VideoRoi {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function mapGuideToVideoRoi(
  video: HTMLVideoElement,
  guide: HTMLElement | null,
  /** 가이드 밖으로 넓힐 여유 비율. 살짝 벗어난 바코드도 잡으려면 0보다 크게 준다. */
  padRatio = 0,
): VideoRoi {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh) return { sx: 0, sy: 0, sw: 0, sh: 0 };
  if (!guide) return { sx: 0, sy: 0, sw: vw, sh: vh };

  const videoRect = video.getBoundingClientRect();
  const guideRect = guide.getBoundingClientRect();
  if (!videoRect.width || !videoRect.height) return { sx: 0, sy: 0, sw: vw, sh: vh };

  const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
  const offsetX = (videoRect.width - vw * scale) / 2;
  const offsetY = (videoRect.height - vh * scale) / 2;

  let sw = guideRect.width / scale;
  let sh = guideRect.height / scale;
  let sx = (guideRect.left - videoRect.left - offsetX) / scale;
  let sy = (guideRect.top - videoRect.top - offsetY) / scale;

  if (padRatio > 0) {
    const px = sw * padRatio;
    const py = sh * padRatio;
    sx -= px;
    sy -= py;
    sw += px * 2;
    sh += py * 2;
  }

  sx = Math.max(0, Math.min(sx, vw - 1));
  sy = Math.max(0, Math.min(sy, vh - 1));
  sw = Math.max(1, Math.min(sw, vw - sx));
  sh = Math.max(1, Math.min(sh, vh - sy));

  return { sx, sy, sw, sh };
}
