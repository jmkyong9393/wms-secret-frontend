'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/stores/auth';
import { apiClient } from '@/lib/api-client';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useSetAtom(userAtom);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. 백엔드로 로그인 요청 (Axios Direct Fetch)
      const response = await apiClient.post('/api/v1/auth/login', { username, password });
      const { token, user } = response.data;

      // 2. JWT 토큰과 역할(Role)을 쿠키에 저장 (Next.js Edge Middleware 호환을 위해)
      Cookies.set('token', token, { expires: 1 }); // 1일 유지
      Cookies.set('role', user.role, { expires: 1 }); // RBAC 라우팅용

      // 3. 사용자 정보를 Jotai 전역 상태에 저장
      setUser(user);

      // 4. 권한에 따라 리다이렉트 분기 처리
      if (user.role === 'WORKER') {
        router.push('/inbound'); // 작업자는 입고 화면으로
      } else {
        router.push('/'); // 관리자는 대시보드로
      }
      
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
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
            <label className="block text-sm font-medium text-gray-700">아이디</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
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
