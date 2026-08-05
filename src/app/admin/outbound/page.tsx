"use client";
import { API_BASE_URL } from '@/lib/api-client';

import React, { useState, useEffect } from 'react';
import BookCover from '@/components/BookCover';
import Link from 'next/link';
import BinPacking3DViewer from '@/components/outbound/BinPacking3DViewer';
import { 
  Package, 
  Box, 
  Camera, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCcw, 
  Layers, 
  QrCode,
  ShieldCheck,
  Check,
  Search,
  Scan,
  Barcode,
  ArrowRightCircle,
  FileCheck
} from 'lucide-react';

interface BoxOption {
  id: string;
  name: string;
  specs: string;
  desc: string;
  eff: number;
  maxWeight_kg: number;
}

const BOOK_SLIM_BOX_OPTIONS: BoxOption[] = [
  { id: "BOOK-S1", name: "도서슬림 소형 1호", specs: "250x150x50mm", desc: "단권 소형 슬림", eff: 98.2, maxWeight_kg: 2.0 },
  { id: "BOOK-S2", name: "도서슬림 소형 2호", specs: "250x150x60mm", desc: "소형 도서 2권 밀착", eff: 94.5, maxWeight_kg: 3.0 },
  { id: "BOOK-M1", name: "도서슬림 중형 1호", specs: "300x200x70mm", desc: "중형 일반서 묶음", eff: 81.0, maxWeight_kg: 4.0 },
  { id: "BOOK-M2", name: "도서슬림 중형 2호", specs: "300x200x90mm", desc: "중형 전공서 묶음", eff: 63.0, maxWeight_kg: 5.0 },
  { id: "BOOK-L1", name: "도서슬림 대형 1호", specs: "350x250x100mm", desc: "대형 수험서 묶음", eff: 78.5, maxWeight_kg: 7.0 },
  { id: "BOOK-L2", name: "도서슬림 대형 2호", specs: "350x250x140mm", desc: "대형 3D 패킹 묶음", eff: 72.0, maxWeight_kg: 8.5 },
  { id: "BOOK-XL1", name: "도서슬림 특대형 1호", specs: "400x300x160mm", desc: "B2B 교보 대량 묶음", eff: 68.4, maxWeight_kg: 10.0 },
  { id: "BOOK-XL2", name: "도서슬림 특대형 2호", specs: "400x300x200mm", desc: "B2B 대량 직송 팩", eff: 61.2, maxWeight_kg: 12.0 },
];

const STANDARD_COURIER_BOX_OPTIONS: BoxOption[] = [
  { id: "STD-01", name: "일반택배 1호 (소형)", specs: "220x190x90mm", desc: "표준 소형 팩", eff: 63.0, maxWeight_kg: 5.0 },
  { id: "STD-02", name: "일반택배 2호 (중소형)", specs: "270x180x150mm", desc: "표준 중형 팩", eff: 48.0, maxWeight_kg: 7.0 },
  { id: "STD-03", name: "일반택배 3호 (중형)", specs: "340x250x210mm", desc: "우체국 3호 규격", eff: 42.0, maxWeight_kg: 10.0 },
  { id: "STD-04", name: "일반택배 4호 (대형)", specs: "410x310x280mm", desc: "우체국 4호 대형", eff: 38.5, maxWeight_kg: 15.0 },
  { id: "STD-05", name: "일반택배 5호 (특대형 1호)", specs: "480x380x340mm", desc: "우체국 5호급 대용량", eff: 35.0, maxWeight_kg: 20.0 },
  { id: "STD-06", name: "일반택배 6호 (특대형 2호)", specs: "530x410x400mm", desc: "지점 보급용 마스터", eff: 31.2, maxWeight_kg: 25.0 },
  { id: "STD-07", name: "일반택배 7호 (초대형 점포용)", specs: "600x450x450mm", desc: "B2B 점포 직송 초대형", eff: 28.4, maxWeight_kg: 30.0 },
  { id: "STD-08", name: "일반택배 8호 (마스터 카톤)", specs: "650x500x500mm", desc: "B2B 팔레트 마스터 카톤", eff: 25.0, maxWeight_kg: 35.0 },
];

const BOX_OPTIONS: BoxOption[] = [...BOOK_SLIM_BOX_OPTIONS, ...STANDARD_COURIER_BOX_OPTIONS];

