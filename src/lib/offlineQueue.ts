/**
 * PWA Offline Queue for WMS Frontend
 * 
 * 와이파이가 불안정한 물류센터 환경에서 네트워크 단절 시,
 * 검수 데이터 전송 요청을 브라우저의 IndexedDB에 임시로 쌓아두는 큐입니다.
 * 
 * 참고: 이 모듈은 idb 패키지 (https://www.npmjs.com/package/idb)를 사용한다고 가정합니다.
 * 실제 프로젝트 셋업 시 `npm install idb`가 필요합니다.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface WmsQueueDB extends DBSchema {
  'inspection-queue': {
    key: number;
    value: {
      id?: number;
      order_id: string;
      image_url: string;
      timestamp: number;
      status: 'pending' | 'syncing' | 'failed';
    };
    indexes: { 'by-status': string };
  };
}

export class OfflineQueue {
  private dbName = 'wms-offline-db';
  private dbPromise: Promise<IDBPDatabase<WmsQueueDB>>;

  constructor() {
    this.dbPromise = openDB<WmsQueueDB>(this.dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore('inspection-queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-status', 'status');
      },
    });
  }

  /**
   * 큐에 새 작업을 추가합니다. (네트워크 오프라인일 때 호출)
   */
  async enqueue(order_id: string, image_url: string): Promise<void> {
    const db = await this.dbPromise;
    await db.add('inspection-queue', {
      order_id,
      image_url,
      timestamp: Date.now(),
      status: 'pending'
    });
    console.log(`[OfflineQueue] Enqueued task for order: ${order_id}`);
  }

  /**
   * 대기 중인 모든 작업을 가져옵니다.
   */
  async getPendingTasks() {
    const db = await this.dbPromise;
    return await db.getAllFromIndex('inspection-queue', 'by-status', 'pending');
  }

  /**
   * 특정 작업을 삭제합니다. (서버 동기화 성공 시 호출)
   */
  async removeTask(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('inspection-queue', id);
  }

  /**
   * Background Sync API를 활용하여 펜딩된 작업을 서버로 재전송하는 로직 (스켈레톤)
   */
  async syncPendingTasks(): Promise<void> {
    const tasks = await this.getPendingTasks();
    if (tasks.length === 0) return;

    console.log(`[OfflineQueue] Found ${tasks.length} pending tasks to sync.`);
    
    for (const task of tasks) {
      if (!task.id) continue;
      try {
        // TODO: 실제 백엔드(FastAPI) POST API 연동
        // const res = await fetch('/api/v1/inspections', { ... })
        console.log(`[OfflineQueue] Successfully synced task for order: ${task.order_id}`);
        
        // 동기화 성공 시 큐에서 제거
        await this.removeTask(task.id);
      } catch (error) {
        console.error(`[OfflineQueue] Failed to sync task ${task.id}`, error);
        // 실패 시 다음 sync 주기에 재시도
      }
    }
  }
}
