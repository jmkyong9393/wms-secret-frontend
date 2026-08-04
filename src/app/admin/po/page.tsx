'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCcw, PackageCheck, AlertTriangle, CheckCircle2, XCircle,
  ScanSearch, Download, Bot, ShieldAlert, TrendingDown, Sparkles,
} from 'lucide-react';
import { exportToCSV } from '@/lib/exportCsv';
import { poAPI, OrderProposalCard, ProposalStatus } from '@/lib/api';

const URGENCY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  HIGH: 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  MEDIUM: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  LOW: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const COLUMNS: { key: ProposalStatus; label: string; hint: string }[] = [
  { key: 'PENDING', label: '승인 대기', hint: 'AI 제안 - 관리자 결재 대기' },
  { key: 'APPROVED', label: '승인 완료', hint: 'AUTO_PO 발주 + Zone A 신품 입고' },
  { key: 'DISMISSED', label: '기각', hint: '관리자 판단으로 발주 보류' },
];

export default function PurchaseOrderPage() {
  const [proposals, setProposals] = useState<OrderProposalCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await poAPI.getProposals();
      setProposals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('발주 제안 목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await poAPI.scanSafetyStock();
      alert(
        res.createdCount > 0
          ? `[저재고 스캔 완료] 안전선(15권) 미만 도서 ${res.createdCount}건에 대해 AI 발주 제안이 생성되었습니다.`
          : '[저재고 스캔 완료] 새로 제안할 저재고 도서가 없습니다. (기존 대기 카드는 유지)'
      );
      await fetchProposals();
    } catch (err) {
      console.error(err);
      alert('저재고 스캔에 실패했습니다. 관리자 권한과 백엔드 상태를 확인해주세요.');
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (card: OrderProposalCard) => {
    if (!confirm(`'${card.title}' ${card.proposedQuantity}권을 발주 승인할까요?\n승인 즉시 AUTO_PO 주문 생성 + Zone A 신품 재고로 입고됩니다.`)) return;
    setActingId(card.id);
    try {
      const res = await poAPI.approveProposals([card.id]);
      const approved = res.approved?.[0];
      alert(
        approved
          ? `[발주 승인 집행 완료]\n${approved.title} ${approved.quantity}권 → Zone ${approved.zone} 신품 입고 (주문번호 ${approved.orderId.slice(0, 8)}...)`
          : '[발주 승인] 이미 처리된 카드이거나 승인에 실패했습니다.'
      );
      await fetchProposals();
    } catch (err) {
      console.error(err);
      alert('발주 승인에 실패했습니다.');
    } finally {
      setActingId(null);
    }
  };

  const handleDismiss = async (card: OrderProposalCard) => {
    if (!confirm(`'${card.title}' 발주 제안을 기각할까요?`)) return;
    setActingId(card.id);
    try {
      await poAPI.dismissProposals([card.id]);
      await fetchProposals();
    } catch (err) {
      console.error(err);
      alert('기각 처리에 실패했습니다.');
    } finally {
      setActingId(null);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('nexus_order_proposals', proposals, [
      { key: 'isbn', label: 'ISBN' },
      { key: 'title', label: '도서명' },
      { key: 'triggerType', label: '트리거' },
      { key: 'rejectReasonCode', label: '반려 사유 코드' },
      { key: 'currentStock', label: '가용 재고' },
      { key: 'salesVelocity30d', label: '30일 출고량' },
      { key: 'proposedQuantity', label: 'AI 제안 수량' },
      { key: 'urgency', label: '긴급도' },
      { key: 'estimatedCost', label: '예상 매입가' },
      { key: 'reasoning', label: 'AI 제안 사유' },
      { key: 'aiSource', label: '제안 주체' },
      { key: 'status', label: '상태' },
      { key: 'decidedBy', label: '결재자' },
      { key: 'createdAt', label: '생성 시각' },
    ]);
  };

  const pending = proposals.filter(p => p.status === 'PENDING');
  const totalPendingCost = pending.reduce((acc, p) => acc + p.estimatedCost, 0);

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" /> RESTOCK AGENT PIPELINE
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            📦 자동 발주 관리 (SCM 칸반)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            입고 검수 반려·저재고 이벤트 발생 시 Restock 판정 그래프(Collector → gpt-4o-mini Agent → Validator)가
            발주 제안 카드를 생성합니다. 관리자 승인 시에만 AUTO_PO 발주와 Zone A 신품 입고가 집행됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center whitespace-nowrap shrink-0 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition-all border border-indigo-200 dark:border-indigo-800 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <ScanSearch className={`w-4 h-4 mr-1.5 ${scanning ? 'animate-pulse' : ''}`} />
            {scanning ? 'AI 분석 중...' : '저재고 AI 스캔'}
          </button>
          <button
            onClick={fetchProposals}
            disabled={loading}
            className="flex items-center whitespace-nowrap shrink-0 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-all border border-gray-200 dark:border-gray-700 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center whitespace-nowrap shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            발주 내역 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">AI 제안 결재 대기</p>
            <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{pending.length}건</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-100 dark:border-amber-800">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">승인 완료 (누적)</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {proposals.filter(p => p.status === 'APPROVED').length}건
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-100 dark:border-emerald-800">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">대기 건 예상 소요 예산</p>
            <h3 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">₩{totalPendingCost.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-100 dark:border-blue-800">
            <PackageCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {COLUMNS.map(col => {
          const cards = proposals.filter(p => p.status === col.key);
          return (
            <div key={col.key} className="bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 min-h-[300px]">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{col.label}</h2>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{col.hint}</p>
                </div>
                <span className="px-2.5 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-bold font-mono border border-gray-200 dark:border-gray-700">
                  {cards.length}
                </span>
              </div>

              {cards.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-10">카드가 없습니다</p>
              )}

              {cards.map(card => (
                <div
                  key={card.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 space-y-2.5"
                >
                  {/* 카드 헤더: 트리거 + 긴급도 */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      card.triggerType === 'INSPECTION_REJECT'
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                    }`}>
                      {card.triggerType === 'INSPECTION_REJECT'
                        ? <><ShieldAlert className="w-3 h-3" /> 검수 반려 트리거</>
                        : <><TrendingDown className="w-3 h-3" /> 저재고 스캔</>}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${URGENCY_STYLE[card.urgency] || URGENCY_STYLE.LOW}`}>
                      {card.urgency}
                    </span>
                  </div>

                  {/* 도서 정보 */}
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug line-clamp-2">{card.title}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                      ISBN {card.isbn} | {card.publisher}
                    </p>
                    {card.rejectReasonCode && (
                      <p className="text-[10px] font-mono text-rose-500 dark:text-rose-400 mt-0.5">
                        반려 사유: {card.rejectReasonCode}
                      </p>
                    )}
                  </div>

                  {/* 수치 그리드 */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-gray-50 dark:bg-gray-800/70 rounded-lg py-1.5">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">가용 재고</p>
                      <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">{card.currentStock}권</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/70 rounded-lg py-1.5">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">30일 출고</p>
                      <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">{card.salesVelocity30d}권</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/70 rounded-lg py-1.5">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">반려 소실</p>
                      <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">{card.rejectedQuantity}권</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/60 rounded-lg py-1.5 border border-blue-100 dark:border-blue-900">
                      <p className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">AI 제안</p>
                      <p className="text-xs font-mono font-black text-blue-600 dark:text-blue-400">+{card.proposedQuantity}권</p>
                    </div>
                  </div>

                  {/* AI 사유 */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-lg px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">
                      <Sparkles className="w-3 h-3" />
                      {card.aiSource === 'LLM_GPT4O_MINI' ? 'Restock Agent (gpt-4o-mini)' : '결정론적 안전재고 산식 (LLM 폴백)'}
                    </p>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">{card.reasoning}</p>
                  </div>

                  {/* 푸터: 금액 + 결재 */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500">예상 매입가 (도매 60%)</p>
                      <p className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">₩{card.estimatedCost.toLocaleString()}</p>
                    </div>
                    {card.status === 'PENDING' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleApprove(card)}
                          disabled={actingId === card.id}
                          className="flex items-center px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-[11px] shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 승인
                        </button>
                        <button
                          onClick={() => handleDismiss(card)}
                          disabled={actingId === card.id}
                          className="flex items-center px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg transition-colors text-[11px] border border-gray-200 dark:border-gray-700 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> 기각
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{card.decidedBy || '-'}</p>
                        <p className="text-[9px] text-gray-300 dark:text-gray-600 font-mono">
                          {card.decidedAt ? card.decidedAt.slice(0, 16).replace('T', ' ') : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
