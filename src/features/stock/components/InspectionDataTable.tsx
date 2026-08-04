'use client';

/**
 * 검수 처리 내역 통합 데이터 그리드 (Admin 전체 / Worker 개인 공용 — B안 통합).
 *
 * [수정 이력 2026-08-04]
 * - admin/inspections/page.tsx(365줄)와 worker/inspections/page.tsx(711줄)가 동일 API를
 *   호출하며 테이블/모달/내보내기를 중복 구현하던 것을 이 컴포넌트 1벌로 통합.
 *   scope='MINE'(Worker)일 때만 개인 KPI 카드와 HITL 대기 건 병합이 추가된다.
 * - 기존 admin/inspections는 "AI 검수 리포트" 버튼이 상태만 바꾸고 모달을 렌더하지 않는
 *   죽은 버튼이었다(리포트 모달 미구현) - 공용화로 두 페이지 모두 동일 모달을 사용한다.
 * - localhost:8000 하드코딩 대신 API_BASE_URL 환경변수 기반으로 교체.
 */

import React, { useEffect, useMemo, useState } from 'react';
import MasterPagination from '@/components/common/MasterPagination';
import BookCover from '@/components/BookCover';
import BookCoverModal from '@/components/BookCoverModal';
import { exportToCSV } from '@/lib/exportCsv';
import { adminAPI } from '@/lib/api';
import { API_BASE_URL } from '@/lib/api-client';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import {
  FileCheck, Search, Printer, Eye, Clock, Calendar, CheckCircle2, AlertTriangle,
  XCircle, User, ShieldCheck, Sparkles, Download, BookOpen, X, Filter,
} from 'lucide-react';
import type { InspectionItem, LpnPrintData, StockRole } from '../types';
import { gradeMeta, REASON_CODE_MAP, SCAN_ANGLE_LABELS } from '../utils';
import { LpnPrintModal } from './LpnPrintModal';

type StatusFilter = 'ALL' | 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';
type DateFilter = 'ALL' | 'TODAY' | 'WEEK';

const PAGE_SIZE = 10;

function kstNowStr(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() === 0 ? 9 * 3600 * 1000 : 0));
  return kst.toISOString().replace('T', ' ').substring(0, 19);
}

