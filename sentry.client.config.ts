import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Dummy DSN for local development / testing without throwing error
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://dummy@o0.ingest.sentry.io/0",
  tracesSampleRate: 1,
  debug: false,
});
