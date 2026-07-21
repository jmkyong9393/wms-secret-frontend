"use client";

import { useMutation } from "@tanstack/react-query";
import { useStore } from "jotai";
import { getMe, login } from "@/features/auth/api/authService";
import { getSessionKey, mapMeResponseToCurrentUser, mapTokenToSession } from "@/features/auth/store/authSessionMapper";
import {
  authTokenAtom,
  currentUserAtom,
  mustChangePasswordAtom,
  sessionVerifiedAtom,
} from "@/features/auth/store/authAtoms";
import type { LoginRequest } from "@/features/auth/types/authApiTypes";
import type { CurrentUser } from "@/features/auth/types/authTypes";

export type LoginResult =
  | { mustChangePassword: true }
  | { mustChangePassword: false; user: CurrentUser };

// 로그인과 사용자 정보 조회 처리
export function useLoginMutation() {
  const store = useStore();

  return useMutation({
    mutationFn: async (payload: LoginRequest): Promise<LoginResult> => {
      const data = await login(payload);

      // JWT에서 라우팅에 필요한 세션 정보 추출
      const session = mapTokenToSession(data.access_token);
      if (!session) {
        throw new Error("유효하지 않은 인증 토큰입니다.");
      }

      // 로그인 상태 저장
      store.set(authTokenAtom, data.access_token);
      store.set(mustChangePasswordAtom, data.must_change_password);

      // 최초 비밀번호 변경 화면으로 이동할 결과 반환
      if (data.must_change_password) {
        store.set(currentUserAtom, null);
        return { mustChangePassword: true };
      }

      try {
        // 사용자 프로필 조회 및 저장
        const me = await getMe();
        const user = mapMeResponseToCurrentUser(me, session);
        store.set(currentUserAtom, user);
        store.set(sessionVerifiedAtom, getSessionKey(session));
        return { mustChangePassword: false, user };
      } catch (err) {
        // 사용자 조회 실패 시 로그인 상태 초기화
        store.set(authTokenAtom, null);
        store.set(mustChangePasswordAtom, false);
        store.set(currentUserAtom, null);
        throw err;
      }
    },
  });
}
