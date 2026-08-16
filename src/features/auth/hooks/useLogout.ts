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
      // role 쿠키는 클라이언트에서도 지운다. 서버가 token·role 두 개를 Set-Cookie로
      // 내리는데 ALB가 동일 이름 헤더를 하나로 접어 **두 번째(role)가 유실**된다.
      // 그 결과 로그아웃해도 role이 남아, 미들웨어·레이아웃이 이전 역할로 화면을 그린다.
      // role은 HttpOnly가 아니므로(RBAC 라우팅용) 여기서 직접 만료시킬 수 있다.
      document.cookie = "role=; Max-Age=0; Path=/; SameSite=Lax";
      window.location.href = "/login";
    }
  };
}
