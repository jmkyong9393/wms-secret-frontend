import type { CurrentUser } from "@/entities/user/model/types";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/features/employees/types/employee";

/**
 * 직원 관리 권한 확인
 *
 * MASTER와 ADMIN이 직원 계정 생성과
 * 상태 및 역할 변경 가능
 *
 * WORKER/GUEST는 접근 불가
 */

/**
 * 직원 정보를 변경할 수 있는지 확인
 */
export function canManageEmployees(user: CurrentUser | null): boolean {
  return user?.role === "MASTER" || user?.role === "ADMIN";
}

/**
 * 직원에게 지정할 수 있는 역할 목록 반환
 *
 * MASTER는 ADMIN, WORKER, GUEST 지정 가능
 * 그 외 사용자는 역할 지정 불가
 */
export function getAssignableRoles(user: CurrentUser | null): AssignableRole[] {
  if (user?.role === "MASTER" || user?.role === "ADMIN") return [...ASSIGNABLE_ROLES];
  return [];
}
