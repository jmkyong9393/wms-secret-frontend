import { apiClient } from "@/lib/api-client";
import {
  CHANGE_PASSWORD_ENDPOINT,
  LOGIN_ENDPOINT,
  LOGOUT_ENDPOINT,
  ME_ENDPOINT,
} from "@/features/auth/constants/authApi";
import type {
  AuthMeResponse,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UpdateProfileRequest,
} from "@/features/auth/types/authApiTypes";

// 로그인 요청을 보내고 받은 응답 데이터를 반환 (JWT는 응답이 아니라 Set-Cookie로 전달됨)
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>(LOGIN_ENDPOINT, payload);
  return res.data;
}

// 서버 측 인증 쿠키를 만료시킨다
export async function logout(): Promise<void> {
  await apiClient.post(LOGOUT_ENDPOINT);
}

// 현재 로그인된 사용자의 프로필 조회
export async function getMe(): Promise<AuthMeResponse> {
  const res = await apiClient.get<AuthMeResponse>(ME_ENDPOINT);
  return res.data;
}

// 프로필 정보 수정 (이름/이메일/전화번호/주소). 비밀번호는 changePassword를 사용한다.
export async function updateProfile(payload: UpdateProfileRequest): Promise<AuthMeResponse> {
  const res = await apiClient.put<AuthMeResponse>(ME_ENDPOINT, payload);
  return res.data;
}

// 비밀번호 변경 (마이페이지 자율 변경 / 온보딩 강제 변경 공용 단일 엔드포인트)
export async function changePassword(payload: ChangePasswordRequest): Promise<AuthMeResponse> {
  const res = await apiClient.patch<AuthMeResponse>(CHANGE_PASSWORD_ENDPOINT, payload);
  return res.data;
}
