'use client';

/**
 * BBox 편집 결과의 UBCI 점수/등급을 결재 전에 보여 준다.
 * 편집이 없으면 아무것도 렌더하지 않는다 - 안 고친 화면에 패널이 떠 있으면 소음이다.
 */

import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import type { HitlScorePreview } from '@/features/hitl/api/adminApi';

const GRADE_STYLE: Record<string, string> = {
  MINT: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  GOOD: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  REJECT: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
};

interface Props {
  preview: HitlScorePreview | null;
  loading: boolean;
  error: string | null;
  /** 편집이 하나도 없으면 패널 자체를 숨긴다 */
  hasEdits: boolean;
}

export function ScorePreviewPanel({ preview, loading, error, hasEdits }: Props) {
  if (!hasEdits) return null;

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 tracking-wide">
          편집 반영 점수 (저장 전 미리보기)
        </p>
        {loading && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
      </div>

      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{error}</p>
      ) : !preview ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">계산 중...</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {preview.current_score !== null && (
              <>
                <span className="text-sm font-bold text-gray-400 dark:text-gray-500 line-through tabular-nums">
                  {preview.current_score}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </>
            )}
            {preview.score_unverified ? (
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">판정 보류</span>
            ) : (
              <>
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {preview.ubci_score ?? '—'}
                </span>
                {preview.grade && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-extrabold rounded border ${
                      GRADE_STYLE[preview.grade] || GRADE_STYLE.NORMAL
                    }`}
                  >
                    {preview.grade}
                  </span>
                )}
                {typeof preview.delta === 'number' && preview.delta !== 0 && (
                  <span
                    className={`text-[11px] font-extrabold tabular-nums ${
                      preview.delta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {preview.delta > 0 ? `+${preview.delta}` : preview.delta}
                  </span>
                )}
              </>
            )}
          </div>

          <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">
            감점 대상 <strong className="tabular-nums">{preview.defect_count}</strong>건
            {preview.excluded_count > 0 && (
              <> · 제외 <strong className="tabular-nums">{preview.excluded_count}</strong>건</>
            )}
          </p>

          {preview.policy_text && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3">
              {preview.policy_text}
            </p>
          )}

          {preview.integrity_issues.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
              <div className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold space-y-0.5">
                {preview.integrity_issues.map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
