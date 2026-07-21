import type { Role } from "@/features/auth/types/authTypes";

// 역할별 로그인 후 이동 경로
// GUEST 전용 화면 미정으로 경로 제외
export const ROLE_HOME_ROUTE: Partial<Record<Role, string>> = {
  MASTER: "/admin",
  ADMIN: "/admin",
  WORKER: "/inbound",
};
