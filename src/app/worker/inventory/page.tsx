'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { exportToCSV } from '@/lib/exportCsv';
import { 
  PackageSearch, 
  Download, 
  Search, 
  Printer, 
  Eye, 
  MapPin, 
  Tag, 
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Clock,
  Calendar,
  BookOpen,
  Sparkles,
  Layers,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { LpnPrintLabel, LpnLabelData } from '@/features/inbound/components/LpnPrintLabel';
import { inventoryAPI } from '@/lib/api';

interface InventoryItem {
  id: string;
  lpn_barcode: string;
  book: {
    title: string;
    author: string;
    publisher: string;
    isbn: string;
    base_price: number;
  };
  grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  ubci_score: number;
  zone: string;
  quantity: number;
  worker_id: string;
  date: string;
}

export default function WorkerInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter States
  const [searchField, setSearchField] = useState<'ALL' | 'BOOK_INFO' | 'AUTHOR' | 'PUBLISHER' | 'LPN' | 'ISBN' | 'TITLE' | 'ZONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [ubciScoreFilter, setUbciScoreFilter] = useState<string>('ALL');

  // Sort State
  const [sortBy, setSortBy] = useState<'LATEST' | 'OLDEST' | 'QTY_DESC' | 'QTY_ASC' | 'UBCI_DESC' | 'TITLE_ASC'>('LATEST');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const [activePrintData, setActivePrintData] = useState<LpnLabelData | null>(null);

  useEffect(() => {
    inventoryAPI.getInventory()
      .then((data) => {
        if (data && data.length > 0) {
          setItems(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Worker Inventory API fetch failed:", err);
        setLoading(false);
      });
  }, []);


  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        if (searchField === 'BOOK_INFO') {
          return (
            item.book.title.toLowerCase().includes(q) ||
            item.book.author.toLowerCase().includes(q) ||
            item.book.publisher.toLowerCase().includes(q)
          );
        }
        if (searchField === 'TITLE') return item.book.title.toLowerCase().includes(q);
        if (searchField === 'AUTHOR') return item.book.author.toLowerCase().includes(q);
        if (searchField === 'PUBLISHER') return item.book.publisher.toLowerCase().includes(q);
        if (searchField === 'LPN') return item.lpn_barcode.toLowerCase().includes(q);
        if (searchField === 'ISBN') return item.book.isbn.toLowerCase().includes(q);
        if (searchField === 'ZONE') return item.zone.toLowerCase().includes(q);

        return (
          item.book.title.toLowerCase().includes(q) ||
          item.book.author.toLowerCase().includes(q) ||
          item.book.publisher.toLowerCase().includes(q) ||
          item.lpn_barcode.toLowerCase().includes(q) ||
          item.book.isbn.toLowerCase().includes(q) ||
          item.zone.toLowerCase().includes(q)
        );
      });
    }

    if (gradeFilter !== 'ALL') {
      result = result.filter((item) => item.grade === gradeFilter);
    }

    if (ubciScoreFilter !== 'ALL') {
      if (ubciScoreFilter === '90_PLUS') result = result.filter((item) => item.ubci_score >= 95);
      else if (ubciScoreFilter === '80_PLUS') result = result.filter((item) => item.ubci_score >= 85 && item.ubci_score < 95);
      else if (ubciScoreFilter === '60_PLUS') result = result.filter((item) => item.ubci_score >= 65 && item.ubci_score < 85);
      else if (ubciScoreFilter === 'UNDER_60') result = result.filter((item) => item.ubci_score < 65);
    }

    result.sort((a, b) => {
      if (sortBy === 'LATEST') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'OLDEST') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'QTY_DESC') return b.quantity - a.quantity;
      if (sortBy === 'QTY_ASC') return a.quantity - b.quantity;
      if (sortBy === 'UBCI_DESC') return b.ubci_score - a.ubci_score;
      if (sortBy === 'TITLE_ASC') return a.book.title.localeCompare(b.book.title);
      return 0;
    });

    return result;
  }, [items, searchQuery, searchField, gradeFilter, ubciScoreFilter, sortBy]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safeCurrentPage, pageSize]);

  const handlePrintLabel = (item: InventoryItem) => {
    setActivePrintData({
      lpn_barcode: item.lpn_barcode,
      book: {
        title: item.book.title,
        author: item.book.author,
        isbn: item.book.isbn,
      },
      worker_id: item.worker_id || 'WM2607001 (장문경)',
    });
  };

  const handleExportCSV = () => {
    const exportData = filteredItems.map((item) => ({
      id: item.id,
      lpn_barcode: item.lpn_barcode,
      title: item.book.title,
      isbn: item.book.isbn,
      zone: item.zone,
      grade: item.grade,
      ubci_score: item.ubci_score,
      quantity: item.quantity,
    }));
    exportToCSV('worker_inventory_search', exportData, [
      { key: 'lpn_barcode', label: 'LPN 바코드' },
      { key: 'title', label: '도서명' },
      { key: 'isbn', label: 'ISBN' },
      { key: 'zone', label: '보관 랙 Zone' },
      { key: 'grade', label: 'AI 등급' },
      { key: 'ubci_score', label: 'UBCI 점수' },
      { key: 'quantity', label: '보유 수량' }
    ]);
  };

  const getGradeBadge = (grade: string, ubciScore?: number) => {
    const g = (grade || '').toUpperCase();
    const score = ubciScore !== undefined && ubciScore !== null ? ubciScore : 85;

    let displayGrade = 'GOOD';
    let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';

    if (score >= 95 || g.includes('MINT') || g === 'S') {
      displayGrade = 'MINT';
      badgeBg = 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
    } else if (score >= 85 || g.includes('GOOD') || g.includes('A')) {
      displayGrade = 'GOOD';
      badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    } else if (score >= 65 || g.includes('NORMAL') || g.includes('B')) {
      displayGrade = 'NORMAL';
      badgeBg = 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
    } else {
      displayGrade = 'REJECT';
      badgeBg = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
    }

    return (
      <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black border shadow-2xs ${badgeBg}`}>
        {displayGrade} (UBCI: {score}점)
      </span>
    );
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> WORKER READ-ONLY INVENTORY SEARCH
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">수정 기능 비활성화됨 (조회 전용)</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <PackageSearch className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            현장 작업자 재고 현황 검색
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            창고 보관 랙(Zone A-E)의 재고 위치, LPN 바코드, 등급 및 보유 수량을 조회할 수 있습니다.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>조회 결과 엑셀 다운로드</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          
          {/* Target Field Select */}
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">검색 항목 선택</label>
            <select
              value={searchField}
              onChange={(e: any) => setSearchField(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="ALL">전체 항목 검색</option>
              <option value="BOOK_INFO">도서 정보 (제목+저자+출판사)</option>
              <option value="TITLE">도서명만</option>
              <option value="AUTHOR">저자만</option>
              <option value="PUBLISHER">출판사만</option>
              <option value="LPN">LPN 바코드</option>
              <option value="ISBN">ISBN 번호</option>
              <option value="ZONE">보관 위치</option>
            </select>
          </div>

          {/* Search Query Input */}
          <div className="md:col-span-5 relative">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">검색어 입력</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="도서명, ISBN, LPN 바코드, 랙 Zone 검색..."
                className="w-full h-10 pl-9 pr-4 text-xs font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Grade Filter */}
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">등급 필터</label>
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="ALL">전체 등급</option>
              <option value="MINT">MINT (최상)</option>
              <option value="GOOD">GOOD (우수)</option>
              <option value="NORMAL">NORMAL (보통)</option>
              <option value="REJECT">REJECT (폐기/반송)</option>
            </select>
          </div>

          {/* Sort By Select */}
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold outline-none text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="LATEST">최신 입고순</option>
              <option value="OLDEST">오래된순</option>
              <option value="QTY_DESC">수량 많은순</option>
              <option value="QTY_ASC">수량 적은순</option>
              <option value="UBCI_DESC">UBCI 높은순</option>
              <option value="TITLE_ASC">도서명 가나다순</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Inventory Responsive View Container */}
      <div className="space-y-4">
        {/* Mobile & Tablet Optimized Card Grid (Visible on md:hidden) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:hidden gap-3.5">
          {loading ? (
            <div className="col-span-full p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-400 font-bold text-xs">
              재고 데이터를 불러오는 중...
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-400 font-bold text-xs">
              조건에 부합하는 재고 항목이 없습니다.
            </div>
          ) : (
            paginatedItems.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-3 transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
                {/* Header: LPN Barcode & Location Badge */}
                <div className="flex items-center justify-between border-b dark:border-gray-800 pb-2.5">
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1">
                    🔖 {item.lpn_barcode}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg text-xs">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    {item.zone ? item.zone.replace(/^Zone\s*/gi, '').replace(/Rack\s*0*/gi, '').replace(/Shelf\s*0*/gi, '').replace(/\s+/g, '').replace(/--+/g, '-') : 'A-1-1'}
                  </span>
                </div>

                {/* Body: Thumbnail + Title + Author/Publisher */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 shadow-2xs">
                    <img
                      src={`https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_${item.book?.isbn || '9791163033455'}.jpg`}
                      alt={item.book?.title || 'Book Cover'}
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src = 'https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791163033455.jpg';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-extrabold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
                      {item.book.title}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                      {item.book.author} · {item.book.publisher}
                    </p>
                    <p className="font-mono text-[11px] text-gray-400 font-bold">
                      📖 ISBN: {item.book.isbn}
                    </p>
                  </div>
                </div>

                {/* Footer: Grade Badge + Quantity + Print Action */}
                <div className="flex items-center justify-between pt-2.5 border-t dark:border-gray-800 text-xs">
                  <div>{getGradeBadge(item.grade, item.ubci_score)}</div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="font-mono font-black text-gray-900 dark:text-white text-sm block">
                        {item.zone?.includes('A') ? '15권' : '1권'}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 block">
                        {item.zone?.includes('A') ? '신품통합' : '개별LPN'}
                      </span>
                    </div>

                    <button
                      onClick={() => handlePrintLabel(item)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>라벨</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Data Table (Visible on md:block) */}
        <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold">
                <tr>
                  <th className="p-4 w-44">LPN 바코드</th>
                  <th className="p-4 min-w-[260px]">도서 정보 / ISBN</th>
                  <th className="p-4 w-40 text-center">UBCI 등급 (점수)</th>
                  <th className="p-4 w-36 text-center">보관 위치</th>
                  <th className="p-4 w-28 text-right">보유 수량</th>
                  <th className="p-4 w-36 text-center">입고 일시</th>
                  <th className="p-4 w-28 text-center">라벨 출력</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-400 font-bold">재고 데이터를 불러오는 중...</td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-400 font-bold">조건에 부합하는 재고 항목이 없습니다.</td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/40 dark:hover:bg-gray-800/60 transition-colors">
                      <td className="p-4 font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs whitespace-nowrap">
                        {item.lpn_barcode}
                      </td>

                      {/* Book Info with Cover Thumbnail */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 shadow-2xs">
                            <img
                              src={`https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_${item.book?.isbn || '9791163033455'}.jpg`}
                              alt={item.book?.title || 'Book Cover'}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.target.src = 'https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791163033455.jpg';
                              }}
                            />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-extrabold text-gray-900 dark:text-white text-sm leading-snug truncate max-w-[280px]">
                              {item.book.title}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] font-medium truncate">
                              {item.book.author} | {item.book.publisher}
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 font-mono text-[10px] font-bold">
                              📖 ISBN: {item.book.isbn}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* UBCI Grade & Score */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {getGradeBadge(item.grade, item.ubci_score)}
                      </td>

                      {/* Zone Code (Formatted D-3-3) */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg text-xs shadow-2xs">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          {item.zone ? item.zone.replace(/^Zone\s*/gi, '').replace(/Rack\s*0*/gi, '').replace(/Shelf\s*0*/gi, '').replace(/\s+/g, '').replace(/--+/g, '-') : 'A-1-1'}
                        </span>
                      </td>

                      {/* Quantity Distinction */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className="font-mono font-black text-gray-900 dark:text-white text-base block">
                          {item.zone?.includes('A') ? '15권' : '1권'}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                          {item.zone?.includes('A') ? 'ISBN 신품통합' : 'LPN 1:1개별'}
                        </span>
                      </td>

                      <td className="p-4 text-center text-gray-500 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap font-medium">
                        {item.date}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handlePrintLabel(item)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border border-gray-200 hover:border-indigo-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>라벨</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enhanced 5-Page Window & Direct Jump Pagination Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-gray-500 dark:text-gray-400 font-mono">
            총 <strong className="text-gray-900 dark:text-white font-mono">{filteredItems.length}</strong>개 항목 중 {((safeCurrentPage - 1) * pageSize) + 1}-{Math.min(safeCurrentPage * pageSize, filteredItems.length)} 표시
          </p>

          {/* 5-Page Window & Direct Jump Form */}
          {(() => {
            const windowSize = 5;
            const currentGroup = Math.floor((safeCurrentPage - 1) / windowSize);
            const startPage = currentGroup * windowSize + 1;
            const endPage = Math.min(startPage + windowSize - 1, totalPages);
            const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

            return (
              <div className="flex flex-wrap items-center gap-1 font-mono">
                {/* << 맨 처음 */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="맨 처음 페이지 (1페이지)"
                >
                  &lt;&lt;
                </button>

                {/* < 이전 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="이전 페이지"
                >
                  &lt;
                </button>

                {/* 5개 숫자 버튼 */}
                {visiblePages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                      safeCurrentPage === p
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/30'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {/* > 다음 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="다음 페이지"
                >
                  &gt;
                </button>

                {/* >> 맨 끝 */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={`맨 끝 페이지 (${totalPages}페이지)`}
                >
                  &gt;&gt;
                </button>

                {/* Direct Page Jump Input Field */}
                <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">페이지 바로가기:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = parseInt(jumpPageInput, 10);
                        if (!isNaN(target)) {
                          const safeTarget = Math.max(1, Math.min(totalPages, target));
                          setCurrentPage(safeTarget);
                          setJumpPageInput('');
                        }
                      }
                    }}
                    placeholder={`${safeCurrentPage}`}
                    className="w-14 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-black text-center text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-600 shadow-2xs"
                  />
                  <span className="text-xs font-bold text-gray-400 font-mono">/ {totalPages}</span>
                  <button
                    onClick={() => {
                      const target = parseInt(jumpPageInput, 10);
                      if (!isNaN(target)) {
                        const safeTarget = Math.max(1, Math.min(totalPages, target));
                        setCurrentPage(safeTarget);
                        setJumpPageInput('');
                      }
                    }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-lg transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    이동
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* LPN Label Thermal Print Modal */}
      {activePrintData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl space-y-4 max-w-sm w-full text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-2">
              <h3 className="font-bold text-sm">LPN 바코드 라벨 인쇄 프리뷰</h3>
              <button onClick={() => setActivePrintData(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-sm font-bold cursor-pointer">✕</button>
            </div>
            <div className="flex justify-center border p-2 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden">
              <LpnPrintLabel data={activePrintData} />
            </div>
            <button onClick={() => window.print()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
              🖨️ 라벨 인쇄 실행
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
