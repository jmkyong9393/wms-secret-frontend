"use client";

import { useQuery } from "@tanstack/react-query";
import { listEmployeesAction } from "@/features/employees/actions/employeeActions";
import { employeeKeys } from "@/features/employees/constants/queryKeys";
import type { EmployeeListParams } from "@/features/employees/types/employee";

// 검색 및 필터 조건에 맞는 직원 목록 조회
export function useEmployeesQuery(params: EmployeeListParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => listEmployeesAction(params),
  });
}
