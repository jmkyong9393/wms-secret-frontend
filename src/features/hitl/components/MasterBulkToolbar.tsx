'use client';

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { DECISION_OPTIONS, GRADE_OPTIONS, REASON_OPTIONS } from '../constants/approvalOptions';
import { REASON_CODE_MAP } from '../constants/reasonLabels';

export interface MasterBulkValues { decision: string; grade: string; reasons: string[] }

/** 선택 항목 일괄 설정 툴바. 선택지 상태는 내부 소유, 적용은 onApply 콜백으로 페이지에 위임. */
export function MasterBulkToolbar({ selectedCount, onApply }: {
  selectedCount: number;
  onApply: (values: MasterBulkValues) => void;
}) {
  const [masterDecision, setMasterDecision] = useState<string>('APPROVE_DOWNGRADE');
  const [masterGrade, setMasterGrade] = useState<string>('GOOD');
  const [masterReasons, setMasterReasons] = useState<string[]>(['DMG_INT_DOODLE', 'DMG_EXT_CRUSH']);

  const handleMasterDecisionChange = (val: string | null) => {
    if (val) setMasterDecision(val);
  };
  const handleMasterGradeChange = (val: string | null) => {
    if (val) setMasterGrade(val);
  };
  const toggleMasterReason = (code: string) => {
    if (masterReasons.includes(code)) {
      if (masterReasons.length > 1) {
        setMasterReasons(masterReasons.filter((c) => c !== code));
      }
    } else {
      setMasterReasons([...masterReasons, code]);
    }
  };
  const handleApply = () => onApply({ decision: masterDecision, grade: masterGrade, reasons: masterReasons });

  return (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 dark:bg-blue-950/50 p-2 rounded-xl border border-blue-100 dark:border-blue-800 w-full md:w-auto">
            <div className="flex items-center text-xs font-extrabold text-blue-900 dark:text-blue-300 mr-1">
              <Sliders className="w-3.5 h-3.5 mr-1" />
              선택항목 일괄 설정:
            </div>
            <Select value={masterDecision} onValueChange={handleMasterDecisionChange}>
              <SelectTrigger className="h-9 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white w-36">
                <SelectValue>
                  {DECISION_OPTIONS.find((o) => o.value === masterDecision)?.label || masterDecision}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={masterGrade} onValueChange={handleMasterGradeChange}>
              <SelectTrigger className="h-9 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white w-28">
                <SelectValue>
                  {GRADE_OPTIONS.find((o) => o.value === masterGrade)?.label || masterGrade}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {GRADE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              {masterReasons.map((code) => {
                const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                  >
                    {meta.label}
                    {masterReasons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleMasterReason(code)}
                        className="hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                        title="사유 제거"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              <Select
                onValueChange={(val: string | null) => {
                  if (val && !masterReasons.includes(val)) {
                    setMasterReasons([...masterReasons, val]);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-24 text-[10px] font-bold px-2 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                  <span>+ 사유 선택</span>
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {REASON_OPTIONS.map((grp) => (
                    <React.Fragment key={grp.group}>
                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                      {grp.items.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1.5">
                            {masterReasons.includes(opt.value) ? "✓ " : ""}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              ⚡ {selectedCount > 0 ? `선택 ${selectedCount}건 폼에 세팅` : '선택 항목 폼에 세팅'}
            </button>
          </div>
  );
}
