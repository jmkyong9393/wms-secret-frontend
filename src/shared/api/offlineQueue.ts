/**
 * 오프라인 검수 제출 큐.
 *
 * 창고 랙 사이는 통신이 자주 끊긴다. 그때 촬영한 검수 건이 사라지지 않도록
 * **실패한 검수 요청을 그대로 보관했다가 연결이 돌아오면 재전송**한다.
 *
 * [설계] 별도 업로드 경로를 만들지 않는다. 온라인에서 쓰는 요청
 * (`POST /api/v1/inbound/evaluate`, base64 이미지 동봉)을 그대로 저장했다가 재생한다.
 * 종전 구현은 CloudFront에 PUT하는 별도 경로를 뒀는데, 그 경로는 도메인이 주입되지
 * 않았고 CDN이 PUT을 거부해 한 번도 동작한 적이 없다(2026-08-25 실측).
 *
 * [중복 방지 — 가장 중요] **네트워크 오류로 서버에 닿지도 못한 요청만** 큐에 넣는다.
 * HTTP 응답을 받았다면 서버는 이미 그 요청을 처리했을 수 있고, 그때 재전송하면
 * 같은 책이 두 번 검수되어 ReturnJob이 중복 생성된다(evaluate는 매번 새 job을 만든다).
 * 재전송 직전에도 LPN 상태를 한 번 더 조회해 이미 검수된 건은 조용히 버린다.
 *
 * [저장소] 촬영분이 Blob이라 localStorage(문자열·약 5MB)로는 담을 수 없다.
 * IndexedDB는 Blob을 그대로 담고 용량도 넉넉하다.
 */
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'WMS_OfflineQueue';
const STORE_NAME = 'pendingTasks';
/** v1은 필드 구성이 달랐고 실제로 채워진 적이 없다. 올리면서 비운다. */
const DB_VERSION = 2;

/** 재전송을 포기하는 시도 횟수. 넘으면 사람이 개입해야 하는 상태로 본다. */
export const MAX_ATTEMPTS = 5;

export interface PendingEvaluation {
  id?: number;
  lpn: string;
  images: Blob[];
  bookMetadata?: unknown;
  workerId?: string | null;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export class OfflineQueue {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v1 스토어는 스키마가 다르므로 버리고 새로 만든다 (적재된 적 없는 구조다).
        if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      },
    });
  }

  /** 전송 실패한 검수 건을 보관한다. 호출 전에 "네트워크 오류인지" 판별할 것. */
  async enqueue(item: Omit<PendingEvaluation, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
    const db = await this.dbPromise;
    await db.add(STORE_NAME, { ...item, createdAt: Date.now(), attempts: 0 });
  }

  async listPending(): Promise<PendingEvaluation[]> {
    const db = await this.dbPromise;
    const all: PendingEvaluation[] = await db.getAll(STORE_NAME);
    return all.sort((a, b) => a.createdAt - b.createdAt);   // 오래된 것부터
  }

  async count(): Promise<number> {
    const db = await this.dbPromise;
    return db.count(STORE_NAME);
  }

  async remove(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }

  private async bumpAttempt(task: PendingEvaluation, error: string): Promise<void> {
    if (task.id === undefined) return;
    const db = await this.dbPromise;
    await db.put(STORE_NAME, { ...task, attempts: task.attempts + 1, lastError: error });
  }

  /**
   * 대기 건을 순서대로 재전송한다.
   *
   * @param send      실제 전송 함수. 성공하면 resolve, 실패하면 throw.
   * @param isAlreadyInspected LPN이 이미 검수됐는지 확인 (중복 방지). 판단 불가면 false.
   * @returns 처리 결과 요약
   */
  async flush(
    send: (task: PendingEvaluation) => Promise<void>,
    isAlreadyInspected?: (lpn: string) => Promise<boolean>,
  ): Promise<{ sent: number; skipped: number; failed: number; dropped: number }> {
    const result = { sent: 0, skipped: 0, failed: 0, dropped: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) return result;

    for (const task of await this.listPending()) {
      if (task.id === undefined) continue;

      // 이미 검수된 LPN이면 재전송이 곧 중복 생성이다. 조용히 버린다.
      if (isAlreadyInspected) {
        try {
          if (await isAlreadyInspected(task.lpn)) {
            await this.remove(task.id);
            result.skipped += 1;
            continue;
          }
        } catch {
          // 확인 실패는 판단 보류 - 아래 전송으로 넘어가지 않고 다음 기회로 미룬다.
          result.failed += 1;
          continue;
        }
      }

      try {
        await send(task);
        await this.remove(task.id);
        result.sent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (task.attempts + 1 >= MAX_ATTEMPTS) {
          // 계속 실패하는 건을 무한히 들고 있으면 큐가 막힌다. 버리되 흔적을 남긴다.
          console.error(`[OfflineQueue] LPN ${task.lpn} 재전송 ${MAX_ATTEMPTS}회 실패 - 폐기`, msg);
          await this.remove(task.id);
          result.dropped += 1;
        } else {
          await this.bumpAttempt(task, msg);
          result.failed += 1;
        }
      }
    }
    return result;
  }
}

/**
 * 이 오류가 "요청이 서버에 닿지 못한 것"인지 판별한다.
 *
 * fetch는 네트워크 단계에서 실패할 때만 reject하고, 서버가 4xx·5xx를 응답하면
 * resolve한다. 따라서 **reject된 경우에만** 재전송이 안전하다.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return error instanceof TypeError;   // fetch의 네트워크 실패는 TypeError로 온다
}

/** 오프라인이라 큐에 보관했음을 호출부에 알리는 신호. 실패가 아니라 '보류'다. */
export class OfflineQueuedError extends Error {
  constructor(public readonly lpn: string) {
    super('오프라인 상태라 검수 요청을 보관했습니다. 연결되면 자동으로 전송됩니다.');
    this.name = 'OfflineQueuedError';
  }
}
