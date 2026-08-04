import type { Role, UserStatus } from "@/features/auth/types/authTypes";

// POST /api/v1/auth/login 요청 데이터
export interface LoginRequest {
  employee_id: string;
  password: string;
}

// POST /api/v1/auth/login 응답 데이터 - JWT는 HttpOnly 쿠키로만 전달되고
// 이 응답 본문에는 포함되지 않는다 (XSS로 토큰이 탈취되는 경로 원천 차단)
export interface LoginResponse {
  message: string;
  employee_id: string;
  name: string;
  role: Role;
  must_change_password: boolean;
}

// GET/PUT /api/v1/auth/me 응답 데이터 (백엔드 UserResponse와 1:1 대응)
export interface AuthMeResponse {
  id: string;
  employee_id: string;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  name: string;
  role: Role;
  status: UserStatus;
  must_change_password: boolean;
}

// PUT /api/v1/auth/me 요청 데이터 - 비밀번호는 여기 포함하지 않는다 (PATCH /password 전용)
export interface UpdateProfileRequest {
  name?: string;
  email?: string | null;
  phone_number?: string | null;
  address?: string | null;
}

// PATCH /api/v1/auth/password 요청 데이터
// current_password는 온보딩(최초 강제 변경) 시에는 생략 가능하고, 그 외에는 필수다.
export interface ChangePasswordRequest {
  current_password?: string;
  new_password: string;
}