export function InspectionDataTable({ role, scope }: { role: StockRole; scope: 'ALL' | 'MINE' }) {
  const isMine = scope === 'MINE';
  const currentUser = useAtomValue(currentUserAtom);
  const workerId = currentUser?.employeeId || 'WM2608001';

  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [selectedReportItem, setSelectedReportItem] = useState<InspectionItem | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [zoomBook, setZoomBook] = useState<any | null>(null);
  const [activePrintData, setActivePrintData] = useState<LpnPrintData | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  // 메뉴 개편(2026-08-04)으로 관리자 메뉴의 "나의 검수 내역" 항목이 제거되고,
  // 이 페이지 안의 [전체|내 검수만] 토글이 그 역할을 흡수했다 (ADMIN 뷰 전용).
  const [mineOnly, setMineOnly] = useState(false);

  // 1) 검수 완료 이력 (available-books 기반)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/orders/available-books`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const items = await res.json();
        if (!items?.length) return;
        const mapped: InspectionItem[] = items.map((it: any) => ({
          id: it.id,
          lpn_barcode: it.lpn || (it.isNew ? 'LPN 미발급 (신품)' : `LPN-260803-${String(it.id).slice(-6).toUpperCase()}`),
          book: {
            title: it.title || '도서 정보 없음',
            author: it.author || '저자미상',
            publisher: it.publisher || '출판사미상',
            isbn: it.isbn || '-',
            base_price: it.listPrice || 15000,
            cover_image_url: it.cover_image_url || '',
          },
          ubci_score: it.ubciScore ?? (it.isNew ? 100 : 85),
          grade: it.isNew ? 'NEW_FASTTRACK' : it.conditionGrade || 'GOOD',
          status: 'AUTO_APPROVED',
          worker_id: workerId,
          inspected_at: it.created_at
            ? new Date(it.created_at).toISOString().replace('T', ' ').substring(0, 19)
            : kstNowStr(),
          ai_confidence: 98.5,
          defects_found: [{ reason_code: 'DMG_NONE', description: 'AI 파이프라인 검수 완료 (자동 승인)', confidence: 0.98 }],
          image_urls: it.cover_image_url ? [it.cover_image_url] : [],
        }));
        setInspections((prev) => {
          const existing = new Set(prev.map((i) => i.id));
          return [...prev, ...mapped.filter((i) => !existing.has(i.id))];
        });
      } catch (err) {
        console.warn('Failed to fetch inspection items from backend API', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) HITL 승인 대기 건 병합 (Worker 개인 뷰 전용)
  useEffect(() => {
    if (!isMine) return;
    (async () => {
      try {
        if (!adminAPI?.getPendingHitlTasks) return;
        const data = await adminAPI.getPendingHitlTasks();
        if (!Array.isArray(data) || !data.length) return;
        const realItems: InspectionItem[] = data.map((item: any) => {
          const raw = item.created_at ? new Date(item.created_at) : new Date();
          const kst = new Date(raw.getTime() + (raw.getTimezoneOffset() === 0 ? 9 * 3600 * 1000 : 0));
          const score = item.ubci_score ?? 65;
          const defects =
            item.agent_logs?.defects?.length > 0
              ? item.agent_logs.defects.map((d: any) => ({
                  reason_code: d.type || 'DMG_INT_DOODLE',
                  description: d.description || `${d.type} 감점`,
                  confidence: d.confidence ? Math.round(d.confidence * 100) : 96.8,
                }))
              : [{ reason_code: 'DMG_INT_DOODLE', description: 'AI 판독 결함 상세 미기재', confidence: 96.8 }];
          return {
            id: `insp-${item.id}`,
            lpn_barcode: item.agent_logs?.lpn_barcode || `LPN-${String(item.id).substring(0, 4).toUpperCase()}`,
            book: {
              title: item.book_title || '도서 정보 없음',
              author: '-',
              publisher: '-',
              isbn: item.isbn || '-',
              base_price: 0,
              cover_image_url: item.cover_image_url || '',
            },
            ubci_score: score,
            grade: gradeMeta('', score).display,
            status: 'HITL_PENDING' as const,
            worker_id: workerId,
            inspected_at: kst.toISOString().replace('T', ' ').substring(0, 19),
            ai_confidence: 96.8,
            defects_found: defects,
            image_urls: item.image_urls?.length ? item.image_urls : [],
          };
        });
        setInspections((prev) => {
          const existing = new Set(prev.map((i) => i.id));
          return [...realItems.filter((i) => !existing.has(i.id)), ...prev];
        });
      } catch (e) {
        console.error('Failed to fetch HITL pending items:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMine]);

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        i.book.title.toLowerCase().includes(term) ||
        i.book.author.toLowerCase().includes(term) ||
        i.book.isbn.includes(term) ||
        i.lpn_barcode.toLowerCase().includes(term);

      const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;

      // 관리자 [내 검수만] 토글: 본인 사번이 담당자로 기록된 건만
      if (mineOnly && !(i.worker_id || '').includes(workerId)) return false;

      let matchDate = true;
      if (dateFilter === 'TODAY') {
        const kstToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
        matchDate = i.inspected_at.includes(kstToday);
      } else if (dateFilter === 'WEEK') {
        const t = new Date(i.inspected_at.replace(' ', 'T'));
        matchDate = isNaN(t.getTime()) || t.getTime() >= Date.now() - 7 * 24 * 3600 * 1000;
      }
      return matchSearch && matchStatus && matchDate;
    });
  }, [inspections, searchTerm, statusFilter, dateFilter, mineOnly, workerId]);

  const totalPages = Math.ceil(filteredInspections.length / PAGE_SIZE) || 1;
  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInspections.slice(start, start + PAGE_SIZE);
  }, [filteredInspections, currentPage]);

  // Worker 개인 KPI
  const kstToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const todayCount = inspections.filter((i) => i.inspected_at.startsWith(kstToday)).length;
  const autoApprovalCount = inspections.filter((i) => i.status === 'AUTO_APPROVED').length;
  const autoApprovalRate = inspections.length ? ((autoApprovalCount / inspections.length) * 100).toFixed(1) : '0.0';
  const hitlCount = inspections.filter((i) => i.status === 'HITL_PENDING').length;

  const handleExportCSV = () => {
    const rows = filteredInspections.map((i) => ({
      검수ID: i.id,
      LPN바코드: i.lpn_barcode,
      도서명: i.book.title,
      저자: i.book.author,
      ISBN: i.book.isbn,
      UBCI점수: i.ubci_score,
      등급: i.grade,
      판정상태: i.status,
      AI신뢰도: `${i.ai_confidence}%`,
      검수일시: i.inspected_at,
    }));
    exportToCSV(isMine ? `nexus_worker_inspection_audit_${workerId}` : 'admin_inspections_history', rows);
  };

  const isNewBook = (item: InspectionItem) =>
    item.lpn_barcode.includes('미발급') || item.grade === 'NEW_FASTTRACK' || item.grade === 'NEW';

  const openReport = (item: InspectionItem) => {
    setSelectedReportItem(item);
    setActiveImgIdx(0);
  };

  const openZoom = (item: InspectionItem) =>
    setZoomBook({
      title: item.book.title,
      author: item.book.author,
      publisher: item.book.publisher,
      isbn: item.book.isbn,
      cover_image_url: item.book.cover_image_url,
      base_price: item.book.base_price,
      lpn_barcode: item.lpn_barcode,
    });

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              {isMine ? (
                <><User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> WORKER PERSONAL INSPECTION AUDIT LOG</>
              ) : (
                <><ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> ADMIN SYSTEM WMS INSPECTIONS AUDIT LOG</>
              )}
            </span>
            {!isMine && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">전체 입고 & 신품 Fast-Track 관제</span>}
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {isMine ? '나의 검수 처리 내역' : '통합 검수 처리 내역 (Admin/Worker 동기화)'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            {isMine ? (
              <>작업자 <strong className="text-gray-900 dark:text-white font-extrabold font-mono">[{workerId}]</strong> 님이 현장에서 진행한 AI 검수 및 반품 입고 판독 히스토리입니다.</>
            ) : (
              '신품 Fast-Track 바이패스 건 및 중고 AI 멀티에이전트 검수 내역을 실시간으로 모니터링합니다.'
            )}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>검수 내역 엑셀 내보내기 ({filteredInspections.length}건)</span>
        </button>
      </div>

      {/* Worker 개인 KPI 카드 */}
      {isMine && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <span>오늘 검수한 총 도서</span>
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">
              {todayCount}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">권</span>
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <span>AI 검수 자동 승인율</span>
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {autoApprovalRate}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">%</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">LangGraph Supervisor 자동 패스</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <span>HITL 매니저 재검수 이관</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {hitlCount}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Supervisor 이관 - 관리자 결재 대기</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <span>총 검수 이력</span>
              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
              {inspections.length}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
            </p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="도서명, 저자, LPN 바코드, ISBN 검색..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* 관리자 전용: 전체 / 내 검수만 스코프 토글 (구 "나의 검수 내역" 메뉴 흡수) */}
            {role === 'ADMIN' && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setMineOnly(false); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all ${
                    !mineOnly ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => { setMineOnly(true); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all ${
                    mineOnly ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  내 검수만
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-500 dark:text-gray-400">
              <Filter className="w-3.5 h-3.5" />
              <span>판독 결과:</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl outline-none bg-gray-50/50 dark:bg-gray-800 dark:text-white text-xs font-bold"
              >
                <option value="ALL">전체 결과</option>
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
                onChange={(e) => { setDateFilter(e.target.value as DateFilter); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl outline-none bg-gray-50/50 dark:bg-gray-800 dark:text-white text-xs font-bold"
              >
                <option value="ALL">전체 날짜</option>
                <option value="TODAY">오늘</option>
                <option value="WEEK">최근 1주일</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">
            총 검수 항목: <strong className="text-blue-600 dark:text-blue-400 font-mono">{filteredInspections.length}</strong>건
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left table-fixed">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 font-bold">
              <tr>
                <th className="py-3.5 px-4 w-36">LPN 바코드</th>
                <th className="py-3.5 px-4">도서 정보</th>
                <th className="py-3.5 px-4 text-center w-48">UBCI 등급 (점수)</th>
                <th className="py-3.5 px-4 text-center w-40">AI 판독 결과</th>
                <th className="py-3.5 px-4 text-center w-32">AI 신뢰도</th>
                <th className="py-3.5 px-4 text-center w-40">검수 시각</th>
                <th className="py-3.5 px-4 text-right w-56">작업 기능</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedInspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 dark:text-gray-500 font-medium">
                    조건에 해당하는 검수 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedInspections.map((item) => {
                  const isNew = isNewBook(item);
                  const meta = gradeMeta(item.grade, item.ubci_score);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-4 px-4 font-mono font-black text-xs text-gray-900 dark:text-white">{item.lpn_barcode}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <BookCover
                            src={item.book.cover_image_url}
                            title={item.book.title}
                            author={item.book.author}
                            isbn={item.book.isbn}
                            className="w-10 h-14"
                          />
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{item.book.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-extrabold">{item.book.author} · {item.book.publisher}</p>
                            <p className="text-[11px] font-mono text-gray-400 font-bold">
                              정가: {item.book.base_price ? item.book.base_price.toLocaleString() : '-'}원 | {item.book.isbn}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {isNew ? (
                          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            미표기 (신품 Fast-Track)
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold font-mono border ${meta.badge}`}>
                            {meta.display} ({item.ubci_score}점)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isNew ? (
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Fast-Track 승인
                          </span>
                        ) : item.status === 'AUTO_APPROVED' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                            <CheckCircle2 className="w-3.5 h-3.5" /> AI 자동 승인
                          </span>
                        ) : item.status === 'HITL_PENDING' ? (
                          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                            <AlertTriangle className="w-3.5 h-3.5" /> HITL 승인 대기
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 w-max mx-auto">
                            <XCircle className="w-3.5 h-3.5" /> 입고 반려 (REJECT)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {isNew ? (
                          <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            스킵 (Fast-Track)
                          </span>
                        ) : (
                          `${item.ai_confidence}%`
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-400 text-center">{item.inspected_at}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isNew ? (
                            <>
                              <button
                                onClick={() => openReport(item)}
                                className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                              >
                                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span>AI 검수 리포트</span>
                              </button>
                              {isMine && (
                                <button
                                  onClick={() =>
                                    setActivePrintData({
                                      lpn_barcode: item.lpn_barcode,
                                      book: { title: item.book.title, author: item.book.author, isbn: item.book.isbn },
                                      worker_id: item.worker_id,
                                    })
                                  }
                                  className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                                >
                                  <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  <span>라벨 인쇄</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => openZoom(item)}
                              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-extrabold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                              <span>도서 상세정보</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <MasterPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalEntries={filteredInspections.length}
          currentCount={paginatedInspections.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* AI 검수 리포트 모달 (다중 각도 이미지 + 결함 상세) */}
      {selectedReportItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200 text-gray-900 dark:text-white max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-gray-800 pb-3">
              <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" /> AI 멀티에이전트 검수 상세 리포트
              </h3>
              <button onClick={() => setSelectedReportItem(null)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50/70 dark:bg-blue-950/60 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex justify-between items-center text-sm font-bold">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-black">{selectedReportItem.lpn_barcode}</p>
                  <p className="text-base text-gray-900 dark:text-white font-black mt-0.5">{selectedReportItem.book.title}</p>
                </div>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300 font-mono">
                  {gradeMeta(selectedReportItem.grade, selectedReportItem.ubci_score).display} ({selectedReportItem.ubci_score}점)
                </span>
              </div>

              {selectedReportItem.image_urls && selectedReportItem.image_urls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span>📷 선택한 스캔 각도: <strong>{SCAN_ANGLE_LABELS[activeImgIdx] || `각도 ${activeImgIdx + 1}`}</strong></span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">[{activeImgIdx + 1} / {selectedReportItem.image_urls.length}]</span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-72 flex items-center justify-center bg-gray-950 p-3">
                    <img
                      src={selectedReportItem.image_urls[activeImgIdx] || selectedReportItem.image_urls[0]}
                      alt="AI Multi Angle Inspection Scan"
                      className="object-contain max-h-64 w-full rounded-lg"
                    />
                  </div>
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
                          <p className="font-bold">{SCAN_ANGLE_LABELS[idx] || `각도 ${idx + 1}`}</p>
                          <p className="text-[10px] text-gray-400 font-mono">raw_{idx}.jpg</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Vision Agent 결함 감지 내역 (공식 reason_code 분류)
                </h4>
                <div className="space-y-2">
                  {selectedReportItem.defects_found.map((defect, idx) => {
                    const dm = REASON_CODE_MAP[defect.reason_code] || {
                      label: defect.reason_code,
                      category: '기타 결함',
                      color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                    };
                    return (
                      <div key={idx} className="p-3.5 rounded-xl border bg-gray-50 dark:bg-gray-800/60 dark:border-gray-700 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border font-mono ${dm.color}`}>
                            [{defect.reason_code}] {dm.label}
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

      <LpnPrintModal data={activePrintData} onClose={() => setActivePrintData(null)} />
      <BookCoverModal isOpen={!!zoomBook} onClose={() => setZoomBook(null)} book={zoomBook} />
    </div>
  );
}
