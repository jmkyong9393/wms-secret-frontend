'use client';

import { useRouter } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { ChangePasswordFields } from '@/features/auth/components/ChangePasswordFields';
import { currentUserAtom } from '@/features/auth/store/authAtoms';

// 최초 로그인 시 강제 비밀번호 변경. 실제 변경 로직은 features/auth/components/ChangePasswordFields
// (PATCH /api/v1/auth/password) 하나로 마이페이지 자율 변경과 공유한다.
export default function OnboardingPage() {
  const router = useRouter();
  const currentUser = useAtomValue(currentUserAtom);

  const handleSuccess = () => {
    if (currentUser?.role === 'WORKER') {
      router.push('/inbound');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 shadow-lg rounded-lg border-t-4 border-blue-600">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-800">환영합니다! 🎉</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          안전한 서비스 이용을 위해 초기 비밀번호를 변경해 주세요.
        </p>
        <ChangePasswordFields onSuccess={handleSuccess} submitLabel="비밀번호 변경 및 시작하기" />
      </div>
    </div>
  );
}
