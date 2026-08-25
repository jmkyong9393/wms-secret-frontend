'use client';

/**
 * 오프라인으로 보관된 검수 건을 연결 복구 시 자동 재전송한다.
 *
 * 조립을 features에 두는 이유: 큐 자체는 도구라 `shared`에 있지만, "무엇을 어떻게
 * 다시 보낼지"는 입고 도메인의 지식이다. shared가 features를 부르면 FSD 의존 방향이
 * 뒤집힌다(린트가 잡는다).
 *
 * 트리거는 둘이다 — `online` 이벤트와 앱 시작 시 1회. 오프라인 상태로 앱을 껐다 켜면
 * online 이벤트가 오지 않아 큐가 영영 잠들기 때문이다.
 */
import { useEffect, useState } from 'react';
import { OfflineQueue } from '@/shared/api/offlineQueue';
import { submitEvaluation, isLpnAlreadyInspected } from '@/features/inbound/api';

/** 큐 변화 알림 이벤트. 화면에서 대기 건수를 갱신할 때 쓴다. */
export const OFFLINE_QUEUE_CHANGED = 'wms:offline-queue-changed';

export function useOfflineEvaluationSync() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const queue = new OfflineQueue();
    let alive = true;

    const refreshCount = async () => {
      const n = await queue.count();
      if (alive) setPendingCount(n);
    };

    const flush = async () => {
      if ((await queue.count()) === 0) { await refreshCount(); return; }
      const r = await queue.flush(
        (task) =>
          submitEvaluation({
            lpn: task.lpn,
            images: task.images,
            bookMetadata: task.bookMetadata,
            workerId: task.workerId,
          }).then(() => undefined),
        isLpnAlreadyInspected,
      );
      if (r.sent || r.skipped || r.dropped) {
        console.log(
          `[OfflineQueue] 재전송 ${r.sent} / 이미검수 ${r.skipped} / 폐기 ${r.dropped} / 보류 ${r.failed}`,
        );
      }
      await refreshCount();
    };

    const onOnline = () => { void flush(); };
    const onChanged = () => { void refreshCount(); };

    void flush();
    window.addEventListener('online', onOnline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED, onChanged);
    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED, onChanged);
    };
  }, []);

  return { pendingCount };
}
