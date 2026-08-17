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
    // [검증 기간 한시] 전 세션을 녹화한다 — Sentry 가이드 권고. 종전 0(오류 세션만)이라
    // 오류가 없으면 Replay가 하나도 쌓이지 않았다. 리허설 종료 후 0.1로 낮출 것.
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    // Sentry Logs — 오류(Issues)와 별개로 구조화 로그를 Explore > Logs에 적재한다.
    enableLogs: true,
    integrations: [
      // 샘플레이트만으로는 Replay가 동작하지 않는다 — 통합을 등록해야 세션 녹화가 붙는다
      // (실측: 샘플레이트만 있던 동안 Replays 화면이 계속 비어 있었다).
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      // console.warn/error를 로그로 자동 수집한다. log/info까지 열면 무료 플랜
      // 볼륨을 순식간에 소진하므로 경고 이상만 담는다.
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
      // 브라우저 프로파일링. next.config.ts의 Document-Policy: js-profiling 헤더와 짝이다.
      Sentry.browserProfilingIntegration(),
    ],
    // 추적되는 트랜잭션 중 프로파일을 남길 비율. traces에 종속이므로 실효 수집률은
    // tracesSampleRate × profilesSampleRate다.
    profilesSampleRate: 1.0,
    debug: false,
  });
}

// 앱 라우터 페이지 전환 계측에 필요하다.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
