import axios from "axios";
import { CURRENT_USER_STORAGE_KEY } from "@/shared/lib/storageKeys";

// 백엔드 API 기본 주소.
//
// 빈 문자열("")을 넣으면 **같은 오리진**으로 상대경로 요청을 보낸다. 이 경우 next.config.ts의
// rewrites가 /api/* 를 서버사이드에서 백엔드로 프록시하므로, 브라우저 입장에서는 CORS도
// 크로스사이트 쿠키도 발생하지 않는다 (인증이 HttpOnly 쿠키라 이 점이 중요하다).
// 터널/외부 접속 환경에서는 이 방식을 쓴다.
//
// `||`가 아니라 `??`를 쓴다 - `||`는 빈 문자열도 falsy로 보아 기본값으로 덮어써 버리므로
// "같은 오리진" 설정 자체가 불가능해진다.
// 환경변수 자체가 없으면 종전과 동일하게 로컬 백엔드를 가리킨다.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
