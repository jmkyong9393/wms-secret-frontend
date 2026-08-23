'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { isAxiosError } from 'axios';
import { Button } from '@/shared/ui/button';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { useChangePasswordMutation } from '@/features/auth/hooks/useChangePasswordMutation';
import { checkPasswordPolicy, getPolicyChecklist } from '@/features/auth/utils/passwordPolicy';
import type { AuthMeResponse } from '@/features/auth/types/authApiTypes';

interface ChangePasswordFieldsProps {
  onSuccess?: (user: AuthMeResponse) => void;
  submitLabel?: string;
}

const inputClassName =
  'mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500';

/**
 * 비밀번호 변경 폼 - PATCH /api/v1/auth/password 하나만 호출하는 유일한 구현.
 * 온보딩(최초 강제 변경, mustChangePassword=true)에서는 현재 비밀번호 입력란을 숨기고,
 * 그 외(마이페이지 자율 변경)에서는 현재 비밀번호 검증을 강제한다 - 백엔드
 * app/domains/users/service.py::change_password와 동일한 기준(mustChangePassword)을 사용한다.
 */
export function ChangePasswordFields({ onSuccess, submitLabel = '비밀번호 변경' }: ChangePasswordFieldsProps) {
  const currentUser = useAtomValue(currentUserAtom);
  const requireCurrentPassword = !currentUser?.mustChangePassword;
  const mutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (requireCurrentPassword && !currentPassword) {
      setError('현재 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    // 서버(app/core/password_policy.py)와 동일한 규칙을 사전 검증한다. 최종 판정은 서버가 하며,
    // 여기서는 왕복 없이 즉시 알려주는 역할만 한다.
    const violations = checkPasswordPolicy(newPassword, currentUser?.employeeId, currentUser?.name);
    if (violations.length > 0) {
      setError(violations.join(' / '));
      return;
    }

    try {
      const user = await mutation.mutateAsync({
        current_password: requireCurrentPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.(user);
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.message || err.response?.data?.detail : undefined;
      setError(msg || '비밀번호 변경에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md">{error}</div>}

      {requireCurrentPassword && (
        <div>
          <label className="block text-sm font-medium text-gray-700">현재 비밀번호</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClassName}
            placeholder="현재 비밀번호 입력"
            required
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">새 비밀번호</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
          placeholder="새로운 비밀번호 입력"
          required
        />
      </div>
      {/* 비밀번호 작성 규칙 안내 (KISA 기술적·관리적 보호조치 기준).
          입력에 따라 실시간으로 충족 여부를 표시해, 무엇이 부족한지 시행착오 없이 알 수 있게 한다. */}
      <ul className="space-y-1 rounded-md bg-gray-50 border border-gray-200 p-3">
        {getPolicyChecklist(newPassword, currentUser?.employeeId, currentUser?.name).map((item) => (
          <li
            key={item.label}
            className={`flex items-start gap-2 text-xs ${
              !newPassword ? 'text-gray-500' : item.satisfied ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            <span aria-hidden className="mt-px font-bold">
              {!newPassword ? '•' : item.satisfied ? '✓' : '✕'}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div>
        <label className="block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
          placeholder="새로운 비밀번호 재입력"
          required
        />
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={mutation.isPending}>
        {mutation.isPending ? '변경 중...' : submitLabel}
      </Button>
    </form>
  );
}
