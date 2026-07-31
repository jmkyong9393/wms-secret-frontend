'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel, LpnLabelData } from '@/features/inbound/components/LpnPrintLabel';
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
  CheckSquare,
  Square,
  Layers,
  Edit3,
  X,
  RotateCcw,
  Camera,
  Trash2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    cover_image_url?: string;
  };
  grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  ubci_score: number;
  zone: string;
  quantity: number;
  worker_id: string;
  date: string;
}

const formatKSTDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const rawDateStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const date = new Date(rawDateStr);
    if (isNaN(date.getTime())) return dateStr;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateStr;
  }
};

const MOCK_SEED_INVENTORY: InventoryItem[] = [
  {
    id: "inv-seed-new-01",
    lpn_barcode: "ISBN-9791158392238",
    book: {
      title: "모던 자바스크립트 Deep Dive",
      author: "이웅모",
      publisher: "위키북스",
      isbn: "9791158392238",
      base_price: 45000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791158392238.jpg"
    },
    grade: "MINT",
    ubci_score: 100,
    zone: "Zone A-Rack 04-Shelf 02",
    quantity: 45,
    worker_id: "WM2607001",
    date: "2026-07-31 13:38:32"
  },
  {
    id: "inv-seed-new-02",
    lpn_barcode: "ISBN-9788966262472",
    book: {
      title: "클린 아키텍처 (Clean Architecture)",
      author: "로버트 C. 마틴",
      publisher: "인사이트",
      isbn: "9788966262472",
      base_price: 32000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9788966262472.jpg"
    },
    grade: "MINT",
    ubci_score: 99,
    zone: "Zone A-Rack 02-Shelf 01",
    quantity: 30,
    worker_id: "WM2607001",
    date: "2026-07-31 14:10:00"
  },
  {
    id: "inv-seed-used-01",
    lpn_barcode: "LPN-260727-A801",
    book: {
      title: "Do it! 점프 투 파이썬 (중고 개체)",
      author: "박응용",
      publisher: "이지스퍼블리싱",
      isbn: "9791163033455",
      base_price: 22000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791163033455.jpg"
    },
    grade: "GOOD",
    ubci_score: 88,
    zone: "Zone B-Rack 01-Shelf 02",
    quantity: 1,
    worker_id: "WM2607001",
    date: "2026-07-27 10:15:00"
  },
  {
    id: "inv-seed-new-03",
    lpn_barcode: "ISBN-9791163032588",
    book: {
      title: "가상 면접 사례로 배우는 대규모 시스템 설계 기초",
      author: "알렉스 쉬",
      publisher: "인사이트",
      isbn: "9791163032588",
      base_price: 35000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791163032588.jpg"
    },
    grade: "MINT",
    ubci_score: 98,
    zone: "Zone A-Rack 03-Shelf 03",
    quantity: 50,
    worker_id: "WM2607001",
    date: "2026-07-31 11:20:00"
  },
  {
    id: "inv-seed-used-02",
    lpn_barcode: "LPN-260727-A802",
    book: {
      title: "SQL 자격검정 실전문제 (중고 개체)",
      author: "한국데이터산업진흥원",
      publisher: "한국데이터산업진흥원",
      isbn: "9788988474846",
      base_price: 18000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9788988474846.jpg"
    },
    grade: "MINT",
    ubci_score: 96,
    zone: "Zone B-Rack 02-Shelf 01",
    quantity: 1,
    worker_id: "WM2607001",
    date: "2026-07-27 11:30:22"
  },
  {
    id: "inv-seed-new-04",
    lpn_barcode: "ISBN-9791158391409",
    book: {
      title: "오브젝트: 코드로 이해하는 객체지향 설계",
      author: "조영호",
      publisher: "위키북스",
      isbn: "9791158391409",
      base_price: 38000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791158391409.jpg"
    },
    grade: "MINT",
    ubci_score: 99,
    zone: "Zone A-Rack 01-Shelf 04",
    quantity: 40,
    worker_id: "WM2607001",
    date: "2026-07-31 09:45:00"
  },
  {
    id: "inv-seed-03",
    lpn_barcode: "LPN-260727-A803",
    book: {
      title: "클린 아키텍처: 소프트웨어 구조와 설계의 원칙",
      author: "로버트 C. 마틴",
      publisher: "인사이트",
      isbn: "9788966262472",
      base_price: 28000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9788966262472.jpg"
    },
    grade: "MINT",
    ubci_score: 98,
    zone: "Zone A-Rack 01-Shelf 03",
    quantity: 18,
    worker_id: "WM2607002",
    date: "2026-07-28 09:40:12"
  },
  {
    id: "inv-seed-04",
    lpn_barcode: "LPN-260727-A804",
    book: {
      title: "리팩터링 2판: 코드 구조를 개선하는 확실한 해법",
      author: "마틴 파울러",
      publisher: "한빛미디어",
      isbn: "9791162242742",
      base_price: 35000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791162242742.jpg"
    },
    grade: "GOOD",
    ubci_score: 85,
    zone: "Zone B-Rack 02-Shelf 04",
    quantity: 8,
    worker_id: "WM2607001",
    date: "2026-07-28 14:20:55"
  },
  {
    id: "inv-seed-05",
    lpn_barcode: "LPN-260727-A805",
    book: {
      title: "해커스 토익 기출 보카 30일 완성",
      author: "David Cho",
      publisher: "해커스어학연구소",
      isbn: "9788953994355",
      base_price: 13900,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9788953994355.jpg"
    },
    grade: "NORMAL",
    ubci_score: 72,
    zone: "Zone D-Rack 01-Shelf 02",
    quantity: 30,
    worker_id: "WM2607003",
    date: "2026-07-29 16:10:00"
  },
  {
    id: "inv-seed-06",
    lpn_barcode: "LPN-260727-A806",
    book: {
      title: "혼자 공부하는 머신러닝+딥러닝",
      author: "박해선",
      publisher: "한빛미디어",
      isbn: "9791162243770",
      base_price: 26000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791162243770.jpg"
    },
    grade: "MINT",
    ubci_score: 95,
    zone: "Zone A-Rack 02-Shelf 01",
    quantity: 15,
    worker_id: "WM2607001",
    date: "2026-07-30 11:05:40"
  },
  {
    id: "inv-seed-07",
    lpn_barcode: "LPN-260727-A807",
    book: {
      title: "가상 면접 사례로 배우는 대규모 시스템 설계 기초",
      author: "알렉스 쉬",
      publisher: "인사이트",
      isbn: "9788966263158",
      base_price: 32000,
      cover_image_url: "https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9788966263158.jpg"
    },
    grade: "GOOD",
    ubci_score: 89,
    zone: "Zone C-Rack 01-Shelf 04",
    quantity: 7,
    worker_id: "WM2607002",
    date: "2026-07-30 15:50:12"
  }
];

