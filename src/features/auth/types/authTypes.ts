export type Role = "MASTER" | "ADMIN" | "WORKER" | "GUEST";

export const VALID_ROLES: readonly Role[] = ["MASTER", "ADMIN", "WORKER", "GUEST"];

// 올바른 사용자 역할인지 확인
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

export type UserStatus = "ACTIVE" | "INACTIVE";

// 현재 로그인한 사용자 정보 (GET/POST /api/v1/auth/me, /login 응답을 기반으로 구성)
export interface CurrentUser {
  employeeId: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}
