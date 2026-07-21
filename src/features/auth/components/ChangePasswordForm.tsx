"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "jotai";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { doPasswordsMatch, isRequiredFieldFilled } from "@/features/auth/utils/validation";
import { useChangePasswordMutation } from "@/features/auth/hooks/useChangePasswordMutation";
import { getMe } from "@/features/auth/api/authService";
import { mapMeResponseToCurrentUser } from "@/features/auth/store/authSessionMapper";
import { currentUserAtom, logoutAtom, sessionAtom } from "@/features/auth/store/authAtoms";
import { ROLE_HOME_ROUTE } from "@/features/auth/constants/roleRoutes";
import type { Role } from "@/features/auth/types/authTypes";
import type {
  ChangePasswordFieldErrors,
  ChangePasswordFormStatus,
  ChangePasswordFormValues,
} from "@/features/auth/types/authFormTypes";

export function ChangePasswordForm() {
  const router = useRouter();
  const store = useStore();
  const changePasswordMutation = useChangePasswordMutation();

  const [values, setValues] = useState<ChangePasswordFormValues>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [status, setStatus] = useState<ChangePasswordFormStatus>("idle");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const navigateHome = (role: Role) => {
    const destination = ROLE_HOME_ROUTE[role];
    if (destination) router.push(destination);
  };

  const handleReLogin = () => {
    store.set(logoutAtom);
    router.push("/login");
  };

  const handleRetryProfile = async () => {
    const session = store.get(sessionAtom);
    if (!session) {
      handleReLogin();
      return;
    }

    setIsRetrying(true);
    setRetryError(null);
    try {
      const me = await getMe();
      const user = mapMeResponseToCurrentUser(me, session);
      store.set(currentUserAtom, user);
      navigateHome(user.role);
    } catch {
      setRetryError("사용자 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors: ChangePasswordFieldErrors = {};
    if (!isRequiredFieldFilled(values.currentPassword)) {
      errors.currentPassword = "현재 비밀번호를 입력해 주세요.";
    }
    if (!isRequiredFieldFilled(values.newPassword)) {
      errors.newPassword = "새 비밀번호를 입력해 주세요.";
    }
    if (!isRequiredFieldFilled(values.confirmPassword)) {
      errors.confirmPassword = "새 비밀번호 확인을 입력해 주세요.";
    }
    if (
      !errors.newPassword &&
      !errors.confirmPassword &&
      !doPasswordsMatch(values.newPassword, values.confirmPassword)
    ) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus("idle");
      if (errors.currentPassword) {
        currentPasswordRef.current?.focus();
      } else if (errors.newPassword) {
        newPasswordRef.current?.focus();
      } else if (errors.confirmPassword) {
        confirmPasswordRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
    setStatus("idle");

    changePasswordMutation.mutate(
      { current_password: values.currentPassword, new_password: values.newPassword },
      {
        onSuccess: (result) => {
          if (result.profileLoaded) {
            navigateHome(result.user.role);
            return;
          }
          setStatus("profileRecovery");
        },
        onError: () => {
          setStatus("error");
        },
      }
    );
  };

  const isSubmitting = changePasswordMutation.isPending;
  const showRecovery = status === "profileRecovery";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <PasswordInput
        id="currentPassword"
        ref={currentPasswordRef}
        label="현재 비밀번호"
        value={values.currentPassword}
        onChange={(value) =>
          setValues((v) => ({ ...v, currentPassword: value }))
        }
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
        disabled={isSubmitting || showRecovery}
      />

      <PasswordInput
        id="newPassword"
        ref={newPasswordRef}
        label="새 비밀번호"
        value={values.newPassword}
        onChange={(value) => setValues((v) => ({ ...v, newPassword: value }))}
        autoComplete="new-password"
        error={fieldErrors.newPassword}
        disabled={isSubmitting || showRecovery}
      />

      <PasswordInput
        id="confirmPassword"
        ref={confirmPasswordRef}
        label="새 비밀번호 확인"
        value={values.confirmPassword}
        onChange={(value) =>
          setValues((v) => ({ ...v, confirmPassword: value }))
        }
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting || showRecovery}
      />

      {status === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인하거나 다시 시도해 주세요.
        </div>
      )}

      {showRecovery && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
          비밀번호는 변경되었지만 사용자 정보를 불러오지 못했습니다.
        </div>
      )}

      {showRecovery && retryError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          {retryError}
        </div>
      )}

      {showRecovery ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleReLogin}
          >
            다시 로그인
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleRetryProfile}
            disabled={isRetrying}
          >
            {isRetrying ? "사용자 정보 확인 중..." : "다시 시도"}
          </Button>
        </div>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
        </Button>
      )}
    </form>
  );
}
