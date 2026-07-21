import axios from "axios";
import { AUTH_TOKEN_STORAGE_KEY } from "@/features/auth/store/authAtoms";

// 백엔드 API 기본 주소 
// 환경변수 미설정 시 로컬 백엔드 주소 사용 
// Axios 요청과 MSW Mock에서 동일한 주소 공유
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // API 응답 대기 시간 10초
  timeout: 10000,
});

// API 요청 전 실행되는 공통 처리
apiClient.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// API 응답 후 실행되는 공통 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: 인증 만료 및 공통 오류 처리 추가
    return Promise.reject(error);
  }
);
