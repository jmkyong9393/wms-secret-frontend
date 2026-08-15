import * as Sentry from "@sentry/nextjs";

// 브라우저 런타임 Sentry 초기화. Next 16은 빌드에 Turbopack을 쓰므로 webpack 전용
// 주입 경로였던 sentry.client.config.ts는 로드되지 않는다 - 이 파일이 대체한다.
// DSN이 없으면 초기화하지 않는다 (존재하지 않는 엔드포인트로 전송 시도 방지).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // 운영은 10%만 추적한다. 무료 플랜 트랜잭션 한도를 지키기 위한 값이다.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // 오류가 난 세션만 재생을 남긴다.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    debug: false,
  });
}

// 앱 라우터 페이지 전환 계측에 필요하다.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
