"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // 1. Service Worker 등록 (Background Sync용)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered.", reg.scope))
        .catch((err) => console.error("SW registration failed", err));
    }

    // 대기 중인 검수 건 재전송은 features 계층이 담당한다
    // (shared → features 참조는 FSD 의존 방향 위반이라 조립을 상위로 올렸다).
    // → features/inbound/hooks/useOfflineEvaluationSync.ts
  }, []);

  return null;
}
