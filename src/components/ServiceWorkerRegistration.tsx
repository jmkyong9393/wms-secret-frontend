"use client";

import { useEffect } from "react";
import { OfflineQueue } from "@/lib/offlineQueue";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // 1. Service Worker 등록 (Background Sync용)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered.", reg.scope))
        .catch((err) => console.error("SW registration failed", err));
    }

    // 2. 브라우저 Online 이벤트 리스너 (Fallback Sync용)
    // 서비스 워커의 Background Sync API가 지원되지 않는 브라우저(Safari 등)를 위한 방어 로직
    const handleOnline = async () => {
      console.log("Network came back online. Syncing Offline Queue...");
      const queue = new OfflineQueue();
      await queue.syncPendingTasks();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
