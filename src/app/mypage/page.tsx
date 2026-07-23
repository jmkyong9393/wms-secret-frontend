'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useAtom } from 'jotai';
import { userAtom } from '@/stores/auth';

export default function MyPage() {
  const [user, setUser] = useAtom(userAtom);
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 최초 로드 시 본인 정보 가져오기
    const fetchUser = async () => {
      try {
        const res = await apiClient.get('/api/v1/users/me');
        const userData = res.data;
        setUser(userData);
        setName(userData.name || '');
        setEmail(userData.email || '');
        setPhone(userData.phone_number || '');
        setAddress(userData.address || '');
      } catch (err) {
        setError('사용자 정보를 불러오는데 실패했습니다.');
      }
    };
    fetchUser();
  }, [setUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const updatePayload: any = {
        name,
        email: email || null,
        phone_number: phone || null,
        address: address || null,
      };
      
      if (password) {
        updatePayload.password = password;
      }

      const res = await apiClient.put('/api/v1/users/me', updatePayload);
      setUser(res.data);
      setMessage('정보가 성공적으로 수정되었습니다.');
      setPassword(''); // 비밀번호 입력 초기화
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
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
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
                value={(user as any).employee_id || user.username || ''}
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
            
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-medium text-gray-800 mb-4">비밀번호 변경 (선택사항)</h3>
              <label className="block text-sm font-medium text-gray-700">새 비밀번호</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                placeholder="변경할 경우에만 입력하세요"
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
      </div>
    </div>
  );
}
