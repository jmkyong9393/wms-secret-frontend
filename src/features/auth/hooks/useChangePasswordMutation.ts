"use client";

import { useMutation } from "@tanstack/react-query";
import { useStore } from "jotai";
import { changePassword, getMe } from "@/features/auth/api/authService";
import { getSessionKey, mapMeResponseToCurrentUser } from "@/features/auth/store/authSessionMapper";
import {
  authTokenAtom,
  currentUserAtom,
  mustChangePasswordAtom,
  sessionAtom,
  sessionVerifiedAtom,
} from "@/features/auth/store/authAtoms";
import type { ChangePasswordRequest } from "@/features/auth/types/authApiTypes";
import type { CurrentUser } from "@/features/auth/types/authTypes";

export type ChangePasswordResult =
  | { profileLoaded: true; user: CurrentUser }
  | { profileLoaded: false }; // 비밀번호 변경은 성공했지만 사용자 정보 조회 실패

// 비밀번호 변경과 사용자 정보 조회 처리
export function useChangePasswordMutation() {
  const store = useStore();

  return useMutation({
    mutationFn: async (payload: ChangePasswordRequest): Promise<ChangePasswordResult> => {
      // 비밀번호 변경
      await changePassword(payload);
      // 비밀번호 변경 필요 상태 해제
      store.set(mustChangePasswordAtom, false);

      const session = store.get(sessionAtom);
      // 로그인 세션이 없으면 인증 정보 초기화
      if (!session) {
        store.set(authTokenAtom, null);
        store.set(currentUserAtom, null);
        throw new Error("인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.");
      }

      try {
        // 변경 후 사용자 정보 다시 조회
        const me = await getMe();
        const user = mapMeResponseToCurrentUser(me, session);
        // 사용자 정보와 세션 확인 상태 저장
        store.set(currentUserAtom, user);
        store.set(sessionVerifiedAtom, getSessionKey(session));
        return { profileLoaded: true, user };
      } catch {
         // 비밀번호 변경은 성공했으므로 조회 실패만 전달
        return { profileLoaded: false };
      }
    },
  });
}
