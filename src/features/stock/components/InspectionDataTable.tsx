'use client';
import { API_BASE_URL } from '@/shared/api/api-client';

/**
 * 검수 처리 내역 통합 데이터 그리드 (Admin 전체 / Worker 개인 공용 — B안 통합).
 *
 * 
 * - admin/inspections/page.tsx(365줄)와 worker/inspections/page.tsx(711줄)가 동일 API를
 *   호출하며 테이블/모달/내보내기를 중복 구현하던 것을 이 컴포넌트 1벌로 통합.
 *   scope='MINE'(Worker)일 때만 개인 KPI 카드와 HITL 대기 건 병합이 추가된다.
 * - 기존 admin/inspections는 "AI 검수 리포트" 버튼이 상태만 바꾸고 모달을 렌더하지 않는
 *   죽은 버튼이었다(리포트 모달 미구현) - 공용화로 두 페이지 모두 동일 모달을 사용한다.
 * - localhost:8000 하드코딩 대신 API_BASE_URL 환경변수 기반으로 교체.
 */

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import MasterPagination from '@/shared/ui/MasterPagination';
import BookCover from '@/entities/book/ui/BookCover';
import BookCoverModal from '@/entities/book/ui/BookCoverModal';
import { exportToCSV } from '@/shared/lib/exportCsv';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import {
  FileCheck, Search, Printer, Eye, Clock, Calendar, CheckCircle2, AlertTriangle,
  XCircle, User, ShieldCheck, Sparkles, Download, BookOpen, X, Filter,
} from 'lucide-react';
import type { InspectionItem, StockRole } from '../types';
import type { LpnPrintData } from '@/entities/label/model/types';
import { gradeMeta, REASON_CODE_MAP, SCAN_ANGLE_LABELS } from '../utils';
import { LpnPrintModal } from '@/entities/label/ui/LpnPrintModal';

type StatusFilter = 'ALL' | 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';
type DateFilter = 'ALL' | 'TODAY' | 'WEEK';

const PAGE_SIZE = 10;

/**
 * 신품(Fast-Track) 도서의 LPN 자리에 표시할 문구.
 * 신품은 사진 촬영·AI 검수를 건너뛰고 바코드만으로 즉시 입고되므로 LPN이 없다.
 * 종전 문구는 'LPN 미발급 (신품)'이었으나, 모바일에서 두 줄로 깨지고 "미발급"이라는
 * 부정 표현이 오류처럼 읽혀 '신품'으로 줄였다.
 */
const NEW_BOOK_LPN_LABEL = '신품';

/** LPN이 아직 부여되지 않은 검수 건의 표기. 번호를 지어내지 않는다. */
const LPN_UNISSUED_LABEL = 'LPN 미부여';

/** UBCI 점수 표기. 판정 전이라 값이 없으면 기본 점수를 넣지 않고 미산출로 적는다. */
const scoreText = (score: number | null | undefined) => (score == null ? '미산출' : `${score}점`);

/**
 * `return_jobs.status` → 화면 상태.
 *
 * 원장은 파이프라인 진행 상태를, 화면은 결재 관점(자동승인/결재대기/반려)을 쓴다.
 * 아직 판정이 끝나지 않은 진행 중 상태(PENDING, PROCESSING 등)는 사람이 손댈 곳이
 * 결재 대기이므로 HITL_PENDING으로 모은다.
 */
function toInspectionStatus(raw: string | null | undefined): InspectionItem['status'] {
  const s = (raw || '').toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'AUTO_APPROVED') return 'AUTO_APPROVED';
  if (s === 'REJECTED' || s === 'FAILED') return 'REJECTED';
  return 'HITL_PENDING';
}

/**
 * 서버 agent_logs의 결함 배열을 화면 모델로 변환한다.
 *
 * confidence는 서버가 0~1 실수로 준다. 종전 모달은 이 값을 그대로 "%"에 붙여
 * `0.98%`로 표시했다 - 신뢰도 98%가 0.98%로 보이면 판독이 실패한 것처럼 읽힌다.
 * 1을 넘는 값(이미 백분율)은 그대로 두어 양쪽 표기를 모두 받아낸다.
 */
