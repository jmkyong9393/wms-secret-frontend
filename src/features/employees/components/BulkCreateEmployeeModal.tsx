"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrentUser } from "@/features/auth/types/authTypes";
import type { AssignableRole, BulkCreateEmployeeResult } from "@/features/employees/types/employee";
import { getAssignableRoles } from "@/features/employees/utils/permissions";
import { ROLE_LABEL } from "@/features/employees/utils/badges";
import { useBulkCreateEmployeesMutation } from "@/features/employees/hooks/useEmployeeMutations";
import { ConfirmDialog } from "@/features/employees/components/ConfirmDialog";

interface BulkCreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
}

interface DraftRow {
  employee_id: string;
  name: string;
  role: AssignableRole;
  password: string;
}

function createEmptyRow(defaultRole: AssignableRole): DraftRow {
  return { employee_id: "", name: "", role: defaultRole, password: "" };
}

// 직원 계정 일괄 생성 모달
// 여러 직원의 사번, 이름, 역할, 초기 비밀번호 입력
// 입력 행 추가·삭제 및 입력값 검사
// 생성 전 확인 팝업 표시
// 생성 요청 후 직원별 성공·실패 결과 표시
// 초기 비밀번호는 입력 중에만 임시 보관
// 생성 성공 또는 모달 종료 시 입력값 초기화
export function BulkCreateEmployeeModal({ open, onClose, currentUser }: BulkCreateEmployeeModalProps) {
  const assignableRoles = getAssignableRoles(currentUser);
  const defaultRole = assignableRoles[0] ?? "WORKER";

  const [rows, setRows] = useState<DraftRow[]>([createEmptyRow(defaultRole)]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<BulkCreateEmployeeResult[] | null>(null);

  const mutation = useBulkCreateEmployeesMutation();

  const resetState = () => {
    setRows([createEmptyRow(defaultRole)]);
    setValidationError(null);
    setConfirmOpen(false);
    setResults(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const updateRow = (index: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow(defaultRole)]);
  const removeRow = (index: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleSubmitClick = () => {
    if (rows.some((r) => !r.employee_id.trim() || !r.name.trim() || r.password.length < 8)) {
      setValidationError("사번, 이름을 입력하고 비밀번호는 8자 이상으로 입력해주세요.");
      return;
    }
    setValidationError(null);
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    mutation.mutate(
      { employees: rows.map(({ employee_id, name, role, password }) => ({ employee_id, name, role, password })) },
      {
        onSuccess: (data) => {
          setResults(data.results);
          setConfirmOpen(false);
          // 요청 완료 시 비밀번호는 화면 상태에서 즉시 제거
          setRows((prev) => prev.map((row) => ({ ...row, password: "" })));
        },
        onError: () => {
          setConfirmOpen(false);
        },
      }
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">직원 계정 일괄 생성</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {rows.map((row, index) => (
            <div key={index} className="flex items-end gap-2 border-b border-gray-50 pb-3 last:border-0">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`employee_id-${index}`}>사번</Label>
                <Input
                  id={`employee_id-${index}`}
                  value={row.employee_id}
                  onChange={(e) => updateRow(index, { employee_id: e.target.value })}
                  placeholder="W0010"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`name-${index}`}>이름</Label>
                <Input
                  id={`name-${index}`}
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder="홍길동"
                />
              </div>
              <div className="w-28 space-y-1">
                <Label>역할</Label>
                <Select
                  value={row.role}
                  onValueChange={(value) => updateRow(index, { role: value as AssignableRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`password-${index}`}>초기 비밀번호</Label>
                <Input
                  id={`password-${index}`}
                  type="password"
                  value={row.password}
                  onChange={(e) => updateRow(index, { password: e.target.value })}
                  placeholder="8자 이상"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeRow(index)}
                disabled={rows.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="w-4 h-4" />
            행 추가
          </Button>

          {validationError && <p className="text-sm text-red-600">{validationError}</p>}
          {mutation.isError && (
            <p className="text-sm text-red-600">
              생성 요청에 실패했습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.
            </p>
          )}

          {results && (
            <div className="rounded-lg border border-gray-100 p-3 space-y-1">
              <p className="text-sm font-medium text-gray-700">생성 결과</p>
              {results.map((result) => (
                <p
                  key={result.employee_id}
                  className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}
                >
                  {result.employee_id} — {result.success ? "생성 완료" : result.reason ?? "실패"}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            닫기
          </Button>
          <Button type="button" onClick={handleSubmitClick} disabled={mutation.isPending}>
            {mutation.isPending ? "생성 중..." : "일괄 생성"}
          </Button>
        </div>
      </div>
    </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`${rows.length}명의 직원 계정을 생성할까요?`}
        description="계정 생성 후에는 초기 비밀번호를 다시 조회할 수 없습니다."
        isLoading={mutation.isPending}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
