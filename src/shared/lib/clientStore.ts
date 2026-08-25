'use client';

/**
 * SSR 안전한 브라우저 상태 구독 유틸 (useSyncExternalStore 기반).
 *
 * 종전에는 "서버에 localStorage가 없다"는 이유로 useState(기본값) + useEffect(setState)로
 * 초기값을 흘려 넣었다. 이 패턴은 마운트 직후 재렌더를 한 번 강제하고
 * react-hooks/set-state-in-effect 위반이다. useSyncExternalStore는 하이드레이션 중에는
 * 서버 스냅샷을 쓰고 완료 후 실제 값으로 갈아타므로, 재렌더 캐스케이드 없이
 * hydration 불일치도 나지 않는다.
 */

import { useCallback, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** 하이드레이션 완료 여부 — 서버·하이드레이션 중 false, 이후 true. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * localStorage 키 하나를 구독한다.
 * - 다른 탭의 변경: `storage` 이벤트
 * - 같은 탭의 변경: 쓰는 쪽이 반드시 `notifyEvent`(커스텀 이벤트)를 dispatch해야 한다.
 *   (`storage` 이벤트는 같은 탭에서는 발화하지 않는 브라우저 규격)
 */
export function useLocalStorageItem(key: string, notifyEvent?: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      window.addEventListener('storage', onChange);
      if (notifyEvent) window.addEventListener(notifyEvent, onChange);
      return () => {
        window.removeEventListener('storage', onChange);
        if (notifyEvent) window.removeEventListener(notifyEvent, onChange);
      };
    },
    [notifyEvent],
  );
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
}

/** localStorage에 쓰고 같은 탭 구독자에게 즉시 통지한다 (useLocalStorageItem의 쓰기 짝). */
export function writeLocalStorageItem(key: string, value: string | null, notifyEvent?: string): void {
  if (typeof window === 'undefined') return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  if (notifyEvent) window.dispatchEvent(new Event(notifyEvent));
}
