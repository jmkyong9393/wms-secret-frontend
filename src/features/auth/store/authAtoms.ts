import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { mapTokenToSession } from "@/features/auth/store/authSessionMapper";
import type { AuthSession, CurrentUser } from "@/features/auth/types/authTypes";

// 인증 정보 localStorage 키
export const AUTH_TOKEN_STORAGE_KEY = "wms_auth_token";
export const MUST_CHANGE_PASSWORD_STORAGE_KEY = "wms_must_change_password";
export const CURRENT_USER_STORAGE_KEY = "wms_current_user";

// 토큰 문자열 저장 방식
const rawTokenStorage = {
  getItem: (key: string, initialValue: string | null) => {
    if (typeof window === "undefined") return initialValue;
    const value = localStorage.getItem(key);
    return value === null ? initialValue : value;
  },
  setItem: (key: string, newValue: string | null) => {
    if (typeof window === "undefined") return;
    if (newValue === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, newValue);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};

// 로그인 토큰 저장
export const authTokenAtom = atomWithStorage<string | null>(
  AUTH_TOKEN_STORAGE_KEY,
  null,
  rawTokenStorage,
  { getOnInit: true }
);

// 최초 비밀번호 변경 여부 저장
export const mustChangePasswordAtom = atomWithStorage<boolean>(
  MUST_CHANGE_PASSWORD_STORAGE_KEY,
  false
);

// 토큰에서 로그인 세션 정보 생성
export const sessionAtom = atom<AuthSession | null>((get) => {
  const token = get(authTokenAtom);
  if (!token) return null;
  return mapTokenToSession(token);
});

// 로그인 여부 확인
export const isAuthenticatedAtom = atom((get) => get(sessionAtom) !== null);

// 로그인 사용자 정보 저장
export const currentUserAtom = atomWithStorage<CurrentUser | null>(
  CURRENT_USER_STORAGE_KEY,
  null,
  undefined,
  { getOnInit: true }
);

// 현재 세션의 서버 확인 완료 상태
// 새로고침 시 초기화
export const sessionVerifiedAtom = atom<string | null>(null);

// 로그인 정보 전체 초기화
export const logoutAtom = atom(null, (_get, set) => {
  set(authTokenAtom, null);
  set(mustChangePasswordAtom, false);
  set(currentUserAtom, null);
  set(sessionVerifiedAtom, null);
});
