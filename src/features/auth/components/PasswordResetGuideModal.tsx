'use client';

import { KeyRound, ShieldCheck, UserCog, X } from 'lucide-react';

/**
 * 비밀번호 재설정 안내 모달.
 *
 * [2026-08-06 신설]
 * 종전에는 `<a href="#">`에 `alert("관리자(개인이메일)에게 문의하세요")`가 물려 있었다.
 * 두 가지가 문제였다:
 *  1. **공개 로그인 화면에 개인 이메일 주소가 그대로 노출**되어 수집·피싱 표적이 된다.
 *  2. 재설정 절차가 실제로 무엇인지 알려주지 않아, 사용자는 무엇을 준비해 누구에게
 *     요청해야 하는지 알 수 없었다.
 *
 * **왜 셀프 서비스 재설정(이메일/SMS 링크)이 아닌가**
 * 이 시스템은 일반 회원가입이 없고 관리자가 사번을 발급하는 B2B 사내 구조이며,
 * `users.email`/`phone_number`가 모두 선택 항목이라 실제로 비어 있는 계정이 대부분이다.
 * 본인에게 도달할 채널이 없는 상태에서 셀프 재설정을 붙이면, 인증 없이 비밀번호를
 * 바꿔주는 통로가 되어 오히려 계정 탈취 경로가 된다.
 * 따라서 **계정을 발급한 주체(관리자)가 재설정도 승인**하는 구조를 택한다.
 */
export default function PasswordResetGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-reset-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 id="pw-reset-title" className="text-sm font-black text-gray-900">
                비밀번호 재설정 안내
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">관리자 승인 방식으로 운영됩니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <ol className="space-y-3">
            {[
              {
                icon: UserCog,
                title: '담당 관리자에게 재설정 요청',
                desc: '사내 요청 채널로 사번과 성명을 함께 전달합니다. 개인 연락처가 아닌 사내 채널을 이용하세요.',
              },
              {
                icon: ShieldCheck,
                title: '관리자 본인 확인 후 승인',
                desc: '계정을 발급한 관리자(MASTER/ADMIN)가 소속과 재직 여부를 확인한 뒤 재설정을 승인합니다.',
              },
              {
                icon: KeyRound,
                title: '임시 비밀번호 발급 및 즉시 변경',
                desc: '발급받은 임시 비밀번호로 로그인하면 비밀번호 변경 화면으로 자동 이동합니다.',
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[11px] font-black flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <step.icon className="w-3.5 h-3.5 text-indigo-500" />
                    {step.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong className="font-black">보안 주의.</strong> 관리자를 포함한 누구도 기존 비밀번호를
              묻지 않습니다. 비밀번호를 요구하는 연락을 받으면 응하지 마시고 관리자에게 신고하세요.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
