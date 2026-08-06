import { describe, it, expect } from 'vitest';
import {
  TRACK1_IMAGE_COUNT,
  TRACK1_SHOTS,
  EXTRA_SHOT,
  shotAt,
  shotLabel,
} from './captureSequence';

describe('입고 촬영 시퀀스', () => {
  it('필수 촬영은 3장이다 (백엔드 TRACK1_IMAGE_COUNT와 계약)', () => {
    // 이 값을 바꾸면 app/ai/agents/__init__.py 의 TRACK1_IMAGE_COUNT도 같이 바꿔야 한다.
    // 어긋나면 책등 사진이 YOLO 판독에서 누락되거나, 손이 찍힌 속지가 Track 1로 새어든다.
    expect(TRACK1_IMAGE_COUNT).toBe(3);
  });

  it('촬영 순서는 앞표지 → 뒤표지 → 책등이다 (VLM image_index 해석 기준)', () => {
    expect(TRACK1_SHOTS.map((s) => s.phase)).toEqual(['FRONT', 'BACK', 'SPINE']);
  });

  it('4장째부터는 자유 촬영 단계로 넘어간다', () => {
    expect(shotAt(0).phase).toBe('FRONT');
    expect(shotAt(2).phase).toBe('SPINE');
    expect(shotAt(3)).toBe(EXTRA_SHOT);
    expect(shotAt(99)).toBe(EXTRA_SHOT);
  });

  it('책등 가이드박스는 표지와 다른 좁고 긴 비율을 쓴다', () => {
    // processImage()가 가이드박스 영역만 도려내므로, 책등을 표지 비율로 찍으면
    // 배경이 대부분을 차지해 결함이 상대적으로 작아진다.
    const spine = TRACK1_SHOTS[2];
    expect(spine.guideClass).not.toBe(TRACK1_SHOTS[0].guideClass);
  });

  it('썸네일 라벨은 필수 3장 이후 순번을 붙인다', () => {
    expect(shotLabel(0)).toBe('앞표지');
    expect(shotLabel(1)).toBe('뒤표지');
    expect(shotLabel(2)).toBe('책등');
    expect(shotLabel(3)).toBe('추가 1');
    expect(shotLabel(5)).toBe('추가 3');
  });
});
