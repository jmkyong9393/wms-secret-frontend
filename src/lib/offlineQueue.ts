/**
 * PWA Offline Queue for WMS Frontend
 * 네트워크 단절(오프라인) 상태에서도 작업자가 바코드 스캔을 멈추지 않도록,
 * IndexedDB를 활용하여 API 요청을 로컬에 적재(Queueing)하는 방어 로직 클래스.
 */
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'WMS_OfflineQueue';
const STORE_NAME = 'pendingTasks';
const DB_VERSION = 1;

export interface PendingTask {
  id?: number;
  taskId: string;
  blob: Blob;
  isbn: string;
  lpn: string;
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
  async enqueue(taskInfo: Omit<PendingTask, 'timestamp' | 'id'>): Promise<void> {
    const db = await this.dbPromise;
    const task: PendingTask = { ...taskInfo, timestamp: Date.now() };
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

  // 네트워크 복구 시 동기화 (Background Sync) - 호출부에서 구현하도록 콜백 주입
  async syncPendingTasks(
    uploadFn: (blob: Blob, filename: string) => Promise<string>,
    evaluateFn: (isbn: string, lpn: string, url: string) => Promise<any>
  ): Promise<void> {
    if (!navigator.onLine) return;

    const tasks = await this.getPendingTasks();
    if (tasks.length === 0) return;

    console.log(`[OfflineQueue] Found ${tasks.length} pending tasks. Starting sync...`);

    for (const task of tasks) {
      if (!task.id) continue;
      
      try {
        const filename = `condition_${task.lpn}_${task.taskId}.jpg`;
        const uploadedUrl = await uploadFn(task.blob, filename);
        await evaluateFn(task.isbn, task.lpn, uploadedUrl);
        
        console.log(`[OfflineQueue] Task ${task.id} synced successfully.`);
        await this.removeTask(task.id);
      } catch (error: any) {
        console.error(`[OfflineQueue] Sync failed for task ${task.id}`, error);
        
        if (error.response?.status === 401 || error.response?.status === 400) {
          console.warn(`[OfflineQueue] Discarding task ${task.id} due to non-retriable error.`);
          await this.removeTask(task.id);
        }
      }
    }
  }
}

