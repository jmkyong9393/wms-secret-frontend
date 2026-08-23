import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { changePassword } from "@/features/auth/api/authService";
import { currentUserAtom } from "@/entities/user/model/authAtoms";
import type { ChangePasswordRequest } from "@/features/auth/types/authApiTypes";

// PATCH /api/v1/auth/password 단일 엔드포인트를 호출하는 유일한 프론트엔드 진입점.
// 마이페이지(자율 변경)와 온보딩(강제 변경) 모두 features/auth/components/ChangePasswordFields를
// 통해 이 훅 하나만 사용한다.
export function useChangePasswordMutation() {
  const setCurrentUser = useSetAtom(currentUserAtom);

  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => changePassword(payload),
    onSuccess: (user) => {
      setCurrentUser({
        employeeId: user.employee_id,
        name: user.name,
        role: user.role,
        mustChangePassword: user.must_change_password,
      });
    },
  });
}
