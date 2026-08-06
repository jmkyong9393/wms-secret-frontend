'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { ChangePasswordFields } from '@/features/auth/components/ChangePasswordFields';
import { PrivacyConsentStep } from '@/features/auth/components/PrivacyConsentStep';
import { currentUserAtom } from '@/features/auth/store/authAtoms';

/**
 * 최초 로그인 온보딩.
 *
 * [2026-08-06 확장] 비밀번호 강제 변경 앞에 **개인정보 수집·이용 동의**(개인정보 보호법
 * 제15조) 단계를 추가했다. 이 서비스는 일반 회원가입이 없고 관리자가 사번을 발급하는
 * 구조라 동의를 받을 지점이 없었는데, 계정을 처음 쓰는 이 시점이 정보주체가 서비스와
 * 처음 대면하는 순간이므로 여기서 받는다.
 *
 * 비밀번호 변경 로직 자체는 features/auth/components/ChangePasswordFields
 * (PATCH /api/v1/auth/password) 하나로 마이페이지 자율 변경과 계속 공유한다.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const currentUser = useAtomValue(currentUserAtom);

  // 이미 동의한 계정(재진입 등)은 동의 단계를 건너뛴다.
  const [consented, setConsented] = useState(false);
  const needsConsent = !consented;

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

        {/* 진행 표시 - 2단계 흐름임을 먼저 알려 이탈을 줄인다 */}
        <div className="flex items-center justify-center gap-2 mb-5 text-[11px] font-bold">
          <span className={needsConsent ? 'text-blue-600' : 'text-gray-400'}>
            1. 개인정보 동의
          </span>
          <span className="text-gray-300">›</span>
          <span className={needsConsent ? 'text-gray-400' : 'text-blue-600'}>
            2. 비밀번호 변경
          </span>
        </div>

        {needsConsent ? (
          <>
            <p className="text-sm text-gray-600 text-center mb-6">
              서비스 이용을 위해 개인정보 수집·이용에 동의해 주세요.
            </p>
            <PrivacyConsentStep onAgreed={() => setConsented(true)} />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center mb-6">
              안전한 서비스 이용을 위해 초기 비밀번호를 변경해 주세요.
            </p>
            <ChangePasswordFields onSuccess={handleSuccess} submitLabel="비밀번호 변경 및 시작하기" />
          </>
        )}
      </div>
    </div>
  );
}
