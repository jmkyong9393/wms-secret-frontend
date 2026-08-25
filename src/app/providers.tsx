"use client";

/**
 * 전역 프로바이더 조립 + 실시간 이벤트를 쿼리 캐시에 연결하는 자리.
 *
 * "어떤 이벤트가 어떤 화면 데이터를 낡게 만드는가"는 여러 feature에 걸친 지식이라
 * 모든 계층을 볼 수 있는 app 계층이 소유한다 (shared는 SSE 연결이라는 도구만 제공한다).
 *
 * [해결하는 문제] 종전에는 화면이 각자 SSE를 구독했다. 그래서 **그 화면을 보고 있을 때만**
 * 갱신됐고, 관리자 화면에서 송장을 발급한 뒤 스캐너로 이동하면 이미 지나간 이벤트라
 * 받을 수 없었다. 게다가 전역 staleTime이 60초라 화면에 다시 들어와도 재조회하지 않아
 * 최대 1분간 묵은 상태가 보였다.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Provider as JotaiProvider } from "jotai";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { isAuthenticatedAtom } from "@/entities/user/model/authAtoms";
import { subscribeRealtime, checkRealtimeConnection, RECONNECTED_EVENT } from "@/shared/lib/realtimeEvents";

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

function RealtimeQuerySync() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  // 스트림은 인증을 요구한다. 로그인 전에 구독하면 401만 받고 재연결을 반복하게 된다
  // (로그인 화면에 머무는 동안 요청이 7건 나간 것을 운영에서 확인, 2026-08-26).
  // 세션이 만료돼 401이 나면 api-client가 이 값을 비우므로 구독도 함께 끊긴다.
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  // 화면을 옮길 때마다 연결을 점검한다. 탭을 계속 보고 있으면
  // visibilitychange가 발화하지 않아, 감시 시계가 돌 때까지 기다려야 한다.
  useEffect(() => {
    if (isAuthenticated) checkRealtimeConnection();
  }, [pathname, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeRealtime((evt) => {
      // 재연결은 "끊긴 동안 뭐가 바뀌었는지 모른다"는 신호다. 전부 다시 가져온다.
      if (evt.type === RECONNECTED_EVENT) {
        queryClient.invalidateQueries();
        return;
      }
      const keys = INVALIDATES[evt.type];
      if (!keys) return;
      for (const key of keys) {
        // 부분 일치로 무효화한다 - 같은 접두사에 파라미터가 붙은 키까지 함께 걸린다.
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
  }, [queryClient, isAuthenticated]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient는 각 세션마다 독립적으로 인스턴스를 유지해야 하므로 useState 안에 선언
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분간 캐시 유지
            retry: 1, // 실패 시 1회 재시도
            refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 방지
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        {/* 실시간 이벤트를 받아 관련 캐시를 무효화한다 (화면 이동과 무관하게 동작) */}
        <RealtimeQuerySync />
        {children}
      </JotaiProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
