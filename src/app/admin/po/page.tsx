'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCcw, PackageCheck, AlertTriangle, CheckCircle2, XCircle,
  ScanSearch, Download, Bot, ShieldAlert, TrendingDown, Sparkles, Trash2,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { exportToCSV } from '@/lib/exportCsv';
import { poAPI, OrderProposalCard, ProposalStatus } from '@/lib/api';
import { apiClient } from '@/lib/api-client';

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
  // 표시 전용 - 안전재고 값은 /admin/settings에서만 바꾼다 (2026-08-09)
  const [safetyStockThreshold, setSafetyStockThreshold] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get('/api/v1/admin/settings')
      .then((res) => setSafetyStockThreshold(res.data.safety_stock_threshold))
      .catch(() => {});
  }, []);

  // 칸반은 컬럼마다 카드가 쌓이는 구조라 페이지도 컬럼별로 따로 센다.
  // (한 컬럼만 30건이어도 나머지 두 컬럼까지 같이 넘어가면 조작이 어긋난다.)
  const [pageByCol, setPageByCol] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 카드 상세(수치 그리드·AI 사유) 펼침 상태 — 기본 접힘. 카드가 길어 컬럼 스캔이
  // 어렵다는 피드백 반영. 결재 버튼은 접힌 상태에도 항상 노출한다.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

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
          ? `[저재고 스캔 완료] 안전 재고선 미만 도서 ${res.createdCount}건에 대해 AI 발주 제안이 생성되었습니다.`
          : '[저재고 스캔 완료] 새로 제안할 저재고 도서가 없습니다. (기존 대기 카드는 유지)'
      );
      await fetchProposals();
    } catch (err) {
      console.error(err);
      // 뭉뚱그린 에러 문구가 403(권한)과 타임아웃(백엔드는 진행 중)을
      // 구분 못해 오진단을 유발했다 - 실측: 스캔이 12초 안팎 걸리는데 클라이언트
      // 타임아웃이 그보다 짧으면 서버는 성공했는데도 실패로 보였다. 상황별로 분기한다.
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          alert(
            '스캔이 예상보다 오래 걸리고 있습니다. 서버에서는 계속 진행 중일 수 있으니 ' +
            '잠시 후 새로고침해서 결과를 확인해주세요.'
          );
          await fetchProposals();
        } else if (err.response?.status === 403) {
          alert('저재고 스캔은 관리자(MASTER/ADMIN) 권한이 필요합니다.');
        } else {
          const detail = err.response?.data?.detail;
          alert(detail ? `저재고 스캔에 실패했습니다: ${detail}` : '저재고 스캔에 실패했습니다. 백엔드 상태를 확인해주세요.');
        }
      } else {
        alert('저재고 스캔에 실패했습니다.');
      }
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

  const handleBulk = async (
    action: 'approve' | 'dismiss' | 'delete',
    ids: string[],
    confirmText: string,
  ) => {
    if (!ids.length) return;
    if (!confirm(confirmText)) return;
    setActingId('BULK');
    try {
      if (action === 'approve') await poAPI.approveProposals(ids);
      else if (action === 'dismiss') await poAPI.dismissProposals(ids);
      else {
        const res = await poAPI.deleteProposals(ids);
        if (res.skipped?.length) {
          alert(`${res.deletedCount}건 삭제했습니다.
결재 대기(승인 대기) 카드 ${res.skipped.length}건은 삭제할 수 없어 건너뛰었습니다 — 먼저 승인 또는 기각해주세요.`);
        }
      }
      setSelected(new Set());
      await fetchProposals();
    } catch (err) {
      console.error(err);
      alert('일괄 처리에 실패했습니다.');
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
          {safetyStockThreshold !== null && (
            <Link
              href="/admin/settings"
              className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-mono ml-1"
              title="설정에서 변경"
            >
              현재 안전재고 기준: {safetyStockThreshold}권 · 설정에서 변경
            </Link>
          )}
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
          const allCards = proposals.filter(p => p.status === col.key);
          const totalPages = Math.max(1, Math.ceil(allCards.length / pageSize));
          const page = Math.min(pageByCol[col.key] ?? 1, totalPages);
          const cards = allCards.slice((page - 1) * pageSize, page * pageSize);
          const pageIds = cards.map(c => c.id);
          const selectedHere = pageIds.filter(id => selected.has(id));
          const allChecked = pageIds.length > 0 && selectedHere.length === pageIds.length;
          const setPage = (n: number) => setPageByCol(prev => ({ ...prev, [col.key]: n }));

          return (
            <div key={col.key} className="bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 min-h-[300px]">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{col.label}</h2>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{col.hint}</p>
                </div>
                <span className="px-2.5 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-bold font-mono border border-gray-200 dark:border-gray-700">
                  {allCards.length}
                </span>
              </div>

              {/* 이 페이지 전체 선택 + 선택 건 일괄 처리 */}
              {allCards.length > 0 && (
                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <label className="flex items-center gap-1.5 font-bold text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() =>
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (allChecked) pageIds.forEach(id => next.delete(id));
                          else pageIds.forEach(id => next.add(id));
                          return next;
                        })
                      }
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    />
                    이 페이지 전체
                  </label>

                  {selectedHere.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-blue-600 dark:text-blue-400">{selectedHere.length}건</span>
                      {col.key === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleBulk('approve', selectedHere, `선택한 ${selectedHere.length}건을 일괄 발주 승인할까요?
승인 즉시 AUTO_PO 주문 생성 + Zone A 신품 입고가 집행됩니다.`)}
                            disabled={actingId !== null}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer disabled:opacity-50"
                          >
                            일괄 승인
                          </button>
                          <button
                            onClick={() => handleBulk('dismiss', selectedHere, `선택한 ${selectedHere.length}건을 일괄 기각할까요?`)}
                            disabled={actingId !== null}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer disabled:opacity-50"
                          >
                            일괄 기각
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleBulk('delete', selectedHere, `선택한 ${selectedHere.length}건을 보드에서 삭제할까요?
결재 기록이 함께 사라지며 되돌릴 수 없습니다.`)}
                          disabled={actingId !== null}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md cursor-pointer disabled:opacity-50"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {allCards.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-10">카드가 없습니다</p>
              )}

              {cards.map(card => (
                <div
                  key={card.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 space-y-2.5"
                >
                  {/* 카드 헤더: 선택 + 트리거 + 긴급도 */}
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(card.id)}
                      onChange={() => toggleSelect(card.id)}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer shrink-0"
                      title="일괄 처리 대상으로 선택"
                    />
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

                  {/* 도서 정보 — 클릭하면 상세 접기/펼치기 */}
                  <div
                    onClick={() => toggleExpand(card.id)}
                    className="flex items-start justify-between gap-2 cursor-pointer group"
                    title={expanded.has(card.id) ? '상세 접기' : '상세 펼치기'}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug line-clamp-2">{card.title}</p>
                      {/* 접힌 상태 핵심 요약: AI 제안 수량만 한 줄로 */}
                      {!expanded.has(card.id) && (
                        <p className="text-[10px] font-mono mt-0.5 text-blue-600 dark:text-blue-400 font-bold">
                          AI 제안 +{card.proposedQuantity}권
                          {card.rejectReasonCode ? <span className="text-rose-500 dark:text-rose-400 font-normal"> · {card.rejectReasonCode}</span> : null}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 mt-0.5 shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${expanded.has(card.id) ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {/* 상세 영역 (기본 접힘) */}
                  {expanded.has(card.id) && (
                    <>
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
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
                    </>
                  )}

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
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{card.decidedBy || '-'}</p>
                          <p className="text-[9px] text-gray-300 dark:text-gray-600 font-mono">
                            {card.decidedAt ? card.decidedAt.slice(0, 16).replace('T', ' ') : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleBulk('delete', [card.id], `'${card.title}' 카드를 보드에서 삭제할까요?
결재 기록이 함께 사라지며 되돌릴 수 없습니다.`)}
                          disabled={actingId !== null}
                          title="보드에서 삭제"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 컬럼 페이지네이션 (건수가 적으면 화살표를 숨기고 건수 선택만 남긴다) */}
              {allCards.length > 0 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-[11px] font-mono">
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPageByCol({}); }}
                    className="px-1.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md font-bold text-gray-600 dark:text-gray-300 cursor-pointer"
                    title="한 페이지에 표시할 카드 수"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}개</option>)}
                  </select>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-black disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        &lt;
                      </button>
                      <span className="font-bold text-gray-500 dark:text-gray-400 px-1">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-black disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
