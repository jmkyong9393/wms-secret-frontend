"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrentUser, UserStatus } from "@/features/auth/types/authTypes";
import type { EmployeeListItem, AssignableRole } from "@/features/employees/types/employee";
import { canManageEmployees, getAssignableRoles } from "@/features/employees/utils/permissions";
import {
  ROLE_BADGE_STYLE,
  ROLE_LABEL,
  STATUS_BADGE_STYLE,
  STATUS_LABEL,
} from "@/features/employees/utils/badges";
import {
  useUpdateEmployeeStatusMutation,
  useUpdateEmployeeRoleMutation,
} from "@/features/employees/hooks/useEmployeeMutations";
import { ConfirmDialog } from "@/features/employees/components/ConfirmDialog";

interface EmployeeTableProps {
  employees: EmployeeListItem[];
  currentUser: CurrentUser | null;
}

type PendingAction =
  | { type: "status"; employeeId: string; name: string; nextStatus: UserStatus }
  | { type: "role"; employeeId: string; name: string; nextRole: AssignableRole };

/**
 * 직원 목록 및 계정 관리 테이블
 *
 * 직원의 사번, 이름, 역할, 상태, 가입일 표시
 * MASTER에게만 상태 및 역할 변경 기능 제공
 * 본인 계정과 MASTER 역할 변경 제한
 *
 * 변경 요청 전 확인 팝업 표시
 * 변경 성공 후 직원 목록 다시 조회
 */
export function EmployeeTable({ employees, currentUser }: EmployeeTableProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const canManage = canManageEmployees(currentUser);
  const assignableRoles = getAssignableRoles(currentUser);

  const updateStatusMutation = useUpdateEmployeeStatusMutation();
  const updateRoleMutation = useUpdateEmployeeRoleMutation();
  const isMutating = updateStatusMutation.isPending || updateRoleMutation.isPending;

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "status") {
      updateStatusMutation.mutate(
        { employeeId: pendingAction.employeeId, payload: { status: pendingAction.nextStatus } },
        { onSuccess: () => setPendingAction(null) }
      );
    } else {
      updateRoleMutation.mutate(
        { employeeId: pendingAction.employeeId, payload: { role: pendingAction.nextRole } },
        { onSuccess: () => setPendingAction(null) }
      );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-3 font-medium">사번</th>
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">역할</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">가입일</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                조건에 맞는 직원이 없습니다.
              </td>
            </tr>
          )}
          {employees.map((employee) => {
            const isSelf = currentUser?.employeeId === employee.employee_id;
            const nextStatus: UserStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            // MASTER는 역할 변경 대상에서 제외 — ASSIGNABLE_ROLES에 없으므로 셀렉트 자체를 노출하지 않음
            const showRoleSelect = employee.role !== "MASTER";

            return (
              <tr key={employee.employee_id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-800">{employee.employee_id}</td>
                <td className="px-4 py-3 text-gray-700">{employee.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold rounded-full px-2 py-0.5 ${ROLE_BADGE_STYLE[employee.role]}`}
                    >
                      {ROLE_LABEL[employee.role]}
                    </span>
                    {showRoleSelect && (
                      <Select
                        value={employee.role}
                        onValueChange={(value) => {
                          const nextRole = value as AssignableRole;
                          if (nextRole === employee.role) return;
                          setPendingAction({
                            type: "role",
                            employeeId: employee.employee_id,
                            name: employee.name,
                            nextRole,
                          });
                        }}
                        disabled={!canManage || isSelf || isMutating}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(assignableRoles.length > 0
                            ? assignableRoles
                            : ([employee.role] as AssignableRole[])
                          ).map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_BADGE_STYLE[employee.status]}`}
                    >
                      {STATUS_LABEL[employee.status]}
                    </span>
                    <Switch
                      checked={employee.status === "ACTIVE"}
                      onCheckedChange={() =>
                        setPendingAction({
                          type: "status",
                          employeeId: employee.employee_id,
                          name: employee.name,
                          nextStatus,
                        })
                      }
                      disabled={!canManage || isSelf || isMutating}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(employee.created_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.type === "status"
            ? `${pendingAction.name}님의 상태를 ${
                pendingAction.nextStatus === "ACTIVE" ? "활성" : "비활성"
              }(으)로 변경할까요?`
            : pendingAction
              ? `${pendingAction.name}님의 역할을 ${ROLE_LABEL[pendingAction.nextRole]}(으)로 변경할까요?`
              : ""
        }
        isLoading={isMutating}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
