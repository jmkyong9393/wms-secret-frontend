"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Provider as JotaiProvider } from "jotai";
import { useState } from "react";

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
        {children}
      </JotaiProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
