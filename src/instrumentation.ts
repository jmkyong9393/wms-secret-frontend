import * as Sentry from "@sentry/nextjs";

// Next.js 계측 훅. @sentry/nextjs v9부터 서버·엣지 런타임의 Sentry 초기화는 이 훅이
// 직접 import 해야 실행된다 - 파일만 두면 로드되지 않는다.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// 서버 컴포넌트·라우트 핸들러에서 터진 예외를 Sentry로 넘긴다.
export const onRequestError = Sentry.captureRequestError;
