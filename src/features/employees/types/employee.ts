import type { Role, UserStatus } from "@/features/auth/types/authTypes";

// 직원 생성과 역할 변경 시 선택 가능한 역할
// MASTER 역할은 현재 선택 불가
export type AssignableRole = Exclude<Role, "MASTER">;
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = ["ADMIN", "WORKER", "GUEST"];

// 직원 목록의 직원 한 명 정보
// 비밀번호는 직원 목록에 포함하지 않음
export interface EmployeeListItem {
  employee_id: string;
  name: string;
  role: Role;
  status: UserStatus;
  created_at: string;
}

export interface EmployeeListParams {
  keyword?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
  size?: number;
}

export interface EmployeeListResponse {
  items: EmployeeListItem[];
  total: number;
  page: number;
  size: number;
}

// 생성할 직원 한 명의 입력 정보
// 비밀번호는 계정 생성 요청에만 사용
// 직원 목록이나 응답에는 포함하지 않음
export interface BulkCreateEmployeeRow {
  employee_id: string;
  name: string;
  role: AssignableRole;
  password: string;
}

export interface BulkCreateEmployeeRequest {
  employees: BulkCreateEmployeeRow[];
}

export interface BulkCreateEmployeeResult {
  employee_id: string;
  success: boolean;
  reason?: string;
}

export interface BulkCreateEmployeeResponse {
  results: BulkCreateEmployeeResult[];
}

export interface UpdateEmployeeStatusRequest {
  status: UserStatus;
}
export interface UpdateEmployeeStatusResponse {
  employee_id: string;
  status: UserStatus;
}

export interface UpdateEmployeeRoleRequest {
  role: AssignableRole;
}
export interface UpdateEmployeeRoleResponse {
  employee_id: string;
  role: Role;
}
