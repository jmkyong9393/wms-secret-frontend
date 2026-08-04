"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Sparkles,
  RefreshCcw,
  ClipboardList,
  MapPin,
  ArrowRight,
  Plus,
  Minus,
  Search,
  X,
  Bot,
  PackageCheck,
  Truck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api/v1";

interface PickingItem {
  id: string;
  stock_type: 'NEW' | 'USED';
  is_new: boolean;
  lpn_barcode: string | null;
  isbn: string;
  title: string;
  quantity: number;
  picked_quantity: number;
  location_label: string;
  pick_seq: number;
  unit_price: number;
  status: string;
}

interface PickingInstruction {
  id: string;
  instruction_no: string;
  order_id: string;
  customer_name: string | null;
  order_status: string | null;
  order_total_price: number | null;
  status: string;
  total_items: number;
  picked_items: number;
  route_summary: string | null;
  worker_note: string | null;
  ai_source: string;
  box_id: string | null;
  cj_waybill_no: string | null;
  created_at: string | null;
  items: PickingItem[];
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: '수락 대기',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-300' },
  ACCEPTED:    { label: '피킹 수락됨', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-300' },
  IN_PROGRESS: { label: '피킹 진행중', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300' },
  PICKED:      { label: '피킹 완료',   cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300' },
  PACKED:      { label: '포장 대기 (송장 발급)', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-300' },
  SHIPPED:     { label: '출고 완료',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300' },
  CANCELLED:   { label: '취소',       cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-300' },
};

export default function OrdersPickingPage() {
  const [instructions, setInstructions] = useState<PickingInstruction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 수동 주문 생성 패널 상태
  const [showManualPanel, setShowManualPanel] = useState<boolean>(false);
  const [availableBooks, setAvailableBooks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cart, setCart] = useState<Record<string, number>>({}); // id -> qty
  const [customerName, setCustomerName] = useState<string>('교보문고 B2B 지점');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchInstructions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/orders/picking-instructions?limit=30`, { cache: 'no-store' });
      if (res.ok) setInstructions(await res.json());
    } catch (e) {
      console.error("Failed to fetch picking instructions:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstructions(); }, [fetchInstructions]);

  useEffect(() => {
    if (!showManualPanel || availableBooks.length > 0) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/orders/available-books`, { cache: 'no-store' });
        if (res.ok) setAvailableBooks(await res.json());
      } catch (e) {
        console.error("Failed to fetch available books:", e);
      }
    })();
  }, [showManualPanel, availableBooks.length]);