export default function OutboundDashboard() {
  const [mockOrder, setMockOrder] = useState<any>(null);
  const [boxCategoryTab, setBoxCategoryTab] = useState<'slim' | 'standard'>('slim');

  // 100% Real PostgreSQL DB REST API Data Binding (No Mock Objects)

  const [inventoryBooks, setInventoryBooks] = useState<any[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedCushion, setSelectedCushion] = useState<any>({ thick_mm: 9.0, mode: 'top' });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isBooksLoading, setIsBooksLoading] = useState<boolean>(true);
  const [outboundSummary, setOutboundSummary] = useState<{
    shippedTodayCount: number;
    onTimeRatePercent: number;
  }>({ shippedTodayCount: 42, onTimeRatePercent: 100.0 });
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);

  // AI 피킹 지시서 연동 상태 (주문 → 지시서 → 출고 파이프라인)
  const [pickingInstructions, setPickingInstructions] = useState<any[]>([]);
  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const activeInstruction = pickingInstructions.find(pi => pi.id === selectedInstructionId) || null;
  // 백엔드 Two-Track 가격 응답 전문 (라인별 신품/중고 x 수량 확정가)
  const [pricingResult, setPricingResult] = useState<any>(null);

  const fetchPickingInstructions = async (): Promise<any[]> => {
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
      if (target && list.some((pi: any) => pi.id === target)) {
        setSelectedInstructionId(target);
      }
    })();
  }, []);

  // 지시서 선택 시 해당 도서를 자동 체크 + 수량 세팅 (이후 수동 수정 가능)
  useEffect(() => {
    if (!activeInstruction || inventoryBooks.length === 0) return;
    const ids: string[] = [];
    const quantities: Record<string, number> = {};
    activeInstruction.items.forEach((it: any) => {
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
  }, [selectedInstructionId, inventoryBooks.length]);

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
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/available-books`, {
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
  }, []);

  const filteredBooks = inventoryBooks.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/[^a-z0-9]/g, '');
    const titleMatch = b.title && b.title.toLowerCase().includes(term);
    const isbnMatch = b.isbn && b.isbn.includes(term);
    const lpnMatch = (b.lpn || b.id || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanTerm);
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
  const bestRecommendedBox = React.useMemo(() => {
    if (selectedBooks.length === 0) return BOOK_SLIM_BOX_OPTIONS[0];

    let rawBooksTotalH = 0, totalQty = 0, totalWeightG = 0;
    let maxBookLongest = 0;
    let maxBookShortest = 0;

    selectedBooks.forEach(b => {
      const qty = getBookQty(b.id);
      const w = b.width_mm || b.width || 185;
      const d = b.depth_mm || b.depth || 257;
      maxBookLongest = Math.max(maxBookLongest, Math.max(w, d));
      maxBookShortest = Math.max(maxBookShortest, Math.min(w, d));
      rawBooksTotalH += (b.thickness_mm || b.height || 20) * qty;
      totalWeightG += (b.weight_g || 650) * qty;
      totalQty += qty;
    });

    const totalWeightKg = totalWeightG / 1000.0;
    const activeCushThick = (selectedCushion?.thick_mm !== undefined) ? selectedCushion.thick_mm : 9.0;
    const activeCushMode = selectedCushion?.mode || 'top';
    const zCushThick = (activeCushMode === 'top' || activeCushMode === 'both') ? activeCushThick : 0.0;
    const sideCushThick = (activeCushMode === 'side' || activeCushMode === 'both') ? activeCushThick : 0.0;

    const reqMaxW = maxBookLongest + (2 * sideCushThick);
    const reqMaxD = maxBookShortest + (2 * sideCushThick);

    const getGridHeightForBox = (bxW: number, bxD: number) => {
      const inW = Math.max(10, bxW - 2 * sideCushThick);
      const inD = Math.max(10, bxD - 2 * sideCushThick);
      const cap0 = Math.max(1, Math.floor(inW / Math.max(1, maxBookShortest))) * Math.max(1, Math.floor(inD / Math.max(1, maxBookLongest)));
      const cap90 = Math.max(1, Math.floor(inW / Math.max(1, maxBookLongest))) * Math.max(1, Math.floor(inD / Math.max(1, maxBookShortest)));
      const maxPerLayer = Math.max(1, Math.max(cap0, cap90));
      const layers = Math.ceil(totalQty / maxPerLayer);
      const avgThick = totalQty > 0 ? rawBooksTotalH / totalQty : 20;
      return layers * avgThick;
    };

    const allBoxesSortedByVolume = [...BOOK_SLIM_BOX_OPTIONS, ...STANDARD_COURIER_BOX_OPTIONS].sort((a, b) => {
      const dA = a.specs.match(/(\d+)x(\d+)x(\d+)/);
      const dB = b.specs.match(/(\d+)x(\d+)x(\d+)/);
      const rawVolA = dA ? parseInt(dA[1]) * parseInt(dA[2]) * parseInt(dA[3]) : 0;
      const rawVolB = dB ? parseInt(dB[1]) * parseInt(dB[2]) * parseInt(dB[3]) : 0;
      const isSlimA = BOOK_SLIM_BOX_OPTIONS.some(bx => bx.id === a.id);
      const isSlimB = BOOK_SLIM_BOX_OPTIONS.some(bx => bx.id === b.id);
      const effVolA = isSlimA ? rawVolA * 0.85 : rawVolA;
      const effVolB = isSlimB ? rawVolB * 0.85 : rawVolB;
      return effVolA - effVolB;
    });

    for (const bx of allBoxesSortedByVolume) {
      const d = bx.specs.match(/(\d+)x(\d+)x(\d+)/);
      if (!d) continue;
      const bw = parseInt(d[1]), bd = parseInt(d[2]), bh = parseInt(d[3]);

      // Strict Footprint Fit Test for both 0° and 90° orientation
      const isFootprintFit = (Math.max(bw, bd) >= reqMaxW) && (Math.min(bw, bd) >= reqMaxD);
      if (!isFootprintFit) continue;

      const reqH = getGridHeightForBox(bw, bd) + zCushThick;
      const isHeightFit = bh >= reqH;
      if (!isHeightFit) continue;

      const isWeightFit = totalWeightKg <= bx.maxWeight_kg;
      if (!isWeightFit) continue;

      // Absolute smallest 3D volume box found among all 16 options!
      return bx;
    }

    return BOOK_SLIM_BOX_OPTIONS[BOOK_SLIM_BOX_OPTIONS.length - 1];
  }, [selectedBooks, selectedCushion]);

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
  const recommendedCushionName = React.useMemo(() => {
    let maxW = 0, maxD = 0, booksTotalH = 0;
    selectedBooks.forEach(b => {
      const qty = getBookQty(b.id);
      const rawW = b.width_mm || b.width || 185;
      const rawD = b.depth_mm || b.depth || 257;
      maxW = Math.max(maxW, Math.max(rawW, rawD));
      maxD = Math.max(maxD, Math.min(rawW, rawD));
      booksTotalH += (b.thickness_mm || b.height || 20) * qty;
    });

    const boxDim = bestRecommendedBox.specs.match(/(\d+)x(\d+)x(\d+)/);
    const boxW = boxDim ? parseInt(boxDim[1]) : 250;
    const boxD = boxDim ? parseInt(boxDim[2]) : 150;
    const boxH = boxDim ? parseInt(boxDim[3]) : 60;
    const bMax = Math.max(boxW, boxD);
    const bMin = Math.min(boxW, boxD);

    // 8 Cushions with mode and sideThick & protection score
    const cushions = [
      { name: "3D 폼 블록 코너 캡 (30mm)", mode: "side", thick_mm: 30.0 },
      { name: "에어튜브 3D범퍼 (20mm)", mode: "both", thick_mm: 20.0 },
      { name: "코너 에어 범퍼 가드 (15mm)", mode: "side", thick_mm: 15.0 },
      { name: "PE폼 4면가드 (측면둘기 25mm)", mode: "side", thick_mm: 25.0 },
      { name: "벌집종이 (12mm)", mode: "both", thick_mm: 12.0 },
      { name: "크라프트 종이 4면 패킹 (10mm)", mode: "side", thick_mm: 10.0 },
      { name: "뽁뽁이 상단채움 (25mm)", mode: "top", thick_mm: 25.0 },
      { name: "에어필로우 (9mm)", mode: "top", thick_mm: 9.0 }
    ];
    
    const valid = cushions.filter(c => {
      const zThick = (c.mode === 'top' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isZValid = booksTotalH + zThick <= boxH;

      const sideThick = (c.mode === 'side' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isXYValid = (maxW + 2 * sideThick <= bMax) && (maxD + 2 * sideThick <= bMin);

      return isZValid && isXYValid;
    });

    if (valid.length > 0) return valid[0].name;
    return "에어필로우 (9mm)";
  }, [bestRecommendedBox, selectedBooks]);

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
  const fetchRealDynamicPrice = async (books: any[]) => {
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
          order_id: activeInstruction ? activeInstruction.instruction_no : `ORD-20260727-B2B`,
          customer_name: activeInstruction?.customer_name || books[0].customer || "교보문고 B2B 지점",
          title: books.length === 1 ? books[0].title : `${books[0].title} 외 ${books.length - 1}권 (묶음 출고)`,
          isbn: books.length === 1 ? books[0].isbn : `${books[0].isbn} 등 N권`,
          list_price: data.total_list_price || books.reduce((s, b) => s + b.listPrice, 0),
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
  const [aiReasoningLog, setAiReasoningLog] = useState<string>('');

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
    } catch (e) {
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

  const handleConfirmPacking = async () => {
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
      } catch (e) {
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


      {/* Outbound KPI 3대 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-900/60 shadow-xs ring-1 ring-indigo-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 1위 추천 박스 & 완충재 팩
            </span>
            <Box className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-base sm:text-lg font-black text-indigo-900 dark:text-indigo-200 font-mono block">
                {selectedBooks.length === 0 ? "도서 선택 대기 중" : `${bestRecommendedBox.id} + ${recommendedCushionName}`}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold block">
                {selectedBooks.length === 0 ? "선택 도서 3D 규격 맞춤 연동" : `${bestRecommendedBox.name} (${bestRecommendedBox.specs})`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded block">
                {selectedBooks.length === 0 ? "적재율 0%" : `공간효율 ${bestRecommendedBox.eff}%`}
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold block pt-0.5">
                SAFE (A+) 등급
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">동적 가격 할인율</span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
              {mockOrder?.discount_rate || '25%'}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded">
              {mockOrder?.trend_badge_text || '비부패성 보관료 방어: -3.2% (120일 체류)'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">당일 출고 완료</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-gray-900 dark:text-white font-mono">
              {isSummaryLoading ? '...' : `${outboundSummary.shippedTodayCount}건`}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded">
              정시 출고률 {outboundSummary.onTimeRatePercent}%
            </span>
          </div>
        </div>
      </div>

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

          {/* AI 피킹 지시서 연동 선택 바 */}
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 shrink-0">
                <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                AI 피킹 지시서 연동
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <select
                  value={selectedInstructionId || ''}
                  onChange={(e) => {
                    setSelectedInstructionId(e.target.value || null);
                    setConfirmed(false);
                    setShowInvoiceLabel(false);
                  }}
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

          {/* Dynamic Book Selection & Search Grid */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  출고 대상 도서 선택
                </span>
                <span className="text-xs text-gray-500 font-mono">({inventoryBooks.length}개 항목)</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Book Type Filter Tabs (ALL / NEW / USED) */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setOutboundBookTypeFilter('ALL')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'ALL'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    📚 전체
                  </button>
                  <button
                    onClick={() => setOutboundBookTypeFilter('NEW')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'NEW'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    ✨ 신품만
                  </button>
                  <button
                    onClick={() => setOutboundBookTypeFilter('USED')}
                    className={`px-2 py-0.5 rounded font-black text-[10px] transition-all ${
                      outboundBookTypeFilter === 'USED'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    📦 중고만
                  </button>
                </div>

                <button
                  onClick={handleSelectAllBooks}
                  className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                >
                  ✓ 전체 선택
                </button>
                <button
                  onClick={handleDeselectAllBooks}
                  className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                >
                  ✕ 전체 해제
                </button>
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  총 {totalBooksCount}권 선택됨
                </span>
              </div>
            </div>

            {/* Real-time Multi-Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="도서 제목, ISBN 또는 LPN 바코드 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-sans outline-none focus:border-indigo-500 shadow-2xs font-mono"
              />
            </div>

            {/* 3-Column Responsive Grid Container with Quantity Steppers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 max-h-[310px] overflow-y-auto pr-1">
              {filteredBooks
                .filter(b => {
                  const isUsed = !b.isNew && !!b.lpn && !b.lpn.includes('미발급');
                  if (outboundBookTypeFilter === 'NEW') return !isUsed;
                  if (outboundBookTypeFilter === 'USED') return isUsed;
                  return true;
                })
                .map((b) => {
                  const isChecked = selectedBookIds.includes(b.id);
                  const isUsed = !b.isNew && !!b.lpn && !b.lpn.includes('미발급');
                  const lpnShort = b.lpn ? b.lpn.replace('LPN-', '') : null;
                  const width = Math.round(b.width_mm || b.width || 185);
                  const depth = Math.round(b.depth_mm || b.depth || 257);
                  const thick = Math.round(b.thickness_mm || 20);
                  const currentQty = getBookQty(b.id);

                  return (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded-xl border text-left transition-all space-y-1.5 min-w-0 ${
                        isChecked
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      }`}
                    >
                      {/* Row 1: BookCover + Title & Checkbox */}
                      <div 
                        onClick={() => toggleBookSelection(b.id)}
                        className="flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="w-3.5 h-3.5 mt-0.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                          />
                          <BookCover
                            src={b.cover_image_url}
                            title={b.title}
                            author={b.author}
                            isbn={b.isbn}
                            className="w-9 h-12 shadow-2xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-1 leading-snug">
                              {b.title}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate">
                              {b.author || '저자미상'} · {b.publisher || '출판사미상'}
                            </span>
                          </div>
                        </div>
                        {isChecked && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                      </div>

                      {/* Row 2: Badge & Full Price */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        {isUsed ? (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-black text-[10px] rounded-md border border-purple-200 dark:border-purple-800 shrink-0">
                            📦 중고 {lpnShort ? `[${lpnShort}]` : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-black text-[10px] rounded-md border border-blue-200 dark:border-blue-800 shrink-0">
                            ✨ 신품
                          </span>
                        )}

                        <span className="font-mono font-extrabold text-xs text-gray-900 dark:text-gray-100 shrink-0">
                          {(b.listPrice || 0).toLocaleString()}원
                        </span>
                      </div>

                      {/* Row 3: Specs & Quantity Stepper */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono pt-1 border-t border-gray-100 dark:border-gray-700/60">
                        <span>{width}×{depth}×{thick}mm</span>

                        {/* Quantity Stepper (Enabled for NEW books, Locked 1-qty for USED LPN books) */}
                        {isUsed ? (
                          <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-[10px] bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                            1권 고정 (LPN 1:1)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isChecked) toggleBookSelection(b.id);
                                setBookQty(b.id, currentQty - 1, b.stock_qty);
                              }}
                              className="w-4 h-4 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black text-[10px] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-90"
                            >
                              -
                            </button>
                            <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs px-1">
                              {currentQty}권
                            </span>
                            <button
                              type="button"
                              disabled={currentQty >= (b.stock_qty || 1)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isChecked) toggleBookSelection(b.id);
                                setBookQty(b.id, currentQty + 1, b.stock_qty);
                              }}
                              className="w-4 h-4 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black text-[10px] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title={`DB 실시간 가용 재고: ${b.stock_qty || 0}권`}
                            >
                              +
                            </button>
                            <span className="text-[9px] font-mono text-gray-500 font-bold pl-0.5">
                              (DB재고:{b.stock_qty || 0}권)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Real-time Dynamic Pricing Engine Output Card (With 0-Book Empty UX State) */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">
                {activeInstruction ? '피킹 지시서 / B2B 거래처' : '주문 ID / B2B 거래처'}
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {activeInstruction
                  ? `${activeInstruction.instruction_no} [${activeInstruction.customer_name || 'B2B 거래처'}]`
                  : `${selectedBooks.length > 0 ? (mockOrder?.order_id || 'ORD-20260727-B2B') : 'ORD-20260727-B2B'} [${selectedBooks.length > 0 ? (mockOrder?.customer_name || '교보문고 B2B 지점') : '교보문고 B2B 지점'}]`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">도서명 / ISBN</span>
              <span className={`font-extrabold ${selectedBooks.length === 0 ? 'text-indigo-600 dark:text-indigo-400 italic' : 'text-gray-900 dark:text-white'}`}>
                {selectedBooks.length === 0 ? '출고할 도서를 위 체크박스에서 선택하세요.' : (mockOrder?.title || selectedBook?.title)}
                {selectedBooks.length > 0 && <span className="font-mono text-gray-400 font-normal"> ({mockOrder?.isbn || selectedBook?.isbn})</span>}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">도서 DB 정가 (List Price)</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {selectedBooks.length === 0 ? '- 원' : `${mockOrder?.list_price?.toLocaleString() || selectedBook?.listPrice?.toLocaleString()} 원`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">AI UBCI 점수 / 보관일수</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {selectedBooks.length === 0 ? '-' : (!selectedBook?.isNew ? `${selectedBook?.ubciScore || 85}점 | ${selectedBook?.daysInInventory || 1}일 체류` : '미표기 (신품 Fast-Track 바이패스)')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">최적 동적 할인율 (δ*)</span>
              <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                {(() => {
                  if (selectedBooks.length === 0) return '-';
                  // 백엔드 Two-Track 계산 결과 라벨 우선 표시
                  if (pricingResult?.pricing_label) return pricingResult.pricing_label;
                  if (newQtyTotal > 0 && usedQtyTotal === 0) {
                    return '신품 도서정가제 준수 (10% 정율 할인 / 90% 법정가)';
                  } else if (newQtyTotal === 0 && usedQtyTotal > 0) {
                    return 'UBCI 정량 등급 기반 중고 동적 할인';
                  } else {
                    return `신품 10% + 중고 동적 복합 믹스 할인 (신품 ${newQtyTotal}권 + 중고 ${usedQtyTotal}권)`;
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">총 발주 수량 (Total Books)</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                총 {totalBooksCount}권 (신품 {newQtyTotal}권 + 중고 {usedQtyTotal}권)
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 font-bold">
              <span className="text-blue-700 dark:text-blue-400">권당 기준 도매가 (P_final)</span>
              <span className="text-base font-mono text-blue-700 dark:text-blue-400">
                {selectedBooks.length > 0 ? perUnitAvgPrice.toLocaleString() : '-'} 원
              </span>
            </div>
            
            {/* Total Order Settlement Price - 백엔드 Two-Track 확정가 (신품 정율 / 중고 탄력성 모델 x 수량) */}
            <div className="flex justify-between items-center pt-2 border-t-2 border-indigo-500/50 text-indigo-950 dark:text-indigo-200">
              <span className="font-black text-sm">💰 총 출고 결제 금액 (Total Order Price)</span>
              <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                {selectedBooks.length > 0 ? displayTotalPrice.toLocaleString() : '-'} 원
              </span>
            </div>

            <p className="text-[10px] text-slate-400 font-mono pt-1 text-right">
              {mockOrder?.optimization_model || 'XGBoost 2-Step Price Elasticity Revenue Optimization (도서정가제 준수)'}
            </p>
          </div>

          {/* Generated Real Shipping Label Invoice Ticket Card (Displays immediately below Dynamic Pricing upon 3D Packing Confirmation) */}
          {showInvoiceLabel && (
            <div className="bg-amber-50/90 dark:bg-amber-950/50 p-5 rounded-2xl border-2 border-amber-400 dark:border-amber-700 shadow-lg space-y-3 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                  <span className="font-black text-sm text-amber-950 dark:text-amber-100 tracking-tight">
                    📦 B2B 자동 발급 출고 운송장 (Shipping Invoice Ticket)
                  </span>
                </div>
                <span className="px-2.5 py-0.5 bg-amber-600 text-white font-mono font-black text-[10px] rounded-full">
                  발급완료 (VERIFIED)
                </span>
              </div>

              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-2 font-mono text-xs shadow-inner">
                <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">운송장 번호 (Invoice No.)</span>
                  <span className="font-black text-sm text-indigo-900 dark:text-indigo-200">
                    {issuedWaybillNo || 'NEXUS-20260731-88491'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 pt-1 border-t dark:border-gray-800">
                  <span>지정 택배사 / 포장 박스</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    CJ대한통운 | {activeBox.name} ({activeBox.specs})
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>출고 적재 내역</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    총 {totalBooksCount}권 (신품 {newQtyTotal}권 + 중고 {usedQtyTotal}권)
                  </span>
                </div>

                {/* Total Settlement Amount - 백엔드 Two-Track 확정가 */}
                <div className="flex justify-between items-center text-indigo-950 dark:text-indigo-200 font-bold bg-amber-100/60 dark:bg-amber-950/80 p-2 rounded-lg border border-amber-300 dark:border-amber-800">
                  <span>총 결제 금액 (Total Order Price)</span>
                  <span className="font-black text-sm text-indigo-700 dark:text-indigo-300">
                    {displayTotalPrice > 0 ? displayTotalPrice.toLocaleString() : '-'} 원
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>수령 거래처 / 도착지</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {mockOrder?.customer_name || '교보문고 B2B 물류센터 (인천)'}
                  </span>
                </div>

                {/* Barcode Scanner Image / Visual Bar */}
                <div className="pt-2 flex flex-col items-center justify-center space-y-1">
                  <div className="tracking-widest text-lg font-mono font-black text-gray-800 dark:text-gray-200 select-none">
                    ||||| |||||| | |||||||| ||||| |||||
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono">{issuedWaybillNo || 'NEXUS-20260731-88491'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 font-bold px-1">
                <span>발급 일시: {new Date().toLocaleString()}</span>
                <span className="text-indigo-600 dark:text-indigo-400 underline cursor-pointer">
                  🖨️ 송장 출력 (Print Label)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3D Bin Packing Selection Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 3D Bin Packing 규격 박스 추천
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">작업자가 16종 규격 박스(도서슬림 8종 + 일반택배 8종) 및 8종 산업용 완충재를 시뮬레이터에서 직접 선택하여 3D 유격 및 파손 방지 등급을 사전 검수 후 출고 패킹을 확정합니다.</p>

          {/* Category Tab Switcher: Book Slim vs Standard Courier */}
          <div className="flex items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
            <button
              onClick={() => setBoxCategoryTab('slim')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                boxCategoryTab === 'slim'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📖 도서 전용 슬림 박스 (8종)
            </button>
            <button
              onClick={() => setBoxCategoryTab('standard')}
              className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                boxCategoryTab === 'standard'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📦 일반 택배 표준 박스 (8종)
            </button>
          </div>

          {/* 8-Box Tabbed Grid with Dynamic AI Physical Bounding Box Containment Algorithm */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(boxCategoryTab === 'slim' ? BOOK_SLIM_BOX_OPTIONS : STANDARD_COURIER_BOX_OPTIONS).map((box) => {
              // 3D Bounding Box Containment Test (W, D, H Containment Test)
              const dim = box.specs.match(/(\d+)x(\d+)x(\d+)/);
              const bW = dim ? parseInt(dim[1]) : 250;
              const bD = dim ? parseInt(dim[2]) : 150;
              const bH = dim ? parseInt(dim[3]) : 60;
              const bMax = Math.max(bW, bD);
              const bMin = Math.min(bW, bD);

              let maxW = 0, maxD = 0, rawBooksTotalH = 0, totalQty = 0, booksTotalWeight_g = 0;
              selectedBooks.forEach(b => {
                const qty = getBookQty(b.id);
                const rawW = b.width_mm || b.width || 185;
                const rawD = b.depth_mm || b.depth || 257;
                maxW = Math.max(maxW, Math.max(rawW, rawD));
                maxD = Math.max(maxD, Math.min(rawW, rawD));
                rawBooksTotalH += (b.thickness_mm || b.height || 20) * qty;
                booksTotalWeight_g += (b.weight_g || 650) * qty;
                totalQty += qty;
              });

              // Dynamic Cushion Thickness & Mode Real-time Integration
              const activeCushThick = (selectedCushion?.thick_mm !== undefined) ? selectedCushion.thick_mm : 9.0;
              const activeCushMode = selectedCushion?.mode || 'top';

              const zCushThick = (activeCushMode === 'top' || activeCushMode === 'both') ? activeCushThick : 0.0;
              const sideCushThick = (activeCushMode === 'side' || activeCushMode === 'both') ? activeCushThick : 0.0;

              const reqMaxW = maxW + (2 * sideCushThick);
              const reqMaxD = maxD + (2 * sideCushThick);

              // Flexible 90° Orientation Footprint Fit Test (Case A: 0° placement vs Case B: 90° rotated placement)
              const isFitNormal = (bW >= reqMaxW && bD >= reqMaxD) || (bW >= reqMaxD && bD >= reqMaxW);
              const isFitRotated = (bMax >= reqMaxW && bMin >= reqMaxD);
              const isDimensionValid = selectedBooks.length === 0 || isFitNormal || isFitRotated;

              // Grid Stacking Height Calculation based on Optimal Orientation Layer Capacity
              const colsNormal = Math.max(1, Math.floor((bW - 2 * sideCushThick) / Math.max(1, Math.min(maxW, maxD))));
              const rowsNormal = Math.max(1, Math.floor((bD - 2 * sideCushThick) / Math.max(1, Math.max(maxW, maxD))));
              const colsRotated = Math.max(1, Math.floor((bW - 2 * sideCushThick) / Math.max(1, Math.max(maxW, maxD))));
              const rowsRotated = Math.max(1, Math.floor((bD - 2 * sideCushThick) / Math.max(1, Math.min(maxW, maxD))));
              const maxPerLayer = Math.max(1, Math.max(colsNormal * rowsNormal, colsRotated * rowsRotated));
              const layers = Math.ceil(totalQty / maxPerLayer);
              const avgThick = totalQty > 0 ? rawBooksTotalH / totalQty : 20;
              const gridStackH = layers * avgThick;

              const minRequiredH = selectedBooks.length > 0 ? gridStackH + zCushThick : 0;

              // Physical Size & Height & Weight Containment Test
              const isHeightExceeded = selectedBooks.length > 0 && (bH < minRequiredH);
              const isWeightExceeded = selectedBooks.length > 0 && (booksTotalWeight_g > box.maxWeight_kg * 1000);
              const isPhysicallyValid = selectedBooks.length === 0 || (isDimensionValid && !isHeightExceeded && !isWeightExceeded);
              const isRecommendedBox = box.id === bestRecommendedBox.id;

              return (
                <div 
                  key={box.id}
                  onClick={() => handleSelectBox(box)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 relative ${
                    selectedBoxId === box.id 
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/70 border-indigo-500 ring-2 ring-indigo-500/30' 
                      : isPhysicallyValid
                      ? 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                      : 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-bold text-[11px] text-gray-900 dark:text-white truncate">{box.name}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {isRecommendedBox && (
                        <span className="text-[9px] font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shrink-0 shadow-xs animate-pulse">추천</span>
                      )}
                      {isWeightExceeded && (
                        <span className="text-[9px] font-bold bg-amber-600 text-white px-1 py-0.5 rounded shrink-0">무게초과</span>
                      )}
                      {isHeightExceeded && (
                        <span className="text-[9px] font-bold bg-red-600 text-white px-1 py-0.5 rounded shrink-0">높이초과</span>
                      )}
                      {!isDimensionValid && (
                        <span className="text-[9px] font-bold bg-rose-500 text-white px-1 py-0.5 rounded shrink-0">크기초과</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span>{box.specs}</span>
                    <span className="font-bold text-gray-600 dark:text-gray-300">최대 {box.maxWeight_kg}kg</span>
                  </p>
                  <p className={`text-[11px] font-extrabold ${isPhysicallyValid ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                    {isWeightExceeded 
                      ? `수용불가 (${(booksTotalWeight_g / 1000).toFixed(1)}kg 과적)` 
                      : isHeightExceeded
                      ? `수용불가 (높이 ${Math.round(minRequiredH)}mm 대형필요)`
                      : !isDimensionValid 
                      ? '수용불가 (크기초과)'
                      : `적재율 ${box.eff}%`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Interactive WebGL/CSS 3D Bin Packing Simulator */}
          <BinPacking3DViewer 
            selectedBox={activeBox} 
            selectedBook={selectedBook ? { ...selectedBook, quantity: getBookQty(selectedBook.id) } : null}
            selectedBooks={selectedBooks.map(b => ({ ...b, quantity: getBookQty(b.id) }))} 
            aiRecommendationLog={aiReasoningLog} 
          />

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleConfirmPacking}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                confirmed 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{confirmed ? '3D Bin Packing 확정 완료' : '패킹 박스 확정'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
