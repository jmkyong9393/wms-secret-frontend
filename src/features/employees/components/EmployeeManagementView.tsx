"use client";

import { useState } from "react";
import { useAtomValue } from "jotai";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentUserAtom } from "@/features/auth/store/authAtoms";
import { VALID_ROLES, type Role, type UserStatus } from "@/features/auth/types/authTypes";
import { canManageEmployees } from "@/features/employees/utils/permissions";
import { ROLE_LABEL, STATUS_LABEL } from "@/features/employees/utils/badges";
import { useEmployeesQuery } from "@/features/employees/hooks/useEmployeesQuery";
import { EmployeeTable } from "@/features/employees/components/EmployeeTable";
import { BulkCreateEmployeeModal } from "@/features/employees/components/BulkCreateEmployeeModal";
import type { EmployeeListParams } from "@/features/employees/types/employee";

const PAGE_SIZE = 20;
const ROLE_FILTER_ALL = "ALL" as const;
const STATUS_FILTER_ALL = "ALL" as const;

export function EmployeeManagementView() {
  const currentUser = useAtomValue(currentUserAtom);
  const canManage = canManageEmployees(currentUser);

  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | typeof ROLE_FILTER_ALL>(ROLE_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<UserStatus | typeof STATUS_FILTER_ALL>(
    STATUS_FILTER_ALL
  );
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  const params: EmployeeListParams = {
    keyword: keyword.trim() || undefined,
    role: roleFilter === ROLE_FILTER_ALL ? undefined : roleFilter,
    status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
    page,
    size: PAGE_SIZE,
  };

  const { data, isLoading, isError } = useEmployeesQuery(params);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">직원 관리</h2>
          <p className="text-sm text-gray-500 mt-1">직원 계정을 조회하고 상태·역할을 관리합니다.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            직원 일괄 생성
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={keyword}
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
          placeholder="사번 또는 이름 검색"
          className="max-w-xs"
        />
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setPage(1);
            setRoleFilter(value as Role | typeof ROLE_FILTER_ALL);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROLE_FILTER_ALL}>전체 역할</SelectItem>
            {VALID_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABEL[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setPage(1);
            setStatusFilter(value as UserStatus | typeof STATUS_FILTER_ALL);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>전체 상태</SelectItem>
            <SelectItem value="ACTIVE">{STATUS_LABEL.ACTIVE}</SelectItem>
            <SelectItem value="INACTIVE">{STATUS_LABEL.INACTIVE}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {isError && <p className="text-sm text-red-600">직원 목록을 불러오지 못했습니다.</p>}

      {data && (
        <>
          <EmployeeTable employees={data.items} currentUser={currentUser} />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>총 {data.total}명</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                다음
              </Button>
            </div>
          </div>
        </>
      )}

      <BulkCreateEmployeeModal
        open={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
