import { apiClient } from "@/lib/api-client";
import { CHANGE_PASSWORD_ENDPOINT, LOGIN_ENDPOINT, ME_ENDPOINT } from "@/features/auth/constants/authApi";
import type {
  AuthMeResponse,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from "@/features/auth/types/authApiTypes";

// 로그인 요청을 보내고 받은 응답 데이터를 반환
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>(LOGIN_ENDPOINT, payload);
  return res.data;
}

// 현재 로그인된 사용자의 프로필 조회
export async function getMe(): Promise<AuthMeResponse> {
  const res = await apiClient.get<AuthMeResponse>(ME_ENDPOINT);
  return res.data;
}

// 비밀번호 변경 요청 (성공 시 204 No Content)
export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await apiClient.patch(CHANGE_PASSWORD_ENDPOINT, payload);
}
