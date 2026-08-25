/**
 * 실시간 구독이 연결을 하나만 유지하고, 끊기면 되살아나는지 검증한다.
 *
 * 이 파일의 핵심 주장은 둘이다.
 * ① "화면이 여럿이어도 SSE 연결은 하나" — 종전에는 화면마다 `new EventSource(...)`를 열어
 *    Header와 작업 화면이 연결을 둘 유지했고, 서버는 연결마다 Redis pubsub을 만들었다.
 * ② "서버가 끊어도 다시 붙는다" — 브라우저의 자동 재연결에 맡겨 뒀더니 백엔드를 재시작한
 *    뒤 45초를 관찰해도 되살아나지 않았다(2026-08-26 실측). 그대로 두면 배포할 때마다
 *    접속 중인 모든 화면의 실시간이 새로고침 전까지 죽는다. 이제는 오류가 나면 상태와
 *    무관하게 우리가 백오프로 다시 연다.
 *
 * 구조로만 보장하면 다음 사람이 쉽게 되돌리므로 고정한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 0;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  named: Record<string, Array<() => void>> = {};
  close() { this.closed = true; this.readyState = 2; }
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
  addEventListener(type: string, fn: () => void) { (this.named[type] ||= []).push(fn); }
  /** 이름 붙은 heartbeat 이벤트. onmessage는 발화하지 않는다. */
  heartbeat() { (this.named['heartbeat'] ?? []).forEach((f) => f()); }

  /** 서버가 연결을 받아들였다. */
  accept() { this.readyState = 1; this.onopen?.(); }
  /** 서버가 연결을 종료해 브라우저가 재연결을 포기했다(CLOSED). */
  die() { this.readyState = 2; this.onerror?.(); }
  /** 일시적 끊김 — 브라우저가 스스로 재시도 중이다(CONNECTING). */
  blip() { this.readyState = 0; this.onerror?.(); }
}

vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);

// 모듈 상태(연결·구독자)가 테스트 간에 새로 시작되도록 매번 다시 import 한다.
async function freshModule() {
  vi.resetModules();
  FakeEventSource.instances = [];
  return import('./realtimeEvents');
}

