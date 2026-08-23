"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // useState로 감싸서 여러 번 렌더링되더라도 QueryClient 인스턴스가 하나만 유지되도록 합니다.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분간 캐시 유지
            retry: 1, // 실패 시 1회 재시도
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
