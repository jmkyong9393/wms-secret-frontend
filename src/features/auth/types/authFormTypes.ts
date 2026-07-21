export interface LoginFormValues {
  employee_id: string;
  password: string;
}

export interface LoginFieldErrors {
  employee_id?: string;
  password?: string;
}

// 비밀번호 변경 화면 상태
export type ChangePasswordFormStatus =
  | "idle"
  | "error"
  | "profileRecovery"; 

export interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordFieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}
