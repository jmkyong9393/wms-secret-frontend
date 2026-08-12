/**
 * 스캔된 바코드가 도서 ISBN인지 검증한다.
 *
 * [2026-08-13 신설 — 실사고 대응]
 * 같은 책을 두 번 스캔했는데 서로 다른 값이 나왔다:
 *   중고 검수: 6788398481475 -> "미등록 도서"
 *   신품 입고: 9788968481475 -> 정상 인식
 * 1·5·6번째 자리가 6->9, 3->9, 9->6으로 뒤집힌 광학 오독이었다.
 *
 * **주의: 이 오독은 EAN-13 체크디지트를 통과한다.** 두 코드의 가중합이 둘 다 145로 같아
 * (바뀐 자릿수의 오차가 정확히 상쇄됨) 체크디지트만으로는 절대 걸러낼 수 없다.
 * 잡아내는 것은 **접두어 규칙**이다 - ISBN-13은 반드시 978/979(Bookland)로 시작한다.
 *
 * 그래서 두 검사를 모두 건다: 접두어(이번 사고를 직접 차단) + 체크디지트(다른 유형의 오독).
 * 두 검사를 다 통과하는 오독도 이론상 가능하므로, 호출부는 추가로 "2회 일치"를 요구한다.
 */

export type IsbnRejectReason = 'LENGTH' | 'NON_NUMERIC' | 'PREFIX' | 'CHECKSUM';

export interface IsbnValidationResult {
  valid: boolean;
  reason?: IsbnRejectReason;
  /** 작업자에게 그대로 보여줄 한국어 안내 */
  message?: string;
}

/** ISBN-13 Bookland 접두어. 이 둘만 도서다. */
const ISBN_PREFIXES = ['978', '979'];

/** EAN-13 체크디지트 계산 (가중치 1,3 교대) */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function validateIsbn13(raw: string): IsbnValidationResult {
  const code = (raw || '').replace(/[\s-]/g, '');

  if (!/^\d+$/.test(code)) {
    return { valid: false, reason: 'NON_NUMERIC', message: '숫자가 아닌 값이 읽혔습니다. 다시 스캔해 주세요.' };
  }
  if (code.length !== 13) {
    return {
      valid: false,
      reason: 'LENGTH',
      message: `13자리 ISBN이 아닙니다 (${code.length}자리). 책 뒷면의 978로 시작하는 바코드를 스캔해 주세요.`,
    };
  }
  if (!ISBN_PREFIXES.some((p) => code.startsWith(p))) {
    return {
      valid: false,
      reason: 'PREFIX',
      message: `도서 바코드가 아닙니다 (${code.slice(0, 3)}…로 시작). ISBN은 978/979로 시작합니다 — 각도를 바꿔 다시 스캔해 주세요.`,
    };
  }
  if (ean13CheckDigit(code.slice(0, 12)) !== Number(code[12])) {
    return {
      valid: false,
      reason: 'CHECKSUM',
      message: '바코드가 잘못 읽혔습니다 (검증번호 불일치). 다시 스캔해 주세요.',
    };
  }
  return { valid: true };
}

/** LPN 재촬영용 QR인지. 이 값은 ISBN 검증 대상이 아니다. */
export function isLpnCode(raw: string): boolean {
  return (raw || '').toUpperCase().startsWith('LPN-');
}
