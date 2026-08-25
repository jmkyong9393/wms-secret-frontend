/** HITL 결재 폼 선택지 (결정·확정 등급·오버라이드 사유). */
export const DECISION_OPTIONS = [
  { value: "APPROVE_NORMAL", label: "정상 승인 (입고)" },
  { value: "APPROVE_DOWNGRADE", label: "등급 하향 승인" },
  { value: "REJECT_RETURN", label: "반려 (출판사/고객 반송)" },
  { value: "RE_CHECK", label: "재검수 요청 (재촬영)" },
];

export const GRADE_OPTIONS = [
  { value: "MINT", label: "MINT (최상급)" },
  { value: "GOOD", label: "GOOD (상급)" },
  { value: "NORMAL", label: "NORMAL (중급)" },
  { value: "REJECT", label: "REJECT (폐기)" },
];

export const REASON_OPTIONS = [
  { group: "오탐 방어 (정정)", items: [
    { value: "FP_SHADOW", label: "그림자 오탐" },
    { value: "FP_GLARE", label: "빛 반사 오탐" },
  ]},
  { group: "외부 손상", items: [
    { value: "DMG_EXT_CRUSH", label: "모서리 찌그러짐" },
    { value: "DMG_EXT_WET", label: "외부 습기/침수" },
    { value: "DMG_EXT_TEAR", label: "커버 찢어짐" },
  ]},
  { group: "내부 훼손", items: [
    { value: "DMG_INT_DOODLE", label: "내부 손글씨/낙서" },
    { value: "DMG_INT_STAIN", label: "내지 오염/이물질" },
    { value: "DMG_INT_DISCOLOR", label: "내지 황변/변색" },
  ]},
];
