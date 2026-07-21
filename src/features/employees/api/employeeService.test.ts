import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  listEmployees,
  bulkCreateEmployees,
  updateEmployeeStatus,
  updateEmployeeRole,
} from "./employeeService";

vi.mock("@/lib/api-client", () => {
  return {
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
  };
});

describe("employeeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listEmployees calls GET /api/v1/users/admin with query params", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { items: [], total: 0, page: 1, size: 20 },
    });

    const params = { keyword: "홍", page: 1, size: 20 };
    const res = await listEmployees(params);

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/users/admin", { params });
    expect(res).toEqual({ items: [], total: 0, page: 1, size: 20 });
  });

  it("bulkCreateEmployees calls POST /api/v1/users/admin/create-accounts with the request body", async () => {
    const payload = {
      employees: [{ employee_id: "W0099", name: "홍길동", role: "WORKER" as const, password: "password1" }],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { results: [{ employee_id: "W0099", success: true }] },
    });

    const res = await bulkCreateEmployees(payload);

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/users/admin/create-accounts", payload);
    expect(res.results[0].success).toBe(true);
  });

  it("updateEmployeeStatus calls PATCH on the employee status endpoint", async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { employee_id: "W0001", status: "INACTIVE" },
    });

    const res = await updateEmployeeStatus("W0001", { status: "INACTIVE" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/users/admin/W0001/status", {
      status: "INACTIVE",
    });
    expect(res.status).toBe("INACTIVE");
  });

  it("updateEmployeeRole calls PATCH on the employee role endpoint", async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { employee_id: "W0001", role: "ADMIN" },
    });

    const res = await updateEmployeeRole("W0001", { role: "ADMIN" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/users/admin/W0001/role", {
      role: "ADMIN",
    });
    expect(res.role).toBe("ADMIN");
  });
});
