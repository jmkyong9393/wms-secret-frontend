import type { Role, UserStatus } from "@/entities/user/model/types";

// 역할별 배지 색상 / 한글 라벨
export const ROLE_BADGE_STYLE: Record<Role, string> = {
  MASTER: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  WORKER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  GUEST: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

export const ROLE_LABEL: Record<Role, string> = {
  MASTER: "마스터",
  ADMIN: "관리자",
  WORKER: "작업자",
  GUEST: "게스트",
};

// 계정 상태별 배지 색상 / 한글 라벨
export const STATUS_BADGE_STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  INACTIVE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
};
