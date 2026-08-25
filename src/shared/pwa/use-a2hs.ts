'use client';

import { useCallback, useSyncExternalStore } from 'react';

// BeforeInstallPromptEvent type definition
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * A2HS(홈 화면 추가) 설치 프롬프트 스토어.
 *
 * 브라우저의 `beforeinstallprompt`는 React 밖에서 발생하는 외부 상태다. 종전에는
 * useState+useEffect로 복사해 왔지만(마운트 직후 재렌더 + set-state-in-effect 위반),
 * 모듈 스코프 스토어 + useSyncExternalStore 구독이 정석이다. 하이드레이션 전에 이벤트가
 * 먼저 발화한 경우를 위한 `window.__deferredPrompt` 스태시도 스냅샷에서 흡수한다.
 */
let storedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  // 이미 PWA(독립 앱)로 실행 중이면 설치 배너 대상이 아니다.
  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  const stashed = (window as Window & { __deferredPrompt?: BeforeInstallPromptEvent }).__deferredPrompt;
  return storedPrompt ?? stashed ?? null;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault(); // 모바일 mini-infobar 억제
    storedPrompt = e as BeforeInstallPromptEvent;
    notify();
  };
  const handleAppInstalled = () => {
    storedPrompt = null;
    (window as Window & { __deferredPrompt?: BeforeInstallPromptEvent }).__deferredPrompt = undefined;
    notify();
  };
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

export function useA2HS() {
  const deferredPrompt = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const isInstallable = deferredPrompt !== null;

  const promptToInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // 프롬프트는 1회용 - 소진 즉시 비워 배너를 내린다.
    storedPrompt = null;
    (window as Window & { __deferredPrompt?: BeforeInstallPromptEvent }).__deferredPrompt = undefined;
    notify();
  }, [deferredPrompt]);

  return { isInstallable, promptToInstall };
}
