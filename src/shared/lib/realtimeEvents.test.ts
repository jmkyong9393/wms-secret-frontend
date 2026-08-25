/**
 * 실시간 구독이 연결을 하나만 유지하는지 검증한다.
 *
 * 이 파일의 핵심 주장은 "화면이 여럿이어도 SSE 연결은 하나"다. 종전에는 화면마다
 * `new EventSource(...)`를 열어 Header와 작업 화면이 연결을 둘 유지했고, 서버는 연결마다
 * Redis pubsub을 하나씩 만들었다. 구조로만 보장하면 다음 사람이 쉽게 되돌리므로 고정한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() { this.closed = true; }
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
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
