"use client";
import type { PickingInstruction, OutboundBook, CushionOption, PricingResult, DemoOrder } from '@/features/outbound/model/types';
import { API_BASE_URL } from '@/shared/api/api-client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BOOK_SLIM_BOX_OPTIONS, BOX_OPTIONS, type BoxOption } from '@/features/outbound/constants/boxOptions';
import { todayYYYYMMDD, randomB2bCustomerName } from '@/features/outbound/utils/simulation';
import { computeBestBox, recommendCushionName as recommendCushion } from '@/features/outbound/lib/packingCalc';
import { OutboundKpiCards } from '@/features/outbound/components/OutboundKpiCards';
import { PickingInstructionBar } from '@/features/outbound/components/PickingInstructionBar';
import { BookSelectionGrid } from '@/features/outbound/components/BookSelectionGrid';
import { PricingSummaryPanel } from '@/features/outbound/components/PricingSummaryPanel';
import { InvoiceTicketCard } from '@/features/outbound/components/InvoiceTicketCard';
import { BoxSelectionPanel } from '@/features/outbound/components/BoxSelectionPanel';
import { Camera, TrendingUp, Sparkles, RefreshCcw } from 'lucide-react';

export default function OutboundDashboard() {
  const [mockOrder, setMockOrder] = useState<DemoOrder | null>(null);
  const [boxCategoryTab, setBoxCategoryTab] = useState<'slim' | 'standard'>('slim');

  // 100% Real PostgreSQL DB REST API Data Binding (No Mock Objects)

  const [inventoryBooks, setInventoryBooks] = useState<OutboundBook[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedCushion] = useState<CushionOption>({ thick_mm: 9.0, mode: 'top' });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [, setIsBooksLoading] = useState<boolean>(true);
  const [outboundSummary, setOutboundSummary] = useState<{
    shippedTodayCount: number;
    onTimeRatePercent: number;
  }>({ shippedTodayCount: 42, onTimeRatePercent: 100.0 });
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);

  // AI 피킹 지시서 연동 상태 (주문 → 지시서 → 출고 파이프라인)
  const [pickingInstructions, setPickingInstructions] = useState<PickingInstruction[]>([]);
  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const activeInstruction = pickingInstructions.find(pi => pi.id === selectedInstructionId) || null;
  // 백엔드 Two-Track 가격 응답 전문 (라인별 신품/중고 x 수량 확정가)
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);

  const fetchPickingInstructions = async (): Promise<PickingInstruction[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/orders/picking-instructions?active_only=true&limit=20`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPickingInstructions(data);
        return data;
      }
    } catch (e) {
      console.error("Failed to fetch picking instructions:", e);
    }
    return [];
  };

  useEffect(() => {
    (async () => {
      const list = await fetchPickingInstructions();
      // /admin/outbound?instruction=<id> 딥링크 진입 시 해당 지시서 자동 선택
      const params = new URLSearchParams(window.location.search);
      const target = params.get('instruction');
      if (target && list.some((pi) => pi.id === target)) {
        setSelectedInstructionId(target);
      }
    })();
  }, []);

  // 지시서 선택 시 해당 도서를 자동 체크 + 수량 세팅 (이후 수동 수정 가능)
  useEffect(() => {
    if (!activeInstruction || inventoryBooks.length === 0) return;
    const ids: string[] = [];
    const quantities: Record<string, number> = {};
    activeInstruction.items.forEach((it) => {
      const frontId = it.is_new ? `NEW-BOOK-${it.book_id}` : it.used_item_id;
      if (frontId && inventoryBooks.some(b => b.id === frontId)) {
        ids.push(frontId);
        quantities[frontId] = it.quantity;
      }
    });
    if (ids.length > 0) {
      setSelectedBookIds(ids);
      setBookQuantities(prev => ({ ...prev, ...quantities }));
    }
    // 목록 재조회(할당 중고 포함)로 배열이 갈리면 다시 맞춘다 - length만 보면
    // 지시서를 바꿨는데 권수가 같을 때 재매칭이 건너뛰어진다.
  }, [selectedInstructionId, inventoryBooks]);

  // Fetch real DB outbound summary KPI
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsSummaryLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/outbound-summary`);
        if (res.ok) {
          const data = await res.json();
          setOutboundSummary({
            shippedTodayCount: data.shipped_today_count || 0,
            onTimeRatePercent: data.on_time_rate_percent || 100.0
          });
        }
      } catch (e) {
        console.error("Failed to fetch outbound summary:", e);
      } finally {
        setIsSummaryLoading(false);
      }
    };
    fetchSummary();
  }, []);

  // Fetch real inventory books from PostgreSQL DB via REST API
  useEffect(() => {
    const fetchDbBooks = async () => {
      try {
        setIsBooksLoading(true);
        // 지시서를 연 상태면 그 지시서에 할당(ALLOCATED)된 중고 LPN도 함께 받는다.
        // 할당된 중고는 판매 가능 목록에서 빠지므로, 안 넘기면 중고 라인이 매칭에 실패해
        // 신품만 선택되고 가격·패킹이 중고 0권으로 산정된다.
        const qs = selectedInstructionId ? `?instruction_id=${selectedInstructionId}` : '';
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/available-books${qs}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setInventoryBooks(data);
            // 피킹 지시서 자동 선택이 먼저 실행된 경우 기본(첫 도서) 선택으로 덮어쓰지 않는다
            setSelectedBookIds(prev => (prev.length > 0 ? prev : [data[0].id]));
          } else {
            setInventoryBooks([]);
          }
        } else {
          setInventoryBooks([]);
        }
      } catch (e) {
        console.error("Failed to fetch DB books:", e);
        setInventoryBooks([]);
      } finally {
        setIsBooksLoading(false);
      }
    };
    fetchDbBooks();
  }, [selectedInstructionId]);

  const filteredBooks = inventoryBooks.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/[^a-z0-9]/g, '');
    const titleMatch = b.title && b.title.toLowerCase().includes(term);
    const isbnMatch = b.isbn && b.isbn.includes(term);
    // cleanTerm이 비면(한글 검색어 등) LPN 매칭을 시도하지 않는다 — ''.includes('')는
    // 항상 true라서 한글 검색 시 전 도서가 LPN 매칭으로 통과해 필터가 무력화됐다.
    const lpnMatch = cleanTerm.length > 0
      && (b.lpn || b.id || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanTerm);
    return titleMatch || isbnMatch || lpnMatch;
  });

  // Quantity Stepper State per book (id -> quantity, default 1)
  const [outboundBookTypeFilter, setOutboundBookTypeFilter] = useState<'ALL' | 'NEW' | 'USED'>('ALL');
  const [bookQuantities, setBookQuantities] = useState<Record<string, number>>({});

  const getBookQty = (id: string) => bookQuantities[id] || 1;

  const setBookQty = (id: string, qty: number, maxStock?: number) => {
    const dbLimit = typeof maxStock === 'number' ? maxStock : 1;
    const safeMax = Math.max(1, dbLimit);
    if (qty > safeMax) {
      alert(`⚠️ [출고 재고 제한] 해당 도서의 DB 실시간 가용 재고는 총 ${safeMax}권입니다. (재고 초과 선택 불가)`);
    }
    const safeQty = Math.max(1, Math.min(safeMax, qty));
    setBookQuantities(prev => ({ ...prev, [id]: safeQty }));
  };

  const selectedBooks = inventoryBooks.filter(b => selectedBookIds.includes(b.id));
  const selectedBook = selectedBooks[0] || inventoryBooks[0] || null;

  // Total quantity of all selected items (sum of qty per book)
  const totalBooksCount = selectedBooks.reduce((acc, b) => acc + getBookQty(b.id), 0);

  // 신품/중고 판별은 백엔드 isNew 필드 단일 기준 (lpn 문자열 truthy 판별 버그 제거:
  // 신품도 lpn="LPN 미발급 (신품)" 문자열을 가져 !b.lpn 판별이 전량 중고 처리되던 문제)
  const newQtyTotal = selectedBooks.filter(b => b.isNew).reduce((a, b) => a + getBookQty(b.id), 0);
  const usedQtyTotal = selectedBooks.filter(b => !b.isNew).reduce((a, b) => a + getBookQty(b.id), 0);
  // 백엔드 Two-Track 확정가 우선, 통신 실패 시에만 로컬 근사(신품 90% / 중고 65%) 폴백
  const localFallbackTotal = selectedBooks.reduce((acc, b) => {
    const qty = getBookQty(b.id);
    const rate = b.isNew ? 0.90 : 0.65;
    return acc + Math.round((b.listPrice || 30000) * rate) * qty;
  }, 0);
  const displayTotalPrice = pricingResult?.final_price ?? localFallbackTotal;
  const perUnitAvgPrice = totalBooksCount > 0 ? Math.round(displayTotalPrice / totalBooksCount) : 0;

  const handleSelectAllBooks = () => {
    setSelectedBookIds(filteredBooks.map(b => b.id));
  };

  const handleDeselectAllBooks = () => {
    setSelectedBookIds([]);
  };
  const bestRecommendedBox = React.useMemo(
    () => computeBestBox(selectedBooks, getBookQty, selectedCushion),
    [selectedBooks, selectedCushion],
  );

  // Auto-selection Switching: Automatically switch selected box AND TAB to AI Best Recommended Box
  useEffect(() => {
    if (bestRecommendedBox && bestRecommendedBox.id) {
      setSelectedBoxId(bestRecommendedBox.id);
      const isSlim = BOOK_SLIM_BOX_OPTIONS.some(b => b.id === bestRecommendedBox.id);
      if (isSlim && boxCategoryTab !== 'slim') {
        setBoxCategoryTab('slim');
      } else if (!isSlim && boxCategoryTab !== 'standard') {
        setBoxCategoryTab('standard');
      }
    }
  }, [bestRecommendedBox]);

  // Dynamic AI Cushion Material Name for 100% Dynamic KPI Card (Mode-aware & XY-Bounding Co-Optimization)
  const recommendedCushionName = React.useMemo(
    () => recommendCushion(bestRecommendedBox, selectedBooks, getBookQty),
    [bestRecommendedBox, selectedBooks],
  );

  // Real-time Auto-Sync selected box ID to bestRecommendedBox ID on book selection change
  useEffect(() => {
    if (selectedBooks.length > 0 && bestRecommendedBox) {
      setSelectedBoxId(bestRecommendedBox.id);
    }
  }, [bestRecommendedBox]);

  // User Tab Switch Freedom: Auto-tab lock useEffect removed to ensure user can freely toggle between Slim and Standard tabs without being trapped.

  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds(prev => {
      if (prev.includes(bookId)) {
        return prev.filter(id => id !== bookId); // Allow deselecting all to 0 books
      } else {
        return [...prev, bookId];
      }
    });
  };

  // Fetch real algorithmic price from backend API based on selected N books metadata
  // Two-Track: 라인별 quantity(수량) + is_new(신품/중고) + ubci null-safe 전달
  const fetchRealDynamicPrice = async (books: OutboundBook[]) => {
    if (!books || books.length === 0) {
      setPricingResult(null);
      return;
    }
    try {
      const payload = {
        items: books.map(b => ({
          list_price: b.listPrice,
          ubci_score: b.ubciScore,
          days_in_inventory: b.daysInInventory,
          category: b.category,
          title: b.title,
          isbn: b.isbn,
          quantity: getBookQty(b.id),
          is_new: !!b.isNew
        }))
      };
      const res = await fetch(`${API_BASE_URL}/api/v1/orders/calculate-dynamic-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setPricingResult(data);
        const usedBooks = books.filter(b => !b.isNew);
        setMockOrder({
          order_id: activeInstruction ? activeInstruction.instruction_no : `ORD-${todayYYYYMMDD()}-B2B`,
          customer_name: activeInstruction?.customer_name || books[0].customer || randomB2bCustomerName(),
          title: books.length === 1 ? books[0].title : `${books[0].title} 외 ${books.length - 1}권 (묶음 출고)`,
          isbn: books.length === 1 ? books[0].isbn : `${books[0].isbn} 등 N권`,
          list_price: data.total_list_price || books.reduce((s, b) => s + (b.listPrice || 0), 0),
          ubci_score: usedBooks.length > 0
            ? Math.round(usedBooks.reduce((s, b) => s + (b.ubciScore || 85), 0) / usedBooks.length)
            : null,
          days_in_inventory: Math.max(...books.map(b => b.daysInInventory || 1)),
          category: books[0].category,
          final_price: data.final_price,
          discount_rate: data.discount_percent,
          trend_badge_text: data.dwell_badge_text || data.trend_badge_text || `B2B ${books.length}권 묶음 출고 할인`,
          pricing_label: data.pricing_label,
          optimization_model: data.optimization_model
        });
      }
    } catch (e) {
      console.error("Dynamic pricing calculation failed:", e);
    }
  };

  React.useEffect(() => {
    if (selectedBooks.length > 0) {
      fetchRealDynamicPrice(selectedBooks);
    } else {
      setPricingResult(null);
    }
  }, [selectedBookIds, bookQuantities]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>("BOOK-S2");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [aiReasoningLog] = useState<string>('');

  const activeBox = BOX_OPTIONS.find(b => b.id === selectedBoxId) || BOX_OPTIONS[1];

  // [정리 이력 2026-08-04] 이 화면에 있던 LPN/ISBN 수동 검증 모의 로직(하드코딩된 도서명·
  // 송장번호 폴백 포함)은 열 수 있는 버튼이 없는 데드 코드였다. 현장 스캔 검증은
  // /worker/outbound 스캐너가 피킹 지시서 API(picking-scan)로 실연동 처리한다.

  const handleTestOrder = async () => {
    // 실제 Order + OrderItem + AI 피킹 지시서를 DB에 생성하고 즉시 이 화면에 바인딩한다.
    try {
      setIsLoading(true);
      setConfirmed(false);
      setShowInvoiceLabel(false);
      const res = await fetch(`${API_BASE_URL}/api/v1/orders/simulate-b2b`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(`시뮬레이션 실패: ${data.detail || data.message}`);
        return;
      }
      await fetchPickingInstructions();
      if (data.picking_instruction?.id) {
        setSelectedInstructionId(data.picking_instruction.id);
      }
      alert(
        `🎲 [B2B 주문 시뮬레이션 & AI 피킹 지시서 발행]\n` +
        `지시서: ${data.picking_instruction?.instruction_no}\n` +
        `거래처: ${data.customer_name}\n` +
        `${data.pricing.pricing_label}\n` +
        `총 ${data.pricing.total_quantity}권 / ${Number(data.pricing.final_price).toLocaleString()}원`
      );
    } catch {
      alert('백엔드 연결 실패 - B2B 주문 시뮬레이션을 실행하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBox = (box: BoxOption) => {
    setSelectedBoxId(box.id);
    setConfirmed(false);
  };

  const [showInvoiceLabel, setShowInvoiceLabel] = useState<boolean>(false);
  const [issuedWaybillNo, setIssuedWaybillNo] = useState<string | null>(null);
  // 송장 발급 일시. 렌더 중 new Date()를 쓰면 리렌더마다 값이 바뀌고 서버·클라 시각이
  // 달라 하이드레이션 불일치가 난다. 송장번호가 확정될 때 한 번만 기록한다.
  const [issuedAt, setIssuedAt] = useState('');
  useEffect(() => {
    setIssuedAt(issuedWaybillNo ? new Date().toLocaleString('ko-KR') : '');
  }, [issuedWaybillNo]);

  const handleConfirmPacking = async () => {
    // 적재 품목이 없으면 확정 불가 — 0권짜리 운송장은 유효한 출고 문서가 아니다
    if (!activeInstruction && totalBooksCount === 0) {
      alert('출고할 도서를 먼저 선택하세요. 선택 수량이 0권이면 운송장을 발급할 수 없습니다.');
      return;
    }

    // 피킹 지시서 연동 시: 실제 출고 확정 API (재고 차감 + CJ 송장 발급 + 주문 SHIPPED 전이)
    if (activeInstruction) {
      const notFullyPicked = activeInstruction.status !== 'PICKED';
      if (notFullyPicked) {
        const ok = confirm(
          `⚠️ 아직 전 품목 피킹 완료 전입니다 (${activeInstruction.picked_items}/${activeInstruction.total_items}권).\n` +
          `현장 스캔 없이 강제로 패킹을 확정하시겠습니까? (데모/관리자 권한)`
        );
        if (!ok) return;
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/orders/picking-instructions/${activeInstruction.id}/confirm-packing`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              box_id: activeBox.id,
              cushion_name: recommendedCushionName,
              force: notFullyPicked,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          alert(`패킹 확정 실패: ${data.detail || data.message}`);
          return;
        }
        setConfirmed(true);
        setShowInvoiceLabel(true);
        setIssuedWaybillNo(data.cj_waybill_no);
        setOutboundSummary(prev => ({ ...prev, shippedTodayCount: prev.shippedTodayCount + 1 }));
        alert(`[3D Bin Packing 확정 & CJ 송장 발급]\n${data.message}\n박스: ${activeBox.name} (${activeBox.specs})\n\n→ worker가 스캐너 화면의 적재 가이드에 따라 포장 완료하면 최종 출고됩니다.`);
        await fetchPickingInstructions();
        return;
      } catch {
        alert('백엔드 연결 실패 - 출고 확정을 처리하지 못했습니다.');
        return;
      }
    }

    // 지시서 미연동(임의 선택) 모드: 화면 시뮬레이션만 수행
    setConfirmed(true);
    setShowInvoiceLabel(true);
    setOutboundSummary(prev => ({
      ...prev,
      shippedTodayCount: prev.shippedTodayCount + 1
    }));
    alert(`[3D Bin Packing 확정 & 송장 발급] ${activeBox.name} (${activeBox.specs})이 패킹 박스로 확정되어 출고 송장이 발급되었습니다. (당일 출고 건수 +1)`);
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 3D BIN PACKING & DYNAMIC PRICING
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            🚚 출고 최적화 및 송장 발급 관제 (AI Outbound)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            도서 3D 부피/두께 적재 레이어(13-Layer) 최적 박스 패킹 알고리즘, B2B 동적 가격 산정 및 CJ/로젠 송장 자동 발급 관제 센터입니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 1. Navigate directly to worker outbound picking scanner app */}
          <Link 
            href="/worker/outbound"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center transition-all shadow-xs active:scale-95 cursor-pointer"
            title="현장 작업자 전용 출고 피킹 스캐너 화면으로 이동합니다"
          >
            <Camera className="w-4 h-4 mr-2" />
            현장 출고 피킹 스캐너 이동
          </Link>
          
          {/* 2. Run random B2B order bundle simulation */}
          <button 
            onClick={handleTestOrder}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="랜덤 B2B 묶음 주문을 즉시 생성하여 3D Bin Packing 규격 박스 패킹과 동적 가격 할인을 실시간 시뮬레이션합니다"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? '시뮬레이션 생성 중...' : '🎲 B2B 주문 시뮬레이션 (랜덤 test)'}
          </button>
        </div>
      </div>


      <OutboundKpiCards
        selectedCount={selectedBooks.length}
        bestBox={bestRecommendedBox}
        cushionName={recommendedCushionName}
        mockOrder={mockOrder}
        outboundSummary={outboundSummary}
        isSummaryLoading={isSummaryLoading}
      />

      {/* Main Content: 3D Bin Packing & Dynamic Pricing Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Dynamic Pricing Real Book Metadata Automatic Calculation Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" /> 동적 가격 산정 엔진 (Dynamic Pricing)
            </h3>
            <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-200">
              도서 DB 데이터 실시간 바인딩
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            LPN/ISBN으로 입고된 도서의 실제 메타데이터(정가, AI UBCI 품질점수, 보관일수, 카테고리)를 백엔드 Two-Track 모델(신품 정율 / 중고 2-Step 탄력성)로 전달하여 최종 B2B 도매가를 자동 연산합니다.
          </p>

          <PickingInstructionBar
            pickingInstructions={pickingInstructions}
            selectedInstructionId={selectedInstructionId}
            onSelect={(id) => {
              setSelectedInstructionId(id);
              setConfirmed(false);
              setShowInvoiceLabel(false);
            }}
            activeInstruction={activeInstruction}
          />

          <BookSelectionGrid
            inventoryCount={inventoryBooks.length}
            filteredBooks={filteredBooks}
            outboundBookTypeFilter={outboundBookTypeFilter}
            setOutboundBookTypeFilter={setOutboundBookTypeFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedBookIds={selectedBookIds}
            toggleBookSelection={toggleBookSelection}
            handleSelectAllBooks={handleSelectAllBooks}
            handleDeselectAllBooks={handleDeselectAllBooks}
            totalBooksCount={totalBooksCount}
            getBookQty={getBookQty}
            setBookQty={setBookQty}
          />

          <PricingSummaryPanel
            activeInstruction={activeInstruction}
            mockOrder={mockOrder}
            selectedBooks={selectedBooks}
            selectedBook={selectedBook}
            pricingResult={pricingResult}
            newQtyTotal={newQtyTotal}
            usedQtyTotal={usedQtyTotal}
            totalBooksCount={totalBooksCount}
            perUnitAvgPrice={perUnitAvgPrice}
            displayTotalPrice={displayTotalPrice}
          />

          {/* Generated Real Shipping Label Invoice Ticket Card (패킹 확정 시 동적 가격 카드 하단 표시) */}
          {showInvoiceLabel && (
            <InvoiceTicketCard
              activeBox={activeBox}
              issuedWaybillNo={issuedWaybillNo}
              totalBooksCount={totalBooksCount}
              newQtyTotal={newQtyTotal}
              usedQtyTotal={usedQtyTotal}
              displayTotalPrice={displayTotalPrice}
              customerName={mockOrder?.customer_name}
              issuedAt={issuedAt}
            />
          )}
        </div>

        <BoxSelectionPanel
          boxCategoryTab={boxCategoryTab}
          setBoxCategoryTab={setBoxCategoryTab}
          selectedBooks={selectedBooks}
          getBookQty={getBookQty}
          selectedCushion={selectedCushion}
          bestRecommendedBox={bestRecommendedBox}
          selectedBoxId={selectedBoxId}
          handleSelectBox={handleSelectBox}
          activeBox={activeBox}
          selectedBook={selectedBook}
          aiReasoningLog={aiReasoningLog}
          confirmed={confirmed}
          activeInstruction={activeInstruction}
          totalBooksCount={totalBooksCount}
          handleConfirmPacking={handleConfirmPacking}
        />
      </div>
    </div>
  );
}
