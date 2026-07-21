import type { Role, UserStatus } from "@/features/auth/types/authTypes";

// 로그인 API 요청 데이터
export interface LoginRequest {
  employee_id: string;
  password: string;
}

// 로그인 API 응답 데이터
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  must_change_password: boolean;
}

// GET /api/v1/auth/me 응답 데이터
export interface AuthMeResponse {
  id: string;
  employee_id: string;
  email: string | null;
  name: string;
  role: Role;
  status: UserStatus;
  must_change_password: boolean;
}

// PATCH /api/v1/auth/password 요청 데이터
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
