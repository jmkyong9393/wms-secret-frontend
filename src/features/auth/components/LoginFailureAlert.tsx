'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import type { LoginFailure } from '@/features/auth/utils/loginFailure';

/**
 * 로그인 실패 사유 알림창.
 *
 * 화면 상단에 떠서 "무엇이 / 왜 / 그래서 어떻게"를 한 번에 보여준다. 사유 코드를 함께
 * 노출하는 이유는, 나중에 문제가 생겼을 때 사용자가 화면에 뜬 코드만 알려줘도 원인을
 * 특정할 수 있게 하기 위해서다 (문구는 번역/수정되어도 코드는 계약으로 고정된다).
 *
 * 폼 위에 겹치지 않게 fixed 배치하고, 경고성(오타 등)은 자동으로 닫히되 조치가 필요한
 * 오류(계정 비활성/시도 제한/서버 장애)는 사용자가 직접 닫을 때까지 남긴다.
 */
export default function LoginFailureAlert({
  failure,
  onClose,
}: {
  failure: LoginFailure | null;
  onClose: () => void;
}) {
  // 표시 여부는 failure 유무의 파생값이고, 자동 닫힘만 dismissed 오버레이로 얹는다.
  // 새 failure가 오면 렌더 중 조정으로 dismissed를 리셋한다.
  const [dismissed, setDismissed] = useState(false);
  const [prevFailure, setPrevFailure] = useState<LoginFailure | null>(failure);
  if (failure !== prevFailure) {
    setPrevFailure(failure);
    setDismissed(false);
  }

  // 단순 오타(warning)는 6초 뒤 자동으로 사라진다. error는 남겨서 조치를 유도한다.
  useEffect(() => {
    if (!failure || failure.severity !== 'warning') return;
    const timer = setTimeout(() => {
      setDismissed(true);
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [failure, onClose]);

  if (!failure || dismissed) return null;

  const isError = failure.severity === 'error';
  const Icon = isError ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-2rem),420px)] animate-in fade-in slide-in-from-top-2"
    >
      <div
        className={`rounded-2xl border shadow-2xl backdrop-blur-xl p-4 ${
          isError
            ? 'bg-rose-50/95 border-rose-200 text-rose-900'
            : 'bg-amber-50/95 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
              isError ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-snug">{failure.title}</p>
            <p className="text-xs mt-1 leading-relaxed opacity-90">{failure.message}</p>
            {failure.hint && (
              <p className="text-[11px] mt-1.5 leading-relaxed opacity-75">{failure.hint}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {failure.code}
              </span>
              {failure.status && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  HTTP {failure.status}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              onClose();
            }}
            aria-label="알림 닫기"
            className={`shrink-0 p-1 rounded-lg transition-colors ${
              isError ? 'hover:bg-rose-100' : 'hover:bg-amber-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
