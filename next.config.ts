import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "wms-ai-platform",
  project: "frontend",
  widenClientFileUpload: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: true },
  disableLogger: true,
  automaticVercelMonitors: true,
});
