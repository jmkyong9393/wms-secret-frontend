/**
 * JWT 만료 판별 (서명 검증 없음 - 라우팅 게이트 전용).
 * 진짜 인증은 백엔드가 서명으로 수행한다. 여기서는 "만료·손상 쿠키를 로그인 상태로
 * 오인해 /login 접근이 홈으로 되튕기는 교착"만 막는다. Edge 런타임 호환(atob만 사용).
 */
export function isJwtUsable(token: string | undefined | null): token is string {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
