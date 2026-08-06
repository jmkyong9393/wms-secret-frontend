/**
 * 개인정보 표시 제한(마스킹) 유틸 — ISMS-P 2.6.3 / 개인정보의 기술적·관리적 보호조치 기준 제10조.
 *
 * [도입 배경 - 2026-08-06]
 * 개인정보 처리방침(/privacy)에는 "성명·전화번호·이메일·IP를 마스킹해 표시한다"고 고지해
 * 두고, 정작 코드에는 Header에 인라인으로 박힌 이름 마스킹 함수 하나뿐이었다. 고지와 구현이
 * 어긋난 상태이므로 규칙을 한 곳으로 모으고 실제 조회 화면에 적용한다.
 *
 * 적용 원칙:
 * - **타인의 정보를 조회하는 화면**(사원 목록 등)에만 적용한다.
 * - **정보주체 본인이 자기 정보를 확인/수정하는 화면**(마이페이지)에는 적용하지 않는다.
 *   본인 확인·정정권(개인정보 보호법 제35·36조) 행사를 방해하기 때문이다.
 */

/** 성명 마스킹: 장문경 → 장*경, 홍길동 → 홍*동, 김철 → 김* */
export function maskName(name?: string | null): string {
  if (!name) return '사용자';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return trimmed.charAt(0) + '*';
  return (
    trimmed.charAt(0) +
    '*'.repeat(trimmed.length - 2) +
    trimmed.charAt(trimmed.length - 1)
  );
}

/** 전화번호 마스킹: 010-1234-5050 → 010-****-5050 (국번 자리를 가린다) */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '*'.repeat(digits.length || 1);

  const tail = digits.slice(-4);
  const head = digits.slice(0, digits.length === 11 ? 3 : digits.length - 8 + 2 || 3);
  return `${head}-****-${tail}`;
}

/** 이메일 마스킹: jmkyong2002@naver.com → jmky****@naver.com (로컬파트 뒷부분을 가린다) */
export function maskEmail(email?: string | null): string {
  if (!email) return '-';
  const at = email.indexOf('@');
  if (at < 1) return '*'.repeat(email.length);

  const local = email.slice(0, at);
  const domain = email.slice(at);
  // 로컬파트가 짧으면 첫 글자만 남긴다 (ab@x.com → a*@x.com)
  const keep = local.length <= 4 ? 1 : 4;
  return local.slice(0, keep) + '*'.repeat(Math.max(local.length - keep, 3)) + domain;
}

/** IP 마스킹: 123.123.123.123 → 123.123.***.123 (3번째 옥텟을 가린다) */
export function maskIp(ip?: string | null): string {
  if (!ip) return '-';
  const parts = ip.split('.');
  if (parts.length !== 4) return ip; // IPv6 등은 그대로 둔다
  return `${parts[0]}.${parts[1]}.***.${parts[3]}`;
}

/** 주소 마스킹: 상세주소(동/호수)를 가리고 행정구역까지만 남긴다 */
export function maskAddress(address?: string | null): string {
  if (!address) return '-';
  const tokens = address.trim().split(/\s+/);
  if (tokens.length <= 2) return address;
  return `${tokens.slice(0, 2).join(' ')} ${'*'.repeat(4)}`;
}
