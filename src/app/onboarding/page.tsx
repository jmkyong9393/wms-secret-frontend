'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';
import Cookies from 'js-cookie';

export default function OnboardingPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const user = useAtomValue(userAtom);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 4) {
      setError('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/api/v1/users/onboarding', { new_password: newPassword });
      
      // 상태 변경 성공 시 권한에 따라 리다이렉트
      const role = Cookies.get('role');
      if (role === 'WORKER') {
        router.push('/inbound');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('비밀번호 변경에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 shadow-lg rounded-lg border-t-4 border-blue-600">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">환영합니다! 🎉</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          안전한 서비스 이용을 위해 초기 비밀번호를 변경해 주세요.
        </p>
        
        {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">새 비밀번호</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
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
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
              placeholder="새로운 비밀번호 재입력"
              required 
            />
          </div>
          <div className="pt-2">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경 및 시작하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
