import Cookies from "js-cookie";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BASE_URL = rawApiUrl.endsWith("/api/v1")
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/$/, "")}/api/v1`;

/**
 * Next.js App Router에 최적화된 Native Fetch Wrapper.
 * 기존 Axios 인터셉터를 대체하며, Next.js의 Request Memoization 및 Caching 이점을 누릴 수 있습니다.
 */
async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  let token = Cookies.get("token");
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("wms_auth_token") || localStorage.getItem("token") || undefined;
  }

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    // 401 Unauthorized 방어 로직 (Axios Response Interceptor 대체)
    if (response.status === 401) {
      Cookies.remove("token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw {
      response: { status: response.status, data: errorData },
      message: `HTTP Error ${response.status}`,
    };
  }

  return response.json();
}

export const api = {
  // 3주차: 반품 도서 AI 검수 파이프라인 트리거
  triggerInspection: async (data: { book_id: string; location_id?: string; image_urls: string[] }) => {
    return fetchClient<any>("/returns/inspections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const uploadAPI = {
  uploadImage: async (order_id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchClient<any>(`/returns/orders/${order_id}/upload`, {
      method: "POST",
      body: formData,
    });
  },
};

export const adminAPI = {
  getPendingHitlTasks: async () => {
    return fetchClient<any[]>("/admin/hitl/pending", { method: "GET" });
  },
  submitHitlOverrides: async (items: any[]) => {
    return fetchClient<any>("/admin/hitl/override", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
};

export const inventoryAPI = {
  getInventory: async () => {
    return fetchClient<any[]>("/inventory/", { method: "GET" });
  },
  createLpn: async (data: { book_id?: string; isbn?: string; worker_id?: string }) => {
    return fetchClient<any>("/inventory/lpn", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getLpnList: async () => {
    return fetchClient<any[]>("/inventory/lpn", { method: "GET" });
  }
};

export const poAPI = {
  getSuggestedPo: async () => {
    return fetchClient<any[]>("/po/suggested", { method: "GET" });
  },
  approvePo: async (book_ids: string[]) => {
    return fetchClient<any>("/po/approve", {
      method: "POST",
      body: JSON.stringify({ book_ids }),
    });
  }
};
