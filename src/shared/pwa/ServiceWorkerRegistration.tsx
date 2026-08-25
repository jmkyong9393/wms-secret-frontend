"use client";

import { useEffect } from "react";
import { OfflineQueue } from "@/shared/api/offlineQueue";

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
      await queue.syncPendingTasks(
        async (blob, filename) => {
          const { uploadImageToCloudFront } = await import('@/shared/api/s3_helper');
          return await uploadImageToCloudFront(blob, filename);
        },
        async (isbn, lpn, url) => {
          const { apiClient } = await import('@/shared/api/api-client');
          const response = await apiClient.post('/api/v1/inspections', {
            book_id: isbn,
            location_id: lpn,
            image_urls: [url]
          });
          return response.data;
        }
      );
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
