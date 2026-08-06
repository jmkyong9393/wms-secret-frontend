'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

/**
 * 개인정보 수집·이용 동의 (개인정보 보호법 제15조 제2항).
 *
 * [도입 배경 - 2026-08-06]
 * 이 서비스는 일반 회원가입이 없고 관리자가 사번을 발급하는 구조라, 종전에는 동의를 받는
 * 지점 자체가 없었다. 계정을 처음 사용하는 시점(온보딩)이 정보주체가 서비스와 처음 대면하는
 * 순간이므로 여기서 동의를 받는다.
 *
 * 법 제15조 제2항이 요구하는 4개 고지 항목(①목적 ②항목 ③보유·이용 기간 ④거부 권리 및
 * 불이익)을 모두 화면에 표시한다 - 하나라도 빠지면 적법한 동의로 인정되지 않는다.
 */

const CONSENT_ITEMS = [
  { label: '수집·이용 목적', value: '창고관리 시스템 계정 식별, 작업 이력 관리, 검수 책임 추적' },
  { label: '수집 항목', value: '사번, 성명, 역할(직무) / 선택: 이메일, 전화번호, 주소' },
  { label: '보유·이용 기간', value: '퇴사 또는 계정 삭제 요청 시까지 (관련 법령상 보존 의무가 있는 경우 해당 기간)' },
];

export function PrivacyConsentStep({ onAgreed }: { onAgreed: () => void }) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checked) {
      setError('필수 동의 항목에 동의해야 서비스를 이용할 수 있습니다.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/auth/privacy-consent', { agreed: true });
      onAgreed();
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(msg || '동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md">{error}</div>}

      <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
        {CONSENT_ITEMS.map((item) => (
          <div key={item.label} className="p-3">
            <p className="text-xs font-bold text-gray-700">{item.label}</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 법 제15조 제2항 제4호: 동의를 거부할 권리와 거부 시 불이익을 반드시 함께 고지한다. */}
      <p className="text-[11px] text-gray-500 leading-relaxed">
        동의를 거부할 권리가 있으며, 거부 시 계정 발급 목적을 달성할 수 없어 시스템 이용이
        제한됩니다. 자세한 내용은{' '}
        <Link href="/privacy" target="_blank" className="text-blue-600 underline font-medium">
          개인정보 처리방침
        </Link>
        에서 확인하실 수 있습니다.
      </p>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-800 font-medium">
          [필수] 개인정보 수집·이용에 동의합니다.
        </span>
      </label>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        disabled={submitting || !checked}
      >
        {submitting ? '처리 중...' : '동의하고 계속하기'}
      </Button>
    </form>
  );
}
