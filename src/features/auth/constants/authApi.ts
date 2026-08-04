/**
 * 인증 API 경로 공용 관리
 *
 * app/domains/auth/router.py (백엔드 /api/v1/auth/* 네임스페이스)와 1:1 대응한다.
 * 로그인 주소 변경 시 이 파일만 수정한다.
 */
export const LOGIN_ENDPOINT = "/api/v1/auth/login";
export const LOGOUT_ENDPOINT = "/api/v1/auth/logout";
export const ME_ENDPOINT = "/api/v1/auth/me";
export const CHANGE_PASSWORD_ENDPOINT = "/api/v1/auth/password";
