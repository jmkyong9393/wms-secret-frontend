'use client';

/**
 * 실시간 이벤트 단일 구독 (SSE).
 *
 * [왜 하나로 모으는가] 종전에는 화면마다 각자 `new EventSource(...)`를 열었다.
 * 작업자가 출고 스캐너를 보고 있으면 Header와 스캐너가 **연결을 두 개** 유지했고,
 * 서버는 연결마다 Redis pubsub을 하나씩 만든다. 더 큰 문제는 **그 화면에 있어야만
 * 이벤트를 받는다**는 점이다 — 관리자 화면에서 송장을 발급하고 스캐너로 이동하면,
 * 발급 시점에 스캐너가 떠 있지 않았으므로 그 이벤트는 영영 오지 않는다.
 *
 * 여기서는 연결을 하나로 두고 구독자에게 나눠준다. 구독자가 0이 되면 연결을 닫는다.
 *
 * [자동 재연결] EventSource는 끊기면 스스로 재연결한다. 그동안 발생한 이벤트는
 * 받지 못하므로, 데이터 정합성은 이벤트가 아니라 **재조회**가 책임진다
 * (app/providers.tsx가 이벤트를 받아 관련 쿼리를 무효화한다).
 */
import { API_BASE_URL } from '@/shared/api/api-client';

export interface RealtimeEvent {
  type: string;
  title?: string;
  description?: string;
  target_role?: string;
  [key: string]: unknown;
}

type Listener = (evt: RealtimeEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 마지막 구독자가 사라져도 바로 끊지 않고 기다리는 시간.
 *
 * 구독자 수는 순간적으로 0이 된다 — 화면을 옮기면 이전 화면이 먼저 해제되고 다음 화면이
 * 구독하며, React StrictMode는 이펙트를 마운트→해제→마운트로 한 번 더 돌린다.
 * 즉시 닫으면 그때마다 연결이 끊겼다 붙어(플래핑) 서버 pubsub도 함께 요동친다.
 * 실측에서 화면 전환 직후 연결이 0으로 떨어진 뒤 복구되지 않는 것을 확인해 유예를 뒀다.
 */
const IDLE_CLOSE_DELAY_MS = 3000;

function open() {
  // 닫기 예약이 걸려 있었다면 취소한다 - 다시 필요해졌다는 뜻이다.
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (source || typeof window === 'undefined') return;
  source = new EventSource(`${API_BASE_URL}/api/v1/notifications/stream`);
  source.onmessage = (e) => {
    let evt: RealtimeEvent;
    try {
      evt = JSON.parse(e.data);
    } catch {
      return;                       // 파싱 실패는 무시 - 연결은 유지한다
    }
    if (!evt || evt.type === 'CONNECTED') return;
    for (const fn of listeners) {
      try { fn(evt); } catch (err) { console.error('[realtime] 구독자 처리 실패', err); }
    }
  };
  source.onerror = () => {
    // 끊기면 EventSource가 알아서 재연결한다. 여기서 close하면 그 재시도가 사라진다.
    console.warn('[realtime] SSE 연결 오류 - 자동 재연결 대기');
  };
}

function closeIfIdle() {
  if (listeners.size > 0 || !source) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  }, IDLE_CLOSE_DELAY_MS);
}

/** 실시간 이벤트를 구독한다. 반환값을 호출하면 해제된다. */
export function subscribeRealtime(fn: Listener): () => void {
  listeners.add(fn);
  open();
  return () => {
    listeners.delete(fn);
    closeIfIdle();
  };
}
