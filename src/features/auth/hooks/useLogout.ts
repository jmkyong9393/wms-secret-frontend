import { useSetAtom } from "jotai";
import { logoutAtom } from "@/features/auth/store/authAtoms";
import { logout as logoutRequest } from "@/features/auth/api/authService";

// 로그아웃 = 백엔드 쿠키 만료(POST /api/v1/auth/logout) + 클라이언트 세션 정리를
// 한 곳에서만 수행한다. 백엔드 호출이 실패해도(네트워크 단절 등) 클라이언트 세션은
// 반드시 정리하고 로그인 페이지로 보낸다.
export function useLogout() {
  const clearSession = useSetAtom(logoutAtom);

  return async () => {
    try {
      await logoutRequest();
    } catch {
      // 쿠키 만료 요청 실패는 무시 - 아래 finally에서 클라이언트 세션은 어차피 정리된다
    } finally {
      clearSession();
      window.location.href = "/login";
    }
  };
}
