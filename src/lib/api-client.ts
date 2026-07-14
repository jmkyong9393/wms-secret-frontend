import axios from "axios";

// 환경변수에서 백엔드 API 주소를 가져옵니다. 기본값은 로컬호스트.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // 타임아웃 10초 설정 (비전 검수 등 오래 걸리는 작업은 별도 처리 요망)
  timeout: 10000, 
});

import Cookies from "js-cookie";

// 인터셉터 (요청 전)
apiClient.interceptors.request.use(
  (config) => {
    // js-cookie를 통해 토큰 추출 및 주입
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 인터셉터 (응답 후)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Unauthorized 에러 발생 시 처리 방어 로직
    if (error.response && error.response.status === 401) {
      Cookies.remove("token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
