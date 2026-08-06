/**
 * 비밀번호 작성 규칙 (화면 사전검증 + 안내용).
 *
 * **최종 판정은 서버(app/core/password_policy.py)가 한다.** 여기 구현은 왕복 없이 즉시
 * 피드백을 주기 위한 거울이며, 임계값은 서버와 동일하게 유지해야 한다
 * (GET /api/v1/auth/password-policy로 서버 값을 조회할 수 있다).
 *
 * 프론트 검증만으로는 API를 직접 호출하는 경로를 막을 수 없으므로, 이 파일이 통과시켜도
 * 서버가 거부하면 그 결과가 최종이다.
 */

export const MIN_LENGTH_TWO_CLASSES = 10;
export const MIN_LENGTH_THREE_CLASSES = 8;
export const MAX_LENGTH = 64;
export const MAX_SEQUENTIAL_RUN = 4;

export const PASSWORD_POLICY_DESCRIPTIONS = [
  `영문/숫자/특수문자 중 2종류 조합 시 ${MIN_LENGTH_TWO_CLASSES}자 이상, 3종류 이상 조합 시 ${MIN_LENGTH_THREE_CLASSES}자 이상`,
  `연속되거나 동일한 문자/숫자 ${MAX_SEQUENTIAL_RUN}자 이상 사용 금지 (예: 1234, aaaa)`,
  '사번, 이름 등 유추하기 쉬운 정보 포함 금지',
];

function countCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-zA-Z]/.test(password)) classes += 1;
  if (/[0-9]/.test(password)) classes += 1;
  if (/[^a-zA-Z0-9]/.test(password)) classes += 1;
  return classes;
}

function hasSequentialRun(password: string): boolean {
  if (password.length < MAX_SEQUENTIAL_RUN) return false;

  let runSame = 1;
  let runUp = 1;
  let runDown = 1;
  for (let i = 1; i < password.length; i += 1) {
    const prev = password.charCodeAt(i - 1);
    const cur = password.charCodeAt(i);
    runSame = cur === prev ? runSame + 1 : 1;
    runUp = cur - prev === 1 ? runUp + 1 : 1;
    runDown = prev - cur === 1 ? runDown + 1 : 1;
    if (Math.max(runSame, runUp, runDown) >= MAX_SEQUENTIAL_RUN) return true;
  }
  return false;
}

/** 규칙 위반 사유 목록을 반환한다 (빈 배열이면 통과). */
export function checkPasswordPolicy(
  password: string,
  employeeId?: string | null,
  name?: string | null,
): string[] {
  const reasons: string[] = [];
  if (!password) return ['비밀번호를 입력해 주세요.'];

  if (password.length > MAX_LENGTH) {
    reasons.push(`비밀번호는 ${MAX_LENGTH}자 이하여야 합니다.`);
  }

  const classes = countCharacterClasses(password);
  if (classes <= 1) {
    reasons.push('영문, 숫자, 특수문자 중 2종류 이상을 조합해야 합니다.');
  } else if (classes === 2 && password.length < MIN_LENGTH_TWO_CLASSES) {
    reasons.push(`2종류 조합은 ${MIN_LENGTH_TWO_CLASSES}자 이상이어야 합니다.`);
  } else if (classes >= 3 && password.length < MIN_LENGTH_THREE_CLASSES) {
    reasons.push(`3종류 조합은 ${MIN_LENGTH_THREE_CLASSES}자 이상이어야 합니다.`);
  }

  if (hasSequentialRun(password)) {
    reasons.push(`연속되거나 동일한 문자/숫자를 ${MAX_SEQUENTIAL_RUN}자 이상 사용할 수 없습니다.`);
  }

  const lowered = password.toLowerCase();
  if (employeeId && lowered.includes(employeeId.toLowerCase())) {
    reasons.push('사번이 포함된 비밀번호는 사용할 수 없습니다.');
  }
  if (name && name.length >= 2 && lowered.includes(name.toLowerCase())) {
    reasons.push('이름이 포함된 비밀번호는 사용할 수 없습니다.');
  }

  return reasons;
}

/** 안내 체크리스트용 항목별 충족 여부 */
export interface PolicyCheckItem {
  label: string;
  satisfied: boolean;
}

export function getPolicyChecklist(
  password: string,
  employeeId?: string | null,
  name?: string | null,
): PolicyCheckItem[] {
  const classes = countCharacterClasses(password);
  const lengthOk =
    classes >= 3
      ? password.length >= MIN_LENGTH_THREE_CLASSES
      : classes === 2
        ? password.length >= MIN_LENGTH_TWO_CLASSES
        : false;

  const lowered = password.toLowerCase();
  return [
    { label: PASSWORD_POLICY_DESCRIPTIONS[0], satisfied: !!password && lengthOk },
    { label: PASSWORD_POLICY_DESCRIPTIONS[1], satisfied: !!password && !hasSequentialRun(password) },
    {
      label: PASSWORD_POLICY_DESCRIPTIONS[2],
      satisfied:
        !!password &&
        !(employeeId && lowered.includes(employeeId.toLowerCase())) &&
        !(name && name.length >= 2 && lowered.includes(name.toLowerCase())),
    },
  ];
}
