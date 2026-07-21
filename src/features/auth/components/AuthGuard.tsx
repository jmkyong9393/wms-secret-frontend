"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { ROLE_HOME_ROUTE } from "@/features/auth/constants/roleRoutes";
import type { Role } from "@/features/auth/types/authTypes";

interface AuthGuardProps {
  // 접근 가능한 역할. 미지정 시 로그인 사용자 전체 허용
  allow?: Role[];
  children: React.ReactNode;
}

const REDIRECTING_MESSAGE = (
  <p className="p-8 text-center text-sm text-gray-400">페이지를 이동하고 있습니다...</p>
);

// 로그인 상태와 역할에 따른 페이지 접근 제어
export function AuthGuard({ allow, children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const authSession = useAuthSession();

  const status = authSession.status;

  // 로그인 사용자 역할
  const role = authSession.status === "ready" ? authSession.currentUser.role : null;

  // 비밀번호 변경 필요 여부
  const needsPasswordChange = status === "pendingPasswordChange" && pathname !== "/change-password";

  // 현재 역할의 접근 제한 여부
  const roleNotAllowed = status === "ready" && !!allow && !!role && !allow.includes(role);

  useEffect(() => {
    // 미로그인 시 로그인 페이지로 이동
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    // 최초 비밀번호 변경 페이지로 이동
    if (needsPasswordChange) {
      router.replace("/change-password");
      return;
    }
    // 접근 권한이 없으면 역할별 기본 페이지로 이동
    if (roleNotAllowed && role) {
      router.replace(ROLE_HOME_ROUTE[role] ?? "/login");
    }
  }, [status, needsPasswordChange, roleNotAllowed, role, pathname, router]);

  if (status === "unauthenticated" || needsPasswordChange) return REDIRECTING_MESSAGE;

  if (status === "loading") {
    return <p className="p-8 text-center text-sm text-gray-400">세션 확인 중...</p>;
  }

  if (authSession.status === "error") {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-red-600">세션 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <Button type="button" onClick={authSession.retry}>다시 시도</Button>
      </div>
    );
  }
  
  // 비밀번호 변경 페이지는 역할 제한 없음
  if (status === "pendingPasswordChange") return <>{children}</>; // /change-password 자체는 allow 없음
  if (roleNotAllowed) return REDIRECTING_MESSAGE;

  return <>{children}</>;
}