function toInspectionDefects(raw: unknown): InspectionItem['defects_found'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((d: Record<string, unknown>) => {
    const c = Number(d.confidence ?? 0);
    const parts: string[] = [];
    if (d.ratio != null) parts.push(`면적 ${d.ratio}%`);
    if (d.level != null) parts.push(`강도 ${d.level}단계`);
    // 증거 대조 검증이 오탐으로 지목한 건은 감점에서 빠졌다는 사실을 같이 보여준다.
    if (d.evidence_suspect) parts.push('증거 대조 결과 오탐 의심 (감점 제외)');
    // HITL 관리자가 오탐으로 제외/직접 추가한 표식을 이 목록이 무시하고
    // 있었다 - 관리자가 5건을 제외해 최종 1건만 반영됐어도 화면은 6건 전부를 "탐지된
    // 결함"으로 보여줘 점수(높은 점수)와 목록(많은 결함)이 서로 모순돼 보였다.
    if (d.hitl_excluded) parts.push('관리자 오탐 판정 (감점 미반영)');
    if (d.hitl_added) parts.push('관리자 직접 추가');
    return {
      reason_code: String(d.type ?? d.reason_code ?? 'UNKNOWN'),
      description: String(d.description ?? (parts.length ? parts.join(' · ') : '상세 설명 없음')),
      confidence: Math.round(c <= 1 ? c * 100 : c),
      excluded: Boolean(d.hitl_excluded),
    };
  });
}

