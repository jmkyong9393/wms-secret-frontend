'use client';

import Link from 'next/link';
import { FileCheck } from 'lucide-react';

/** AI 피킹 지시서 연동 선택 바 - 지시서 선택 시 도서 자동 선택은 페이지 이펙트가 담당. */
export function PickingInstructionBar({ pickingInstructions, selectedInstructionId, onSelect, activeInstruction }: {
  pickingInstructions: any[];
  selectedInstructionId: string | null;
  onSelect: (id: string | null) => void;
  activeInstruction: any;
}) {
  return (
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 shrink-0">
                <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                AI 피킹 지시서 연동
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <select
                  value={selectedInstructionId || ''}
                  onChange={(e) => onSelect(e.target.value || null)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-700 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">지시서 미연동 (재고에서 수동 선택)</option>
                  {pickingInstructions.map(pi => (
                    <option key={pi.id} value={pi.id}>
                      {pi.instruction_no} · {pi.customer_name || 'B2B'} · {pi.total_items}권 ({pi.picked_items}권 피킹) · {pi.status}
                    </option>
                  ))}
                </select>
                <Link
                  href="/admin/orders"
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black shrink-0"
                  title="주문 & AI 피킹 지시서 관제 화면으로 이동"
                >
                  주문 관제 →
                </Link>
              </div>
            </div>
            {activeInstruction && (
              <div className="space-y-1 pt-1 border-t border-indigo-200/70 dark:border-indigo-800/70">
                {activeInstruction.route_summary && (
                  <p className="text-[11px] text-indigo-900 dark:text-indigo-200">
                    <strong className="font-black">🗺️ AI 동선:</strong> {activeInstruction.route_summary}
                  </p>
                )}
                {activeInstruction.worker_note && (
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                    <strong className="font-black">🤖 작업 지시:</strong> {activeInstruction.worker_note}
                  </p>
                )}
                <p className="text-[10px] font-mono text-indigo-400">
                  지시서 도서가 자동 선택되었습니다 - 아래에서 수동 수정 가능 · {activeInstruction.ai_source}
                </p>
              </div>
            )}
          </div>
  );
}
