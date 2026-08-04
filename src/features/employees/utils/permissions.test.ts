import { describe, it, expect } from "vitest";
import { canManageEmployees, getAssignableRoles } from "./permissions";
import type { CurrentUser } from "@/features/auth/types/authTypes";
import type { Role } from "@/features/auth/types/authTypes";

function makeUser(role: Role): CurrentUser {
  return { employeeId: "T0001", name: "테스트", role, mustChangePassword: false };
}

describe("canManageEmployees", () => {
  it("returns true for MASTER/ADMIN", () => {
    expect(canManageEmployees(makeUser("MASTER"))).toBe(true);
    expect(canManageEmployees(makeUser("ADMIN"))).toBe(true);
  });

  it("returns false for WORKER/GUEST", () => {
    expect(canManageEmployees(makeUser("WORKER"))).toBe(false);
    expect(canManageEmployees(makeUser("GUEST"))).toBe(false);
  });

  it("returns false for null (unauthenticated)", () => {
    expect(canManageEmployees(null)).toBe(false);
  });
});

describe("getAssignableRoles", () => {
  it("returns ADMIN/WORKER/GUEST (MASTER 제외) for MASTER/ADMIN", () => {
    expect(getAssignableRoles(makeUser("MASTER"))).toEqual(["ADMIN", "WORKER", "GUEST"]);
    expect(getAssignableRoles(makeUser("ADMIN"))).toEqual(["ADMIN", "WORKER", "GUEST"]);
  });

  it("returns an empty array for WORKER/GUEST", () => {
    expect(getAssignableRoles(makeUser("WORKER"))).toEqual([]);
    expect(getAssignableRoles(makeUser("GUEST"))).toEqual([]);
  });

  it("returns an empty array for null (unauthenticated)", () => {
    expect(getAssignableRoles(null)).toEqual([]);
  });
});
