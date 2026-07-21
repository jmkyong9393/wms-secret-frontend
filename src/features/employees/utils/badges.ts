import type { Role, UserStatus } from "@/features/auth/types/authTypes";

// 역할별 배지 색상 / 한글 라벨
export const ROLE_BADGE_STYLE: Record<Role, string> = {
  MASTER: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  WORKER: "bg-green-100 text-green-700",
  GUEST: "bg-gray-100 text-gray-600",
};

export const ROLE_LABEL: Record<Role, string> = {
  MASTER: "마스터",
  ADMIN: "관리자",
  WORKER: "작업자",
  GUEST: "게스트",
};

// 계정 상태별 배지 색상 / 한글 라벨
export const STATUS_BADGE_STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-red-100 text-red-700",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
};
