export type Role = "MASTER" | "ADMIN" | "WORKER" | "GUEST";

export const VALID_ROLES: readonly Role[] = ["MASTER", "ADMIN", "WORKER", "GUEST"];

// 올바른 사용자 역할인지 확인
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export type UserStatus = "ACTIVE" | "INACTIVE";


// 토큰에 들어 있는 로그인 정보
export interface JwtClaims {
  sub: string;
  role: string;
  tenant_id: string;
  type: string;
  exp: number;
}

// 토큰에서 만든 로그인 세션 정보
export interface AuthSession {
  userId: string;
  role: Role;
  tenantId: string;
  exp: number;
}

// 현재 로그인한 사용자 정보
export interface CurrentUser {
  employeeId: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  tenantId?: string;
}
