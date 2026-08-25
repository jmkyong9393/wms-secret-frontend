/**
 * 오프라인 검수 큐 동작 검증.
 *
 * 이 큐의 실패는 조용하다 — 큐가 비어 있어도, 재전송이 안 돌아도 화면은 멀쩡하다.
 * 그래서 "적재된다 / 재전송된다 / 중복을 막는다" 세 가지를 테스트로 고정한다.
 * (종전 구현이 한 번도 동작하지 않은 채 방치됐던 이유가 이것이다.)
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineQueue, isNetworkFailure, MAX_ATTEMPTS } from './offlineQueue';

const makeTask = (lpn: string) => ({
  lpn,
  images: [new Blob(['fake-jpeg'], { type: 'image/jpeg' })],
  bookMetadata: { isbn: '9788901234567' },
  workerId: 'WM2608001',
});

describe('OfflineQueue', () => {
  let q: OfflineQueue;

  beforeEach(async () => {
    q = new OfflineQueue();
    for (const t of await q.listPending()) if (t.id !== undefined) await q.remove(t.id);
  });

  it('적재하면 대기 목록과 개수에 잡힌다', async () => {
    await q.enqueue(makeTask('LPN-260825-A001'));
    expect(await q.count()).toBe(1);
    const [task] = await q.listPending();
    expect(task.lpn).toBe('LPN-260825-A001');
    expect(task.attempts).toBe(0);
    expect(task.images).toHaveLength(1);
    // Blob 자체의 보존은 여기서 확인하지 못한다 - fake-indexeddb가 jsdom Blob을
    // 구조화 복제하지 못해 빈 객체로 돌아온다(환경 한계).
    // 실제 브라우저 왕복은 2026-08-25 운영 환경에서 직접 확인했다:
    // Blob 인스턴스·MIME 타입·크기·바이트열이 모두 원본과 일치했다.
  });

  it('오래된 건부터 전송한다', async () => {
    await q.enqueue(makeTask('OLD'));
    await new Promise((r) => setTimeout(r, 5));
    await q.enqueue(makeTask('NEW'));
    const order: string[] = [];
    await q.flush(async (t) => { order.push(t.lpn); });
    expect(order).toEqual(['OLD', 'NEW']);
  });

  it('전송에 성공하면 큐에서 사라진다', async () => {
    await q.enqueue(makeTask('LPN-A'));
    const r = await q.flush(async () => {});
    expect(r.sent).toBe(1);
    expect(await q.count()).toBe(0);
  });

  it('이미 검수된 LPN은 전송하지 않고 버린다 (중복 검수 방지)', async () => {
    await q.enqueue(makeTask('LPN-DONE'));
    const send = vi.fn(async () => {});
    const r = await q.flush(send, async () => true);
    expect(send).not.toHaveBeenCalled();
    expect(r.skipped).toBe(1);
    expect(await q.count()).toBe(0);
  });

  it('LPN 확인이 실패하면 전송을 미룬다 (판단 보류)', async () => {
    await q.enqueue(makeTask('LPN-UNKNOWN'));
    const send = vi.fn(async () => {});
    const r = await q.flush(send, async () => { throw new Error('조회 실패'); });
    expect(send).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
    expect(await q.count()).toBe(1);   // 남아서 다음 기회에 재시도된다
  });

  it('전송이 실패하면 남기고 시도 횟수를 올린다', async () => {
    await q.enqueue(makeTask('LPN-RETRY'));
    const r = await q.flush(async () => { throw new Error('boom'); });
    expect(r.failed).toBe(1);
    const [task] = await q.listPending();
    expect(task.attempts).toBe(1);
    expect(task.lastError).toBe('boom');
  });

  it('반복 실패가 상한에 닿으면 폐기해 큐가 막히지 않게 한다', async () => {
    await q.enqueue(makeTask('LPN-DEAD'));
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await q.flush(async () => { throw new Error('boom'); });
    }
    expect(await q.count()).toBe(0);
  });

  it('오프라인이면 아무것도 보내지 않는다', async () => {
    await q.enqueue(makeTask('LPN-OFF'));
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const send = vi.fn(async () => {});
    const r = await q.flush(send);
    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
    spy.mockRestore();
  });
});

describe('isNetworkFailure', () => {
  it('fetch의 네트워크 실패(TypeError)만 재전송 대상으로 본다', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('서버가 응답한 오류는 재전송하지 않는다 — 이미 처리됐을 수 있다', () => {
    expect(isNetworkFailure(new Error('Evaluation failed (HTTP 500)'))).toBe(false);
  });
});
