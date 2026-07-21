/**
 * 로그인 API 경로 공용 관리
 *
 * 실제 API 요청과 MSW Mock에서 동일한 경로 사용
 * 로그인 주소 변경 시 이 파일만 수정
 */
export const LOGIN_ENDPOINT = "/api/v1/auth/login";
export const ME_ENDPOINT = "/api/v1/auth/me";
export const CHANGE_PASSWORD_ENDPOINT = "/api/v1/auth/password";