describe('subscribeRealtime', () => {
  beforeEach(() => { FakeEventSource.instances = []; });

  it('구독자가 여럿이어도 연결은 하나만 만든다', async () => {
    const { subscribeRealtime } = await freshModule();
    const un1 = subscribeRealtime(() => {});
    const un2 = subscribeRealtime(() => {});
    const un3 = subscribeRealtime(() => {});
    expect(FakeEventSource.instances).toHaveLength(1);
    un1(); un2(); un3();
  });

  it('모든 구독자에게 같은 이벤트를 전달한다', async () => {
    const { subscribeRealtime } = await freshModule();
    const a: string[] = []; const b: string[] = [];
    const un1 = subscribeRealtime((e) => a.push(e.type));
    const un2 = subscribeRealtime((e) => b.push(e.type));
    FakeEventSource.instances[0].emit({ type: 'WAYBILL_ISSUED' });
    expect(a).toEqual(['WAYBILL_ISSUED']);
    expect(b).toEqual(['WAYBILL_ISSUED']);
    un1(); un2();
  });

  it('CONNECTED 핸드셰이크는 이벤트로 전달하지 않는다', async () => {
    const { subscribeRealtime } = await freshModule();
    const got: string[] = [];
    const un = subscribeRealtime((e) => got.push(e.type));
    FakeEventSource.instances[0].emit({ type: 'CONNECTED', message: 'hi' });
    expect(got).toEqual([]);
    un();
  });

  it('구독자가 모두 해제되면 유예 뒤에 연결을 닫는다', async () => {
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un1 = subscribeRealtime(() => {});
    const un2 = subscribeRealtime(() => {});
    un1();
    expect(FakeEventSource.instances[0].closed).toBe(false);   // 아직 한 명 남았다
    un2();
    expect(FakeEventSource.instances[0].closed).toBe(false);   // 즉시 닫지 않는다
    vi.advanceTimersByTime(3100);
    expect(FakeEventSource.instances[0].closed).toBe(true);
    vi.useRealTimers();
  });

  it('유예 중에 다시 구독하면 연결을 끊지 않고 그대로 쓴다', async () => {
    // 화면 전환은 "이전 화면 해제 → 다음 화면 구독" 순서라 구독자가 잠깐 0이 된다.
    // 여기서 끊으면 전환할 때마다 연결이 요동친다(실측으로 확인한 결함).
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un1 = subscribeRealtime(() => {});
    un1();                                   // 구독자 0
    vi.advanceTimersByTime(500);             // 유예 중
    const un2 = subscribeRealtime(() => {}); // 다음 화면이 구독
    vi.advanceTimersByTime(5000);            // 유예 시간을 넘겨도
    expect(FakeEventSource.instances).toHaveLength(1);        // 새 연결을 만들지 않았고
    expect(FakeEventSource.instances[0].closed).toBe(false);  // 기존 연결이 살아 있다
    un2();
    vi.useRealTimers();
  });

  it('한 구독자가 예외를 던져도 다른 구독자는 계속 받는다', async () => {
    const { subscribeRealtime } = await freshModule();
    const ok: string[] = [];
    const un1 = subscribeRealtime(() => { throw new Error('boom'); });
    const un2 = subscribeRealtime((e) => ok.push(e.type));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    FakeEventSource.instances[0].emit({ type: 'PICKING_INSTRUCTION_ISSUED' });
    expect(ok).toEqual(['PICKING_INSTRUCTION_ISSUED']);
    un1(); un2();
  });

  it('깨진 JSON은 무시하고 연결을 유지한다', async () => {
    const { subscribeRealtime } = await freshModule();
    const got: string[] = [];
    const un = subscribeRealtime((e) => got.push(e.type));
    FakeEventSource.instances[0].onmessage?.({ data: '{not json' });
    expect(got).toEqual([]);
    expect(FakeEventSource.instances[0].closed).toBe(false);
    un();
  });
});

