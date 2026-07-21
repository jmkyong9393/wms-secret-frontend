import type { EmployeeListParams } from "@/features/employees/types/employee";

// 직원 목록 Query key factory
export const employeeKeys = {
  all: ["employees"] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.all, "list", params] as const,
};
