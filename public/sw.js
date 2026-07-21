const CACHE_NAME = "wms-offline-cache-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // 간단한 캐시 폴백 (Offline First 전략의 기본)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});

// 백그라운드 싱크 (Chrome 등 지원 브라우저용)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-queue") {
    console.log("[Service Worker] Syncing offline queue in background...");
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // 실제 브라우저 컨텍스트가 아닌 서비스워커 컨텍스트이므로,
  // idb 로직을 여기서 직접 구현하거나, 클라이언트 측 online 이벤트를 메인으로 사용합니다.
  // 본 프로젝트에서는 React 앱의 ServiceWorkerRegistration 에서 Fallback으로 완벽히 제어합니다.
  return Promise.resolve();
}
