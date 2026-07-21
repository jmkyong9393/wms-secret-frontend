"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { isRequiredFieldFilled } from "@/features/auth/utils/validation";
import { useLoginMutation } from "@/features/auth/hooks/useLoginMutation";
import { ROLE_HOME_ROUTE } from "@/features/auth/constants/roleRoutes";
import type { LoginFieldErrors, LoginFormValues } from "@/features/auth/types/authFormTypes";

export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLoginMutation();

  const [values, setValues] = useState<LoginFormValues>({
    employee_id: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [guestPending, setGuestPending] = useState(false);

  const employeeIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors: LoginFieldErrors = {};
    if (!isRequiredFieldFilled(values.employee_id)) {
      errors.employee_id = "사번을 입력해 주세요.";
    }
    if (!isRequiredFieldFilled(values.password)) {
      errors.password = "비밀번호를 입력해 주세요.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.employee_id) {
        employeeIdRef.current?.focus();
      } else if (errors.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
    setGuestPending(false);

    loginMutation.mutate(values, {
      onSuccess: (result) => {
        if (result.mustChangePassword) {
          router.push("/change-password");
          return;
        }

        if (result.user.role === "GUEST") {
          setGuestPending(true);
          return;
        }

        const destination = ROLE_HOME_ROUTE[result.user.role];
        if (destination) {
          router.push(destination);
        }
      },
    });
  };

  const isSubmitting = loginMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="employee_id">사번</Label>
        <Input
          id="employee_id"
          ref={employeeIdRef}
          type="text"
          value={values.employee_id}
          onChange={(e) =>
            setValues((v) => ({ ...v, employee_id: e.target.value }))
          }
          autoComplete="username"
          disabled={isSubmitting}
          aria-invalid={!!fieldErrors.employee_id}
          aria-describedby={
            fieldErrors.employee_id ? "employee_id-error" : undefined
          }
        />
        {fieldErrors.employee_id && (
          <p id="employee_id-error" className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.employee_id}
          </p>
        )}
      </div>

      <PasswordInput
        id="password"
        ref={passwordRef}
        label="비밀번호"
        value={values.password}
        onChange={(value) => setValues((v) => ({ ...v, password: value }))}
        autoComplete="current-password"
        error={fieldErrors.password}
        disabled={isSubmitting}
      />

      {loginMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
          로그인에 실패했습니다. 사번/비밀번호를 확인하거나 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {guestPending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
          게스트 전용 화면은 준비 중입니다. 담당자에게 문의해 주세요.
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "로그인 중..." : "로그인"}
      </Button>
    </form>
  );
}
