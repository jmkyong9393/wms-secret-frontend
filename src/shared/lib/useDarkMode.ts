'use client';

/**
 * 다크 모드 상태 훅 (Header·설정 페이지 공유).
 *
 * 원천은 DOM 클래스(초기 스크립트가 넣을 수 있음)와 localStorage('nexus-theme')다.
 * useState 복사 대신 useSyncExternalStore로 구독한다 - 같은 탭 변경은
 * 'nexus-theme-change', 다른 탭은 storage 이벤트로 통지받는다.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const THEME_EVENT = 'nexus-theme-change';

function readIsDark(): boolean {
  return (
    document.documentElement.classList.contains('dark') ||
    localStorage.getItem('nexus-theme') === 'dark'
  );
}

export function setDarkMode(dark: boolean): void {
  // 스냅샷이 DOM 클래스를 OR로 보므로, 클래스 갱신을 dispatch보다 먼저 해야 값이 뒤집힌다.
  document.documentElement.classList.toggle('dark', dark);
  document.body.classList.toggle('dark', dark);
  localStorage.setItem('nexus-theme', dark ? 'dark' : 'light');
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useDarkMode(): { isDarkMode: boolean; setDarkMode: (dark: boolean) => void } {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  const isDarkMode = useSyncExternalStore(subscribe, readIsDark, () => false);

  // 저장된 테마를 DOM 클래스로 반영 (localStorage만 있고 클래스가 없는 초기 로드 대비)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return { isDarkMode, setDarkMode };
}
