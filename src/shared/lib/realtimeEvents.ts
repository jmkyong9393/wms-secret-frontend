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
 * [끊긴 연결을 되살린다] 브라우저의 자동 재연결에 기대지 않고 오류가 나면 항상 우리가
 * 백오프로 다시 연다. 백엔드를 재시작한 뒤 연결이 되살아나지 않는 것을 실측으로 확인했고
 * (2026-08-26), 그대로 두면 **배포할 때마다 접속 중인 모든 화면의 실시간이** 새로고침
 * 전까지 죽는다.
 *
 * [오류조차 오지 않는 죽음] 중간 프록시가 백엔드 쪽 연결만 끊으면 브라우저 소켓은 열린
 * 채 남아 `onerror`가 영영 오지 않는다. 그래서 서버가 25초마다 보내는 신호가 끊기는지
 * 감시해(`SILENCE_TIMEOUT_MS`) 조용한 죽음을 판별한다.
 *
 * [끊긴 동안의 이벤트는 포기한다] 재연결 시점에 `REALTIME_RECONNECTED`를 발행해
 * 구독자가 **전체 재조회**로 정합성을 되찾게 한다. 놓친 이벤트를 되감지 않는다.
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

/**
 * 연결이 끊겼다 붙었음을 알리는 **내부** 이벤트. 서버가 보내는 값이 아니다.
 * 구독자는 이걸 받으면 "그동안 놓친 변경이 있다"고 보고 데이터를 다시 가져와야 한다.
 */
export const RECONNECTED_EVENT = 'REALTIME_RECONNECTED';

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** 연결이 한 번이라도 끊겼는지. 첫 연결에서 재연결 이벤트를 내보내지 않기 위해 쓴다. */
let disconnected = false;

/**
 * 마지막 구독자가 사라져도 바로 끊지 않고 기다리는 시간.
 *
 * 구독자 수는 순간적으로 0이 된다 — 화면을 옮기면 이전 화면이 먼저 해제되고 다음 화면이
 * 구독하며, React StrictMode는 이펙트를 마운트→해제→마운트로 한 번 더 돌린다.
 * 즉시 닫으면 그때마다 연결이 끊겼다 붙어(플래핑) 서버 pubsub도 함께 요동친다.
 * 실측에서 화면 전환 직후 연결이 0으로 떨어진 뒤 복구되지 않는 것을 확인해 유예를 뒀다.
 */
const IDLE_CLOSE_DELAY_MS = 3000;

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
let retryDelay = INITIAL_RETRY_DELAY_MS;

/**
 * 이 시간 동안 서버가 아무 말도 없으면 연결이 죽은 것으로 본다.
 *
 * 서버는 25초마다 HEARTBEAT를 보낸다. 두 번 연속 놓칠 때까지 기다린다.
 * onerror만으로는 부족하다 - 중간 프록시가 백엔드 쪽 연결만 끊으면 브라우저 소켓은
 * 열린 채 남아 오류가 오지 않는다(백엔드 재시작 후 70초 무응답을 실측, 2026-08-26).
 */
const SILENCE_TIMEOUT_MS = 60000;
let watchdog: ReturnType<typeof setTimeout> | null = null;

/**
 * 사용자가 화면으로 돌아왔을 때는 침묵을 더 짧게 본다.
 *
 * 감시 시계만 쓰면 최악 50초를 기다리지만, 사람이 화면을 보고 있을 때는
 * 그 공백이 그대로 체감된다. 하트비트 주기(25초)를 한 번 넘기면 의심한다.
 */
const ACTIVE_SILENCE_TOLERANCE_MS = 30000;

/** 마지막으로 서버 소식을 들은 시각. */
let lastSeenAt = 0;

/** 살아있음을 확인할 때마다 감시 시계를 되감는다. */
function armWatchdog() {
  lastSeenAt = Date.now();
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    watchdog = null;
    if (!source) return;
    dropAndReconnect();
  }, SILENCE_TIMEOUT_MS);
}

