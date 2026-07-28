'use client';

import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel, LpnLabelData } from '@/features/inbound/components/LpnPrintLabel';
import { exportToCSV } from '@/lib/exportCsv';
import {
  FileCheck,
  Search,
  Printer,
  Eye,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  User,
  ShieldCheck,
  Sparkles,
  Download,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InspectionItem {
  id: string;
  lpn_barcode: string;
  book: {
    title: string;
    author: string;
    publisher: string;
    isbn: string;
  };
  ubci_score: number;
  grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  status: 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';
  worker_id: string;
  inspected_at: string;
  ai_confidence: number;
  defects_found: Array<{
    reason_code: string;
    description: string;
    confidence: number;
  }>;
  bbox_image_url?: string;
  image_urls?: string[];
}

const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  FP_SHADOW: { label: '그림자 오탐 방어', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐 방어', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_STAIN: { label: '내부 낙서/오염', category: '내부 훼손', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  DMG_NONE: { label: '결함 없음 (정상)', category: '정상 승인', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
};

export default function WorkerInspectionsPage() {
  const currentWorkerId = 'WM2607001';
  const [activePrintData, setActivePrintData] = useState<LpnLabelData | null>(null);
  const [selectedReportItem, setSelectedReportItem] = useState<InspectionItem | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState<number>(0);

  // Initial Inspection History Data with Multi-angle images
  const [inspections, setInspections] = useState<InspectionItem[]>([
    {
      id: 'insp-001',
      lpn_barcode: 'LPN-260727-A801',
      book: {
        title: 'Do it! 점프 투 파이썬 (개정 2판)',
        author: '박응용',
        publisher: '이지스퍼블리싱',
        isbn: '9791163033455',
      },
      ubci_score: 99,
      grade: 'MINT',
      status: 'AUTO_APPROVED',
      worker_id: 'WM2607001',
      inspected_at: '2026-07-27 17:45:10',
      ai_confidence: 99.8,
      defects_found: [
        { reason_code: 'DMG_NONE', description: '최상급 완벽 신품 상태 판독', confidence: 99.8 }
      ],
      image_urls: [
        'http://localhost:8000/experiment_data/job-21555c2e/raw_0.jpg',
        'http://localhost:8000/experiment_data/job-21555c2e/raw_1.jpg'
      ]
    },
    {
      id: 'insp-002',
      lpn_barcode: 'LPN-260727-A799',
      book: {
        title: '모던 자바스크립트 Deep Dive',
        author: '이웅모',
        publisher: '위키북스',
        isbn: '9791158392238',
      },
      ubci_score: 97,
      grade: 'MINT',
      status: 'AUTO_APPROVED',
      worker_id: 'WM2607001',
      inspected_at: '2026-07-27 15:10:25',
      ai_confidence: 98.5,
      defects_found: [
        { reason_code: 'FP_SHADOW', description: '그림자 오탐 방어 성공 (S급 승인)', confidence: 98.5 }
      ],
      image_urls: [
        'http://localhost:8000/experiment_data/job-ab3fd33e/raw_0.jpg',
        'http://localhost:8000/experiment_data/job-ab3fd33e/raw_1.jpg'
      ]
    },
    {
      id: 'insp-003',
      lpn_barcode: 'LPN-260727-A796',
      book: {
        title: '사피엔스 (Sapiens)',
        author: '유발 하라리',
        publisher: '김영사',
        isbn: '9788934972464',
      },
      ubci_score: 98,
      grade: 'MINT',
      status: 'AUTO_APPROVED',
      worker_id: 'WM2607001',
      inspected_at: '2026-07-27 10:30:15',
      ai_confidence: 99.2,
      defects_found: [
        { reason_code: 'FP_GLARE', description: '빛 반사 오탐 제어 완료', confidence: 99.2 }
      ],
      image_urls: [
        'http://localhost:8000/experiment_data/job-01749160/raw_0.jpg',
        'http://localhost:8000/experiment_data/job-01749160/raw_1.jpg'
      ]
    },
    {
      id: 'insp-004',
      lpn_barcode: 'LPN-260726-A754',
      book: {
        title: '이것이 자바다 (개정판)',
        author: '신용권',
        publisher: '한빛미디어',
        isbn: '9788965402603',
      },
      ubci_score: 42,
      grade: 'REJECT',
      status: 'REJECTED',
      worker_id: 'WM2607001',
      inspected_at: '2026-07-26 13:40:00',
      ai_confidence: 96.1,
      defects_found: [
        { reason_code: 'DMG_EXT_TEAR', description: '표지 전면 대형 찢어짐 80% 감지', confidence: 96.1 }
      ],
      image_urls: [
        'http://localhost:8000/experiment_data/job-615ccd20/raw_0.jpg',
        'http://localhost:8000/experiment_data/job-615ccd20/raw_1.jpg',
        'http://localhost:8000/experiment_data/job-615ccd20/raw_2.jpg'
      ]
    },
    {
      id: 'insp-005',
      lpn_barcode: 'LPN-260726-A740',
      book: {
        title: '클린 코드: 애자일 소프트웨어 태도',
        author: '로버트 C. 마틴',
        publisher: '인사이트',
        isbn: '9788966260560',
      },
      ubci_score: 89,
      grade: 'GOOD',
      status: 'HITL_PENDING',
      worker_id: 'WM2607001',
      inspected_at: '2026-07-26 11:15:30',
      ai_confidence: 84.0,
      defects_found: [
        { reason_code: 'DMG_INT_STAIN', description: '내지 상단 옅은 밑줄 흔적 (HITL 수동 확인 이관)', confidence: 84.0 }
      ],
      image_urls: [
        'http://localhost:8000/experiment_data/job-c9e85407/raw_0.jpg',
        'http://localhost:8000/experiment_data/job-c9e85407/raw_1.jpg',
        'http://localhost:8000/experiment_data/job-c9e85407/raw_2.jpg',
        'http://localhost:8000/experiment_data/job-c9e85407/raw_3.jpg'
      ]
    }
  ]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK'>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleOpenReportModal = (item: InspectionItem) => {
    setSelectedReportItem(item);
    setActiveImgIdx(0);
  };

  const handleExportCSV = () => {
    const exportData = filteredInspections.map((i) => ({
      검수ID: i.id,
      LPN바코드: i.lpn_barcode,
      도서명: i.book.title,
      ISBN: i.book.isbn,
      UBCI점수: i.ubci_score,
      등급: i.grade,
      판정상태: i.status,
      AI신뢰도: `${i.ai_confidence}%`,
      검수일시: i.inspected_at,
    }));
    exportToCSV(`nexus_worker_inspection_audit_${currentWorkerId}`, exportData);
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const matchSearch =
        i.book.title.includes(searchTerm) ||
        i.book.isbn.includes(searchTerm) ||
        i.book.author.includes(searchTerm) ||
        i.lpn_barcode.includes(searchTerm);

      const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;

      let matchDate = true;
      if (dateFilter === 'TODAY') {
        matchDate = i.inspected_at.startsWith('2026-07-27');
      } else if (dateFilter === 'WEEK') {
        matchDate = i.inspected_at.startsWith('2026-07-2');
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [inspections, searchTerm, statusFilter, dateFilter]);

  const totalPages = Math.ceil(filteredInspections.length / pageSize) || 1;
  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInspections.slice(start, start + pageSize);
  }, [filteredInspections, currentPage]);

  const todayCount = inspections.filter((i) => i.inspected_at.startsWith('2026-07-27')).length;
  const autoApprovalCount = inspections.filter((i) => i.status === 'AUTO_APPROVED').length;
  const autoApprovalRate = inspections.length ? ((autoApprovalCount / inspections.length) * 100).toFixed(1) : '0.0';

  const ANGLE_LABELS = ['각도 1 (전면 표지)', '각도 2 (측면 / 책등)', '각도 3 (후면 표지)', '각도 4 (상하단 / 내지)'];

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-extrabold font-mono flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> WORKER PERSONAL INSPECTION AUDIT LOG
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" /> 나의 검수 처리 내역
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">
            작업자 <strong className="text-gray-900 dark:text-white font-extrabold font-mono">[{currentWorkerId}]</strong> 님이 현장에서 진행한 AI 검수 및 반품 입고 판독 히스토리입니다.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl transition-all shadow-xs active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4 mr-2" />
          📊 나의 검수 내역 엑셀 내보내기 ({filteredInspections.length}건)
        </button>
      </div>

      {/* Worker Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>오늘 검수한 총 도서</span>
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">{todayCount}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">권</span></p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">목표 달성률 100% (정상)</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>AI 검수 자동 승인율</span>
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{autoApprovalRate}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">%</span></p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">LangGraph Supervisor 자동 패스</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>HITL 매니저 재검수 이관</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {inspections.filter(i => i.status === 'HITL_PENDING').length}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Critic Agent 정밀 검증 심사 중</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>평균 검수 처리 속도</span>
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">18<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">초/권</span></p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">↑ 전월 대비 2초 단축</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="도서명, 저자, 출판사, LPN 바코드, ISBN 검색..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <Filter className="w-3.5 h-3.5" />
              <span>판독 결과:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white text-xs font-bold"
              >
                <option value="ALL">전체 결과 보기</option>
                <option value="AUTO_APPROVED">AI 자동 승인</option>
                <option value="HITL_PENDING">HITL 승인 대기</option>
                <option value="REJECTED">반품/폐기 (REJECT)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>검수 일자:</span>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white text-xs font-bold"
              >
                <option value="ALL">전체 날짜</option>
                <option value="TODAY">오늘 (2026-07-27)</option>
                <option value="WEEK">최근 1주일</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Inspections History Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">
            총 검수 항목: <strong className="text-blue-600 dark:text-blue-400 font-mono">{filteredInspections.length}</strong>건
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 font-bold">
              <tr>
                <th className="py-3.5 px-4">LPN 바코드</th>
                <th className="py-3.5 px-4">도서 정보</th>
                <th className="py-3.5 px-4 text-center">UBCI 등급 (점수)</th>
                <th className="py-3.5 px-4 text-center">AI 판독 결과</th>
                <th className="py-3.5 px-4 text-center">AI 신뢰도</th>
                <th className="py-3.5 px-4">검수 시각</th>
                <th className="py-3.5 px-4 text-right">작업 기능</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedInspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 dark:text-gray-500 font-medium">
                    조건에 해당하는 나의 검수 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedInspections.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/20 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                      <div className="flex items-center gap-2">
                        <QRCodeSVG value={item.lpn_barcode} size={28} />
                        <span>{item.lpn_barcode}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-extrabold text-gray-900 dark:text-white text-sm">{item.book.title}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                        {item.book.author} | {item.book.publisher} | <span className="font-mono">{item.book.isbn}</span>
                      </p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${
                        item.grade === 'MINT' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                        item.grade === 'GOOD' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                        item.grade === 'NORMAL' ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                        'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      }`}>
                        {item.grade} ({item.ubci_score}점)
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {item.status === 'AUTO_APPROVED' && (
                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                          <CheckCircle2 className="w-3.5 h-3.5" /> AI 자동 승인
                        </span>
                      )}
                      {item.status === 'HITL_PENDING' && (
                        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                          <AlertTriangle className="w-3.5 h-3.5" /> HITL 승인 대기
                        </span>
                      )}
                      {item.status === 'REJECTED' && (
                        <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                          <XCircle className="w-3.5 h-3.5" /> 입고 반려 (REJECT)
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                      {item.ai_confidence}%
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {item.inspected_at}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenReportModal(item)}
                          className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>다각도 AI 리포트</span>
                        </button>

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
                          className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold rounded-xl transition-all text-sm flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>라벨 인쇄</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 text-sm">
          <p className="text-gray-500 dark:text-gray-400 font-mono">
            Showing <strong className="text-gray-900 dark:text-white">{paginatedInspections.length}</strong> of{' '}
            <strong className="text-gray-900 dark:text-white">{filteredInspections.length}</strong> entries
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 font-bold text-xs"
            >
              <ChevronLeft className="w-4 h-4 inline" /> 이전
            </button>
            <span className="font-mono font-bold text-xs px-2 text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 font-bold text-xs"
            >
              다음 <ChevronRight className="w-4 h-4 inline" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Multi-Angle AI Inspection Report Modal */}
      {selectedReportItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200 text-gray-900 dark:text-white max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" /> AI 5-Agent 다각도 스캔 검수 상세 리포트
              </h3>
              <button
                onClick={() => setSelectedReportItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50/70 dark:bg-blue-950/60 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex justify-between items-center text-sm font-bold">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-black">{selectedReportItem.lpn_barcode}</p>
                  <p className="text-base text-gray-900 dark:text-white font-black mt-0.5">{selectedReportItem.book.title}</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono">{selectedReportItem.grade} ({selectedReportItem.ubci_score}점)</span>
                </div>
              </div>

              {/* Multi-Angle Image Viewer */}
              {selectedReportItem.image_urls && selectedReportItem.image_urls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span>📷 선택한 스캔 각도: <strong>{ANGLE_LABELS[activeImgIdx] || `각도 ${activeImgIdx + 1}`}</strong></span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">[{activeImgIdx + 1} / {selectedReportItem.image_urls.length}]</span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-72 flex items-center justify-center bg-gray-950 p-3 relative">
                    <img
                      src={selectedReportItem.image_urls[activeImgIdx] || selectedReportItem.image_urls[0]}
                      alt="AI Multi Angle Inspection Scan"
                      className="object-contain max-h-64 w-full rounded-lg"
                    />
                  </div>

                  {/* Thumbnail Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {selectedReportItem.image_urls.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImgIdx(idx)}
                        className={`p-1.5 rounded-xl border transition-all text-left flex items-center gap-2 cursor-pointer ${
                          activeImgIdx === idx 
                            ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 ring-2 ring-blue-500/30' 
                            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <img src={url} alt={`Thumb ${idx}`} className="w-10 h-10 object-cover rounded-lg border shrink-0" />
                        <div className="text-[11px] truncate">
                          <p className="font-bold">{ANGLE_LABELS[idx] || `각도 ${idx + 1}`}</p>
                          <p className="text-[10px] text-gray-400 font-mono">raw_{idx}.jpg</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vision Agent 결함 감지 내역 (공식 reason_code 분류)</h4>
                <div className="space-y-2">
                  {selectedReportItem.defects_found.map((defect, idx) => {
                    const meta = REASON_CODE_MAP[defect.reason_code] || {
                      label: defect.reason_code,
                      category: '기타 결함',
                      color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                    };

                    return (
                      <div key={idx} className="p-3.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 dark:border-gray-700 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border font-mono ${meta.color}`}>
                            [{defect.reason_code}] {meta.label}
                          </span>
                          <span className="font-extrabold text-gray-900 dark:text-white">{defect.description}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 shrink-0">
                          신뢰도: <strong className="text-blue-700 dark:text-blue-400 font-extrabold">{defect.confidence}%</strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedReportItem(null)}
                className="px-5 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Print Modal */}
      {activePrintData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setActivePrintData(null)}>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl relative border border-gray-200 dark:border-gray-800 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" /> LPN 열전사 라벨 출력 미리보기 (50x30mm)
              </h4>
              <button onClick={() => setActivePrintData(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700">
              <LpnPrintLabel data={activePrintData} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
                프린터로 출력
              </Button>
              <Button variant="outline" onClick={() => setActivePrintData(null)} className="text-xs font-bold">
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
