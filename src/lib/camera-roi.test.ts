import { describe, it, expect } from 'vitest';
import { mapGuideToVideoRoi } from './camera-roi';

/**
 * ROI 역산이 틀리면 조용히 엉뚱한 영역을 읽는다(에러가 안 난다).
 * object-cover로 잘려나간 여백을 제대로 되돌리는지 좌표로 검증한다.
 */
function makeVideo(nativeW: number, nativeH: number, boxW: number, boxH: number) {
  return {
    videoWidth: nativeW,
    videoHeight: nativeH,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: boxW, height: boxH }),
  } as unknown as HTMLVideoElement;
}

function makeGuide(left: number, top: number, width: number, height: number) {
  return {
    getBoundingClientRect: () => ({ left, top, width, height }),
  } as unknown as HTMLElement;
}

describe('mapGuideToVideoRoi', () => {
  it('16:9 영상이 4:3 박스에 object-cover될 때 좌우 잘림을 되돌린다', () => {
    // 1920x1080을 400x300에 그리면 scale=0.2778, 좌우가 잘린다
    const video = makeVideo(1920, 1080, 400, 300);
    // 화면 중앙 304px 폭 가이드 (컨테이너 기준 left=48)
    const guide = makeGuide(48, 55.75, 304, 188.5);

    const roi = mapGuideToVideoRoi(video, guide);

    // 가이드가 화면 중앙이므로 ROI도 원본의 가로 중앙이어야 한다
    expect(roi.sx + roi.sw / 2).toBeCloseTo(960, 0);
    expect(roi.sw).toBeCloseTo(1094.4, 0);
    // 원본 경계를 넘지 않는다
    expect(roi.sx).toBeGreaterThanOrEqual(0);
    expect(roi.sx + roi.sw).toBeLessThanOrEqual(1920);
  });

  it('padRatio만큼 ROI를 넓히되 원본 밖으로 나가지 않는다', () => {
    const video = makeVideo(1920, 1080, 400, 300);
    const guide = makeGuide(48, 55.75, 304, 188.5);

    const base = mapGuideToVideoRoi(video, guide, 0);
    const padded = mapGuideToVideoRoi(video, guide, 0.12);

    expect(padded.sw).toBeGreaterThan(base.sw);
    expect(padded.sx).toBeGreaterThanOrEqual(0);
    expect(padded.sx + padded.sw).toBeLessThanOrEqual(1920);
    expect(padded.sy + padded.sh).toBeLessThanOrEqual(1080);
  });

  it('가이드가 없으면 전체 프레임을 돌려준다', () => {
    const video = makeVideo(1920, 1080, 400, 300);
    expect(mapGuideToVideoRoi(video, null)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it('비디오 메타데이터가 아직 없으면 빈 ROI를 돌려준다 (호출부가 건너뛰도록)', () => {
    const video = makeVideo(0, 0, 400, 300);
    expect(mapGuideToVideoRoi(video, makeGuide(0, 0, 10, 10))).toEqual({
      sx: 0, sy: 0, sw: 0, sh: 0,
    });
  });
});