describe('연결 복구', () => {
  beforeEach(() => { FakeEventSource.instances = []; });

  it('서버가 연결을 끊으면(CLOSED) 백오프 뒤에 다시 연결한다', async () => {
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    const first = FakeEventSource.instances[0];
    first.accept();
    first.die();
    expect(FakeEventSource.instances).toHaveLength(1);   // 즉시 다시 열지는 않는다
    vi.advanceTimersByTime(1100);
    expect(FakeEventSource.instances).toHaveLength(2);   // 백오프 뒤 새 연결
    un();
    vi.useRealTimers();
  });

  it('일시적 끊김(CONNECTING)에서도 우리가 다시 연다', async () => {
    // 브라우저 재시도에 맡겼더니 그 상태로 남은 채 영영 붙지 않았다(실측).
    // 우리가 close()하면 브라우저의 예약된 재시도도 취소되므로 연결이 둘로 늘지 않는다.
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    FakeEventSource.instances[0].blip();
    expect(FakeEventSource.instances[0].closed).toBe(true);   // 낡은 연결을 정리하고
    vi.advanceTimersByTime(1100);
    expect(FakeEventSource.instances).toHaveLength(2);        // 새로 연다
    un();
    vi.useRealTimers();
  });

  it('재연결이 실패하면 대기 시간을 늘려간다', async () => {
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    FakeEventSource.instances[0].die();
    vi.advanceTimersByTime(1100);
    expect(FakeEventSource.instances).toHaveLength(2);

    FakeEventSource.instances[1].die();
    vi.advanceTimersByTime(1100);                        // 1초로는 아직 부족하다
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);                        // 2초를 넘기면 재시도
    expect(FakeEventSource.instances).toHaveLength(3);
    un();
    vi.useRealTimers();
  });

  it('재연결에 성공하면 구독자에게 재조회 신호를 보낸다', async () => {
    // 끊긴 동안의 이벤트는 되감을 수 없으므로, 구독자가 전부 다시 가져와야 한다.
    vi.useFakeTimers();
    const { subscribeRealtime, RECONNECTED_EVENT } = await freshModule();
    const got: string[] = [];
    const un = subscribeRealtime((e) => got.push(e.type));
    const first = FakeEventSource.instances[0];
    first.accept();
    expect(got).toEqual([]);                  // 첫 연결은 재연결이 아니다
    first.die();
    vi.advanceTimersByTime(1100);
    FakeEventSource.instances[1].accept();
    expect(got).toEqual([RECONNECTED_EVENT]);
    un();
    vi.useRealTimers();
  });

  it('하트비트는 화면에 전달하지 않는다', async () => {
    // 연결 유지용 신호를 구독자에게 넘기면 토스트가 25초마다 뜨거나
    // 쓸데없는 재조회가 돌게 된다.
    const { subscribeRealtime } = await freshModule();
    const got: string[] = [];
    const un = subscribeRealtime((e) => got.push(e.type));
    FakeEventSource.instances[0].emit({ type: 'HEARTBEAT' });
    expect(got).toEqual([]);
    un();
  });

  it('서버가 오래 조용하면 오류가 없어도 연결을 버리고 다시 연다', async () => {
    // 중간 프록시가 백엔드 쪽만 끊으면 브라우저 소켓은 열린 채 남아
    // onerror가 오지 않는다(실측). 침묵만이 유일한 단서다.
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    FakeEventSource.instances[0].accept();
    vi.advanceTimersByTime(61000);                       // 생존 신호가 끊긴 채 60초
    expect(FakeEventSource.instances[0].closed).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(FakeEventSource.instances).toHaveLength(2);   // 새로 연결했다
    un();
    vi.useRealTimers();
  });

  it('하트비트를 받으면 감시 시계가 되감긴다', async () => {
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    FakeEventSource.instances[0].accept();
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(25000);                     // 주기마다 생존 신호가 온다
      FakeEventSource.instances[0].emit({ type: 'HEARTBEAT' });
    }
    expect(FakeEventSource.instances[0].closed).toBe(false);   // 100초가 지나도 살아 있다
    expect(FakeEventSource.instances).toHaveLength(1);
    un();
    vi.useRealTimers();
  });

  it('이름 붙은 heartbeat 이벤트로 감시 시계가 되감긴다', async () => {
    // 서버는 `event: heartbeat`로 보낸다. 기본 message로 보내면 이 파일을 모르는
    // 클라이언트가 하트비트를 일반 알림으로 표시한다(운영에서 실제로 발생).
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    const es = FakeEventSource.instances[0];
    es.accept();
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(25000);
      es.heartbeat();
    }
    expect(es.closed).toBe(false);                       // 100초가 지나도 살아 있다
    expect(FakeEventSource.instances).toHaveLength(1);
    un();
    vi.useRealTimers();
  });

  it('이름 붙은 하트비트는 화면에 전달되지 않는다', async () => {
    const { subscribeRealtime } = await freshModule();
    const got: string[] = [];
    const un = subscribeRealtime((e) => got.push(e.type));
    FakeEventSource.instances[0].heartbeat();
    expect(got).toEqual([]);
    un();
  });

  it('구독자가 없으면 재연결하지 않는다', async () => {
    vi.useFakeTimers();
    const { subscribeRealtime } = await freshModule();
    const un = subscribeRealtime(() => {});
    un();                                     // 구독자 0
    vi.advanceTimersByTime(3100);             // 유예가 지나 연결이 닫힌다
    expect(FakeEventSource.instances[0].closed).toBe(true);
    vi.advanceTimersByTime(60000);
    expect(FakeEventSource.instances).toHaveLength(1);   // 아무도 안 보는데 되살리지 않는다
    vi.useRealTimers();
  });
});
