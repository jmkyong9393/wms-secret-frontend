'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { useChangePasswordMutation } from '@/features/auth/hooks/useChangePasswordMutation';
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
    if (newPassword.length < 4) {
      setError('비밀번호는 최소 4자리 이상이어야 합니다.');
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