  const handleSimulate = async () => {
    try {
      setIsSimulating(true);
      const res = await fetch(`${API_BASE}/orders/simulate-b2b`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`🎲 [B2B 주문 시뮬레이션 완료]\n주문: ${data.pricing.total_quantity}권 / ${Number(data.pricing.final_price).toLocaleString()}원\n피킹 지시서: ${data.picking_instruction?.instruction_no} 발행됨`);
        await fetchInstructions();
        if (data.picking_instruction?.id) setExpandedId(data.picking_instruction.id);
      } else {
        alert(`시뮬레이션 실패: ${data.detail || data.message}`);
      }
    } catch (e) {
      alert('백엔드 연결에 실패했습니다. (localhost:8000)');
    } finally {
      setIsSimulating(false);
    }
  };

  const cartEntries = Object.entries(cart);
  const cartTotalQty = cartEntries.reduce((a, [, q]) => a + q, 0);

  const handleSubmitManualOrder = async () => {
    if (cartEntries.length === 0) {
      alert('주문할 도서를 1권 이상 담아주세요.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/orders/create-with-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName || '교보문고 B2B 지점',
          items: cartEntries.map(([id, quantity]) => ({ id, quantity })),
          auto_picking_instruction: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ [주문 접수 & AI 피킹 지시서 발행]\n${data.message}`);
        setCart({});
        setShowManualPanel(false);
        await fetchInstructions();
        if (data.picking_instruction?.id) setExpandedId(data.picking_instruction.id);
      } else {
        alert(`주문 실패: ${data.detail || data.message}`);
      }
    } catch (e) {
      alert('백엔드 연결에 실패했습니다. (localhost:8000)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBooks = availableBooks.filter(b => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (b.title || '').toLowerCase().includes(t)
      || (b.isbn || '').includes(t)
      || (b.lpn || '').toLowerCase().includes(t);
  });

  const activeCount = instructions.filter(i => !['SHIPPED', 'CANCELLED'].includes(i.status)).length;
  const shippedCount = instructions.filter(i => i.status === 'SHIPPED').length;

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-bold font-mono inline-flex items-center gap-1 mb-1">
            <Bot className="w-3.5 h-3.5" /> ORDER → AI PICKING INSTRUCTION
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">🧾 주문 & AI 피킹 지시서 관제</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            B2B 주문 접수 시 규칙 엔진(FIFO + Zone 동선)이 재고를 할당하고, LLM이 작업자 지시문을 생성합니다.
            발행된 지시서는 출고 최적화 화면과 현장 피킹 스캐너에 실시간 연동됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualPanel(v => !v)}
            className="bg-white dark:bg-gray-800 border-2 border-indigo-500 text-indigo-700 dark:text-indigo-300 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            {showManualPanel ? '수동 주문 닫기' : '수동 주문 등록'}
          </button>
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? '주문 생성 중...' : '🎲 B2B 주문 시뮬레이션'}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">발행 지시서 (최근)</span>
            <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-3xl font-black font-mono">{isLoading ? '...' : `${instructions.length}건`}</span>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">진행 중 (피킹/패킹)</span>
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-3xl font-black font-mono text-blue-700 dark:text-blue-300">{isLoading ? '...' : `${activeCount}건`}</span>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">출고 완료</span>
            <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">{isLoading ? '...' : `${shippedCount}건`}</span>
        </div>
      </div>

      {/* 수동 주문 등록 패널 */}
      {showManualPanel && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-indigo-500 shadow-xl p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
            <h3 className="font-bold flex items-center gap-2 text-base">
              <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              수동 B2B 주문 등록
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-bold">거래처:</span>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:border-indigo-500 w-48"
              />
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="도서 제목, ISBN 또는 LPN 검색..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
            {filteredBooks.map(b => {
              const inCart = cart[b.id] !== undefined;
              const qty = cart[b.id] || 0;
              const maxStock = b.isNew ? (b.stock_qty || 1) : 1;
              return (
                <div
                  key={b.id}
                  className={`p-2.5 rounded-xl border text-left space-y-1 min-w-0 transition-all ${
                    inCart
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => {
                    setCart(prev => {
                      const next = { ...prev };
                      if (next[b.id] !== undefined) delete next[b.id];
                      else next[b.id] = 1;
                      return next;
                    });
                  }}>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[11px] truncate">{b.title}</p>
                      <p className="text-[10px] font-mono text-gray-400 truncate">
                        {b.isNew ? '✨ 신품 (Zone A)' : `📦 중고 ${b.lpn}`} | {Number(b.listPrice).toLocaleString()}원
                      </p>
                    </div>
                    <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] font-black ${
                      inCart ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'
                    }`}>{inCart ? '✓' : ''}</span>
                  </div>
                  {inCart && b.isNew && (
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setCart(p => ({ ...p, [b.id]: Math.max(1, qty - 1) }))}
                        className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-black font-mono w-8 text-center">{qty}권</span>
                      <button onClick={() => setCart(p => ({ ...p, [b.id]: Math.min(maxStock, qty + 1) }))}
                        className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3" /></button>
                      <span className="text-[9px] text-gray-400 font-mono">(재고 {maxStock})</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t dark:border-gray-800">
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 font-mono">
              🛒 {cartEntries.length}종 / 총 {cartTotalQty}권 선택됨
            </span>
            <button
              onClick={handleSubmitManualOrder}
              disabled={isSubmitting || cartEntries.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? '접수 중...' : '주문 접수 + AI 피킹 지시서 발행'}
            </button>
          </div>
        </div>
      )}

      {/* 피킹 지시서 목록 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            AI 피킹 지시서 목록
          </h3>
          <button onClick={fetchInstructions} className="text-xs font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer">
            <RefreshCcw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-400 font-bold">지시서 목록 로딩 중...</div>
        ) : instructions.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 font-bold border border-dashed rounded-xl dark:border-gray-700">
            발행된 피킹 지시서가 없습니다. 상단의 B2B 주문 시뮬레이션 또는 수동 주문 등록으로 시작하세요.
          </div>
        ) : (
          <div className="space-y-2">
            {instructions.map(ins => {
              const meta = STATUS_META[ins.status] || STATUS_META.PENDING;
              const isOpen = expandedId === ins.id;
              const isActive = !['SHIPPED', 'CANCELLED'].includes(ins.status);
              return (
                <div key={ins.id} className={`rounded-xl border transition-all ${
                  isOpen ? 'border-indigo-400 ring-2 ring-indigo-500/15' : 'border-gray-200 dark:border-gray-800'
                }`}>
                  {/* Row Header */}
                  <div
                    onClick={() => setExpandedId(isOpen ? null : ins.id)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-black font-mono shrink-0 ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-black font-mono text-sm text-indigo-900 dark:text-indigo-200">{ins.instruction_no}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold truncate">
                          {ins.customer_name || 'B2B 거래처'} · {ins.items.length}종 {ins.total_items}권
                          {ins.order_total_price != null && ` · ${Number(ins.order_total_price).toLocaleString()}원`}
                          {ins.cj_waybill_no && ` · 송장 ${ins.cj_waybill_no}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-black text-gray-500">
                        피킹 {ins.picked_items}/{ins.total_items}
                      </span>
                      {isActive && (
                        <Link
                          href={`/admin/outbound?instruction=${ins.id}`}
                          onClick={e => e.stopPropagation()}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1"
                          title="출고 최적화 화면에서 이 지시서 도서로 가격/패킹을 진행합니다"
                        >
                          출고 진행 <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 animate-in fade-in duration-200">
                      {(ins.route_summary || ins.worker_note) && (
                        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/50 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-1.5">
                          {ins.route_summary && (
                            <p className="text-xs text-indigo-900 dark:text-indigo-200 font-bold flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600" />
                              <span><strong className="font-black">AI 동선:</strong> {ins.route_summary}</span>
                            </p>
                          )}
                          {ins.worker_note && (
                            <p className="text-xs text-indigo-800 dark:text-indigo-300 flex items-start gap-1.5">
                              <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600" />
                              <span><strong className="font-black">작업 지시:</strong> {ins.worker_note}</span>
                            </p>
                          )}
                          <p className="text-[9px] font-mono text-indigo-400 pt-0.5">{ins.ai_source}</p>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] text-gray-400 font-black uppercase border-b dark:border-gray-800">
                              <th className="py-1.5 pr-2">순서</th>
                              <th className="py-1.5 pr-2">구분</th>
                              <th className="py-1.5 pr-2">도서명</th>
                              <th className="py-1.5 pr-2">바코드 (스캔 키)</th>
                              <th className="py-1.5 pr-2">위치</th>
                              <th className="py-1.5 pr-2 text-right">수량</th>
                              <th className="py-1.5 pr-2 text-right">권당 확정가</th>
                              <th className="py-1.5 text-right">상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ins.items.map(it => (
                              <tr key={it.id} className="border-b dark:border-gray-800/60 last:border-0">
                                <td className="py-2 pr-2 font-mono font-black text-indigo-600">#{it.pick_seq}</td>
                                <td className="py-2 pr-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                    it.is_new ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                  }`}>{it.is_new ? '✨ 신품' : '📦 중고'}</span>
                                </td>
                                <td className="py-2 pr-2 font-bold max-w-[260px] truncate">{it.title}</td>
                                <td className="py-2 pr-2 font-mono text-[10px] text-gray-500">{it.lpn_barcode || it.isbn}</td>
                                <td className="py-2 pr-2 font-mono font-black text-rose-600 dark:text-rose-400">{it.location_label}</td>
                                <td className="py-2 pr-2 text-right font-mono font-black">{it.picked_quantity}/{it.quantity}권</td>
                                <td className="py-2 pr-2 text-right font-mono">{Number(it.unit_price).toLocaleString()}원</td>
                                <td className="py-2 text-right">
                                  <span className={`text-[9px] font-black ${it.status === 'PICKED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {it.status === 'PICKED' ? '✓ 피킹완료' : '⏳ 대기'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