export function InspectionDataTable({ role, scope }: { role: StockRole; scope: 'ALL' | 'MINE' }) {
  const isMine = scope === 'MINE';
  const currentUser = useAtomValue(currentUserAtom);
  // 세션이 아직 로드되지 않았을 때 특정 사번으로 폴백하면 그 계정의 검수 이력이
  // 조회된다. 값이 없으면 조회 자체를 하지 않는다.
  const workerId = currentUser?.employeeId ?? null;

  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [selectedReportItem, setSelectedReportItem] = useState<InspectionItem | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [zoomBook, setZoomBook] = useState<any | null>(null);
  const [activePrintData, setActivePrintData] = useState<LpnPrintData | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  // 메뉴 개편(2026-08-04)으로 관리자 메뉴의 "나의 검수 내역" 항목이 제거되고,
  // 이 페이지 안의 [전체|내 검수만] 토글이 그 역할을 흡수했다 (ADMIN 뷰 전용).
  const [mineOnly, setMineOnly] = useState(false);

  // 검수 처리 이력.
  //
  // 원장은 `return_jobs`다 — 검수 파이프라인이 실제로 처리한 건만 기록된다.
  // 판매 가능 재고(available-books)는 "지금 팔 수 있는 물건" 목록이지 검수 이력이 아니므로
  // 이 화면의 소스가 될 수 없다. 백엔드가 점수·등급·담당자를 null로 내려주면 null 그대로
  // 두고 화면에서 미산출로 표기한다.
  useEffect(() => {
    // 세션이 아직 없으면 조회하지 않는다. 이전 사용자의 목록이 남지 않도록 비운다.
    if (isMine && !workerId) {
      setInspections([]);
      return;
    }
    (async () => {
      try {
        const qs = new URLSearchParams({ limit: '200' });
        // 서버가 세션에서 대상자를 정한다. 이 값은 화면 표시용 힌트일 뿐이며,
        // 남의 사번을 넣어도 서버가 무시한다(returns/router.py의 인가 참조).
        if (isMine) qs.set('scope', 'mine');

        const res = await fetch(`${API_BASE_URL}/api/v1/returns/inspections?${qs}`, {
          credentials: 'include',   // 쿠키 세션을 실어야 서버가 조회자를 식별한다
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const payload = await res.json();
        const items: any[] = payload?.items ?? [];

        setInspections(
          items.map((it) => ({
            id: it.job_id,
            lpn_barcode: it.lpn_barcode || LPN_UNISSUED_LABEL,
            book: {
              title: it.book?.title || '도서 정보 없음',
              author: it.book?.author || '-',
              publisher: it.book?.publisher || '-',
              isbn: it.book?.isbn || '-',
              base_price: it.book?.base_price ?? 0,
              cover_image_url: it.book?.cover_image_url || '',
            },
            ubci_score: it.ubci_score ?? null,
            grade: it.grade ?? null,
            confirmed_grade: it.confirmed_grade ?? null,
            status: toInspectionStatus(it.status),
            // 검수 담당자는 등급을 확정한 주체다. 조회자 사번(workerId)을 쓰면
            // 누가 보느냐에 따라 담당자가 바뀐다.
            worker_id: it.inspector_label || '등급 미확정',
            worker_label: it.worker_label || '작업자 미기록',
            inspected_at: it.updated_at || it.created_at || '',
            // 결함별 판독 신뢰도의 평균. 결함이 없으면 근거가 없어 null이다.
            ai_confidence: it.avg_defect_confidence != null ? Math.round(it.avg_defect_confidence * 1000) / 10 : null,
            // 결함 상세와 실촬영 이미지는 목록 응답에 없다. 모달을 열 때
            // /inventory/{id}로 실제 판독 결과를 받아 채운다(openReport 참조).
            defects_found: [],
            image_urls: [],
          })),
        );
      } catch (err) {
        console.warn('검수 처리 이력 조회 실패', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMine, workerId]);

  // KST 기준 오늘(YYYY-MM-DD). Intl 객체 생성은 비싸므로 마운트 시 한 번만 만든다.
  const kstToday = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()),
    []
  );

  // 키 입력마다 전체 재필터링으로 입력이 버벅이지 않게 지연 값으로 계산한다.
  const deferredTerm = useDeferredValue(searchTerm);

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      const term = deferredTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        i.book.title.toLowerCase().includes(term) ||
        i.book.author.toLowerCase().includes(term) ||
        i.book.isbn.includes(term) ||
        i.lpn_barcode.toLowerCase().includes(term);

      const matchStatus = statusFilter === 'ALL' || i.status === statusFilter;

      // 관리자 [내 검수만] 토글: 본인 사번이 담당자로 기록된 건만
      // 세션이 없으면(workerId=null) 본인 판정이 불가능하므로 아무것도 통과시키지 않는다.
      if (mineOnly && (!workerId || !(i.worker_id || '').includes(workerId))) return false;

      let matchDate = true;
      if (dateFilter === 'TODAY') {
        matchDate = i.inspected_at.includes(kstToday);
      } else if (dateFilter === 'WEEK') {
        const t = new Date(i.inspected_at.replace(' ', 'T'));
        matchDate = isNaN(t.getTime()) || t.getTime() >= Date.now() - 7 * 24 * 3600 * 1000;
      }
      return matchSearch && matchStatus && matchDate;
    });
  }, [inspections, deferredTerm, statusFilter, dateFilter, mineOnly, workerId, kstToday]);

  const totalPages = Math.ceil(filteredInspections.length / PAGE_SIZE) || 1;
  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInspections.slice(start, start + PAGE_SIZE);
  }, [filteredInspections, currentPage]);

  // Worker 개인 KPI. 지표마다 배열을 훑지 않고 한 번의 순회로 집계한다.
  const { todayCount, autoApprovalCount, hitlCount } = useMemo(() => {
    let today = 0, auto = 0, hitl = 0;
    for (const i of inspections) {
      if (i.inspected_at.startsWith(kstToday)) today++;
      if (i.status === 'AUTO_APPROVED') auto++;
      if (i.status === 'HITL_PENDING') hitl++;
    }
    return { todayCount: today, autoApprovalCount: auto, hitlCount: hitl };
  }, [inspections, kstToday]);
  const autoApprovalRate = inspections.length ? ((autoApprovalCount / inspections.length) * 100).toFixed(1) : '0.0';

  const handleExportCSV = () => {
    const rows = filteredInspections.map((i) => ({
      검수ID: i.id,
      LPN바코드: i.lpn_barcode,
      도서명: i.book.title,
      저자: i.book.author,
      ISBN: i.book.isbn,
      UBCI점수: i.ubci_score ?? '미산출',
      등급: i.grade,
      판정상태: i.status,
      AI신뢰도: i.ai_confidence != null ? `${i.ai_confidence}%` : '미기록',
      검수일시: i.inspected_at,
    }));
    exportToCSV(isMine ? `nexus_worker_inspection_audit_${workerId}` : 'admin_inspections_history', rows);
  };

  // 종전에는 lpn_barcode 문자열에 '미발급'이 포함되는지로 신품을 판정했다.
  // 표시 문구를 바꾸는 순간 판정이 깨지는 구조라, 라벨 간소화('LPN 미발급 (신품)' -> '신품')와
  // 함께 문자열 의존을 끊는다. 등급 기반 판정을 우선하고, 라벨은 폴백으로만 본다.
  const isNewBook = (item: InspectionItem) =>
    item.grade === 'NEW_FASTTRACK' ||
    item.grade === 'NEW' ||
    item.lpn_barcode === NEW_BOOK_LPN_LABEL;

  /**
   * 리포트 모달을 연다.
   *
   * 종전에는 목록 행 객체를 그대로 모달에 넘겼다. 그런데 목록의
   * `defects_found`/`ai_confidence`/`image_urls`는 available-books 응답에 없는 값이라
   * **컴포넌트가 만들어낸 자리표시자**였다(모든 건이 "[DMG_NONE] 결함 없음, 신뢰도 0.98").
   * 그래서 결함 4건으로 HITL 이관된 건도 "결함 없음 · 자동 승인"으로 보였고,
   * 이미지도 실촬영 사진이 아니라 알라딘 표지 한 장이었다.
   *
   * 목록 전체(172건)에 대해 상세를 미리 받는 것은 낭비이므로, 모달을 열 때 그 한 건만
   * `/inventory/{id}`로 조회해 실제 판독 결과로 덮어쓴다. 실패 시 목록 값으로 남되
   * 자리표시자 결함은 비워서 "없는 결함이 있다고 말하는" 상태를 만들지 않는다.
   */
  const openReport = async (item: InspectionItem) => {
    setSelectedReportItem(item);
    setActiveImgIdx(0);

    // 신품(Fast-Track)은 촬영·AI 검수를 거치지 않는다(ISBN 통권 관리). 조회할 판독
    // 결과가 없으므로 요청을 보내지 않고, 모달이 그 사실을 명시하도록 비워 둔다.
    if (isNewBook(item)) {
      setSelectedReportItem({ ...item, defects_found: [], image_urls: [] });
      return;
    }

    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/inventory/${encodeURIComponent(item.id)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`detail ${res.status}`);
      const d = await res.json();
      const logs = d.agent_logs || {};
      setSelectedReportItem({
        ...item,
        lpn_barcode: d.lpn_barcode || item.lpn_barcode,
        ubci_score: d.ubci_score ?? item.ubci_score,
        grade: d.grade || item.grade,
        worker_id: d.inspector?.label || d.worker_id || item.worker_id,
        image_urls: Array.isArray(d.image_urls) && d.image_urls.length ? d.image_urls : item.image_urls,
        defects_found: toInspectionDefects(logs.defects),
        ai_confidence: item.ai_confidence,
      });
    } catch (err) {
      console.warn('검수 상세 조회 실패 - 자리표시자 결함은 표시하지 않는다', err);
      setSelectedReportItem({ ...item, defects_found: [] });
    } finally {
      setReportLoading(false);
    }
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

        {/*
          모바일 전용 카드 목록.
          현장 작업자는 스마트폰에서 이 화면을 보는데, 7컬럼 표는 가로 스크롤 없이는
          읽을 수 없고 우측 "작업 기능" 버튼이 화면 밖으로 밀려 사실상 접근 불가였다.
          좁은 화면에서는 표를 숨기고 카드로 세로 배치한다 (md 이상에서는 기존 표 유지).
        */}
        <div className="md:hidden space-y-2.5">
          {paginatedInspections.length === 0 ? (
            <p className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm font-medium">
              조건에 해당하는 검수 내역이 없습니다.
            </p>
          ) : (
            paginatedInspections.map((item) => {
              const isNew = isNewBook(item);
              const meta = gradeMeta(item.grade, item.ubci_score);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (isNew ? openZoom(item) : openReport(item))}
                  className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 flex gap-3 active:scale-[0.99] transition-transform shadow-2xs"
                >
                  <BookCover
                    src={item.book.cover_image_url}
                    title={item.book.title}
                    author={item.book.author}
                    isbn={item.book.isbn}
                    className="w-12 h-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug">
                      {item.book.title}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold truncate">
                      {item.book.author} · {item.book.publisher}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {isNew ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          <Sparkles className="w-3 h-3 text-indigo-500" /> 신품 Fast-Track
                        </span>
                      ) : (
                        <>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${meta.badge}`}>
                            {meta.display} {scoreText(item.ubci_score)}
                          </span>
                          {item.status === 'AUTO_APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> 자동 승인
                            </span>
                          ) : item.status === 'HITL_PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3" /> 승인 대기
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                              <XCircle className="w-3 h-3" /> 반려
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate pt-0.5">
                      {item.lpn_barcode} · {item.inspected_at}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          {/*
            table-fixed 상태에서 고정 폭 컬럼 합이 테이블 전체 폭과
            같아지면 폭 미지정인 "도서 정보" 컬럼이 0px로 붕괴해 내용이 옆 컬럼과 겹쳐 보였다.
            재고 그리드와 동일하게 auto 레이아웃 + min-width로 전환.
          */}
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 font-bold">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">LPN 바코드</th>
                <th className="py-3.5 px-4 min-w-[280px]">도서 정보</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">UBCI 등급 (점수)</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">AI 판독 결과</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">AI 신뢰도</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">검수 시각</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">작업 기능</th>
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
                    // 행 전체를 탭하면 상세가 열린다.
                    // 모바일(Worker 셸)에서는 표가 가로로 넘쳐 우측 "작업 기능" 버튼이
                    // 화면 밖으로 밀려 사실상 접근 불가였다. 우측 버튼은 데스크톱용으로
                    // 그대로 두고, 행 클릭이라는 넓은 타겟을 추가한다.
                    // 중고=AI 검수 리포트 / 신품=도서 상세정보로 각각 연다.
                    <tr
                      key={item.id}
                      onClick={() => (isNew ? openZoom(item) : openReport(item))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          isNew ? openZoom(item) : openReport(item);
                        }
                      }}
                      aria-label={`${item.book.title} 상세 보기`}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                    >
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
                            {meta.display} ({scoreText(item.ubci_score)})
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
                        ) : item.ai_confidence != null ? (
                          `${item.ai_confidence}%`
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-normal">미기록</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-400 text-center">{item.inspected_at}</td>
                      {/* 행 클릭 핸들러가 붙어 있으므로, 버튼 클릭이 위로 전파되어
                          엉뚱한 모달까지 함께 열리지 않도록 이 셀에서 차단한다. */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                                      worker_id: item.worker_label,
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
                  {gradeMeta(selectedReportItem.grade, selectedReportItem.ubci_score).display} ({scoreText(selectedReportItem.ubci_score)})
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

              {/* 신품은 검수 이력이 없는 것이 정상이다. 빈 결함 목록을 "결함 없음"으로
                  보여주면 검수해서 깨끗했다는 뜻이 되므로, 경로 자체를 구분해 표기한다. */}
              {isNewBook(selectedReportItem) ? (
                <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 space-y-1.5">
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                    Fast-Track 입고 — AI 검수 대상이 아닙니다
                  </p>
                  <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    신품은 공장 출하 상태가 동일해 개별 LPN을 발급하지 않고 ISBN 단위 수량으로
                    관리합니다. 촬영·판독 단계를 거치지 않으므로 결함 목록과 스캔 이미지가 없습니다.
                  </p>
                  <p className="text-xs font-mono text-amber-700 dark:text-amber-400 pt-1">
                    ISBN {selectedReportItem.book.isbn} · 입고 {selectedReportItem.inspected_at}
                  </p>
                </div>
              ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Vision Agent 결함 감지 내역 (공식 reason_code 분류)
                </h4>
                <div className="space-y-2">
                  {reportLoading && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-3">판독 결과를 불러오는 중…</p>
                  )}
                  {!reportLoading && selectedReportItem.defects_found.length === 0 && (
                    <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      검출된 결함이 없습니다.
                    </div>
                  )}
                  {selectedReportItem.defects_found.map((defect, idx) => {
                    const dm = REASON_CODE_MAP[defect.reason_code] || {
                      label: defect.reason_code,
                      category: '기타 결함',
                      color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                    };
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${
                          defect.excluded
                            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 opacity-60'
                            : 'bg-gray-50 dark:bg-gray-800/60 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black border font-mono ${dm.color} ${defect.excluded ? 'line-through' : ''}`}>
                            [{defect.reason_code}] {dm.label}
                          </span>
                          <span className={`font-extrabold text-gray-900 dark:text-white ${defect.excluded ? 'line-through' : ''}`}>{defect.description}</span>
                          {defect.excluded && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black">제외됨</span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 shrink-0">
                          신뢰도: <strong className="text-blue-700 dark:text-blue-400 font-extrabold">{defect.confidence}%</strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
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
