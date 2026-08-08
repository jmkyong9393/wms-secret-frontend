/**
 * HITL 자동 이관 규칙 · UBCI 등급 정책 (표시 전용 상수).
 *
 * 관리자 설정(읽기 전용 정책 뷰)과 HITL 결재 화면이 같은 규칙을 보여줘야 하므로
 * 한 곳에서만 정의한다. 양쪽에 각자 적어 두면 파이프라인이 바뀔 때 한쪽만 갱신되어
 * 심사자가 서로 다른 기준을 보게 된다.
 *
 * 출처
 *   - 등급 경계: UBCI_Specification_v2.0.0.0 §등급 체계, models/wms.py ubci_grade_from_score()
 *   - 이관 규칙: wms-secret-backend/.claude/rules/01-freeze-zones.md, supervisor/critic 노드
 */

export interface UbciGradePolicy {
  grade: string;
  range: string;
  /** 그 점수대의 실물이 어느 정도인지 */
  quality: string;
  /** 그래서 창고가 무엇을 하는지 */
  action: string;
  color: string;
  badge: string;
}

export const UBCI_GRADE_POLICY: UbciGradePolicy[] = [
  {
    grade: 'S급 (MINT)',
    range: '95 ~ 100점',
    quality: '거의 새 책. 결함이 없거나 육안으로 찾기 어려운 수준',
    action: '최고가 판매 · 자동 매입/환불',
    color: 'text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  {
    grade: 'A급 (GOOD)',
    range: '85 ~ 94점',
    quality: '가벼운 사용감. 모서리 마모나 표지 긁힘 정도, 내지는 깨끗',
    action: '입고 승인',
    color: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  {
    grade: 'B급 (NORMAL)',
    range: '65 ~ 84점',
    quality: '사용감이 뚜렷함. 낙서·오염·황변이 있으나 읽는 데 지장 없음',
    action: '감가 입고 승인',
    color: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  {
    grade: 'C급 (REJECT)',
    range: '0 ~ 64점',
    quality: '재판매 불가. 물젖음·제본 벌어짐 등 치명 결함은 점수와 무관하게 즉시 이 등급',
    action: '입고 반려 (반송/폐기)',
    color: 'text-rose-700 dark:text-rose-400',
    badge: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
];

/**
 * UBCI 점수 → 등급 (2026-08-08 신설).
 *
 * HITL 결재 폼의 처분/등급 기본값을 여기서 산정한다 - 종전에는 AI가 실제로 낸 점수와
 * 무관하게 모든 행이 처분 "등급 하향 승인" · 목표 등급 "B"로 초기화됐다("B"는
 * GRADE_OPTIONS/백엔드 ConditionGradeEnum 어디에도 없는 값이라 클램프도 안 먹었다).
 * 경계값은 models/wms.py UBCI_GRADE_SCORE_BANDS와 반드시 같게 유지한다(정본은 백엔드).
 */
export function gradeFromUbciScore(
  score: number | null | undefined
): 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT' | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  if (score >= 95) return 'MINT';
  if (score >= 85) return 'GOOD';
  if (score >= 65) return 'NORMAL';
  return 'REJECT';
}

/**
 * 점수 기반 추천 등급에 대응하는 기본 처분.
 *
 * 등급별 조치는 위 UBCI_GRADE_POLICY.action에 이미 명시되어 있다 - MINT/GOOD는
 * "입고 승인"(감가 없음 → 정상 승인), NORMAL은 "감가 입고 승인"(→ 등급 하향 승인),
 * REJECT는 "입고 반려"다. 두 문서가 서로 다른 기준을 말하면 안 되므로 그 표를 그대로 따른다.
 *
 * REJECT를 "등급 하향 승인"으로 잘못 기본값 잡으면 랙 배정이 Zone E 격리로 안 가고
 * 정상 재고 편입 경로를 타 버린다(admin/router.py는 decision이 REJECT로 시작해야
 * 반려 처리를 한다) - 등급과 처분의 매핑을 반드시 지켜야 하는 이유다.
 */
export function defaultDecisionForGrade(grade: string | null): string {
  if (grade === 'REJECT') return 'REJECT_RETURN';
  if (grade === 'MINT' || grade === 'GOOD') return 'APPROVE_NORMAL';
  return 'APPROVE_DOWNGRADE'; // NORMAL 및 미산출(null) 폴백
}

export interface HitlRoutingRule {
  /** 파이프라인이 남기는 reason_code. 코드가 없는 규칙은 판정 노드 이름을 쓴다. */
  code: string;
  title: string;
  detail: string;
  /** 심사자가 이 건에서 무엇을 먼저 봐야 하는지 */
  reviewHint: string;
}

export const HITL_ROUTING_POLICY: HitlRoutingRule[] = [
  {
    code: 'NO_VALID_IMAGE_HITL',
    title: '판독 커버리지 게이트',
    detail: '촬영 컷을 한 장도 유효하게 읽지 못한 경우. 점수를 내지 않고(null) MINT·자동 환불을 차단한다.',
    reviewHint: 'AI 판독 결과가 비어 있다. 사진을 직접 보고 판정하거나 재촬영을 요청한다.',
  },
  {
    code: 'Critic Stage A',
    title: '정합성 위반',
    detail: 'Vision 결함 수와 Policy 감점이 어긋나거나, BBox 누락·image_index 범위 초과·결함 0건인데 감점 발생 등 사실 대조에 실패한 경우.',
    reviewHint: '점수와 결함 목록이 서로 맞지 않는다. 결함 목록을 기준으로 다시 본다.',
  },
  {
    code: 'Critic Stage B',
    title: '판독 타당성 반려',
    detail: '인쇄물 오탐·중복 환각·special_notes 모순 등으로 재검수 루프가 2회를 초과한 경우.',
    reviewHint: '표지 인쇄를 결함으로 잡았을 수 있다. BBox를 켜고 실제 훼손인지 확인한다.',
  },
  {
    code: 'vision_failed',
    title: 'VLM 판독 실패',
    detail: 'Vision Agent(GPT-4o) 호출 자체가 실패한 경우. 결함 0건을 무결점으로 해석하지 않는다.',
    reviewHint: '판독이 없었던 것이지 흠이 없는 것이 아니다. 육안 판정이 필요하다.',
  },
  {
    code: '등급 경계',
    title: 'NORMAL / REJECT 경계선',
    detail: '점수가 반려 경계(65점) 부근이라 자동 확정 시 매입가 오차가 큰 경우.',
    reviewHint: '1~2점 차이로 반려 여부가 갈린다. 감점 근거를 하나씩 확인한다.',
  },
];
