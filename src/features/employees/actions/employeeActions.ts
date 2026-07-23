"use server";

import { cookies } from "next/headers";
import type {
  EmployeeListParams,
  EmployeeListResponse,
  BulkCreateEmployeeRequest,
  BulkCreateEmployeeResponse,
  UpdateEmployeeStatusRequest,
  UpdateEmployeeStatusResponse,
  UpdateEmployeeRoleRequest,
  UpdateEmployeeRoleResponse,
} from "@/features/employees/types/employee";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && options.method !== "GET" && options.method !== "DELETE") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BACKEND_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function listEmployeesAction(params: EmployeeListParams): Promise<EmployeeListResponse> {
  const searchParams = new URLSearchParams();
  if (params.keyword) searchParams.set("keyword", params.keyword);
  if (params.role) searchParams.set("role", params.role);
  if (params.status) searchParams.set("status", params.status);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.size) searchParams.set("size", params.size.toString());

  return fetchWithAuth(`/api/v1/users/admin?${searchParams.toString()}`);
}

export async function bulkCreateEmployeesAction(
  payload: BulkCreateEmployeeRequest
): Promise<BulkCreateEmployeeResponse> {
  return fetchWithAuth("/api/v1/users/admin/create-accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getNextEmployeeIdAction(prefix: string = "WM"): Promise<{ next_employee_id: string }> {
  return fetchWithAuth(`/api/v1/users/admin/next-employee-id?prefix=${prefix}`);
}

export async function updateEmployeeStatusAction(
  employeeId: string,
  payload: UpdateEmployeeStatusRequest
): Promise<UpdateEmployeeStatusResponse> {
  return fetchWithAuth(`/api/v1/users/admin/${employeeId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateEmployeeRoleAction(
  employeeId: string,
  payload: UpdateEmployeeRoleRequest
): Promise<UpdateEmployeeRoleResponse> {
  return fetchWithAuth(`/api/v1/users/admin/${employeeId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployeeAction(employeeId: string): Promise<{ message: string; employee_id: string }> {
  return fetchWithAuth(`/api/v1/users/admin/${employeeId}`, {
    method: "DELETE",
  });
}
