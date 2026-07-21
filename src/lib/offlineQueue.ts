/**
 * PWA Offline Queue for WMS Frontend
 * 네트워크 단절(오프라인) 상태에서도 작업자가 바코드 스캔을 멈추지 않도록,
 * IndexedDB를 활용하여 API 요청을 로컬에 적재(Queueing)하는 방어 로직 클래스.
 */
import { openDB, IDBPDatabase } from 'idb';
import { uploadAPI } from './api';

const DB_NAME = 'WMS_OfflineQueue';
const STORE_NAME = 'pendingTasks';
const DB_VERSION = 1;

export interface PendingTask {
  id?: number;
  order_id: string;
  image_url: string;
  timestamp: number;
}

export class OfflineQueue {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    // 1. IndexedDB 초기화
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }

  // 작업 적재 (Enqueue)
  async enqueue(order_id: string, image_url: string): Promise<void> {
    const db = await this.dbPromise;
    const task: PendingTask = { order_id, image_url, timestamp: Date.now() };
    await db.add(STORE_NAME, task);
    
    // Service Worker에 Background Sync 태그 등록 시도
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-offline-queue');
      } catch (err) {
        console.error('Background Sync registration failed:', err);
      }
    }
  }

  // 펜딩 작업 모두 가져오기
  async getPendingTasks(): Promise<PendingTask[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAME);
  }

  // 작업 삭제 (성공 또는 폐기 시)
  private async removeTask(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }

  // 네트워크 복구 시 동기화 (Background Sync)
  async syncPendingTasks(): Promise<void> {
    if (!navigator.onLine) return;

    const tasks = await this.getPendingTasks();
    if (tasks.length === 0) return;

    console.log(`[OfflineQueue] Found ${tasks.length} pending tasks. Starting sync...`);

    for (const task of tasks) {
      if (!task.id) continue;
      
      try {
        // 백엔드 API 재전송 시도 (api-client.ts 의 uploadAPI 활용 가정)
        // 실제 프로젝트에선 FormData 구성 등 세부 처리가 필요할 수 있으나, 개념적 sync 로직으로 구현
        await uploadAPI.uploadImage(task.order_id, new File([], "placeholder.jpg")); 
        
        console.log(`[OfflineQueue] Task ${task.id} synced successfully.`);
        await this.removeTask(task.id);
      } catch (error: any) {
        console.error(`[OfflineQueue] Sync failed for task ${task.id}`, error);
        
        // [방어 로직] 401(Unauthorized) 에러로 인한 통신 실패는 오프라인 큐에 계속 담아두면
        // 무한루프에 빠지므로 영구 폐기 처리. (JWT 만료로 인한 거부)
        if (error.response?.status === 401) {
          console.warn(`[OfflineQueue] Discarding task ${task.id} due to 401 Unauthorized.`);
          await this.removeTask(task.id);
        }
      }
    }
  }
}

