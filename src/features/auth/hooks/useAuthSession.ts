"use client";

import { useEffect } from "react";
import { useAtomValue, useStore } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { getMe } from "@/features/auth/api/authService";
import { getSessionKey, mapMeResponseToCurrentUser } from "@/features/auth/store/authSessionMapper";
import {
  currentUserAtom,
  logoutAtom,
  mustChangePasswordAtom,
  sessionAtom,
  sessionVerifiedAtom,
} from "@/features/auth/store/authAtoms";
import type { CurrentUser } from "@/features/auth/types/authTypes";

export type AuthSessionState =
  | { status: "unauthenticated" }
  | { status: "pendingPasswordChange" }
  | { status: "loading" }
  | { status: "ready"; currentUser: CurrentUser }
  | { status: "error"; retry: () => void };

// 로그인 세션의 서버 유효성 확인
export function useAuthSession(): AuthSessionState {
  const store = useStore();
  const session = useAtomValue(sessionAtom);
  const mustChangePassword = useAtomValue(mustChangePasswordAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const verifiedKey = useAtomValue(sessionVerifiedAtom);

  // 현재 로그인 세션을 구분하는 값
  const sessionKey = session ? getSessionKey(session) : null;

  // 현재 세션의 서버 확인 완료 여부
  const isVerified = sessionKey !== null && verifiedKey === sessionKey;

  // 서버 확인이 필요하거나 사용자 정보가 없으면 다시 조회
  const shouldVerify =
    session !== null && !mustChangePassword && (!isVerified || currentUser === null);

  const query = useQuery({
    queryKey: ["auth", "me", sessionKey],
    queryFn: getMe,
    enabled: shouldVerify,
    retry: false,
  });

  useEffect(() => {
    if (!query.isSuccess || !session || !sessionKey) return;

    // 서버 응답으로 사용자 정보와 확인 완료 상태 저장
    store.set(currentUserAtom, mapMeResponseToCurrentUser(query.data, session));
    store.set(sessionVerifiedAtom, sessionKey);
  }, [query.isSuccess, query.data, session, sessionKey, store]);

  useEffect(() => {
    if (!query.isError) return;

    // 인증이 만료되면 로그인 정보 초기화
    if (isAxiosError(query.error) && query.error.response?.status === 401) {
      // TODO(backend): /auth/me의 403 처리 기준 확인
      store.set(logoutAtom);
    }
  }, [query.isError, query.error, store]);

  // 로그인 정보 없음
  if (session === null) return { status: "unauthenticated" };

  // 최초 비밀번호 변경 필요
  if (mustChangePassword) return { status: "pendingPasswordChange" };

  // 서버 확인과 사용자 정보 조회 완료
  if (isVerified && currentUser) return { status: "ready", currentUser };

  // 오프라인 등으로 요청이 시작되지 못한 상태
  if (query.fetchStatus === "paused") {
    return { status: "error", retry: () => query.refetch() };
  }
  if (query.isError) {
    // 서버에서 인증 만료로 판단한 상태
    if (isAxiosError(query.error) && query.error.response?.status === 401) {
      return { status: "unauthenticated" };
    }
    // 네트워크 또는 서버 오류
    return { status: "error", retry: () => query.refetch() };
  }
  // 사용자 정보 확인 중
  return { status: "loading" };
}
