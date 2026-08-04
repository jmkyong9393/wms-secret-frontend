import axios from "axios";
import { CURRENT_USER_STORAGE_KEY } from "@/features/auth/store/authAtoms";

// 백엔드 API 기본 주소
// 환경변수 미설정 시 로컬 백엔드 주소 사용
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // API 응답 대기 시간 10초
  timeout: 10000,
  // 인증은 전적으로 HttpOnly 쿠키(token/role)로 이루어진다. JWT는 JS에서 절대 읽을 수
  // 없으므로(XSS 방어) Authorization 헤더를 수동으로 붙이는 로직 자체가 없다 - 이 옵션이
  // 없으면 브라우저가 백엔드(다른 origin)의 Set-Cookie/쿠키 전송을 아예 무시한다.
  withCredentials: true,
});

// API 응답 후 실행되는 공통 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 세션 쿠키 만료/무효화(401) 시 클라이언트에 남아있는 로그인 상태 표시를 정리하고
    // 로그인 페이지로 돌려보낸다. (로그인 페이지 자체에서의 401은 로그인 실패이므로 제외)
    if (
      typeof window !== "undefined" &&
      error?.response?.status === 401 &&
      window.location.pathname !== "/login"
    ) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
