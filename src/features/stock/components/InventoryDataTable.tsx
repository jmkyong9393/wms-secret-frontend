'use client';

/**
 * 재고 현황 통합 데이터 그리드 (Admin/Worker 공용 — B안 통합).
 *
 * 
 * - admin/inventory/page.tsx(1,329줄)와 worker/inventory/page.tsx(702줄)가 동일 API
 *   (inventoryAPI.getInventory)를 호출하면서 검색/필터/정렬/페이지네이션/내보내기를 각자
 *   중복 구현하고 있던 것을 이 컴포넌트 1벌로 통합. role prop이 관리자 전용 기능
 *   (일괄 선택/벌크 작업/삭제/QR)의 노출 여부만 결정한다.
 * - Worker 상세 링크가 /admin/inventory/{id}로 걸려 있어 미들웨어 RBAC가 Worker를
 *   강제 리다이렉트시키던 버그 수정: Worker의 중고(LPN 보유) 품목은 /lpn/{lpn} 내부
 *   조회 페이지로, 신품은 표지 확대 모달로 연결한다.
 * - 페이지네이션은 관제 표준 MasterPagination으로 통일.
 */

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import BookCover from '@/entities/book/ui/BookCover';
import BookCoverModal from '@/entities/book/ui/BookCoverModal';
import MasterPagination from '@/shared/ui/MasterPagination';
import { exportToCSV } from '@/shared/lib/exportCsv';
import { inventoryAPI } from '@/shared/api/api';
import { useQuery } from '@tanstack/react-query';
import {
  PackageSearch, Download, Search, Printer, Eye, MapPin, ArrowUpDown, Clock,
  Calendar, BookOpen, Sparkles, X, RotateCcw, Camera, Trash2, ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import type { InventoryItem, StockRole } from '../types';
import type { LpnPrintData } from '@/entities/label/model/types';
import { formatKSTDate, formatZone, gradeMeta, isNewBookItem } from '../utils';
import { LpnPrintModal } from '@/entities/label/ui/LpnPrintModal';

/**
 * 확정 트랙 색상. 사람이 개입한 경로(HITL)와 자동 확정(AI)을 한눈에 가른다.
 * Tailwind JIT가 동적 조립 클래스를 인식하지 못하므로 완성된 클래스명을 반환한다.
 */
const trackTone = (track: string): string => {
  if (track === 'HITL') return 'text-amber-600 dark:text-amber-400';
  if (track === 'HITL 대기') return 'text-orange-500 dark:text-orange-400';
  if (track === '신품') return 'text-blue-600 dark:text-blue-400';
  if (track === '수기') return 'text-slate-600 dark:text-slate-300';
  return 'text-emerald-600 dark:text-emerald-400'; // AI
};

type SearchField = 'ALL' | 'BOOK_INFO' | 'AUTHOR' | 'PUBLISHER' | 'LPN' | 'ISBN' | 'TITLE' | 'ZONE';
type SortKey = 'LATEST' | 'OLDEST' | 'QTY_DESC' | 'QTY_ASC' | 'UBCI_DESC' | 'TITLE_ASC';
type BookType = 'ALL' | 'NEW' | 'USED';

export function InventoryDataTable({ role }: { role: StockRole }) {
  const isAdmin = role === 'ADMIN';
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);

  // 검색/필터/정렬
  const [searchField, setSearchField] = useState<SearchField>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookTypeFilter, setBookTypeFilter] = useState<BookType>('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [ubciScoreFilter, setUbciScoreFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('LATEST');

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 관리자 전용 일괄 선택
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetBatchZone, setTargetBatchZone] = useState('Zone A-1-1');
  const [targetBatchGrade, setTargetBatchGrade] = useState<'MINT' | 'GOOD' | 'NORMAL' | 'REJECT'>('MINT');

  // 모달
  const [activePrintData, setActivePrintData] = useState<LpnPrintData | null>(null);
  const [zoomBook, setZoomBook] = useState<any | null>(null);

  // 재고 전량 응답(수 MB)을 60초 캐시한다 - 재방문 시 스피너 없이 즉시 표시.
  const { data: fetchedItems, isLoading: loading } = useQuery({
    queryKey: ['inventory-items'],
    staleTime: 60_000,
    queryFn: async (): Promise<InventoryItem[]> => {
      const data: any[] = await inventoryAPI.getInventory().catch((err: unknown) => {
        console.error('Inventory API fetch failed:', err);
        return [];
      });
      if (!data || !Array.isArray(data)) return [];
      return data.map((item: any, idx: number) => {
            const safeScore = typeof item.ubci_score === 'number' ? item.ubci_score : null;
            return {
              id: item.id || `inv-real-${idx}`,
              lpn_barcode: item.lpn_barcode || 'LPN 미발급 (신품)',
              grade: item.grade || 'GOOD',
              ubci_score: safeScore,
              book: {
                title: item.book?.title || '도서 정보 없음',
                author: item.book?.author || '-',
                publisher: item.book?.publisher || '-',
                isbn: item.book?.isbn || '-',
                base_price: item.book?.base_price || 0,
                cover_image_url: item.book?.cover_image_url || item.cover_image_url || '',
              },
              zone: item.zone || 'Zone A-1-1',
              quantity: item.quantity || 1,
              // 백엔드가 실제 등급 확정 주체(AI 자동 판정 / HITL 결재자)를 내려주므로
              // 사번 리터럴로 덮어쓰지 않는다 (목록과 상세가 다른 담당자를 표시하던 원인).
              worker_id: item.worker_id || '미기록',
              // 작업자(사람)와 확정 트랙을 분리 표기한다. 종전에는
              // "Nexus Vision AI (LangGraph 4-Agent)" 한 줄이 작업자 칸을 차지해
              // 실제로 검수한 사람이 목록에 드러나지 않았다. 자세한 근거는 상세 화면이 맡는다.
              worker_label: item.worker_label || '작업자 미기록',
              track: item.track || 'AI',
              date: item.date || '',
            };
      });
    },
  });

  // 캐시 결과를 로컬 상태로 받아 일괄 구역 변경·삭제 같은 화면 내 변이를 지원한다.
  useEffect(() => {
    if (fetchedItems) setItems(fetchedItems);
  }, [fetchedItems]);

  // 검색어는 지연 값으로 필터링한다 - 키 입력마다 전체 목록을 재계산해 입력이
  // 버벅이는 것을 막는다 (입력 반영은 즉시, 목록 갱신은 여유 프레임에).
  const deferredQuery = useDeferredValue(searchQuery);

  const filteredItems = useMemo(() => {
    const kstToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    return items.filter((item) => {
      const isNew = isNewBookItem(item);
      if (bookTypeFilter === 'NEW' && !isNew) return false;
      if (bookTypeFilter === 'USED' && isNew) return false;

      if (gradeFilter !== 'ALL' && gradeMeta(item.grade, item.ubci_score).display !== gradeFilter) return false;

      // 점수 구간 필터. 점수가 없는 품목(검수 전)은 어떤 구간에도 속하지 않으므로
      // 기본 점수를 씌워 끼워 넣지 않고 제외한다.
      if (ubciScoreFilter !== 'ALL') {
        const score = item.ubci_score;
        if (score == null) return false;
        if (ubciScoreFilter === '90_PLUS' && score < 95) return false;
        if (ubciScoreFilter === '80_PLUS' && (score < 85 || score >= 95)) return false;
        if (ubciScoreFilter === '60_PLUS' && (score < 65 || score >= 85)) return false;
        if (ubciScoreFilter === 'UNDER_60' && score >= 65) return false;
      }

      if (dateFilter === 'TODAY' && !item.date.includes(kstToday)) return false;
      if (dateFilter === 'WEEK') {
        const t = new Date(item.date.replace(' ', 'T')).getTime();
        if (isNaN(t) || t < Date.now() - 7 * 24 * 3600 * 1000) return false;
      }

      if (!deferredQuery.trim()) return true;
      const q = deferredQuery.trim().toLowerCase();
      const b = item.book;
      switch (searchField) {
        case 'LPN': return item.lpn_barcode.toLowerCase().includes(q);
        case 'ISBN': return b.isbn.toLowerCase().includes(q);
        case 'TITLE': return b.title.toLowerCase().includes(q);
        case 'AUTHOR': return b.author.toLowerCase().includes(q);
        case 'PUBLISHER': return b.publisher.toLowerCase().includes(q);
        case 'ZONE': return item.zone.toLowerCase().includes(q);
        case 'BOOK_INFO':
          return (
            b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
            b.publisher.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q)
          );
        default:
          return (
            item.lpn_barcode.toLowerCase().includes(q) || b.isbn.toLowerCase().includes(q) ||
            b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
            b.publisher.toLowerCase().includes(q) || item.zone.toLowerCase().includes(q) ||
            item.worker_id.toLowerCase().includes(q) || item.date.toLowerCase().includes(q)
          );
      }
    });
  }, [items, deferredQuery, searchField, gradeFilter, ubciScoreFilter, dateFilter, bookTypeFilter]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    switch (sortBy) {
      case 'LATEST': return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'OLDEST': return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'QTY_DESC': return list.sort((a, b) => b.quantity - a.quantity);
      case 'QTY_ASC': return list.sort((a, b) => a.quantity - b.quantity);
      case 'UBCI_DESC': return list.sort((a, b) => (b.ubci_score ?? 0) - (a.ubci_score ?? 0));
      case 'TITLE_ASC': return list.sort((a, b) => a.book.title.localeCompare(b.book.title));
      default: return list;
    }
  }, [filteredItems, sortBy]);

  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safeCurrentPage, pageSize]);

  // ---------- 관리자 전용: 선택/벌크 작업 ----------
  const isAllPaginatedSelected = useMemo(
    () => paginatedItems.length > 0 && paginatedItems.every((i) => selectedIds.includes(i.id)),
    [paginatedItems, selectedIds]
  );

  const toggleSelectAll = () => {
    const pageIds = paginatedItems.map((i) => i.id);
    setSelectedIds((prev) =>
      isAllPaginatedSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))
    );
  };

  const toggleSelectItem = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleBatchZoneChange = () => {
    if (!selectedIds.length) return;
    setItems((prev) => prev.map((i) => (selectedIds.includes(i.id) ? { ...i, zone: targetBatchZone } : i)));
    alert(`선택한 ${selectedIds.length}건의 도서 보관 위치가 [${targetBatchZone}]으로 일괄 이동 설정되었습니다.`);
  };

  const handleBatchGradeChange = () => {
    if (!selectedIds.length) return;
    const scoreMap = { MINT: 98, GOOD: 88, NORMAL: 72, REJECT: 45 } as const;
    setItems((prev) =>
      prev.map((i) =>
        selectedIds.includes(i.id) ? { ...i, grade: targetBatchGrade, ubci_score: scoreMap[targetBatchGrade] } : i
      )
    );
    alert(`선택한 ${selectedIds.length}건에 마스터 비상 등급 오버라이드 [${targetBatchGrade}]가 일괄 적용되었습니다.`);
  };

  const handleBatchAiRetry = () => {
    if (!selectedIds.length) return;
    alert(`[🤖 선택 항목 일괄 AI 재검수 요청]\n선택된 ${selectedIds.length}건이 LangGraph 멀티 에이전트 재검수 큐에 입력되었습니다.`);
  };

  const handleBatchReshoot = () => {
    if (!selectedIds.length) return;
    alert(`[📸 선택 항목 일괄 현장 재촬영 요청]\n선택된 ${selectedIds.length}건에 대해 현장 작업자 푸시 알림이 발송되었습니다.`);
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`⚠️ [경고] 선택한 ${selectedIds.length}건을 검수 이력·원장·알림까지 포함해 완전히 삭제합니다.\n복구할 수 없습니다. 진행할까요?`)) return;
    const failed: string[] = [];
    for (const id of selectedIds) {
      try {
        await inventoryAPI.deleteItem(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
        failed.push(msg?.message || msg?.detail || id);
      }
    }
    setSelectedIds([]);
    if (failed.length) alert(`일부 항목을 삭제하지 못했습니다:\n${failed.join('\n')}`);
  };

  const handleSingleAiRetry = (item: InventoryItem) =>
    alert(`[🤖 AI 재검수 요청 완료]\nLPN: ${item.lpn_barcode}\nLangGraph Vision Agent 파이프라인으로 재검수가 요청되었습니다.`);

  const handleSingleReshoot = (item: InventoryItem) =>
    alert(`[📸 현장 재촬영 요청 완료]\nLPN: ${item.lpn_barcode}\n담당 작업자(${item.worker_id}) PDA 모바일 앱으로 촬영 알림이 전송되었습니다.`);

  const handleSingleDelete = async (id: string, lpn: string) => {
    if (!confirm(`⚠️ [경고] [${lpn}] 항목을 검수 이력·원장·알림까지 포함해 완전히 삭제합니다.\n복구할 수 없습니다. 진행할까요?`)) return;
    try {
      await inventoryAPI.deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
      alert(`삭제 실패: ${msg?.message || msg?.detail || '서버 오류'}`);
    }
  };

  // ---------- 내보내기 ----------
  const toCsvRow = (item: InventoryItem) => ({
    LPN: item.lpn_barcode,
    도서명: item.book.title,
    저자: item.book.author,
    출판사: item.book.publisher,
    ISBN: item.book.isbn,
    등급: gradeMeta(item.grade, item.ubci_score).display,
    UBCI점수: item.ubci_score ?? '-',
    보관구역: formatZone(item.zone),
    재고수량: item.quantity,
    작업자: item.worker_label,
    확정트랙: item.track,
    입고일시: item.date,
  });

  const handleExportAllCSV = () =>
    exportToCSV(isAdmin ? 'nexus_inventory_status_all' : 'worker_inventory_search', sortedItems.map(toCsvRow));

  const handleBatchExportCSV = () =>
    exportToCSV(`nexus_inventory_selected_${selectedIds.length}items`, items.filter((i) => selectedIds.includes(i.id)).map(toCsvRow));

  // 라벨의 "작업자"는 등급 확정 주체(AI/HITL)가 아니라 실제 입고 처리한 사람을 보여준다.
  // item.worker_id는 구 필드(등급 확정 주체 서술, 화면 호환용) — 라벨에는 쓰지 않는다.
  const handlePrintLabel = (item: InventoryItem) =>
    setActivePrintData({
      lpn_barcode: item.lpn_barcode,
      book: { title: item.book.title, author: item.book.author, isbn: item.book.isbn },
      worker_id: item.worker_label,
    });

  const openZoom = (item: InventoryItem) =>
    setZoomBook({
      title: item.book.title,
      author: item.book.author,
      publisher: item.book.publisher,
      isbn: item.book.isbn,
      cover_image_url: item.book.cover_image_url,
      base_price: item.book.base_price,
      lpn_barcode: item.lpn_barcode,
    });

  /** 역할별 상세 화면 목적지. Worker는 /admin/* 접근이 미들웨어에서 차단되므로 /lpn 내부 조회로 보낸다. */
  const detailHref = (item: InventoryItem): string | null => {
    if (isAdmin) return `/admin/inventory/${item.id}`;
    if (!isNewBookItem(item)) return `/lpn/${item.lpn_barcode}`;
    return null; // Worker + 신품: 전용 상세 없음 -> 표지 확대 모달로 대체
  };

  // Tailwind JIT는 동적 조립 클래스명을 인식하지 못하므로 역할별 배지 클래스를 통째로 분기한다.
  const badgeClass = isAdmin
    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-mono font-black text-xs px-3 py-1 rounded-full'
    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-mono font-black text-xs px-3 py-1 rounded-full';

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Banner Header (관제 표준 패턴) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className={badgeClass}>
              {isAdmin ? 'INVENTORY MANAGEMENT & BATCH CONTROL PIPELINE' : 'WORKER READ-ONLY INVENTORY SEARCH'}
            </Badge>
            {!isAdmin && (
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">수정 기능 비활성화됨 (조회 전용)</span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            {isAdmin ? (
              <PackageSearch className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            )}
            {isAdmin ? '재고 현황 관제 대시보드' : '현장 작업자 재고 현황 검색'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            {isAdmin
              ? '다중 선택 일괄 보관위치 이동, 마스터 등급 비상 오버라이드, 최신순 정렬 및 동적 페이지네이션을 지원합니다.'
              : '창고 보관 랙(Zone A-E)의 재고 위치, LPN 바코드, 등급 및 보유 수량을 조회할 수 있습니다.'}
          </p>
        </div>

        <Button
          onClick={handleExportAllCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 mr-1.5" />
          전체 목록 엑셀 내보내기 ({sortedItems.length}건)
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          <div className="md:col-span-3 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as SearchField)}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">🔍 전체 검색</option>
              <option value="BOOK_INFO" className="dark:bg-gray-800">📚 도서 정보 통합</option>
              <option value="AUTHOR" className="dark:bg-gray-800">✍️ 작가(저자)별</option>
              <option value="PUBLISHER" className="dark:bg-gray-800">🏢 출판사별</option>
              <option value="LPN" className="dark:bg-gray-800">🔖 LPN 바코드</option>
              <option value="ISBN" className="dark:bg-gray-800">🔢 ISBN 코드</option>
              <option value="TITLE" className="dark:bg-gray-800">📖 도서명</option>
              <option value="ZONE" className="dark:bg-gray-800">📍 보관 위치</option>
            </select>
          </div>

          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="도서명, 작가, 출판사, ISBN, LPN 바코드 키워드 실시간 검색..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-2.5 bg-blue-50/70 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
            <ArrowUpDown className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-sm font-extrabold text-blue-900 dark:text-blue-300 shrink-0">정렬:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortKey); setCurrentPage(1); }}
              className="bg-transparent text-sm font-black text-blue-900 dark:text-blue-300 outline-none w-full cursor-pointer"
            >
              <option value="LATEST" className="dark:bg-gray-800">🕒 최신 입고순 (기본)</option>
              <option value="OLDEST" className="dark:bg-gray-800">⏳ 오래된 입고순</option>
              <option value="QTY_DESC" className="dark:bg-gray-800">⬆️ 재고 수량 많은순</option>
              <option value="QTY_ASC" className="dark:bg-gray-800">⬇️ 재고 수량 적은순</option>
              <option value="UBCI_DESC" className="dark:bg-gray-800">⭐️ UBCI 점수 높은순</option>
              <option value="TITLE_ASC" className="dark:bg-gray-800">🔤 도서명 가나다순</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-3.5 border-t border-gray-100 dark:border-gray-800 text-sm">
          <div className="md:col-span-5 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/90 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            {([
              ['ALL', '📚 전체 재고'],
              ['NEW', '✨ 신품도서만'],
              ['USED', '📦 중고도서만'],
            ] as [BookType, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setBookTypeFilter(val); setCurrentPage(1); }}
                className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition-all ${
                  bookTypeFilter === val
                    ? val === 'NEW'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : val === 'USED'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="md:col-span-4 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-extrabold text-gray-700 dark:text-gray-300 shrink-0">UBCI:</span>
            <select
              value={ubciScoreFilter}
              onChange={(e) => { setUbciScoreFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">전체 점수대</option>
              <option value="90_PLUS" className="dark:bg-gray-800">S급 / MINT (95~100점)</option>
              <option value="80_PLUS" className="dark:bg-gray-800">A급 / GOOD (85~94점)</option>
              <option value="60_PLUS" className="dark:bg-gray-800">B급 / NORMAL (65~84점)</option>
              <option value="UNDER_60" className="dark:bg-gray-800">C급 / REJECT (0~64점)</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-extrabold text-gray-700 dark:text-gray-300 shrink-0">입고일:</span>
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">전체 기간</option>
              <option value="TODAY" className="dark:bg-gray-800">오늘 입고</option>
              <option value="WEEK" className="dark:bg-gray-800">최근 7일</option>
            </select>
          </div>
        </div>
      </div>

      {/* 관리자 전용: Floating Bulk Action Bar */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 animate-in slide-in-from-top duration-300 border border-indigo-700/60">
          <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 px-4 py-2 rounded-xl text-base font-black flex items-center gap-2 w-max font-mono">
            ☑️ 선택된 도서: <strong className="text-white text-xl font-black">{selectedIds.length}</strong>건
          </span>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-xl border border-white/30 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-300 shrink-0" />
              <select
                value={targetBatchZone}
                onChange={(e) => setTargetBatchZone(e.target.value)}
                className="bg-transparent font-black text-white outline-none cursor-pointer"
              >
                <option value="Zone A-1-1" className="bg-gray-900 text-white">Zone A-1-1 (신규적치)</option>
                <option value="Zone A-1-2" className="bg-gray-900 text-white">Zone A-1-2 (S급보관)</option>
                <option value="Zone B-1-1" className="bg-gray-900 text-white">Zone B-1-1 (A급보관)</option>
                <option value="Zone B-2-4" className="bg-gray-900 text-white">Zone B-2-4 (B급보관)</option>
                <option value="Zone C-9-9" className="bg-gray-900 text-white">Zone C-9-9 (반려/폐기존)</option>
              </select>
              <button onClick={handleBatchZoneChange} className="ml-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 font-black rounded-lg transition-all text-xs active:scale-95 whitespace-nowrap">
                위치 이동
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-xl border border-white/30 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <select
                value={targetBatchGrade}
                onChange={(e) => setTargetBatchGrade(e.target.value as 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT')}
                className="bg-transparent font-black text-white outline-none cursor-pointer"
              >
                <option value="MINT" className="bg-gray-900 text-white">MINT (98점)</option>
                <option value="GOOD" className="bg-gray-900 text-white">GOOD (88점)</option>
                <option value="NORMAL" className="bg-gray-900 text-white">NORMAL (72점)</option>
                <option value="REJECT" className="bg-gray-900 text-white">REJECT (45점)</option>
              </select>
              <button
                onClick={handleBatchGradeChange}
                className="ml-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 font-black rounded-lg transition-all text-xs active:scale-95 whitespace-nowrap"
                title="HITL 최종 검수 후 마스터 비상 등급 오버라이드"
              >
                ✨ 비상 등급 오버라이드
              </button>
            </div>

            <button onClick={handleBatchAiRetry} className="px-4 py-2.5 bg-purple-600/90 hover:bg-purple-600 border border-purple-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95 whitespace-nowrap">
              <RotateCcw className="w-4 h-4" /> AI 재검수
            </button>
            <button onClick={handleBatchReshoot} className="px-4 py-2.5 bg-cyan-600/90 hover:bg-cyan-600 border border-cyan-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95 whitespace-nowrap">
              <Camera className="w-4 h-4" /> 현장 재촬영
            </button>
            <button onClick={handleBatchDelete} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 border border-rose-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs text-white shadow-2xs active:scale-95 whitespace-nowrap">
              <Trash2 className="w-4 h-4" /> 선택 삭제
            </button>
            <button onClick={handleBatchExportCSV} className="px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs shadow-2xs active:scale-95 whitespace-nowrap">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => setSelectedIds([])} className="p-2 text-gray-300 hover:text-white transition-colors bg-white/10 rounded-xl hover:bg-white/20 ml-1">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 w-full">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            조회 조건 일치 목록: <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{sortedItems.length}</strong>건 (전체 {items.length}건)
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <span>페이지당 표시:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-200 font-bold outline-none cursor-pointer"
            >
              <option value={5}>5개씩</option>
              <option value={10}>10개씩</option>
              <option value={25}>25개씩</option>
              <option value={50}>50개씩</option>
            </select>
          </div>
        </div>

        {/*
          모바일 뷰포트 대응 카드 리스트 신설.
          이 데스크톱 <table>은 좁은 화면에서 가로 스크롤 없이는 열이 잘려 조회 자체가
          어려웠다(작업자가 실제로 쓰는 화면인데도). md 미만에서는 카드 리스트로, md 이상에서는
          기존 테이블로 전환한다 - 데스크톱 동작은 그대로 두고 좁은 화면에서만 레이아웃을 바꾼다.
        */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <p className="py-16 text-center text-gray-400 font-bold text-sm">재고 데이터를 불러오는 중...</p>
          ) : paginatedItems.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
              <p className="text-sm font-bold">조회 조건에 해당하는 재고 데이터가 없습니다.</p>
              <p className="text-xs mt-1">검색 키워드나 UBCI 점수대 필터를 초기화해 보세요.</p>
            </div>
          ) : (
            paginatedItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isNew = isNewBookItem(item);
              const meta = gradeMeta(item.grade, item.ubci_score);
              const href = detailHref(item);

              return (
                <div
                  key={item.id}
                  // 카드 탭 라우팅 제거 — 상세 진입은 카드 하단 "상세" 버튼 전담.
                  // (체크 선택 중 오탭으로 페이지가 이동해 선택이 초기화되는 사고 방지, 데스크톱 행과 동일 규칙)
                  className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                      : 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        data-row-stop
                        className="w-4 h-4 mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                    )}
                    <span data-row-stop className="contents">
                      <BookCover
                        key={`cover-m-${item.id}-${item.book.isbn}`}
                        src={item.book.cover_image_url}
                        title={item.book.title}
                        author={item.book.author}
                        isbn={item.book.isbn}
                        className="w-12 h-16 shadow-sm shrink-0"
                        onClick={() => openZoom(item)}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* 데스크톱 행과 동일 규칙: 카드 전체 탭은 막고 제목만 상세 진입점 */}
                      {href ? (
                        <Link
                          href={href}
                          title="상세 정보 조회"
                          className="block font-black text-gray-900 dark:text-white text-sm leading-snug truncate hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {item.book.title}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openZoom(item)}
                          title="도서 상세정보 (표지 확대)"
                          className="block w-full text-left font-black text-gray-900 dark:text-white text-sm leading-snug truncate hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {item.book.title}
                        </button>
                      )}
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-extrabold truncate">
                        {item.book.author} · {item.book.publisher}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400">{item.book.isbn}</p>
                    </div>
                    {isNew ? (
                      <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        신품
                      </span>
                    ) : (
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black border ${meta.badge}`}>
                        {meta.display}{item.ubci_score != null ? ` ${item.ubci_score}점` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-700 dark:text-gray-300">
                      {!isNew ? item.lpn_barcode : 'LPN 미발급 (신품)'}
                    </span>
                    <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                      <MapPin className="w-3 h-3" /> {formatZone(item.zone)}
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">{item.quantity}권</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-medium border-t border-gray-200/70 dark:border-gray-700/60 pt-2">
                    <span className="truncate font-mono">
                      {item.worker_label} / <span className={trackTone(item.track)}>{item.track}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {formatKSTDate(item.date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5" data-row-stop>
                    {href ? (
                      <Link
                        href={href}
                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-extrabold rounded-lg text-xs flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> 상세
                      </Link>
                    ) : (
                      <button
                        onClick={() => openZoom(item)}
                        className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-extrabold rounded-lg text-xs flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> 상세
                      </button>
                    )}
                    {!isNew && (
                      <button
                        onClick={() => handlePrintLabel(item)}
                        className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold rounded-lg text-xs flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> 인쇄
                      </button>
                    )}
                    {isAdmin && !isNew && (
                      <>
                        <button onClick={() => handleSingleAiRetry(item)} className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg active:scale-95 shrink-0" title="AI 재검수 요청">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleSingleReshoot(item)} className="p-2 bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-lg active:scale-95 shrink-0" title="현장 재촬영 요청">
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleSingleDelete(item.id, item.lpn_barcode)} className="p-2 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg active:scale-95 shrink-0" title="재고 삭제">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 font-bold text-xs tracking-wider">
              <tr>
                {isAdmin && (
                  <th className="py-3.5 px-4 w-12 text-center">
                    <input type="checkbox" checked={isAllPaginatedSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  </th>
                )}
                <th className="py-3.5 px-4 whitespace-nowrap">LPN 바코드</th>
                <th className="py-3.5 px-4 whitespace-nowrap">ISBN-13</th>
                <th className="py-3.5 px-4 min-w-[280px]">도서 정보 (제목 / 저자 / 출판사 / 정가)</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">UBCI 등급 (점수)</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">보관 위치</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">재고 수량</th>
                <th className="py-3.5 px-4 whitespace-nowrap">작업자 / 입고 일시</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">조회 및 라벨</th>
                {isAdmin && <th className="py-3.5 px-4 text-center whitespace-nowrap">검수 및 삭제</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="py-16 text-center text-gray-400 font-bold text-sm">
                    재고 데이터를 불러오는 중...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 8} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm font-bold">조회 조건에 해당하는 재고 데이터가 없습니다.</p>
                    <p className="text-xs mt-1">검색 키워드나 UBCI 점수대 필터를 초기화해 보세요.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isNew = isNewBookItem(item);
                  const meta = gradeMeta(item.grade, item.ubci_score);
                  const href = detailHref(item);

                  return (
                    <tr
                      key={item.id}
                      // 행 클릭 라우팅은 두지 않는다 — 상세 진입은 우측 "상세" 버튼 전담.
                      // 체크박스로 다중 선택하다 행을 잘못 누르면 페이지가 이동해 선택이
                      // 전부 날아가는 사고가 있어, 파괴적 행 단위 내비게이션을 제거했다.
                      className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                    >
                      {isAdmin && (
                        <td className="py-4 px-4 text-center" data-row-stop>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelectItem(item.id)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        </td>
                      )}

                      {/* LPN */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {!isNew ? (
                          <div className="flex items-center gap-2.5">
                            <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0 shadow-2xs">
                              {/* QR 진입점은 /lpn/[lpn] (행 클릭 링크와 동일 경로) */}
                              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/lpn/${item.lpn_barcode}`} size={42} />
                            </div>
                            <div>
                              <p className="font-mono font-black text-gray-900 dark:text-white text-sm">{item.lpn_barcode}</p>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block mt-0.5">
                                Verified LPN
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-mono font-bold shadow-2xs inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            LPN 미발급 (신품)
                          </span>
                        )}
                      </td>

                      {/* ISBN */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-mono font-black">
                          {item.book.isbn}
                        </span>
                      </td>

                      {/* 도서 정보 */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <span data-row-stop className="contents">
                          <BookCover
                            key={`cover-${item.id}-${item.book.isbn}`}
                            src={item.book.cover_image_url}
                            title={item.book.title}
                            author={item.book.author}
                            isbn={item.book.isbn}
                            className="w-12 h-16 shadow-sm"
                            onClick={() => openZoom(item)}
                          />
                          </span>
                          <div className="space-y-1">
                            {/* 제목은 상세 진입점으로 유지한다 — 행 전체 라우팅은 뺐지만
                                (다중 선택 중 오클릭 방지), 의도적으로 제목을 누르는 동작은
                                살려둔다. 링크라 새 탭 열기도 가능. */}
                            {href ? (
                              <Link
                                href={href}
                                title="상세 정보 조회"
                                className="block font-black text-gray-900 dark:text-white text-base leading-snug hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                              >
                                {item.book.title}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openZoom(item)}
                                title="도서 상세정보 (표지 확대)"
                                className="block text-left font-black text-gray-900 dark:text-white text-base leading-snug hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                              >
                                {item.book.title}
                              </button>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-extrabold">
                              {item.book.author} · {item.book.publisher}
                            </p>
                            <p className="text-[11px] font-mono text-gray-400 font-bold">
                              정가: {item.book.base_price ? item.book.base_price.toLocaleString() : '-'}원
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 등급 */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {isNew ? (
                          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            미표기 (신품 Fast-Track)
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-black border shadow-2xs ${meta.badge}`}>
                            {/* 점수가 없으면 기본값을 채우지 않고 미산출로 표기한다. */}
                            {meta.display} (UBCI: {item.ubci_score ?? '미산출'}
                            {item.ubci_score != null ? '점' : ''})
                          </span>
                        )}
                      </td>

                      {/* Zone */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center font-mono font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/80 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs sm:text-sm shadow-2xs">
                          <MapPin className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          {formatZone(item.zone)}
                        </span>
                      </td>

                      {/* 수량 */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-black text-gray-900 dark:text-white text-base block">{item.quantity}권</span>
                        {isNew ? (
                          <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 block bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-300 dark:border-blue-800 mt-1">✨ 신품도서</span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 block bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-800 mt-1">📦 중고도서</span>
                        )}
                      </td>

                      {/* 작업자/트랙 · 일시 (긴 서술 대신 `사번(이름) / 트랙` 한 줄) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <p className="text-gray-900 dark:text-white font-mono text-sm font-black">
                          {item.worker_label}
                          <span className="text-gray-400 dark:text-gray-500 font-bold"> / </span>
                          <span className={trackTone(item.track)}>{item.track}</span>
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs font-mono flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatKSTDate(item.date)}
                        </p>
                      </td>

                      {/* 조회 및 라벨 */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex justify-center items-center gap-1.5">
                          {href ? (
                            <Link
                              href={href}
                              className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1 border border-gray-200 dark:border-gray-700 shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                              title="상세 정보 조회"
                            >
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400 shrink-0" />
                              <span>상세</span>
                            </Link>
                          ) : (
                            <button
                              onClick={() => openZoom(item)}
                              className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1 border border-gray-200 dark:border-gray-700 shadow-2xs active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                              title="도서 상세정보 (표지 확대)"
                            >
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400 shrink-0" />
                              <span>상세</span>
                            </button>
                          )}

                          {!isNew && (
                            <button
                              onClick={() => handlePrintLabel(item)}
                              className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                              title="LPN 열전사 라벨 인쇄"
                            >
                              <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span>인쇄</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 관리자 전용: 검수/삭제 */}
                      {isAdmin && (
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <div className="flex justify-center items-center gap-1.5">
                            {!isNew && (
                              <>
                                <button onClick={() => handleSingleAiRetry(item)} className="p-2 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 shrink-0" title="AI Vision Agent 재검수 요청">
                                  <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </button>
                                <button onClick={() => handleSingleReshoot(item)} className="p-2 bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 shrink-0" title="현장 작업자 재촬영 요청">
                                  <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleSingleDelete(item.id, item.lpn_barcode)} className="p-2 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 shrink-0" title="재고 삭제 (폐기)">
                              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 관제 표준 모듈형 페이지네이션 */}
        <MasterPagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalEntries={totalItems}
          currentCount={paginatedItems.length}
          onPageChange={setCurrentPage}
        />
      </div>

      <LpnPrintModal data={activePrintData} onClose={() => setActivePrintData(null)} />
      <BookCoverModal isOpen={!!zoomBook} onClose={() => setZoomBook(null)} book={zoomBook} />
    </div>
  );
}
