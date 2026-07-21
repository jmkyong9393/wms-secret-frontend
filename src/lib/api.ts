import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Next.js App Router에 최적화된 Native Fetch Wrapper.
 * 기존 Axios 인터셉터를 대체하며, Next.js의 Request Memoization 및 Caching 이점을 누릴 수 있습니다.
 */
async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const token = Cookies.get("token");

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
    // Next.js 환경 특화 설정 (기본적으로 SSR/SSG 최적화 캐싱 적용 가능)
    // cache: 'no-store', // 동적 데이터의 경우 활성화
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
    // 202 Accepted 및 job_id 반환을 기대
    return fetchClient<any>("/returns/inspections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

export const uploadAPI = {
  // Offline Queue 등에서 사용하기 위한 임시 인터페이스
  uploadImage: async (order_id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchClient<any>(`/returns/orders/${order_id}/upload`, {
      method: "POST",
      body: formData, // FormData는 Content-Type을 수동으로 세팅하지 않음 (브라우저가 boundary 자동 할당)
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
