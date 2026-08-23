"use client";

import { useState } from "react";
import { useHydratedUser } from '@/features/auth/hooks/useHydratedUser';

import { Plus, Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import * as XLSX from "xlsx";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

import { VALID_ROLES, type Role, type UserStatus } from "@/features/auth/types/authTypes";
import { canManageEmployees } from "@/features/employees/utils/permissions";
import { ROLE_LABEL, STATUS_LABEL } from "@/features/employees/utils/badges";
import { useEmployeesQuery } from "@/features/employees/hooks/useEmployeesQuery";
import { EmployeeTable } from "@/features/employees/components/EmployeeTable";
import { BulkCreateEmployeeModal } from "@/features/employees/components/BulkCreateEmployeeModal";
import { SingleCreateEmployeeModal } from "@/features/employees/components/SingleCreateEmployeeModal";
import { listEmployees } from "@/features/employees/api/employeeService";
import type { EmployeeListParams } from "@/features/employees/types/employee";

const PAGE_SIZE = 20;
const ROLE_FILTER_ALL = "ALL" as const;
const STATUS_FILTER_ALL = "ALL" as const;

export function EmployeeManagementView() {
  const { user } = useHydratedUser();
  const canManage = canManageEmployees(user);

  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | typeof ROLE_FILTER_ALL>(ROLE_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<UserStatus | typeof STATUS_FILTER_ALL>(
    STATUS_FILTER_ALL
  );
  const [sortBy, setSortBy] = useState<string>("role");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [isBulkCreateModalOpen, setBulkCreateModalOpen] = useState(false);
  const [isSingleCreateModalOpen, setSingleCreateModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const params: EmployeeListParams = {
    keyword: keyword.trim() || undefined,
    role: roleFilter === ROLE_FILTER_ALL ? undefined : roleFilter,
    status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
    sort_by: sortBy,
    sort_order: sortOrder,
    page,
    size: PAGE_SIZE,
  };

  const { data, isLoading, isError } = useEmployeesQuery(params);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handleExportExcel = async () => {
    if (!user) return;
    try {
      setIsExporting(true);
      const res = await listEmployees({
        keyword: keyword.trim() || undefined,
        role: roleFilter === ROLE_FILTER_ALL ? undefined : roleFilter,
        status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: 1,
        size: 9999,
      });

      const allowedRoles = user.role === "MASTER" 
        ? ["MASTER", "ADMIN", "WORKER", "GUEST"] 
        : ["ADMIN", "WORKER", "GUEST"];

      const filtered = res.items.filter((item) => allowedRoles.includes(item.role));
      
      const exportData = filtered.map((item) => ({
        "사번": item.employee_id,
        "이름": item.name,
        "역할": ROLE_LABEL[item.role] || item.role,
        "상태": STATUS_LABEL[item.status] || item.status,
        "가입일": new Date(item.created_at).toLocaleDateString("ko-KR"),
      }));

      if (exportData.length === 0) {
        alert("다운로드할 데이터가 없습니다.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "직원목록");
      XLSX.writeFile(wb, "직원_목록.xlsx");
    } catch (error) {
      console.error("Failed to export", error);
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">직원 관리</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">직원 계정을 조회하고 상태·역할을 관리합니다.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setSingleCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              직원 등록
            </Button>
            <Button variant="outline" onClick={() => setBulkCreateModalOpen(true)}>
              엑셀 일괄 등록
            </Button>
          </div>
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
          <SelectTrigger className="w-[120px]">
            <SelectValue>
              {roleFilter === ROLE_FILTER_ALL ? "전체 역할" : ROLE_LABEL[roleFilter as Role] || roleFilter}
            </SelectValue>
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
          <SelectTrigger className="w-[120px]">
            <SelectValue>
              {statusFilter === STATUS_FILTER_ALL ? "전체 상태" : STATUS_LABEL[statusFilter as UserStatus] || statusFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>전체 상태</SelectItem>
            <SelectItem value="ACTIVE">{STATUS_LABEL.ACTIVE}</SelectItem>
            <SelectItem value="INACTIVE">{STATUS_LABEL.INACTIVE}</SelectItem>
          </SelectContent>
        </Select>
        
        <Select
          value={`${sortBy}-${sortOrder}`}
          onValueChange={(value) => {
            if (!value) return;
            setPage(1);
            const [sBy, sOrder] = value.split("-");
            setSortBy(sBy);
            setSortOrder(sOrder as "asc" | "desc");
          }}
        >
          <SelectTrigger className="ml-auto w-[140px]">
            <SelectValue>
              {
                ({
                  "role-asc": "직급 높은 순",
                  "role-desc": "직급 낮은 순",
                  "created_at-desc": "최신 가입 순",
                  "created_at-asc": "오래된 가입 순",
                  "name-asc": "이름 가나다 순",
                  "employee_id-asc": "사번 순"
                } as Record<string, string>)[`${sortBy}-${sortOrder}`] || "직급 높은 순"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="role-asc">직급 높은 순</SelectItem>
            <SelectItem value="role-desc">직급 낮은 순</SelectItem>
            <SelectItem value="created_at-desc">최신 가입 순</SelectItem>
            <SelectItem value="created_at-asc">오래된 가입 순</SelectItem>
            <SelectItem value="name-asc">이름 가나다 순</SelectItem>
            <SelectItem value="employee_id-asc">사번 순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-gray-400 dark:text-gray-500">불러오는 중...</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400">직원 목록을 불러오지 못했습니다.</p>}

      {data && (
        <>
          <EmployeeTable employees={data.items} currentUser={user} />
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>총 {data.total}명</span>
              {canManage && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportExcel} 
                  disabled={isExporting}
                  className="h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  {isExporting ? "다운로드 중..." : "목록 다운로드"}
                </Button>
              )}
            </div>
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
        open={isBulkCreateModalOpen}
        onClose={() => setBulkCreateModalOpen(false)}
        currentUser={user}
      />
      <SingleCreateEmployeeModal
        open={isSingleCreateModalOpen}
        onClose={() => setSingleCreateModalOpen(false)}
        currentUser={user}
      />
    </div>
  );
}
