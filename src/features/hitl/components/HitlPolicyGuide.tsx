'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { UBCI_GRADE_POLICY, HITL_ROUTING_POLICY } from '../policy';

/** 결재 규칙·UBCI 등급 기준 접이식 안내 (기본 접힘 - 목록을 밀어내지 않기 위함). */
export function HitlPolicyGuide() {
  const [open, setOpen] = useState(false);
  return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-5 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-gray-100">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            HITL 결재 규칙 · UBCI 등급 기준
          </span>
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
            {open ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </button>

        {open && (
          <div className="px-5 pb-5 space-y-4">
            <div>
              <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 mb-2">
                자동 이관 규칙 (Supervisor / Critic)
              </p>
              <ul className="space-y-2">
                {HITL_ROUTING_POLICY.map((rule, i) => (
                  <li
                    key={rule.code}
                    className="flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800"
                  >
                    <span className="text-amber-500 font-black shrink-0">{i + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-bold text-gray-700 dark:text-gray-200">{rule.title}</span>
                      <span className="ml-1.5 font-mono text-[10px] px-1 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        {rule.code}
                      </span>
                      <span className="block mt-1 leading-snug">{rule.detail}</span>
                      <span className="block mt-1 leading-snug text-blue-600 dark:text-blue-400 font-medium">
                        → {rule.reviewHint}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 mb-2">
                UBCI 등급 기준 (확정 등급 선택 시 참고)
              </p>
              <div className="space-y-1.5">
                {UBCI_GRADE_POLICY.map((p) => (
                  <div
                    key={p.grade}
                    className="grid grid-cols-[7rem_5.5rem_1fr] items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 text-xs"
                  >
                    <span className={`font-black ${p.color}`}>{p.grade}</span>
                    <span className="font-mono font-bold text-gray-700 dark:text-gray-300 tabular-nums">{p.range}</span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">{p.quality}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${p.badge}`}>
                        {p.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
