import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",

  // Next.js는 기본적으로 끝 슬래시가 붙은 경로를 308로 리다이렉트한다. 그런데 백엔드에는
  // `/api/v1/inventory/` 처럼 끝 슬래시가 유효한 엔드포인트가 있어, 프록시 경로에서
  // 리다이렉트가 걸리면 200이 나와야 할 요청이 308로 깨진다(실측 확인).
  // API는 프론트 라우팅 규칙의 대상이 아니므로 리다이렉트를 끈다.
  skipTrailingSlashRedirect: true,

  // [2026-08-06] 개발 서버에 localhost가 아닌 오리진으로 접속하는 것을 허용한다.
  //
  // Next 15.2부터 dev 서버는 요청 Host가 localhost가 아니면 크로스 오리진으로 간주하고,
  // 16에서는 이것이 경고가 아니라 **차단**이다. 차단되면 정적 청크(/_next/static/*)는 200으로
  // 내려오는데 클라이언트 부트스트랩이 중단되어 **하이드레이션만 조용히 실패**한다.
  // 화면은 SSR HTML 그대로 멀쩡히 보이지만 onSubmit/onClick이 하나도 붙지 않아, 로그인
  // 버튼을 눌러도 폼이 네이티브 GET으로 제출되며 "페이지가 새로고침되는" 증상이 된다
  // (cloudflared 터널 실측: localhost는 하이드레이션 성공, 터널은 실패).
  //
  // trycloudflare 퀵 터널은 실행할 때마다 서브도메인이 바뀌므로 와일드카드로 잡는다.
  // dev 전용 설정이라 production 빌드/배포에는 영향이 없다.
  // 같은 공유기 LAN에서 스마트폰으로 접속해 테스트할 때도 위와 동일한 이유로 필요하다.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.0.5"],

  // [2026-08-06] API를 프론트와 같은 오리진으로 프록시한다.
  //
  // 배경: 인증이 HttpOnly 쿠키 기반(api-client.ts의 withCredentials)이라, 프론트와 API가
  // 서로 다른 도메인이면 크로스사이트 쿠키가 되어 SameSite=None; Secure 설정과 백엔드
  // CORS allow_origins 확장이 동시에 필요해진다. 실제로 cloudflared 터널로 3000번만
  // 열었을 때 로그인이 실패했는데, 브라우저가 NEXT_PUBLIC_API_URL의 localhost:8000을
  // **접속자 본인 PC**로 해석했기 때문이다.
  //
  // 리라이트로 /api/* 를 Next 서버가 서버사이드에서 백엔드로 넘기면 브라우저 입장에서는
  // 동일 오리진이므로 CORS도 크로스사이트 쿠키도 발생하지 않는다. 터널도 하나면 된다.
  //
  // BACKEND_ORIGIN은 **서버 전용** 환경변수다(NEXT_PUBLIC_ 접두사 없음). 브라우저 번들에
  // 들어가지 않으므로 내부 주소가 노출되지 않는다. Docker 환경에서는 서비스명(예:
  // http://api:8000)을 넣으면 된다.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },

  // 서버 종류를 광고하는 X-Powered-By 헤더를 제거한다. 공격자에게 스택을 알려줄 이유가 없다.
  poweredByHeader: false,

  // 브라우저에 강제할 보안 정책. ALB가 TLS를 끊고 바로 Next로 오는 구조라 Nginx 같은
  // 중간 계층이 없으므로, 헤더를 붙일 곳은 여기뿐이다.
  async headers() {
    // CSP는 Report-Only로만 건다. 차단 모드로 켜면 Next의 인라인 스크립트와 충돌해
    // 화면이 깨지므로, 먼저 "켰을 때 무엇이 걸리는지"를 관측한 뒤 nonce 설계로 넘어간다.
    // script-src는 일부러 엄격하게 둔다 - 위반을 봐야 좁힐 대상을 알 수 있다.
    // style-src만 인라인을 허용한다: Tailwind/Next가 스타일을 인라인으로 주입해 바꿀 수 없다.
    const cdn = process.env.NEXT_PUBLIC_CDN_DOMAIN || "https://cdn.wms-ai.com";
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${cdn}`,   // 촬영 미리보기(blob) · 검수 사진(CDN)
      "font-src 'self' data:",
      // Sentry가 blob: 워커를 만든다. worker-src를 두지 않으면 script-src로 폴백돼 위반이 뜬다.
      "worker-src 'self' blob:",
      `connect-src 'self' ${cdn}`,           // API·SSE는 동일 출처, Sentry는 tunnelRoute 경유
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS로만 접속하게 고정한다. 중간자가 HTTP로 끌어내리는 다운그레이드를 막는다.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // 관리자 화면이 외부 사이트의 프레임 안에 뜨는 것을 차단한다(클릭재킹).
          { key: "X-Frame-Options", value: "DENY" },
          // 선언된 Content-Type을 브라우저가 임의로 다시 추측하지 못하게 한다.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 외부로 나갈 때 경로를 떼고 도메인만 보낸다. URL에 담긴 LPN·작업 ID 유출 방지.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 촬영 UI가 쓰는 카메라만 남기고 나머지 장치 권한은 닫는다.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          // 관측 전용. 위반해도 차단하지 않고 브라우저 콘솔에만 기록된다.
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          // Sentry 브라우저 프로파일링용. JS Self-Profiling API는 이 문서 정책이 있어야 열린다.
          { key: "Document-Policy", value: "js-profiling" },
        ],
      },
      {
        // public/ 정적 이미지(로고 등)는 기본 max-age=0이라 페이지를 옮길 때마다
        // 재다운로드된다. 로고류는 사실상 불변이므로 하루 캐시 + 백그라운드 재검증.
        source: "/:file*\\.(jpg|jpeg|png|svg|webp|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "azrael-vs",
  project: "nexus-wms",
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: true },
  // 아래 3개는 webpack 빌드 전용 옵션이라 최상위에 두면 deprecation 경고가 난다.
  // (Turbopack 개발 서버에서는 적용되지 않고, 프로덕션 webpack 빌드에만 걸린다)
  webpack: {
    reactComponentAnnotation: {
      enabled: true,
    },
    treeshake: {
      // 구 disableLogger - 번들에서 Sentry 디버그 로깅을 제거한다
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
