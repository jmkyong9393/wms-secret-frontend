/**
 * 시스템 설정 단일 저장소 (localStorage 기반).
 *
 * [2026-08-05 신설] admin/settings 페이지가 로컬 state만 갖고 있어 저장 버튼이
 * 토스트만 띄우는 더미였다. UI 레벨 설정(자동 인쇄, HITL 경보 임계값)을 이 모듈
 * 한 곳으로 모아 실제 소비처(/inbound, /admin/hitl, Header)와 연동한다.
 *
 * 참고: 테마(nexus-theme)와 알림 음소거(nexus-notif-muted)는 Header가 먼저
 * 소유한 기존 키를 그대로 쓴다 - 여기서 중복 정의하지 않는다.
 */

import { useCallback, useSyncExternalStore } from 'react';

export interface SystemSettings {
  /** LPN 발급 시 열전사 프린터(WebUSB) 연결을 시도할지 여부. 끄면 인쇄 단계를 건너뛴다. */
  autoPrintTrigger: boolean;
  /** HITL 승인 대기열이 이 건수 이상이면 관제 화면에서 경보 강조 */
  hitlAlertThreshold: number;
}

const STORAGE_KEY = 'nexus-system-settings';

export const SETTINGS_CHANGE_EVENT = 'nexus-settings-change';

export const DEFAULT_SETTINGS: SystemSettings = {
  autoPrintTrigger: true,
  hitlAlertThreshold: 10,
};

export function getSystemSettings(): SystemSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      autoPrintTrigger:
        typeof parsed.autoPrintTrigger === 'boolean' ? parsed.autoPrintTrigger : DEFAULT_SETTINGS.autoPrintTrigger,
      hitlAlertThreshold:
        Number.isFinite(parsed.hitlAlertThreshold) && parsed.hitlAlertThreshold >= 1
          ? Math.floor(parsed.hitlAlertThreshold)
          : DEFAULT_SETTINGS.hitlAlertThreshold,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSystemSettings(patch: Partial<SystemSettings>): SystemSettings {
  const next = { ...getSystemSettings(), ...patch };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // 같은 탭의 다른 화면(Header, HITL 등)이 즉시 반영할 수 있도록 브로드캐스트
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: next }));
  }
  return next;
}


/**
 * 시스템 설정 한 항목을 구독한다 (SSR 안전).
 * 값이 원시형(boolean/number)이라 getSnapshot이 매번 계산해도 Object.is 비교로 안정적이다.
 * 같은 탭 변경은 saveSystemSettings가 쏘는 SETTINGS_CHANGE_EVENT, 다른 탭은 storage 이벤트로 통지받는다.
 */
export function useSystemSettingValue<K extends keyof SystemSettings>(key: K): SystemSettings[K] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(SETTINGS_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(SETTINGS_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => getSystemSettings()[key],
    () => DEFAULT_SETTINGS[key],
  );
}
