/**
 * PWA Offline Queue for WMS Frontend
 */
export class OfflineQueue {
  // TODO: [팀원 구현 영역] idb 패키지 dbPromise 초기화

  async enqueue(_order_id: string, _image_url: string): Promise<void> {
    // TODO: IndexedDB에 오프라인 검수 요청 저장 로직
    // [방어 로직] 401(Unauthorized) 에러로 인한 통신 실패는 오프라인 큐에 담지 않고 폐기해야 함.
  }

  async getPendingTasks(): Promise<unknown[]> {
    // TODO: 펜딩된 모든 작업 조회 로직
    return [];
  }

  async syncPendingTasks(): Promise<void> {
    // TODO: 네트워크 복구 시 펜딩 작업을 FastAPI 서버로 Background Sync 하는 로직
  }
}
