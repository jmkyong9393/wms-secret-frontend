"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Copy, CheckCircle2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { CurrentUser } from "@/entities/user/model/types";
import type { AssignableRole } from "@/features/employees/types/employee";
import { getAssignableRoles } from "@/features/employees/utils/permissions";
import { ROLE_LABEL } from "@/features/employees/utils/badges";
import { useBulkCreateEmployeesMutation } from "@/features/employees/hooks/useEmployeeMutations";
import { getNextEmployeeId } from "@/features/employees/api/employeeService";

interface SingleCreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
}

function generateRandomPassword(length = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function SingleCreateEmployeeModal({ open, onClose, currentUser }: SingleCreateEmployeeModalProps) {
  const assignableRoles = useMemo(() => getAssignableRoles(currentUser), [currentUser]);
  const defaultRole = assignableRoles[0] ?? "WORKER";

  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AssignableRole>(defaultRole);
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useBulkCreateEmployeesMutation();

  const resetState = useCallback(() => {
    setEmployeeId("");
    setName("");
    setRole(defaultRole);
    setIsSuccess(false);
    setGeneratedPassword("");
    setIsCopied(false);
    setError(null);
  }, [defaultRole, setEmployeeId, setName, setRole, setIsSuccess, setGeneratedPassword, setIsCopied, setError]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  useEffect(() => {
    if (!open) return;
    
    // 모달이 열리면 사번 추천 API 호출
    const fetchNextId = async () => {
      try {
        const data = await getNextEmployeeId();
        setEmployeeId(data.next_employee_id);
      } catch (err) {
        console.error("Failed to fetch next employee id", err);
      }
    };
    fetchNextId();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!employeeId.trim() || !name.trim()) {
      setError("사번과 이름을 입력해주세요.");
      return;
    }
    setError(null);
    
    const newPassword = generateRandomPassword();

    mutation.mutate(
      { employees: [{ employee_id: employeeId, name, role, password: newPassword }] },
      {
        onSuccess: (data) => {
          const result = data.results[0];
          if (result && result.success) {
            setIsSuccess(true);
            setGeneratedPassword(newPassword);
          } else {
            setError(result?.reason || "생성에 실패했습니다.");
          }
        },
        onError: () => {
          setError("생성 요청 중 서버 오류가 발생했습니다.");
        },
      }
    );
  };

  const handleCopyPassword = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadExcel = () => {
    if (!employeeId || !generatedPassword) return;
    const exportData = [
      {
        "사번 (아이디)": employeeId,
        "이름": name,
        "역할": ROLE_LABEL[role] || role,
        "초기 비밀번호": generatedPassword,
        "계정 생성일시": new Date().toLocaleString("ko-KR"),
      },
    ];
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신규계정정보");
    XLSX.writeFile(wb, `신규직원계정_${employeeId}_${name}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
            {isSuccess ? "직원 계정 생성 완료" : "직원 단일 등록"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm font-bold text-green-800 text-center">
                  {name} 님의 계정이 성공적으로 생성되었습니다.
                </p>
              </div>

              <div className="space-y-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">사번 (아이디)</span>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{employeeId}</div>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">초기 비밀번호</span>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-mono font-bold text-indigo-900">{generatedPassword}</span>
                    <Button variant="ghost" size="sm" onClick={handleCopyPassword} title="클립보드에 비밀번호 복사">
                      <Copy className={`w-4 h-4 ${isCopied ? "text-green-600" : "text-gray-400 dark:text-gray-500"}`} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Excel Download Button Integration */}
              <Button
                type="button"
                onClick={handleDownloadExcel}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>📥 계정 정보 엑셀 다운로드 (.xlsx)</span>
              </Button>

              <p className="text-xs text-orange-600 font-medium leading-relaxed">
                * 초기 비밀번호는 지금 창을 닫으면 다시 확인할 수 없습니다. <strong>엑셀 파일을 다운로드</strong>하여 직원에게 안전하게 전달해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="employee_id">사번 (아이디)</Label>
                <div className="flex gap-2">
                  <Input
                    id="employee_id"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="사번을 입력하세요"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">자동 추천된 사번입니다. 필요시 수정 가능합니다.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 홍길동"
                />
              </div>

              <div className="space-y-1">
                <Label>역할</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as AssignableRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>비밀번호</Label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/60 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  무작위 조합으로 자동 생성됩니다.
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            닫기
          </Button>
          {isSuccess ? (
            <Button type="button" onClick={handleDownloadExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer">
              <Download className="w-4 h-4 mr-1.5" />
              엑셀 다운로드
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "생성 중..." : "등록하기"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
