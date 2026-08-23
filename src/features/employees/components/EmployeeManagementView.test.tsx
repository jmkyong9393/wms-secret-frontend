import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { CurrentUser, Role } from "@/entities/user/model/types";

/**
 * 검증 범위: **권한이 실제로 등록 버튼에 연결되어 있는가**.
 *
 * [2026-08-06 축소] 종전에는 목 데이터로 직원 목록 행까지 단언했다가 렌더되지 않아
 * 계속 실패하고 있었다. 목록 렌더는 이 파일이 지키려는 정책("ADMIN도 직원을 등록할 수 있다")과
 * 무관한데 목 데이터 유지비만 발생시켰으므로 제거했다.
 *
 * `canManageEmployees` 자체의 판정 규칙은 `utils/permissions.test.ts`가 이미 덮는다.
 * 여기서만 확인할 수 있는 것은 **컴포넌트가 그 함수를 실제로 버튼 노출에 쓰고 있는지**이고,
 * 그래서 노출/미노출 양쪽을 모두 본다 (한쪽만 보면 항상 참을 반환해도 통과한다).
 */

// 메모리 localStorage - jotai atomWithStorage가 참조한다
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

// 네트워크 차단용 최소 목. 목록 내용은 단언하지 않으므로 빈 결과로 충분하다.
vi.mock("@/features/employees/api/employeeService", () => ({
  listEmployees: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 20 }),
  bulkCreateEmployees: vi.fn(),
  updateEmployeeStatus: vi.fn(),
  updateEmployeeRole: vi.fn(),
  getNextEmployeeId: vi.fn().mockResolvedValue({ next_employee_id: "WM2608099" }),
  deleteEmployee: vi.fn(),
}));

const PROFILES: Record<Role, { employeeId: string; name: string }> = {
  MASTER: { employeeId: "M0001", name: "장문경" },
  ADMIN: { employeeId: "A0001", name: "소한민" },
  WORKER: { employeeId: "W0001", name: "박민우" },
  GUEST: { employeeId: "G0001", name: "손님" },
};

async function renderAs(role: Role) {
  const { EmployeeManagementView } = await import("./EmployeeManagementView");
  const { currentUserAtom } = await import("@/entities/user/model/authAtoms");

  const currentUser: CurrentUser = { ...PROFILES[role], role, mustChangePassword: false };

  const store = createStore();
  // 인증은 HttpOnly 쿠키로 이루어지므로 JWT는 여기서 다루지 않는다 (프로필만 주입).
  store.set(currentUserAtom, currentUser);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <EmployeeManagementView />
      </JotaiProvider>
    </QueryClientProvider>
  );
}

describe("EmployeeManagementView 권한 게이트", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it.each(["MASTER", "ADMIN"] as const)(
    "%s는 직원 등록 수단이 노출된다 (현행 정책: ADMIN도 직원 관리 가능)",
    async (role) => {
      await renderAs(role);
      // 같은 문구의 버튼이 헤더와 빈 목록 안내에 함께 나올 수 있으므로 개수로 단언한다.
      expect(screen.getAllByRole("button", { name: /엑셀 일괄 등록/ }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /직원 등록/ }).length).toBeGreaterThan(0);
    }
  );

  it.each(["WORKER", "GUEST"] as const)("%s에게는 등록 수단이 노출되지 않는다", async (role) => {
    await renderAs(role);
    expect(screen.queryAllByRole("button", { name: /엑셀 일괄 등록/ })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /직원 등록/ })).toHaveLength(0);
  });
});