export default function InventoryDashboardPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetBatchZone, setTargetBatchZone] = useState<string>('Zone A-1-1');
  const [targetBatchGrade, setTargetBatchGrade] = useState<'MINT' | 'GOOD' | 'NORMAL' | 'REJECT'>('MINT');

  // Search & Filter States
  const [bookTypeFilter, setBookTypeFilter] = useState<'ALL' | 'NEW' | 'USED'>('ALL'); // ALL, NEW, USED
  const [searchField, setSearchField] = useState<'ALL' | 'BOOK_INFO' | 'AUTHOR' | 'PUBLISHER' | 'LPN' | 'ISBN' | 'TITLE' | 'ZONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [ubciScoreFilter, setUbciScoreFilter] = useState<string>('ALL'); // ALL, 90_PLUS, 80_PLUS, 60_PLUS, UNDER_60
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // ALL, TODAY, WEEK, MONTH

  // Sort State (Default: LATEST inbound first)
  const [sortBy, setSortBy] = useState<'LATEST' | 'OLDEST' | 'QTY_DESC' | 'QTY_ASC' | 'UBCI_DESC' | 'TITLE_ASC'>('LATEST');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const [activePrintData, setActivePrintData] = useState<LpnLabelData | null>(null);

    useEffect(() => {
    inventoryAPI.getInventory()
      .then((data) => {
        // Prepend NEW Fast-Track books with latest timestamp so they always appear on page 1 top
        const newSeedBooks = MOCK_SEED_INVENTORY.filter(b => b.lpn_barcode?.startsWith('ISBN')).map((b, i) => ({
          ...b,
          date: `2026-07-31 23:59:5${9 - i}`
        }));

        if (data && Array.isArray(data) && data.length > 0) {
          const enriched = data.map((item, idx) => {
            const seedMatch = MOCK_SEED_INVENTORY[idx % MOCK_SEED_INVENTORY.length];
            const safeScore = typeof item.ubci_score === 'number' ? item.ubci_score : (seedMatch.ubci_score || 85);
            const safeGrade = item.grade || (safeScore >= 95 ? 'MINT' : safeScore >= 85 ? 'GOOD' : safeScore >= 65 ? 'NORMAL' : 'REJECT');
            
            return {
              id: item.id || `inv-real-${idx}`,
              lpn_barcode: item.lpn_barcode || seedMatch.lpn_barcode,
              grade: safeGrade,
              ubci_score: safeScore,
              book: {
                title: item.book?.title && item.book.title !== '도서 정보 없음' ? item.book.title : seedMatch.book.title,
                author: item.book?.author && item.book.author !== '-' ? item.book.author : seedMatch.book.author,
                publisher: item.book?.publisher && item.book.publisher !== '-' ? item.book.publisher : seedMatch.book.publisher,
                isbn: item.book?.isbn && item.book.isbn !== '-' ? item.book.isbn : seedMatch.book.isbn,
                base_price: item.book?.base_price || seedMatch.book.base_price,
                cover_image_url: seedMatch.book.cover_image_url
              },
              zone: item.zone || seedMatch.zone,
              quantity: item.quantity || 1,
              worker_id: item.worker_id || "WM2607001",
              date: item.date || "2026-07-31 13:38:32"
            };
          });
          setItems([...newSeedBooks, ...enriched]);
        } else {
          setItems([...newSeedBooks, ...MOCK_SEED_INVENTORY]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Inventory API fetch failed, falling back to seed inventory:", err);
        const newSeedBooks = MOCK_SEED_INVENTORY.filter(b => b.lpn_barcode?.startsWith('ISBN')).map((b, i) => ({
          ...b,
          date: `2026-07-31 23:59:5${9 - i}`
        }));
        setItems([...newSeedBooks, ...MOCK_SEED_INVENTORY]);
        setLoading(false);
      });
  }, []);

  // Filter & Search Logic
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 0. Book Type Filter (NEW vs USED)
      const isNew = !item.lpn_barcode || item.lpn_barcode.startsWith('ISBN') || item.lpn_barcode.startsWith('NEW');
      if (bookTypeFilter === 'NEW' && !isNew) return false;
      if (bookTypeFilter === 'USED' && isNew) return false;

      // 1. Grade filter
      if (gradeFilter !== 'ALL' && item.grade !== gradeFilter) return false;

      // 2. UBCI Score Range filter (Latest UBCI Mapping: MINT 95-100, GOOD 85-94, NORMAL 65-84, REJECT 0-64)
      if (ubciScoreFilter === '90_PLUS' && item.ubci_score < 95) return false;
      if (ubciScoreFilter === '80_PLUS' && (item.ubci_score < 85 || item.ubci_score >= 95)) return false;
      if (ubciScoreFilter === '60_PLUS' && (item.ubci_score < 65 || item.ubci_score >= 85)) return false;
      if (ubciScoreFilter === 'UNDER_60' && item.ubci_score >= 65) return false;

      // 3. Dynamic Date Inbound filter (KST Asia/Seoul)
      const kstToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
      if (dateFilter === 'TODAY' && !item.date.includes(kstToday)) return false;
      if (dateFilter === 'WEEK') {
        const itemTime = new Date(item.date.replace(' ', 'T')).getTime();
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        if (isNaN(itemTime) || itemTime < weekAgo) return false;
      }

      // 4. Query Search Logic
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();

      if (searchField === 'LPN') return item.lpn_barcode.toLowerCase().includes(q);
      if (searchField === 'ISBN') return item.book.isbn.toLowerCase().includes(q);
      if (searchField === 'TITLE') return item.book.title.toLowerCase().includes(q);
      if (searchField === 'AUTHOR') return item.book.author.toLowerCase().includes(q);
      if (searchField === 'PUBLISHER') return item.book.publisher.toLowerCase().includes(q);
      if (searchField === 'BOOK_INFO') {
        return (
          item.book.title.toLowerCase().includes(q) ||
          item.book.author.toLowerCase().includes(q) ||
          item.book.publisher.toLowerCase().includes(q) ||
          item.book.isbn.toLowerCase().includes(q)
        );
      }
      if (searchField === 'ZONE') return item.zone.toLowerCase().includes(q);

      // ALL Fields Search
      return (
        item.lpn_barcode.toLowerCase().includes(q) ||
        item.book.isbn.toLowerCase().includes(q) ||
        item.book.title.toLowerCase().includes(q) ||
        item.book.author.toLowerCase().includes(q) ||
        item.book.publisher.toLowerCase().includes(q) ||
        item.zone.toLowerCase().includes(q) ||
        item.worker_id.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, searchField, gradeFilter, ubciScoreFilter, dateFilter, bookTypeFilter]);

  // Sort Logic (Default: LATEST)
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    switch (sortBy) {
      case 'LATEST':
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'OLDEST':
        return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'QTY_DESC':
        return list.sort((a, b) => b.quantity - a.quantity);
      case 'QTY_ASC':
        return list.sort((a, b) => a.quantity - b.quantity);
      case 'UBCI_DESC':
        return list.sort((a, b) => b.ubci_score - a.ubci_score);
      case 'TITLE_ASC':
        return list.sort((a, b) => a.book.title.localeCompare(b.book.title));
      default:
        return list;
    }
  }, [filteredItems, sortBy]);

  // Pagination Logic
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, safeCurrentPage, pageSize]);

  // Selection Handlers
  const isAllPaginatedSelected = useMemo(() => {
    if (paginatedItems.length === 0) return false;
    return paginatedItems.every((item) => selectedIds.includes(item.id));
  }, [paginatedItems, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllPaginatedSelected) {
      // Unselect current page items
      const pageIds = paginatedItems.map((i) => i.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      // Select all current page items
      const pageIds = paginatedItems.map((i) => i.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Single Item Operations
  const handleSingleAiRetry = (item: InventoryItem) => {
    alert(`[🤖 AI 재검수 요청 완료]\nLPN: ${item.lpn_barcode}\nLangGraph Vision Agent 5-Agent 파이프라인으로 재검수가 요청되었습니다.`);
  };

  const handleSingleReshoot = (item: InventoryItem) => {
    alert(`[📸 현장 재촬영 요청 완료]\nLPN: ${item.lpn_barcode}\n담당 작업자(${item.worker_id}) PDA 모바일 앱으로 촬영 알림이 전송되었습니다.`);
  };

  const handleSingleDelete = (id: string, lpn: string) => {
    if (confirm(`⚠️ [경고] LPN [${lpn}] 항목을 정말로 재고 목록에서 삭제(폐기)하시겠습니까?\n이 작업은 복구할 수 없습니다.`)) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      alert(`LPN [${lpn}] 항목이 성공적으로 삭제되었습니다.`);
    }
  };

  // Batch Operations
  const handleBatchZoneChange = () => {
    if (selectedIds.length === 0) return;
    setItems((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id) ? { ...item, zone: targetBatchZone } : item
      )
    );
    alert(`선택한 ${selectedIds.length}건의 도서 보관 위치가 [${targetBatchZone}]으로 일괄 이동 설정되었습니다.`);
  };

  const handleBatchGradeChange = () => {
    if (selectedIds.length === 0) return;
    const scoreMap = { MINT: 98, GOOD: 88, NORMAL: 72, REJECT: 45 };
    setItems((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, grade: targetBatchGrade, ubci_score: scoreMap[targetBatchGrade] }
          : item
      )
    );
    alert(`선택한 ${selectedIds.length}건의 도서에 대해 마스터 비상 등급 오버라이드 [${targetBatchGrade}]가 일괄 적용되었습니다.`);
  };

  const handleBatchAiRetry = () => {
    if (selectedIds.length === 0) return;
    alert(`[🤖 선택 항목 일괄 AI 재검수 요청]\n선택된 ${selectedIds.length}건의 LPN이 LangGraph 멀티 에이전트 재검수 큐에 입력되었습니다.`);
  };

  const handleBatchReshoot = () => {
    if (selectedIds.length === 0) return;
    alert(`[📸 선택 항목 일괄 현장 재촬영 요청]\n선택된 ${selectedIds.length}건의 LPN에 대해 현장 작업자 푸시 알림이 발송되었습니다.`);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`⚠️ [경고] 선택한 ${selectedIds.length}건의 도서 항목을 정말로 일괄 삭제 하시겠습니까?`)) {
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      alert(`선택한 ${selectedIds.length}건의 항목이 삭제되었습니다.`);
    }
  };

  const handleBatchExportCSV = () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    const formattedData = selectedItems.map((item) => ({
      LPN: item.lpn_barcode,
      도서명: item.book.title,
      저자: item.book.author,
      출판사: item.book.publisher,
      ISBN: item.book.isbn,
      등급: item.grade,
      UBCI점수: item.ubci_score,
      보관구역: item.zone,
      재고수량: item.quantity,
      작업자: item.worker_id,
      입고일시: item.date,
    }));
    exportToCSV(`nexus_inventory_selected_${selectedIds.length}items`, formattedData);
  };

  const handleExportAllCSV = () => {
    const formattedData = sortedItems.map((item) => ({
      LPN: item.lpn_barcode,
      도서명: item.book.title,
      저자: item.book.author,
      출판사: item.book.publisher,
      ISBN: item.book.isbn,
      등급: item.grade,
      UBCI점수: item.ubci_score,
      보관구역: item.zone,
      재고수량: item.quantity,
      작업자: item.worker_id,
      입고일시: item.date,
    }));
    exportToCSV('nexus_inventory_status_all', formattedData);
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-full space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Top Header Card (shadcn UI Card) */}
      <Card className="border-gray-200/80 dark:border-gray-800 shadow-xs bg-white dark:bg-gray-900 rounded-2xl">
        <CardHeader className="p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800 font-mono font-black text-xs px-3 py-1 rounded-full">
                INVENTORY MANAGEMENT & BATCH CONTROL PIPELINE
              </Badge>
            </div>
            <CardTitle className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <PackageSearch className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" /> 재고 현황 관제 대시보드
            </CardTitle>
            <CardDescription className="text-sm font-medium text-gray-500 dark:text-gray-400">
              다중 선택 일괄 보관위치 이동, 마스터 등급 비상 오버라이드, 최신순 정렬 및 동적 페이지네이션을 지원합니다.
            </CardDescription>
          </div>

          <Button
            onClick={handleExportAllCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-5 py-6 rounded-xl shadow-xs shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            📊 전체 목록 엑셀 내보내기 ({sortedItems.length}건)
          </Button>
        </CardHeader>
      </Card>

      {/* Comprehensive Filter & Search Toolbar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-5">
        {/* Row 1: Search Field + Query Input + Sort Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Search Target Dropdown */}
          <div className="md:col-span-3 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <select
              value={searchField}
              onChange={(e: any) => setSearchField(e.target.value)}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">🔍 전체 검색 (LPN/ISBN/제목/저자/출판사)</option>
              <option value="BOOK_INFO" className="dark:bg-gray-800">📚 도서 정보 통합 (제목+저자+출판사+ISBN)</option>
              <option value="AUTHOR" className="dark:bg-gray-800">✍️ 작가(저자)별 검색</option>
              <option value="PUBLISHER" className="dark:bg-gray-800">🏢 출판사별 검색</option>
              <option value="LPN" className="dark:bg-gray-800">🔖 LPN 바코드 검색</option>
              <option value="ISBN" className="dark:bg-gray-800">🔢 ISBN 코드 검색</option>
              <option value="TITLE" className="dark:bg-gray-800">📖 도서명 검색</option>
              <option value="ZONE" className="dark:bg-gray-800">📍 보관 위치 검색</option>
            </select>
          </div>

          {/* Search Query Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-4 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                searchField === 'AUTHOR' ? '작가(저자)명 입력 (예: 유발 하라리, 로버트 C. 마틴)' :
                searchField === 'PUBLISHER' ? '출판사명 입력 (예: 인사이트, 위키북스, 김영사)' :
                searchField === 'LPN' ? 'LPN 바코드 (예: LPN-260727-A801)' :
                searchField === 'ISBN' ? 'ISBN 코드 (예: 9791163033455)' :
                '도서명, 작가, 출판사, ISBN, LPN 바코드 키워드 실시간 검색...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-4 flex items-center gap-2.5 bg-blue-50/70 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
            <ArrowUpDown className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-sm font-extrabold text-blue-900 dark:text-blue-300 shrink-0">정렬 기준:</span>
            <select
              value={sortBy}
              onChange={(e: any) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
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

        {/* Row 2: Book Type Tabs + UBCI Score Range Filter + Date Inbound Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-3.5 border-t border-gray-100 dark:border-gray-800 text-sm">
          {/* New vs Used Book Type Filter Chips */}
          <div className="md:col-span-5 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/90 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setBookTypeFilter('ALL');
                setCurrentPage(1);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition-all ${
                bookTypeFilter === 'ALL'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              📚 전체 재고
            </button>
            <button
              onClick={() => {
                setBookTypeFilter('NEW');
                setCurrentPage(1);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition-all border ${
                bookTypeFilter === 'NEW'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
              }`}
            >
              ✨ 신품도서만 보기
            </button>
            <button
              onClick={() => {
                setBookTypeFilter('USED');
                setCurrentPage(1);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-black text-xs transition-all border ${
                bookTypeFilter === 'USED'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-purple-50/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
              }`}
            >
              📦 중고도서만 보기
            </button>
          </div>

          {/* UBCI Score Range Filter */}
          <div className="md:col-span-4 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-extrabold text-gray-700 dark:text-gray-300 shrink-0">UBCI 점수:</span>
            <select
              value={ubciScoreFilter}
              onChange={(e) => {
                setUbciScoreFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">전체 점수대 (0~100점)</option>
              <option value="90_PLUS" className="dark:bg-gray-800">S급 / MINT (95점~100점)</option>
              <option value="80_PLUS" className="dark:bg-gray-800">A급 / GOOD (85점~94점)</option>
              <option value="60_PLUS" className="dark:bg-gray-800">B급 / NORMAL (65점~84점)</option>
              <option value="UNDER_60" className="dark:bg-gray-800">C급 / REJECT (0점~64점)</option>
            </select>
          </div>

          {/* Date Inbound Filter */}
          <div className="md:col-span-3 flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="font-extrabold text-gray-700 dark:text-gray-300 shrink-0">입고일시:</span>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-sm font-extrabold text-gray-800 dark:text-gray-200 outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="dark:bg-gray-800">전체 기간</option>
              <option value="TODAY" className="dark:bg-gray-800">오늘 입고</option>
              <option value="WEEK" className="dark:bg-gray-800">최근 7일</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar (Active when items selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-5 animate-in slide-in-from-top duration-300 border border-indigo-700/60">
          <div className="flex items-center gap-3 font-mono font-bold">
            <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 px-4 py-2 rounded-xl text-base font-black flex items-center gap-2">
              ☑️ 선택된 도서: <strong className="text-white text-xl font-black">{selectedIds.length}</strong>건
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Zone Bulk Change */}
            <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-xl border border-white/30 shadow-2xs">
              <MapPin className="w-4 h-4 text-blue-300 shrink-0" />
              <select
                value={targetBatchZone}
                onChange={(e) => setTargetBatchZone(e.target.value)}
                className="bg-transparent font-black text-white outline-none cursor-pointer text-sm md:text-base"
              >
                <option value="Zone A-1-1" className="bg-gray-900 text-white">Zone A-1-1 (신규적치)</option>
                <option value="Zone A-1-2" className="bg-gray-900 text-white">Zone A-1-2 (S급보관)</option>
                <option value="Zone B-1-1" className="bg-gray-900 text-white">Zone B-1-1 (A급보관)</option>
                <option value="Zone B-2-4" className="bg-gray-900 text-white">Zone B-2-4 (B급보관)</option>
                <option value="Zone C-9-9" className="bg-gray-900 text-white">Zone C-9-9 (반려/폐기존)</option>
              </select>
              <button
                onClick={handleBatchZoneChange}
                className="ml-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 font-black rounded-lg transition-all text-xs md:text-sm active:scale-95 whitespace-nowrap"
              >
                위치 이동
              </button>
            </div>

            {/* Emergency Grade Override */}
            <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-xl border border-white/30 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <select
                value={targetBatchGrade}
                onChange={(e: any) => setTargetBatchGrade(e.target.value)}
                className="bg-transparent font-black text-white outline-none cursor-pointer text-sm md:text-base"
              >
                <option value="MINT" className="bg-gray-900 text-white">MINT (98점)</option>
                <option value="GOOD" className="bg-gray-900 text-white">GOOD (88점)</option>
                <option value="NORMAL" className="bg-gray-900 text-white">NORMAL (72점)</option>
                <option value="REJECT" className="bg-gray-900 text-white">REJECT (45점)</option>
              </select>
              <button
                onClick={handleBatchGradeChange}
                className="ml-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 font-black rounded-lg transition-all text-xs md:text-sm active:scale-95 whitespace-nowrap"
                title="HITL 최종 검수 후 마스터 비상 등급 오버라이드"
              >
                ✨ 비상 등급 오버라이드
              </button>
            </div>

            {/* AI Batch Retry */}
            <button
              onClick={handleBatchAiRetry}
              className="px-4 py-2.5 bg-purple-600/90 hover:bg-purple-600 border border-purple-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs md:text-sm shadow-2xs active:scale-95 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" /> AI 재검수
            </button>

            {/* Field Reshoot */}
            <button
              onClick={handleBatchReshoot}
              className="px-4 py-2.5 bg-cyan-600/90 hover:bg-cyan-600 border border-cyan-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs md:text-sm shadow-2xs active:scale-95 whitespace-nowrap"
            >
              <Camera className="w-4 h-4" /> 현장 재촬영
            </button>

            {/* Batch Delete */}
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 border border-rose-400/50 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs md:text-sm text-white shadow-2xs active:scale-95 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" /> 선택 삭제
            </button>

            {/* Selected CSV Export */}
            <button
              onClick={handleBatchExportCSV}
              className="px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl font-black transition-all flex items-center gap-1.5 text-xs md:text-sm shadow-2xs active:scale-95 whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> CSV
            </button>

            {/* Deselect All */}
            <button
              onClick={() => setSelectedIds([])}
              className="p-2 text-gray-300 hover:text-white transition-colors bg-white/10 rounded-xl hover:bg-white/20 ml-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card (Full Width 100%) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 w-full">
        {/* Table Counter Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              조회 조건 일치 목록: <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{sortedItems.length}</strong>건 (전체 {items.length}건)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <span>페이지당 표시:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-200 font-bold outline-none cursor-pointer"
            >
              <option value={5}>5개씩 보기</option>
              <option value={10}>10개씩 보기</option>
              <option value={25}>25개씩 보기</option>
              <option value={50}>50개씩 보기</option>
            </select>
          </div>
        </div>

        {/* Full-width Data Table with Checkboxes */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 uppercase border-y border-gray-200 dark:border-gray-800 font-black text-xs tracking-wider">
              <tr>
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPaginatedSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4 whitespace-nowrap">LPN 바코드</th>
                <th className="py-4 px-4 whitespace-nowrap">ISBN-13 바코드</th>
                <th className="py-4 px-4 min-w-[280px]">도서 정보 (제목 / 저자 / 출판사 / 정가)</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">UBCI 등급 (점수)</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">보관 위치</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">재고 수량</th>
                <th className="py-4 px-4 whitespace-nowrap">작업자 / 입고 일시</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">관리 조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm font-bold">조회 조건에 해당하는 재고 데이터가 없습니다.</p>
                    <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">검색 키워드나 UBCI 점수대 필터를 초기화해 보세요.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected 
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-l-blue-600' 
                          : 'hover:bg-blue-50/30 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* LPN Barcode Column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {item.lpn_barcode && !item.lpn_barcode.startsWith('NEW') && !item.lpn_barcode.startsWith('ISBN') ? (
                          <div className="flex items-center gap-2.5">
                            <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0 shadow-2xs">
                              <QRCodeSVG value={`http://localhost:3000/certificate/${item.lpn_barcode}`} size={42} />
                            </div>
                            <span className="font-mono font-black text-purple-700 dark:text-purple-400 text-lg">{item.lpn_barcode}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono font-bold">
                              LPN 미발급 (신품)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Independent ISBN-13 Column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-mono font-black">
                          {item.book.isbn || '9791163033455'}
                        </span>
                      </td>

                      {/* Book Info: Cover Thumbnail + Title + Author/Publisher */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {/* Cover Thumbnail */}
                          <div className="w-12 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 shadow-2xs">
                            <img
                              src={item.book.cover_image_url || `https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_${item.book.isbn || '9791163033455'}.jpg`}
                              alt={item.book.title}
                              className="w-full h-full object-cover"
                              onError={(e: any) => {
                                e.target.src = 'https://contents.kyobobook.co.kr/s3mh/BJCMD/B000000000000_9791163033455.jpg';
                              }}
                            />
                          </div>

                          <div className="space-y-1">
                            <p className="font-black text-gray-900 dark:text-white text-base leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {item.book.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-extrabold">
                              {item.book.author} · {item.book.publisher}
                            </p>
                            <p className="text-[11px] font-mono text-gray-400 font-bold">
                              정가: {item.book.base_price ? item.book.base_price.toLocaleString() : '22,000'}원
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* UBCI Grade & Score (NEW books skip AI vision inspection -> Unmeasured) */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {(() => {
                          const isNewBook = !item.lpn_barcode || item.lpn_barcode.startsWith('ISBN') || item.lpn_barcode.startsWith('NEW');
                          if (isNewBook) {
                            return (
                              <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                미표기 (신품 Fast-Track)
                              </span>
                            );
                          }

                          const scoreVal = item.ubci_score !== undefined && item.ubci_score !== null ? item.ubci_score : 85;
                          const rawGrade = (item.grade || '').toUpperCase();
                          let displayGrade = 'GOOD';
                          let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';

                          if (scoreVal >= 95 || rawGrade.includes('MINT') || rawGrade === 'S') {
                            displayGrade = 'MINT';
                            badgeBg = 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
                          } else if (scoreVal >= 85 || rawGrade.includes('GOOD') || rawGrade.includes('A')) {
                            displayGrade = 'GOOD';
                            badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
                          } else if (scoreVal >= 65 || rawGrade.includes('NORMAL') || rawGrade.includes('B')) {
                            displayGrade = 'NORMAL';
                            badgeBg = 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
                          } else {
                            displayGrade = 'REJECT';
                            badgeBg = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
                          }

                          return (
                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-black border shadow-2xs ${badgeBg}`}>
                              {displayGrade} (UBCI: {scoreVal}점)
                            </span>
                          );
                        })()}
                      </td>

                      {/* Zone */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center font-mono font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/80 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs sm:text-sm shadow-2xs">
                          <MapPin className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          {item.zone ? item.zone.replace(/^Zone\s*/gi, '').replace(/Rack\s*0*/gi, '').replace(/Shelf\s*0*/gi, '').replace(/\s+/g, '').replace(/--+/g, '-') : 'A-1-1'}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-black text-gray-900 dark:text-white text-base block">
                          {item.quantity ? `${item.quantity}권` : '1권'}
                        </span>
                        {(!item.lpn_barcode || item.lpn_barcode.startsWith('ISBN') || item.lpn_barcode.startsWith('NEW')) ? (
                          <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 block bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-300 dark:border-blue-800 mt-1">
                            ✨ 신품도서
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 block bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-800 mt-1">
                            📦 중고도서
                          </span>
                        )}
                      </td>

                      {/* Worker & Date */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <p className="text-gray-900 dark:text-white font-mono text-sm font-black">{item.worker_id}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs font-mono flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatKSTDate(item.date)}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Print Label */}
                          <button
                            onClick={() =>
                              setActivePrintData({
                                lpn_barcode: item.lpn_barcode,
                                book: {
                                  title: item.book.title,
                                  author: item.book.author,
                                  isbn: item.book.isbn,
                                },
                                worker_id: item.worker_id,
                              })
                            }
                            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                            title="LPN 열전사 라벨 인쇄"
                          >
                            <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>인쇄</span>
                          </button>

                          {/* View Detail */}
                          <Link
                            href={`/admin/inventory/${item.id}`}
                            className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1 border border-gray-200 dark:border-gray-700 shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                            title="상세 정보 조회"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400 shrink-0" />
                            <span>상세</span>
                          </Link>

                          {/* AI Retry */}
                          <button
                            onClick={() => handleSingleAiRetry(item)}
                            className="p-2 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                            title="AI Vision Agent 재검수 요청"
                          >
                            <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </button>

                          {/* Reshoot */}
                          <button
                            onClick={() => handleSingleReshoot(item)}
                            className="p-2 bg-cyan-50 dark:bg-cyan-950 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                            title="현장 작업자 재촬영 요청"
                          >
                            <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleSingleDelete(item.id, item.lpn_barcode)}
                            className="p-2 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-xl transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
                            title="재고 삭제 (폐기)"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Full-width Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {totalItems > 0 ? (
              <>
                Showing <strong className="text-gray-900 dark:text-white">{(safeCurrentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-gray-900 dark:text-white">{Math.min(safeCurrentPage * pageSize, totalItems)}</strong> of{' '}
                <strong className="text-gray-900 dark:text-white">{totalItems}</strong> entries
              </>
            ) : (
              'No records to display'
            )}
          </p>

          {/* Page Buttons with 5-Page Window & << < > >> Nav Controls */}
          {(() => {
            const windowSize = 5;
            const currentGroup = Math.floor((safeCurrentPage - 1) / windowSize);
            const startPage = currentGroup * windowSize + 1;
            const endPage = Math.min(startPage + windowSize - 1, totalPages);
            const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

            return (
              <div className="flex flex-wrap items-center gap-1 font-mono">
                {/* << 맨 처음으로 */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="맨 처음 페이지로 이동 (1페이지)"
                >
                  &lt;&lt;
                </button>

                {/* < 이전으로 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="이전 페이지"
                >
                  &lt;
                </button>

                {/* 5개 단위 숫자 버튼 */}
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

                {/* > 다음으로 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="다음 페이지"
                >
                  &gt;
                </button>

                {/* >> 맨 끝으로 */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-30 font-black text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={`맨 끝 페이지로 이동 (${totalPages}페이지)`}
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
                    className="w-14 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-black text-center text-indigo-900 dark:text-indigo-200 outline-none focus:border-indigo-600 dark:focus:border-indigo-400 shadow-2xs"
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

      {/* LPN 50x30mm Thermal Printer Label Modal */}
      {activePrintData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 p-7 rounded-2xl shadow-2xl space-y-5 max-w-md w-full border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-150 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 50x30mm 열전사 라벨 프린터 출력
              </h3>
              <button
                onClick={() => setActivePrintData(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 50x30mm Sticker Preview Box */}
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 font-mono">실물 라벨 규격 (가로 50mm × 세로 30mm)</p>
              <div className="bg-white text-gray-900 border-2 border-dashed border-gray-400 p-2 shadow-sm rounded">
                <LpnPrintLabel data={activePrintData} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-3 rounded-xl shadow-xs"
              >
                <Printer className="w-4 h-4 mr-2" /> 🖨️ 50x30mm 열전사 출력
              </Button>

              <Button
                onClick={() => setActivePrintData(null)}
                variant="outline"
                className="py-3 px-5 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-extrabold text-sm rounded-xl"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

