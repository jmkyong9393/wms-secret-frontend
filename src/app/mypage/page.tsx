'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, updateProfile } from '@/features/auth/api/authService';
import { ChangePasswordFields } from '@/features/auth/components/ChangePasswordFields';
import { Button } from '@/shared/ui/button';
import type { AuthMeResponse } from '@/features/auth/types/authApiTypes';

export default function MyPage() {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        setName(userData.name || '');
        setEmail(userData.email || '');
        setPhone(userData.phone_number || '');
        setAddress(userData.address || '');
      } catch (err) {
        console.warn('내 정보 조회 실패:', err);
        setError('내 정보를 불러오지 못했습니다.');
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const updated = await updateProfile({
        name,
        email: email || null,
        phone_number: phone || null,
        address: address || null,
      });
      setUser(updated);
      setMessage('정보가 성공적으로 수정되었습니다.');
    } catch (err) {
      setError('정보 수정에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 p-6">
      <div className="max-w-2xl w-full mx-auto bg-white p-8 shadow-sm rounded-lg border">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">마이페이지</h1>

        {message && <div className="bg-green-50 text-green-600 text-sm p-3 rounded-md mb-4">{message}</div>}
        {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 읽기 전용 정보 */}
            <div>
              <label className="block text-sm font-medium text-gray-500">사번 (Employee ID)</label>
              <input
                type="text"
                value={user.employee_id}
                className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-gray-500"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">권한 (Role)</label>
              <input
                type="text"
                value={user.role}
                className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 p-2 text-gray-500"
                disabled
              />
            </div>

            {/* 수정 가능 정보 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">전화번호</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">주소</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              className="mr-3"
              onClick={() => router.back()}
            >
              돌아가기
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? '저장 중...' : '정보 저장하기'}
            </Button>
          </div>
        </form>

        {/* 비밀번호 변경 - PATCH /api/v1/auth/password 단일 엔드포인트 (features/auth/components/ChangePasswordFields) */}
        <div className="border-t pt-6 mt-8">
          <h3 className="text-sm font-medium text-gray-800 mb-4">비밀번호 변경</h3>
          {passwordMessage && (
            <div className="bg-green-50 text-green-600 text-sm p-3 rounded-md mb-4">{passwordMessage}</div>
          )}
          <ChangePasswordFields onSuccess={() => setPasswordMessage('비밀번호가 변경되었습니다.')} />
        </div>
      </div>
    </div>
  );
}
