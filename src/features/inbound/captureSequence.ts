/**
 * 입고 검수 촬영 시퀀스 정의 (SSOT).
 *
 * [2026-08-06 변경] 필수 촬영이 2장(앞·뒤)에서 **3장(앞표지·뒤표지·책등)**으로 늘었다.
 * 백엔드 비전 파이프라인이 앞의 N장을 Track 1(YOLO 앙상블 판독)으로, 나머지를
 * Track 2·3(VLM 판독)으로 가르기 때문에, 이 개수와 순서는 서버와 계약 관계다.
 *
 *   서버 대응 상수: app/ai/agents/__init__.py 의 `TRACK1_IMAGE_COUNT`
 *   → 두 값이 어긋나면 책등 사진이 Track 1에서 누락되거나, 손이 찍힌 속지 사진이
 *     Track 1로 잘못 들어가 오탐이 늘어난다. 한쪽만 고치지 말 것.
 *
 * 순서도 계약이다. VLM 프롬프트가 "촬영 순서 관례"로 image_index를 해석하므로
 * 배열 순서를 바꾸면 서버 프롬프트도 같이 바꿔야 한다.
 */
export type CapturePhase = 'FRONT' | 'BACK' | 'SPINE' | 'INNER';

export interface CaptureShot {
  phase: CapturePhase;
  /** 썸네일 배지에 쓰는 짧은 이름 */
  short: string;
  /** 뷰파인더 툴팁 문구 */
  tip: string;
  /**
   * 뷰파인더 가이드박스의 Tailwind 크기 클래스.
   * processImage()가 이 박스 영역만 도려내므로, 피사체 모양과 맞지 않으면
   * 배경이 대량으로 섞여 들어간다(책등은 좁고 긴 띠 형태).
   */
  guideClass: string;
}

/** Track 1 필수 촬영 - 이 3장은 YOLO 앙상블이 직접 판독한다. */
export const TRACK1_SHOTS: readonly CaptureShot[] = [
  {
    phase: 'FRONT',
    short: '앞표지',
    tip: '1. 앞표지를 촬영하세요',
    guideClass: 'w-[90%] md:w-[75%] aspect-[1/1.45]',
  },
  {
    phase: 'BACK',
    short: '뒤표지',
    tip: '2. 뒤표지를 촬영하세요',
    guideClass: 'w-[90%] md:w-[75%] aspect-[1/1.45]',
  },
  {
    phase: 'SPINE',
    short: '책등',
    tip: '3. 책등(제본된 옆면)을 세로로 맞춰 촬영하세요',
    guideClass: 'w-[26%] md:w-[16%] aspect-[1/5]',
  },
] as const;

/** Track 1 필수 장수. 이 수를 채워야 AI 전송 버튼이 열린다. */
export const TRACK1_IMAGE_COUNT = TRACK1_SHOTS.length;

/** 4번째 이후 - 훼손 부위 자유 촬영(속지·책배 등). VLM이 판독한다. */
export const EXTRA_SHOT: CaptureShot = {
  phase: 'INNER',
  short: '추가',
  tip: `${TRACK1_IMAGE_COUNT + 1}. 훼손 부위(모서리·내지·책배 등) 자유 촬영`,
  guideClass: 'w-[90%] md:w-[75%] aspect-[1/1.45]',
};

/** 촬영한 장수에 대응하는 단계 정의를 돌려준다. */
export function shotAt(index: number): CaptureShot {
  return TRACK1_SHOTS[index] ?? EXTRA_SHOT;
}

/** 썸네일 배지 라벨 (4번째부터는 '추가 1', '추가 2' …). */
export function shotLabel(index: number): string {
  return index < TRACK1_IMAGE_COUNT
    ? TRACK1_SHOTS[index].short
    : `${EXTRA_SHOT.short} ${index - TRACK1_IMAGE_COUNT + 1}`;
}
