'use client';

import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/entities/user/model/authAtoms';
import { useLogout } from '@/features/auth/hooks/useLogout';

const SESSION_ALIVE_KEY = 'nexus_session_alive';

/**
 * 탭/브라우저를 완전히 닫았다가 다시 열면 로그아웃되어야 하지만, 새로고침(F5)에서는
 * 로그인 상태가 유지되어야 한다. beforeunload/pagehide 이벤트는 새로고침과 탭 종료를
 * 구분할 수 없어(둘 다 동일하게 발생) 이 이벤트만으로는 새로고침 시에도 로그아웃되는
 * 회귀가 생긴다. 대신 탭이 살아있는 동안에만 유지되는 sessionStorage 마커로 구분한다:
 * 마커가 없는데 로그인 사용자 정보(localStorage)가 있다면 "이전 세션에서 탭/브라우저를
 * 닫은 뒤 새로 연 탭"이라는 뜻이므로 그때만 로그아웃 처리한다. JWT 자체는 HttpOnly 쿠키라
 * 여기서 직접 읽을 수 없으므로, useLogout으로 백엔드 쿠키까지 함께 만료시킨다.
 */
export function SessionAutoLogout() {
  const currentUser = useAtomValue(currentUserAtom);
  const logout = useLogout();

  useEffect(() => {
    const sessionAlive = sessionStorage.getItem(SESSION_ALIVE_KEY);
    if (!sessionAlive && currentUser) {
      logout();
    }
    sessionStorage.setItem(SESSION_ALIVE_KEY, 'true');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
