/**
 * HITL 화면 전용 결함 코드 라벨 확장판.
 * entities/inspection/lib/meta.ts의 REASON_CODE_MAP과 코드가 일부 겹치지만 라벨·색·수록
 * 범위가 다르다(백엔드 DEFECT_TRANSLATION_MAP 동기화분 포함). 통일은 표시 변경이라 별도 과제.
 */
export const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DOODLE: { label: '내부 손글씨/낙서', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_STAIN: { label: '내지 오염/이물질', category: '내부 훼손', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  FP_SHADOW: { label: '그림자 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  // 백엔드 DEFECT_TRANSLATION_MAP과 동기화된 결함 코드 라벨.
  DMG_EXT_SCRATCH: { label: '표지 긁힘/스크래치', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_STICKER: { label: '스티커/바코드 자국', category: '외부 손상', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  DMG_EDGE_WEAR: { label: '모서리 마모', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_SPINE_CRACK: { label: '책등 갈라짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_BINDING_LOOSE: { label: '제본 벌어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_SIGNATURE: { label: '측면 서명/이름', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_STAMP: { label: '도서관/장서인 도장', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  // Supervisor가 사유 코드 없이 이관한 건은 백엔드가 이 상태 코드를 내려준다.
  // 매핑이 없으면 원시 코드가 그대로 노출되어 다른 관제 화면과 이질적으로 보였다.
  AWAITING_HUMAN_REVIEW: { label: '관리자 판독 대기', category: 'HITL 이관', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
};

/** HITL 이관 사유(라우팅 코드) 라벨. 결함 분류 코드(REASON_CODE_MAP)와는 별개 taxonomy. */
export const HITL_ESCALATION_LABELS: Record<string, { label: string; category: string; color: string }> = {
  NO_VALID_IMAGE_HITL: { label: '도서 미식별 (판독 불가)', category: 'HITL 이관 사유', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  CRITIC_RETRY_EXCEEDED: { label: '재검수 한도 초과', category: 'HITL 이관 사유', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
  SCORE_BOUNDARY: { label: '등급 경계 점수', category: 'HITL 이관 사유', color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  CRITIC_INTEGRITY_VIOLATION: { label: '판정 정합성 위반', category: 'HITL 이관 사유', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  AWAITING_HUMAN_REVIEW: { label: '관리자 판독 대기', category: 'HITL 이관 사유', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  OK: { label: '정합성 확인됨', category: 'HITL 이관 사유', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
};
