import { apiClient } from "@/lib/api-client";
import {
  EMPLOYEE_LIST_ENDPOINT,
  EMPLOYEE_BULK_CREATE_ENDPOINT,
  employeeStatusEndpoint,
  employeeRoleEndpoint,
} from "@/features/employees/constants/employeeApi";
import type {
  EmployeeListParams,
  EmployeeListResponse,
  BulkCreateEmployeeRequest,
  BulkCreateEmployeeResponse,
  UpdateEmployeeStatusRequest,
  UpdateEmployeeStatusResponse,
  UpdateEmployeeRoleRequest,
  UpdateEmployeeRoleResponse,
} from "@/features/employees/types/employee";

// 직원 목록 조회 (검색/필터/페이지네이션)
export async function listEmployees(params: EmployeeListParams): Promise<EmployeeListResponse> {
  const res = await apiClient.get<EmployeeListResponse>(EMPLOYEE_LIST_ENDPOINT, { params });
  return res.data;
}

// 직원 계정 일괄 생성
export async function bulkCreateEmployees(
  payload: BulkCreateEmployeeRequest
): Promise<BulkCreateEmployeeResponse> {
  const res = await apiClient.post<BulkCreateEmployeeResponse>(
    EMPLOYEE_BULK_CREATE_ENDPOINT,
    payload
  );
  return res.data;
}

// 직원 상태(ACTIVE/INACTIVE) 변경
export async function updateEmployeeStatus(
  employeeId: string,
  payload: UpdateEmployeeStatusRequest
): Promise<UpdateEmployeeStatusResponse> {
  const res = await apiClient.patch<UpdateEmployeeStatusResponse>(
    employeeStatusEndpoint(employeeId),
    payload
  );
  return res.data;
}

// 직원 역할 변경
export async function updateEmployeeRole(
  employeeId: string,
  payload: UpdateEmployeeRoleRequest
): Promise<UpdateEmployeeRoleResponse> {
  const res = await apiClient.patch<UpdateEmployeeRoleResponse>(
    employeeRoleEndpoint(employeeId),
    payload
  );
  return res.data;
}
