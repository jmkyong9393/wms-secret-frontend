"use client";

import { useEffect, useState } from "react";
import { X, Copy, CheckCircle2 } from "lucide-react";
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
import type { User } from "@/stores/auth";
import type { AssignableRole } from "@/features/employees/types/employee";
import { getAssignableRoles } from "@/features/employees/utils/permissions";
import { ROLE_LABEL } from "@/features/employees/utils/badges";
import { useBulkCreateEmployeesMutation } from "@/features/employees/hooks/useEmployeeMutations";
import { getNextEmployeeIdAction } from "@/features/employees/actions/employeeActions";

interface SingleCreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User | null;
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
  const assignableRoles = getAssignableRoles(currentUser as any);
  const defaultRole = assignableRoles[0] ?? "WORKER";

  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AssignableRole>(defaultRole);
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useBulkCreateEmployeesMutation();

  const resetState = () => {
    setEmployeeId("");
    setName("");
    setRole(defaultRole);
    setIsSuccess(false);
    setGeneratedPassword("");
    setIsCopied(false);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    
    // 모달이 열리면 사번 추천 API 호출
    const fetchNextId = async () => {
      try {
        const data = await getNextEmployeeIdAction();
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
  }, [open]);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">
            {isSuccess ? "직원 계정 생성 완료" : "직원 단일 등록"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-8 h-8 text-green-50 mb-2" />
                <p className="text-sm font-medium text-green-800 text-center">
                  {name} 님의 계정이 성공적으로 생성되었습니다.
                </p>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <span className="block text-xs font-medium text-gray-500 mb-1">사번 (아이디)</span>
                  <div className="text-sm font-bold text-gray-900">{employeeId}</div>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 mb-1">초기 비밀번호</span>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                    <span className="text-sm font-mono font-medium">{generatedPassword}</span>
                    <Button variant="ghost" size="sm" onClick={handleCopyPassword}>
                      <Copy className={`w-4 h-4 ${isCopied ? "text-green-600" : "text-gray-400"}`} />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-orange-600 font-medium">
                * 초기 비밀번호는 지금 창을 닫으면 다시 확인할 수 없습니다. 직원에게 안전하게 전달해주세요.
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
                <p className="text-xs text-gray-500">자동 추천된 사번입니다. 필요시 수정 가능합니다.</p>
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
                <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-500">
                  무작위 조합으로 자동 생성됩니다.
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            닫기
          </Button>
          {!isSuccess && (
            <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "생성 중..." : "등록하기"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
