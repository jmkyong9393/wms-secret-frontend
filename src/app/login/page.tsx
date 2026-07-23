'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/stores/auth';
import { apiClient } from '@/lib/api-client';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/button';
import { AUTH_TOKEN_STORAGE_KEY } from '@/features/auth/store/authAtoms';

export default function LoginPage() {
  const [employee_id, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useSetAtom(userAtom);

  // 로그인 페이지 진입 시 기존 스토리지 초기화 (세션 만료 시 찌꺼기 제거)
  useEffect(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('wms_current_user');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. 백엔드로 로그인 요청
      const response = await apiClient.post('/api/v1/users/login', { employee_id, password });
      const { access_token, must_change_password } = response.data;

      // 2. JWT 토큰을 localStorage 및 쿠키에 저장
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, access_token);
      Cookies.set('token', access_token);

      // 3. /me API 호출하여 사용자 정보 가져오기
      const userResponse = await apiClient.get('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const user = userResponse.data;
      
      Cookies.set('role', user.role);
      setUser(user);

      // 4. 온보딩 상태 확인 후 리다이렉트 분기 처리
      if (must_change_password) {
        router.push('/onboarding');
      } else if (user.role === 'WORKER') {
        router.push('/inbound'); // 작업자는 입고 화면으로
      } else {
        router.push('/'); // 관리자는 대시보드로
      }
      
    } catch (err: any) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError('사번 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('서버 통신에 실패했습니다. 네트워크 상태를 확인해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 shadow-md rounded-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">WMS AI Platform</h1>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">사번</label>
            <input 
              type="text" 
              value={employee_id}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
              placeholder="예: KT2607001"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
              required 
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  );
}
