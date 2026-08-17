import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// DSN이 없으면 초기화하지 않는다 (sentry.client.config.ts와 동일 정책).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Sentry Logs — 클라이언트(instrumentation-client.ts)와 동일 정책.
    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
      // Node 서버 프로파일링 (@sentry/profiling-node — 네이티브 애드온).
      nodeProfilingIntegration(),
    ],
    // 실효 수집률 = tracesSampleRate × profilesSampleRate.
    profilesSampleRate: 1.0,
    debug: false,
  });
}
