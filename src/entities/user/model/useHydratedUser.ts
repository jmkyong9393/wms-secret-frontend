'use client';

import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/entities/user/model/authAtoms';
import type { CurrentUser } from '@/entities/user/model/types';

/**
 * 하이드레이션 안전 버전의 로그인 사용자 조회.
 *
 * [배경] `currentUserAtom`은 `atomWithStorage(..., { getOnInit: true })`라 브라우저에서는
 * 첫 렌더부터 localStorage 값을 읽는다. 반면 서버에는 localStorage가 없어 항상 null이다.
 * 그래서 사용자 정보에 따라 화면이 갈리는 컴포넌트는 **서버 HTML과 첫 클라이언트 렌더가
 * 서로 다른 결과**를 내고 React가 하이드레이션 불일치로 트리를 통째로 다시 그린다.
 * 실제 증상: 사이드바가 서버에서는 '현장 작업자 전용 메뉴', 클라이언트에서는
 * '관제 & 인텔리전스'로 렌더돼 콘솔에 hydration-mismatch 에러가 났다.
 *
 * [해법] 첫 렌더에서는 서버와 똑같이 null을 돌려주고, 마운트된 뒤에야 실제 값을 노출한다.
 * `hydrated`를 같이 돌려주는 이유는, 사용자에 따라 내용이 크게 달라지는 화면에서
 * "아직 모른다"와 "비로그인"을 구분해 **잘못된 메뉴가 한 번 스쳐 지나가는 것**을
 * 막기 위해서다(플레이스홀더를 그릴지 판단하는 근거).
 *
 * 화면 렌더에 사용자 정보를 쓰는 컴포넌트는 `useAtomValue(currentUserAtom)` 대신 이 훅을
 * 쓴다. 이펙트 안에서만 참조하는 경우(렌더 결과에 영향 없음)는 아톰을 직접 써도 된다.
 */
export function useHydratedUser(): { user: CurrentUser | null; hydrated: boolean } {
  const stored = useAtomValue(currentUserAtom);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return { user: hydrated ? stored : null, hydrated };
}
