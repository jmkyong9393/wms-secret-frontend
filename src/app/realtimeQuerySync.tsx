'use client';

/**
 * 실시간 이벤트 → 쿼리 무효화.
 *
 * "어떤 이벤트가 어떤 화면 데이터를 낡게 만드는가"는 도메인 지식이므로 app 계층에 둔다
 * (shared는 SSE 연결이라는 도구만 제공한다).
 *
 * [해결하는 문제] 종전에는 화면이 각자 SSE를 구독했다. 그래서 **그 화면을 보고 있을 때만**
 * 갱신됐고, 관리자 화면에서 송장을 발급한 뒤 스캐너로 이동하면 이미 지나간 이벤트라
 * 받을 수 없었다. 게다가 전역 staleTime이 60초라 화면에 다시 들어와도 재조회하지 않아
 * 최대 1분간 묵은 상태가 보였다.
 *
 * 이제는 어느 화면에 있든 이벤트를 받아 관련 캐시를 무효화한다. 화면에 들어가는 순간
 * 최신 데이터가 있거나, 없으면 즉시 다시 가져온다.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeRealtime } from '@/shared/lib/realtimeEvents';

/** 이벤트 타입 → 낡아지는 쿼리 키. 목록에 없는 이벤트는 무효화 없이 지나간다. */
const INVALIDATES: Record<string, string[]> = {
  // 출고: 지시서·송장은 작업자 스캐너와 관리자 관제가 같은 원장을 본다
  PICKING_INSTRUCTION_ISSUED: ['worker-picking-instructions', 'admin-picking-instructions'],
  WAYBILL_ISSUED: ['worker-picking-instructions', 'admin-picking-instructions'],
  OUTBOUND_COMPLETED: ['worker-picking-instructions', 'admin-picking-instructions', 'inventory-items', 'dashboard-kpi'],
  // 입고·검수: 재고와 대시보드 지표가 함께 움직인다
  INSPECTION_DONE: ['inspections', 'inventory-items', 'dashboard-kpi', 'dashboard-charts'],
  HITL_REQUIRED: ['inspections', 'dashboard-kpi'],
  // 발주·이상거래
  RESTOCK_PROPOSED: ['po-proposals'],
  FDS_ALERT: ['fds-console', 'fds-summary'],
};

export function RealtimeQuerySync() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeRealtime((evt) => {
        const keys = INVALIDATES[evt.type];
        if (!keys) return;
        for (const key of keys) {
          // 부분 일치로 무효화한다 - 같은 접두사에 파라미터가 붙은 키까지 함께 걸린다.
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }),
    [queryClient],
  );

  return null;
}