function disarmWatchdog() {
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
}

/** 지금 연결을 죽은 것으로 보고 정리한 뒤 백오프로 다시 연다. */
function dropAndReconnect() {
  if (!source) return;
  disconnected = true;
  disarmWatchdog();
  source.close();
  source = null;
  scheduleReconnect();
}

function dispatch(evt: RealtimeEvent) {
  for (const fn of listeners) {
    try { fn(evt); } catch (err) { console.error('[realtime] 구독자 처리 실패', err); }
  }
}

function open() {
  // 닫기·재연결 예약이 걸려 있었다면 취소한다 - 지금 바로 연결하기 때문이다.
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (source || typeof window === 'undefined') return;

  source = new EventSource(`${API_BASE_URL}/api/v1/notifications/stream`);

  armWatchdog();          // 연결이 성립하지 않는 경우까지 함께 감시한다

  source.onopen = () => {
    retryDelay = INITIAL_RETRY_DELAY_MS;
    armWatchdog();
    if (disconnected) {
      disconnected = false;
      dispatch({ type: RECONNECTED_EVENT });
    }
  };

  source.onmessage = (e) => {
    armWatchdog();                  // 무슨 메시지든 서버가 살아있다는 증거다
    let evt: RealtimeEvent;
    try {
      evt = JSON.parse(e.data);
    } catch {
      return;                       // 파싱 실패는 무시 - 연결은 유지한다
    }
    // 핸드쉐이크와 하트비트는 연결 유지용이다. 화면에 전달하지 않는다.
    if (!evt || evt.type === 'CONNECTED' || evt.type === 'HEARTBEAT') return;
    dispatch(evt);
  };

  source.onerror = () => {
    if (!source) return;
    // 브라우저의 자동 재연결에 기대지 않고 **항상** 우리가 다시 연다.
    // readyState가 CONNECTING이면 브라우저가 재시도 중이라고 보고 개입하지 않았는데,
    // 실측에서 그 상태로 남은 채 영영 붙지 않았다(백엔드 재시작 후 45초 관찰, 2026-08-26).
    // close()는 브라우저가 예약한 재시도도 함께 취소하므로 연결이 둘로 늘지 않는다.
    dropAndReconnect();
  };
}

function scheduleReconnect() {
  if (listeners.size === 0 || reconnectTimer) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    open();
  }, delay);
}

function closeIfIdle() {
  if (listeners.size > 0 || !source) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (listeners.size === 0 && source) {
      disarmWatchdog();
      source.close();
      source = null;
    }
  }, IDLE_CLOSE_DELAY_MS);
}

/**
 * 구독자가 있는데 연결이 없으면 즉시 다시 연다.
 *
 * 백오프 대기 중이거나 절전 상태에서 깨어난 탭은 연결이 끊긴 채로 남아 있다.
 * 사용자가 화면을 다시 볼 때는 기다리지 않고 바로 붙는 편이 낫다.
 */
function ensureConnected() {
  if (listeners.size === 0) return;
  if (!source) {
    retryDelay = INITIAL_RETRY_DELAY_MS;
    open();
    return;
  }
  // 연결은 있는데 서버가 오래 조용했다면 이미 죽은 연결을 뵐고 있는 것이다.
  if (Date.now() - lastSeenAt > ACTIVE_SILENCE_TOLERANCE_MS) dropAndReconnect();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', ensureConnected);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ensureConnected();
  });
}

/**
 * 화면이 데이터를 다시 읽는 시점에 연결도 같이 점검한다.
 *
 * 탭을 계속 보고 있으면 visibilitychange가 끝내 발화하지 않는다.
 * 사용자가 화면을 옴기는 순간을 점검 계기로 쓴다.
 */
export function checkRealtimeConnection(): void {
  ensureConnected();
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
