'use client';

import React from 'react';
import { Maximize2, Sparkles, Clock } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import BookCover from '@/entities/book/ui/BookCover';
import type { HitlTask } from '../types/hitl';
import { DECISION_OPTIONS, GRADE_OPTIONS, REASON_OPTIONS } from '../constants/approvalOptions';
import { REASON_CODE_MAP, HITL_ESCALATION_LABELS } from '../constants/reasonLabels';
import { formatQueuedAt, getPrimaryDefectReason } from '../utils';

interface HitlTaskTableProps {
  tasks: HitlTask[];
  inFlightCount: number;
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  decisions: Record<string, string>;
  grades: Record<string, string>;
  reasons: Record<string, string>;
  comments: Record<string, string>;
  setDecisions: (next: Record<string, string>) => void;
  setGrades: (next: Record<string, string>) => void;
  setReasons: (next: Record<string, string>) => void;
  setComments: (next: Record<string, string>) => void;
  reinspectingIds: Set<string>;
  onReinspect: (id: string) => void;
  onOpenImage: (task: HitlTask) => void;
}

/** 결재 대기 목록 테이블 - 행별 처분·등급·사유·메모 편집과 AI 재검수 트리거. */
export function HitlTaskTable({
  tasks,
  inFlightCount,
  loading,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  decisions,
  grades,
  reasons,
  comments,
  setDecisions,
  setGrades,
  setReasons,
  setComments,
  reinspectingIds,
  onReinspect,
  onOpenImage,
}: HitlTaskTableProps) {
  return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">
            결재 대기 목록: <strong className="text-blue-600 dark:text-blue-400 font-mono">{tasks.length}</strong>건
            <span className="ml-2 font-medium text-[11px] text-gray-400 dark:text-gray-500">
              이관 시각 최신순
            </span>
          </h2>
          {inFlightCount > 0 && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900"
              title="AI 파이프라인이 아직 판정 중인 건. 완료되면 자동 확정되거나 이 목록으로 이관됩니다. 오래 머물면 워커 상태를 확인하세요."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              AI 검수 진행 중 {inFlightCount}건
            </span>
          )}
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">데이터를 불러오는 중...</div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">대기 중인 검수 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 text-xs font-bold">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      checked={selectedIds.size === tasks.length && tasks.length > 0}
                      onChange={onToggleAll}
                    />
                  </th>
                  <th className="py-3.5 px-3 w-20 text-center whitespace-nowrap">이미지</th>
                  <th className="py-3.5 px-3 w-56 whitespace-nowrap">도서 정보 및 바코드</th>
                  <th className="py-3.5 px-3 w-48 whitespace-nowrap">AI 비전 감지 사유</th>
                  <th className="py-3.5 px-3 w-36 whitespace-nowrap">처분 결정 (Decision)</th>
                  <th className="py-3.5 px-3 w-28 whitespace-nowrap">목표 등급</th>
                  <th className="py-3.5 px-3 w-40 whitespace-nowrap">오버라이드 사유</th>
                  <th className="py-3.5 px-3 w-48 whitespace-nowrap hidden 2xl:table-cell">관리자 메모</th>
                  <th className="py-3.5 px-3 w-28 text-center whitespace-nowrap hidden 2xl:table-cell">AI 재검수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {tasks.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const hasImage = t.image_urls && t.image_urls.length > 0;
                  const firstImage = hasImage ? t.image_urls[0] : t.cover_image_url;

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        // 재검수 중 붙잡아 둔 행. 목록에서 사라지지는 않지만 지금 값이
                        // 갱신 전이라는 사실은 드러나야 한다.
                        reinspectingIds.has(t.id)
                          ? "bg-purple-50/50 dark:bg-purple-950/30 animate-pulse"
                          : isSelected
                            ? "bg-blue-50/40 dark:bg-blue-950/40"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          checked={isSelected}
                          onChange={() => onToggleSelect(t.id)}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <div
                          className="relative w-14 h-18 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group shadow-sm flex items-center justify-center"
                          onClick={() => onOpenImage(t)}
                          title="클릭하여 원본 이미지 및 결함 박스 확대보기"
                        >
                          <BookCover
                            src={firstImage || t.cover_image_url}
                            title={t.book_title || "도서 제목 미지정"}
                            isbn={t.isbn}
                            className="w-full h-full"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        <div
                          className="font-bold text-gray-900 dark:text-white line-clamp-1 cursor-pointer hover:underline hover:text-blue-700 dark:hover:text-blue-400 w-fit"
                          onClick={() => onOpenImage(t)}
                          title="클릭하여 원본 이미지 및 결함 박스 확대보기"
                        >
                          {t.book_title || "도서 정보 없음"}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {(() => {
                            const realLpn = t.agent_logs?.lpn_barcode || (t as HitlTask & { lpn_barcode?: string }).lpn_barcode;
                            return realLpn ? (
                              <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] font-extrabold px-2 py-0.5 rounded shadow-2xs">
                                {realLpn}
                              </span>
                            ) : (
                              <span
                                className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 font-mono text-[11px] font-bold px-2 py-0.5 rounded"
                                title="이 건은 아직 물리 LPN 라벨이 발급되지 않았습니다"
                              >
                                LPN 미발급
                              </span>
                            );
                          })()}
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">ISBN: {t.isbn || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">Task: {t.id.slice(0, 8)}...</span>
                          {(() => {
                            const queuedAt = formatQueuedAt(t.updated_at || t.created_at);
                            return queuedAt ? (
                              <span
                                className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-mono text-[10px] tabular-nums"
                                title="이 건이 결재 대기열에 올라온 시각. 목록은 이 시각 기준 최신순으로 정렬됩니다."
                              >
                                <Clock className="w-3 h-3" />
                                {queuedAt}
                              </span>
                            ) : null;
                          })()}
                          {t.ubci_score !== undefined && (
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              UBCI: {t.ubci_score}점
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        {(() => {
                          // 이 컬럼은 "AI 비전 감지 사유"(getPrimaryDefectReason와 동일 소스).
                          // reason_code류는 결함 분류가 아니라 HITL 라우팅 사유다 — 실제 결함이 없을 때만 라우팅
                          // 사유를 정직하게 보여준다(HITL_ESCALATION_LABELS, 별도 톤).
                          const primaryDefect = getPrimaryDefectReason(t);
                          const routingCode = t.agent_logs?.reason_code || t.agent_logs?.primary_reason_code;
                          const code = primaryDefect || routingCode;
                          const meta = primaryDefect
                            ? REASON_CODE_MAP[primaryDefect] || {
                                label: primaryDefect,
                                category: 'AI 감지',
                                color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                              }
                            : routingCode
                              ? HITL_ESCALATION_LABELS[routingCode] || {
                                  label: routingCode,
                                  category: 'HITL 이관 사유',
                                  color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                                }
                              : { label: '판정 정보 없음', category: '-', color: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };
                          return (
                            <div className="space-y-1">
                              {/* 원시 코드([DMG_...]) 노출 대신 검수 처리 내역과 동일한 한글 라벨 필 배지로 표기 */}
                              <span
                                title={code ? `[${code}] ${meta.category}` : meta.category}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate" title={t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}>
                                {t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}
                              </p>

                              {/*
                                HITL 이관 근거를 검수자에게 노출한다.
                                증거 대조 검증이 결함을 오탐으로 지목하면 Policy가 감점에서 제외하고,
                                그 결과 감점이 0이 되면 Critic이 "결함 N건인데 감점 0점"으로 잡아
                                여기로 보낸다. 이 맥락 없이 결함 목록과 점수만 보면 검수자는
                                "결함 4건인데 왜 100점인가"를 판단할 수 없다.
                              */}
                              {(() => {
                                const logs = t.agent_logs || {};
                                const lines: { label: string; text: string; tone: string }[] = [];
                                const vision: string = logs.vision_text || "";
                                const policy: string = logs.policy_text || "";
                                const critic: string = logs.critic_text || "";

                                if (vision.includes("증거 대조 검증 반려")) {
                                  lines.push({
                                    label: "증거 대조",
                                    text: vision.split("증거 대조 검증 반려 -")[1]?.trim() || vision,
                                    tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900",
                                  });
                                }
                                if (policy.includes("감점 제외")) {
                                  const seg = policy.split("증거 대조 검증에서 오탐으로 지목되어 감점 제외:")[1];
                                  lines.push({
                                    label: "감점 제외",
                                    text: (seg || "").split("|")[0].trim(),
                                    tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900",
                                  });
                                }
                                if (critic.includes("교차 검증 실패")) {
                                  lines.push({
                                    label: "이관 사유",
                                    text: critic.split("불일치 감지:")[1]?.split(".")[0]?.trim() || critic,
                                    tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900",
                                  });
                                }
                                if (lines.length === 0) return null;

                                return (
                                  <div className="pt-1.5 space-y-1">
                                    {lines.map((l) => (
                                      <div
                                        key={l.label}
                                        className={`px-2 py-1 rounded-lg border text-[10px] leading-snug font-semibold ${l.tone}`}
                                      >
                                        <span className="font-black">{l.label}</span> · {l.text}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-2 py-3">
                        <Select
                          disabled={!isSelected}
                          value={decisions[t.id] || "APPROVE_DOWNGRADE"}
                          onValueChange={(val: string | null) => setDecisions({ ...decisions, [t.id]: val ?? "" })}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
                            <SelectValue>
                              {DECISION_OPTIONS.find((o) => o.value === (decisions[t.id] || "APPROVE_DOWNGRADE"))?.label || (decisions[t.id] || "APPROVE_DOWNGRADE")}
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
                      </td>

                      <td className="px-2 py-3">
                        <Select
                          disabled={!isSelected || decisions[t.id] === "REJECT_RETURN" || decisions[t.id] === "RE_CHECK"}
                          value={grades[t.id] || "GOOD"}
                          onValueChange={(val: string | null) => setGrades({ ...grades, [t.id]: val ?? "" })}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
                            <SelectValue>
                              {GRADE_OPTIONS.find((o) => o.value === (grades[t.id] || "GOOD"))?.label || (grades[t.id] || "GOOD")}
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
                      </td>

                      <td className="px-2 py-3">
                        {(() => {
                          const rawVal = reasons[t.id];
                          const selectedList: string[] = Array.isArray(rawVal)
                            ? rawVal
                            : (rawVal ? [rawVal] : []);

                          const toggleReasonCode = (codeToToggle: string) => {
                            const current = selectedList.includes(codeToToggle)
                              ? selectedList.filter((c) => c !== codeToToggle)
                              : [...selectedList, codeToToggle];
                            setReasons({ ...reasons, [t.id]: current.join(", ") });
                          };

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 min-w-[210px]">
                              {selectedList.length === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                  [CLEAN] 결함 없음 (정상)
                                </span>
                              ) : (
                                selectedList.map((code) => {
                                  const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                                  return (
                                    <span
                                      key={code}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                                    >
                                      {meta.label}
                                      {isSelected && (
                                        <button
                                          type="button"
                                          onClick={() => toggleReasonCode(code)}
                                          className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs leading-none p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                          title="AI 감지 사유 삭제/수정"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                              <Select
                                disabled={!isSelected}
                                onValueChange={(val: string | null) => {
                                  if (val && !selectedList.includes(val)) {
                                    setReasons({ ...reasons, [t.id]: [...selectedList, val].join(", ") });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-6 w-20 text-[10px] font-bold px-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                                  <span>+ 사유 추가</span>
                                </SelectTrigger>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {REASON_OPTIONS.map((grp) => (
                                    <React.Fragment key={grp.group}>
                                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                                      {grp.items.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          <span className="flex items-center gap-1.5">
                                            {selectedList.includes(opt.value) ? "✓ " : ""}
                                            {opt.label}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-2 py-3 hidden 2xl:table-cell">
                        <Input
                          disabled={!isSelected}
                          placeholder="사유 작성 (선택)"
                          value={comments[t.id] || ""}
                          onChange={(e) => setComments({ ...comments, [t.id]: e.target.value })}
                          className="h-9 text-xs font-medium rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white"
                        />
                      </td>

                      <td className="px-2 py-3 text-center hidden 2xl:table-cell">
                        <button
                          className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-extrabold rounded-xl transition-all text-xs flex items-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer disabled:opacity-50 mx-auto"
                          onClick={() => onReinspect(t.id)}
                          disabled={reinspectingIds.has(t.id)}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          {reinspectingIds.has(t.id) ? "재검수 중..." : "AI 재검수"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
}
