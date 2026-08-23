"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { maskName } from "@/shared/lib/privacy-mask";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { CurrentUser, UserStatus } from "@/entities/user/model/types";
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
  useDeleteEmployeeMutation,
} from "@/features/employees/hooks/useEmployeeMutations";
import { ConfirmDialog } from "@/features/employees/components/ConfirmDialog";

interface EmployeeTableProps {
  employees: EmployeeListItem[];
  currentUser: CurrentUser | null;
}

type PendingAction =
  | { type: "status"; employeeId: string; name: string; nextStatus: UserStatus }
  | { type: "role"; employeeId: string; name: string; nextRole: AssignableRole }
  | { type: "delete"; employeeId: string; name: string };

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
  const deleteMutation = useDeleteEmployeeMutation();
  const isMutating = updateStatusMutation.isPending || updateRoleMutation.isPending || deleteMutation.isPending;

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "status") {
      updateStatusMutation.mutate(
        { employeeId: pendingAction.employeeId, payload: { status: pendingAction.nextStatus } },
        { onSuccess: () => setPendingAction(null) }
      );
    } else if (pendingAction.type === "role") {
      updateRoleMutation.mutate(
        { employeeId: pendingAction.employeeId, payload: { role: pendingAction.nextRole } },
        { onSuccess: () => setPendingAction(null) }
      );
    } else if (pendingAction.type === "delete") {
      deleteMutation.mutate(pendingAction.employeeId, {
        onSuccess: () => setPendingAction(null),
        onError: (error: any) => {
          alert(error.message || "삭제에 실패했습니다.");
          setPendingAction(null);
        },
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
            <th className="px-4 py-3 font-medium">사번</th>
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">역할</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">가입일</th>
            <th className="px-4 py-3 font-medium text-center">관리</th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                조건에 맞는 직원이 없습니다.
              </td>
            </tr>
          )}
          {employees.map((employee) => {
            const isSelf = currentUser?.employeeId === employee.employee_id;
            const nextStatus: UserStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            const disabledManage = !canManage || isSelf || isMutating || (currentUser?.role !== "MASTER" && employee.role === "MASTER");
            // MASTER는 역할 변경 대상에서 제외 — ASSIGNABLE_ROLES에 없으므로 셀렉트 자체를 노출하지 않음
            const showRoleSelect = employee.role !== "MASTER";

            return (
              <tr key={employee.employee_id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{employee.employee_id}</td>
                {/* ISMS-P 2.6.3 표시제한: 타인의 성명은 조회 화면에서 마스킹한다.
                    (본인 확인용 원본은 마이페이지에서 정보주체 본인에게만 노출) */}
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300" title="개인정보 표시제한 적용">
                  {maskName(employee.name)}
                </td>
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
                        disabled={disabledManage}
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
                      disabled={disabledManage}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(employee.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabledManage}
                    onClick={() =>
                      setPendingAction({
                        type: "delete",
                        employeeId: employee.employee_id,
                        name: employee.name,
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400" />
                  </Button>
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
            : pendingAction?.type === "role"
              ? `${pendingAction.name}님의 역할을 ${ROLE_LABEL[pendingAction.nextRole]}(으)로 변경할까요?`
              : pendingAction?.type === "delete"
                ? `${pendingAction.name}님의 계정을 영구 삭제하시겠습니까?`
                : ""
        }
        isLoading={isMutating}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
