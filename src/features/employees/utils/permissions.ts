import type { CurrentUser } from "@/features/auth/types/authTypes";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/features/employees/types/employee";

/**
 * 직원 관리 권한 확인
 *
 * 현재는 MASTER만 직원 계정 생성과
 * 상태 및 역할 변경 가능
 *
 * ADMIN은 직원 목록 조회만 가능
 */

/**
 * 직원 정보를 변경할 수 있는지 확인
 */
export function canManageEmployees(user: CurrentUser | null): boolean {
  return user?.role === "MASTER";
}

/**
 * 직원에게 지정할 수 있는 역할 목록 반환
 *
 * MASTER는 ADMIN, WORKER, GUEST 지정 가능
 * 그 외 사용자는 역할 지정 불가
 */
export function getAssignableRoles(user: CurrentUser | null): AssignableRole[] {
  if (user?.role === "MASTER") return [...ASSIGNABLE_ROLES];
  return [];
}
