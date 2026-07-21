"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkCreateEmployees,
  updateEmployeeStatus,
  updateEmployeeRole,
} from "@/features/employees/api/employeeService";
import { employeeKeys } from "@/features/employees/constants/queryKeys";
import type {
  BulkCreateEmployeeRequest,
  UpdateEmployeeStatusRequest,
  UpdateEmployeeRoleRequest,
} from "@/features/employees/types/employee";

/**
 * 직원 관리 변경 요청 훅
 *
 * 직원 일괄 생성, 계정 상태 변경, 역할 변경 요청 처리
 * 요청 성공 후 직원 목록을 다시 불러와 최신 상태 반영
 */

export function useBulkCreateEmployeesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkCreateEmployeeRequest) => bulkCreateEmployees(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUpdateEmployeeStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      payload,
    }: {
      employeeId: string;
      payload: UpdateEmployeeStatusRequest;
    }) => updateEmployeeStatus(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}

export function useUpdateEmployeeRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      payload,
    }: {
      employeeId: string;
      payload: UpdateEmployeeRoleRequest;
    }) => updateEmployeeRole(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    },
  });
}
