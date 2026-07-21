import { decodeJwt } from "@/features/auth/utils/jwt";
import { isRole, type AuthSession, type CurrentUser, type JwtClaims } from "@/features/auth/types/authTypes";
import type { AuthMeResponse } from "@/features/auth/types/authApiTypes";

// JWT에서 로그인 세션 정보 생성
// 토큰 서명과 실제 유효성은 백엔드에서 확인
export function mapTokenToSession(token: string): AuthSession | null {
  const claims = decodeJwt<JwtClaims>(token);

  if (!claims || !claims.sub || !claims.tenant_id) return null;
  if (!isRole(claims.role)) return null;
  if (claims.type !== "access") return null;
  if (!claims.exp || claims.exp * 1000 <= Date.now()) return null;

  return {
    userId: claims.sub,
    role: claims.role,
    tenantId: claims.tenant_id,
    exp: claims.exp,
  };
}

// 사용자와 토큰 만료 시간을 조합해 세션 구분
export function getSessionKey(session: AuthSession): string {
  return `${session.userId}:${session.exp}`;
}

// 서버 사용자 정보와 세션 정보를 하나로 합침
export function mapMeResponseToCurrentUser(
  me: AuthMeResponse,
  session: AuthSession
): CurrentUser {
  return {
    employeeId: me.employee_id,
    name: me.name,
    role: me.role,
    mustChangePassword: me.must_change_password,
    tenantId: session.tenantId,
  };
}
