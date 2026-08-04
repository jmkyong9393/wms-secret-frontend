import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { CurrentUser } from "@/features/auth/types/authTypes";

// 인증 정보 localStorage 키
export const CURRENT_USER_STORAGE_KEY = "wms_current_user";

// 로그인 사용자 정보 저장. JWT 원본은 HttpOnly 쿠키로만 존재해 JS에서 절대 읽을 수 없으므로,
// 로그인 상태 판단은 이 atom(서버가 반환한 프로필)의 존재 여부만으로 이루어진다.
export const currentUserAtom = atomWithStorage<CurrentUser | null>(
  CURRENT_USER_STORAGE_KEY,
  null,
  undefined,
  { getOnInit: true }
);

// 로그인 여부 확인
export const isAuthenticatedAtom = atom((get) => get(currentUserAtom) !== null);

// 클라이언트 세션 정리. 실제 인증 쿠키 만료는 HttpOnly라 JS로 지울 수 없으므로
// 반드시 먼저 features/auth/api/authService.logout()으로 백엔드 /api/v1/auth/logout을
// 호출해 서버 측에서 쿠키를 만료시킨 뒤 이 atom을 사용한다 (features/auth/hooks/useLogout 참고).
export const logoutAtom = atom(null, (_get, set) => {
  set(currentUserAtom, null);
});
