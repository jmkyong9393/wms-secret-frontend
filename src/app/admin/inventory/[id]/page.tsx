'use client';
import { API_BASE_URL } from '@/shared/api/api-client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { ArrowLeft, Printer, ShieldCheck, MapPin, Tag, UserCheck, Package, ExternalLink, Bot, Image as ImageIcon, AlertTriangle, RotateCcw } from 'lucide-react';

import BookCover from '@/components/BookCover';
import { InspectionEvidenceViewer } from '@/features/stock/components/InspectionEvidenceViewer';
import { PipelineTracePanel } from '@/features/stock/components/PipelineTracePanel';
import { LpnPrintModal } from '@/features/stock/components/LpnPrintModal';
import type { LpnPrintData } from '@/features/stock/types';
import { adminAPI } from '@/shared/api/api';
import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  resolveExcludedDefectCoordinates,
  type PerImageDefectCoordinate,
} from '@/features/inspection/utils/inspectionImageService';

interface InspectorInfo {
  inspection_source: string;
  inspected_by?: string | null;
  inspected_at?: string | null;
  inbound_worker_id?: string | null;
  label: string;
}

interface InventoryDetailData {
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
  grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT' | 'NEW_FASTTRACK';
  ubci_score: number | null;
  zone: string;
  quantity: number;
  worker_id: string;
  /** 라벨 인쇄용 - AI/HITL 판정 주체(worker_id)가 아니라 실제 입고 처리한 사람. */
  worker_label?: string;
  inspector?: InspectorInfo;
  date: string;
  image_urls?: string[];
  agent_logs?: any;
  final_report?: string | null;
  certificate?: any;
  /** 백엔드 orders/pricing.py가 산정한 가격 내역 (프론트는 렌더만) */
  pricing?: {
    list_price: number;
    used_retail_price: number;
    b2b_supply_price: number;
    category_raw?: string | null;
    category_normalized: string;
    category_retail_rate: number;
    category_b2b_rate: number;
    condition_factor: number;
    days_in_inventory: number;
    discount_rate_vs_list: number;
  } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || `${API_BASE_URL}`;


export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inventoryId = params?.id as string;

  const [data, setData] = useState<InventoryDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePrintData, setActivePrintData] = useState<LpnPrintData | null>(null);
  const [isReinspecting, setIsReinspecting] = useState<boolean>(false);
  // HITL 회수. 되돌리기는 판매 가능 재고에서 빼는 동작이라 확인 절차를 거친다.
  const [recallOpen, setRecallOpen] = useState<boolean>(false);
  const [recallReason, setRecallReason] = useState<string>('');
  const [isRecalling, setIsRecalling] = useState<boolean>(false);

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/inventory/${inventoryId}`);
      if (res.status === 404) throw new Error('해당 재고를 찾을 수 없습니다.');
      if (!res.ok) throw new Error('재고 상세 정보를 불러오는데 실패했습니다.');
      setData(await res.json());
    } catch (err: any) {
      // [수정 이력] 예전에는 조회 실패 시 SQL 수험서 목업 데이터를 대신 렌더했다.
      // 실패를 성공처럼 보여줘 어떤 재고를 보고 있는지 알 수 없었으므로 에러를 그대로 표시한다.
      console.error(err);
      setError(err?.message || '알 수 없는 오류가 발생했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    if (!inventoryId) return;
    fetchDetail();
  }, [inventoryId, fetchDetail]);

  const handleReinspect = async () => {
    if (!data) return;
    try {
      setIsReinspecting(true);
      // [수정 이력] 경로에 /hitl이 빠져 있어 이 버튼은 항상 404였다 (실제 라우터 prefix는
      // /admin/hitl). 재고 ID를 보내면 백엔드가 source_job_id로 원본 검수 작업을 찾아간다.
      const res = await fetch(`${API_BASE}/api/v1/admin/hitl/${data.id}/re-inspect`, { method: 'POST' });
      if (!res.ok) throw new Error('AI 재검수 요청에 실패했습니다.');
      await res.json();

      // 재검수는 Celery 비동기다(실측 54초). 큐 등록 직후 재조회하면 이전 데이터가
      // 그대로 보여 "완료됐는데 안 바뀐다"로 읽힌다 - 판정 갱신 시각(agent_logs의
      // 마지막 node_timings)이 바뀔 때까지 폴링하고, 그때까지 완료를 선언하지 않는다.
      const stampOf = (d: InventoryDetailData | null) => {
        const t = d?.agent_logs?.node_timings;
        return Array.isArray(t) && t.length ? String(t[t.length - 1]?.at ?? '') : String(d?.date ?? '');
      };
      const before = stampOf(data);
      const POLL_MS = 5000;
      const MAX_WAIT_MS = 180000; // YOLO 콜드스타트 포함 최악 케이스 여유
      const t0 = Date.now();
      let done = false;
      while (Date.now() - t0 < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const poll = await fetch(`${API_BASE}/api/v1/inventory/${inventoryId}`);
        if (!poll.ok) continue;
        const fresh: InventoryDetailData = await poll.json();
        if (stampOf(fresh) !== before) {
          setData(fresh);
          done = true;
          break;
        }
      }
      if (done) {
        alert('AI 재검수가 완료되었습니다. 상세 결과가 화면에 반영되었습니다.');
      } else {
        alert('재검수가 아직 진행 중입니다. 큐 등록은 완료됐으니 잠시 후 새로고침으로 확인해 주세요.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReinspecting(false);
    }
  };

  const handleRecall = async () => {
    if (!data) return;
    try {
      setIsRecalling(true);
      // 재고 ID를 보내면 백엔드가 source_job_id로 원본 검수 작업을 찾아간다.
      const res = await adminAPI.recallToHitl(data.id, recallReason.trim() || undefined);
      setRecallOpen(false);
      setRecallReason('');
      await fetchDetail();
      alert(res.message);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'HITL 회수에 실패했습니다.');
    } finally {
      setIsRecalling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm">도서 상세 정보를 패칭 중입니다...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-900 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 재고 목록으로 돌아가기
        </button>
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-rose-900 dark:text-rose-200">재고 상세를 불러오지 못했습니다</h2>
            <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">{error}</p>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-2 font-mono">ID: {inventoryId}</p>
          </div>
        </div>
      </div>
    );
  }

  const isNewBook =
    !data.lpn_barcode ||
    data.lpn_barcode.includes('미발급') ||
    data.lpn_barcode.includes('신품') ||
    data.lpn_barcode.startsWith('ISBN') ||
    data.lpn_barcode.startsWith('NEW') ||
    (data.grade as string) === 'NEW_FASTTRACK';

  // 이미 결재 대기면 되돌릴 것이 없다. 판정 원장은 inspector.inspection_source다.
  const isPendingHitl = data.inspector?.inspection_source === 'PENDING_HITL';

  const images = resolveInspectionImages(data);
  const defectCoords: PerImageDefectCoordinate[] = resolveDefectCoordinates(data);
  // HITL 관리자가 "결함 아님"으로 제외한 건. 확정 오버레이에서는 빠지지만,
  // 몇 건을 왜 걷어냈는지는 남겨야 판정 근거를 추적할 수 있다.
  const excludedCoords: PerImageDefectCoordinate[] = resolveExcludedDefectCoordinates(data);
  const excludedCount = excludedCoords.reduce((n, c) => n + c.bboxes.length, 0);
  const logs = data.agent_logs || {};
  const executedAgents: string[] = logs.executed_agents || [];
  const totalDefects = defectCoords.reduce((n, c) => n + c.bboxes.length, 0);

  // WBF 3-YOLO 앙상블 사전탐지 후보. Vision이 채택하지 않은 것도 그대로 남아 있어,
  // 검수자가 "AI가 무엇을 보고 무엇을 기각했는지"까지 대조할 수 있다.
  // Vision Agent가 도서를 식별하지 못한 촬영 컷 (작업자 얼굴만 찍힘, 빈 배경 등).
  // "결함 0건이라 정상"과 "애초에 책이 안 찍혔다"는 완전히 다른 사실이므로 구분해 표시한다.
  const invalidImageIndexes: number[] = Array.isArray(logs.invalid_image_indexes)
    ? logs.invalid_image_indexes.map(Number)
    : [];

  const yoloCandidates: any[] = Array.isArray(logs.yolo_candidates) ? logs.yolo_candidates : [];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans bg-gray-50 dark:bg-gray-950 min-h-dvh text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Bar */}
      {/* [2026-08-06 모바일 대응] 좁은 화면에서 버튼 4개가 가로로 넘치던 것을 줄바꿈 허용으로 교체 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-900 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          재고 목록으로 돌아가기
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {isNewBook ? (
            <span className="flex items-center px-4 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-black rounded-xl border border-blue-200 dark:border-blue-800">
              ⚡ 신품 Fast-track 입고 완료
            </span>
          ) : (
            <>
              <button
                onClick={() =>
                  setActivePrintData({
                    lpn_barcode: data.lpn_barcode,
                    book: { title: data.book.title, author: data.book.author, isbn: data.book.isbn },
                    worker_id: data.worker_label || data.worker_id,
                  })
                }
                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                50x31mm 라벨 인쇄
              </button>

              <button
                onClick={handleReinspect}
                disabled={isReinspecting}
                className={`flex items-center px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                  isReinspecting ? 'bg-gray-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isReinspecting ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-1.5" />
                ) : (
                  <Bot className="w-4 h-4 mr-1.5" />
                )}
                {isReinspecting ? 'AI 재검수 진행 중...' : 'AI 재검수 요청'}
              </button>

              {/* 판정이 실물과 다를 때 사람이 되돌리는 경로. 되돌린 건은 관리자 결재
                  전까지 판매 가능 재고에서 빠진다. */}
              <button
                onClick={() => setRecallOpen(true)}
                disabled={isRecalling || isPendingHitl}
                title={isPendingHitl ? '이미 관리자 결재 대기 상태입니다' : undefined}
                className={`flex items-center px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs ${
                  isRecalling || isPendingHitl
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                }`}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                {isPendingHitl ? '결재 대기 중' : isRecalling ? '되돌리는 중...' : 'HITL로 되돌리기'}
              </button>

              {/*
                [수정 이력] 이 버튼은 /certificate/[lpn]로 갔지만 그 페이지가 role에 따라
                내부 조회 화면을 대신 띄워서, "고객 공개용 보증서 미리보기"를 눌러도 관리자에게는
                LPN 내부 조회가 나왔다. 내부 조회는 /lpn/[lpn]으로 분리했고 이 버튼은
                이제 순수 고객 화면으로 직행한다.
              */}
              {/*
                [2026-08-06 모바일 대응] target="_blank" 제거.
                모바일 브라우저는 링크로 여는 새 탭을 팝업으로 간주해 차단하는 경우가 있고,
                그러면 "탭이 열렸다가 바로 닫히는" 것처럼 보인다(현장 실측 증상).
                같은 탭 이동으로 바꾸면 Next Link의 클라이언트 라우팅이라 즉시 전환되고,
                뒤로가기로 상세 화면 스크롤 위치까지 복원된다. 데스크톱에서도 손해가 없다.
              */}
              <Link
                href={`/certificate/${data.lpn_barcode}`}
                className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                고객 공개용 보증서 미리보기
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs p-6 md:p-8 space-y-6 transition-colors">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div className="flex gap-4 items-start">
            <BookCover
              src={data?.book?.cover_image_url}
              title={data?.book?.title || '신품 도서'}
              author={data?.book?.author || ''}
              isbn={data?.book?.isbn || ''}
              className="w-20 h-28"
            />
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {isNewBook ? (
                  <>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-mono font-bold shadow-2xs inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      LPN 미발급 (신품)
                    </span>
                    <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      미표기 (신품 Fast-Track)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-mono font-bold">
                      {data.lpn_barcode}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        data.grade === 'MINT'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      UBCI {data.ubci_score ?? '-'}점 ({data.grade} 등급)
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{data.book.title}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                {data.book.author} | {data.book.publisher} | ISBN:{' '}
                <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{data.book.isbn}</span>
              </p>
            </div>
          </div>

          {!isNewBook && (
            <div className="bg-gray-50 dark:bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0 self-start md:self-center flex flex-col items-center gap-1.5">
              {/* QR 대비 확보를 위해 다크 모드에서도 배경은 흰색을 유지한다 (스캔 가독성) */}
              {/*
                QR은 /lpn/[lpn]을 가리킨다. 직원(WORKER/ADMIN/MASTER)이 스캔하면 내부 조회
                화면이 열리고, 고객/비로그인 사용자는 그 페이지가 자동으로 고객용 보증서로
                전환시킨다.
              */}
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/lpn/${data.lpn_barcode}`} size={70} />
              <span className="text-[9px] text-gray-400 font-bold">LPN 스캔</span>
            </div>
          )}
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50/70 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" /> 적치 로케이션 (Zone-Rack-Shelf)
            </span>
            <p className="text-base sm:text-lg font-mono font-black text-indigo-950 dark:text-indigo-200">
              {data.zone
                ? data.zone.replace(/^Zone\s*/gi, '').replace(/Rack\s*0*/gi, '').replace(/Shelf\s*0*/gi, '').replace(/\s+/g, '').replace(/--+/g, '-')
                : '미할당'}
            </p>
          </div>

          <div className="bg-gray-50/70 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-indigo-600" /> 재고 수량
            </span>
            <p className="text-base sm:text-lg font-mono font-black text-gray-900 dark:text-white flex items-center gap-1">
              {data.quantity ? `${data.quantity}권` : '1권'}
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-sans ml-1">
                ({isNewBook ? '⚡ Fast-track 신품 입고' : '중고 개별 관리'})
              </span>
            </p>
          </div>

          {/*
            [수정 이력] 이 칸은 "HITL - WM2608001 (장문경)"이 백엔드 라우터에 리터럴로 박혀
            있어 어떤 품목이든 항상 같은 담당자를 표시했다. 이제 등급을 실제로 확정한 주체
            (AI 자동 판정 / HITL 결재 관리자 / 현장 수기)를 DB 기록에서 읽어 보여준다.
          */}
          <div className="bg-gray-50/70 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-gray-500" /> 등급 확정 주체
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={data.inspector?.label || data.worker_id}>
              {data.inspector?.label || data.worker_id}
            </p>
            {data.inspector?.inbound_worker_id && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">입고 촬영: {data.inspector.inbound_worker_id}</p>
            )}
          </div>
        </div>

        {!isNewBook && (
          <>
            {/*
              Dynamic Pricing — 가격은 백엔드 단일 엔진(orders/pricing.py)이 산정한다.
              [수정 이력] 종전에는 이 카드가 `정가 × UBCI/100`을 프론트에서 계산했고,
              카테고리별 요율이 전혀 반영되지 않았다(UBCI 100점이면 정가와 동일).
            */}
            <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold">
                  <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>AI Dynamic Pricing 산정</span>
                </div>
                {data.pricing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    카테고리: {data.pricing.category_raw || '미분류'} → {data.pricing.category_normalized}
                    {' '}(판매 {Math.round(data.pricing.category_retail_rate * 100)}% / 매입 {Math.round(data.pricing.category_b2b_rate * 100)}%)
                  </span>
                )}
              </div>

              {data.pricing ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900 p-2.5">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">출간 정가</p>
                      <p className="font-mono font-bold text-gray-500 dark:text-gray-400 line-through">
                        {data.pricing.list_price.toLocaleString()}원
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900 p-2.5">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">중고 판매가 (B2C)</p>
                      <p className="font-mono font-black text-gray-900 dark:text-white">
                        {data.pricing.used_retail_price.toLocaleString()}원
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 ml-1">
                          -{Math.round(data.pricing.discount_rate_vs_list * 100)}%
                        </span>
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900 p-2.5">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">B2B 권장 매입가</p>
                      <p className="font-mono font-black text-blue-700 dark:text-blue-300">
                        {data.pricing.b2b_supply_price.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    정가 × 카테고리 요율 × 상태 보정({data.pricing.condition_factor}, UBCI {data.ubci_score ?? '-'}점)
                    {data.pricing.days_in_inventory > 0 && ` × 체류 ${data.pricing.days_in_inventory}일 보정`} 으로 산정되었습니다.
                  </p>
                </>
              ) : (
                <p className="text-gray-500">가격 산정 정보가 없습니다.</p>
              )}
            </div>

            {/*
              검수 이미지 + 결함 오버레이.
              확정 결함(빨강 실선)과 YOLO 사전탐지 후보(주황 점선)를 각각 on/off 한다.
              확정 결함은 HITL 관리자 결재까지 반영된 최종 결과이며, 관리자가 오탐으로
              제외한 박스는 그리지 않는다(건수만 배지에 병기).
            */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 gap-3 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  검수 촬영 이미지 및 최종 확정 결함
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    images.length === 0
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                      : totalDefects > 0
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                  }`}
                >
                  {images.length === 0
                    ? '검수 이미지 없음'
                    : `촬영 ${images.length}장 / 확정 결함 ${totalDefects}건`
                      + (excludedCount > 0 ? ` / 오탐 제외 ${excludedCount}건` : '')}
                </span>
              </div>

              {images.length === 0 ? (
                <div className="py-14 text-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  이 LPN에 연결된 검수 촬영 이미지가 없습니다.
                </div>
              ) : (
                <>
                  <InspectionEvidenceViewer
                    images={images}
                    defectCoords={defectCoords}
                    excludedCoords={excludedCoords}
                    yoloCandidates={yoloCandidates}
                    invalidImageIndexes={invalidImageIndexes}
                    totalDefects={totalDefects}
                    specialNotes={logs.special_notes}
                  />
                </>
              )}
            </div>

            <PipelineTracePanel logs={logs} inspectionDate={data.date} />
          </>
        )}
      </div>

      {/* LPN 라벨 인쇄 - 목록 화면들과 동일한 공용 모달 재사용 */}
      <LpnPrintModal data={activePrintData} onClose={() => setActivePrintData(null)} />

      {/* HITL 회수 확인. 판매 가능 재고에서 빠지는 동작이라 한 번 더 묻는다. */}
      {recallOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isRecalling && setRecallOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-900">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">HITL 재검수로 되돌리기</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{data.lpn_barcode}</p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-1">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                현재 판정{' '}
                <strong className="text-gray-900 dark:text-white">
                  {data.ubci_score ?? '—'}점 {data.grade}
                </strong>
                을 관리자 결재 대기로 되돌립니다.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                판매 가능 재고에서 빠지며, 점수·결함·이미지는 비교 기준으로 그대로 남습니다.
              </p>
            </div>

            <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
              회수 사유 (선택 — 감사 기록에 남습니다)
            </label>
            <textarea
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              rows={2}
              placeholder="예: 실물 확인 결과 모서리 마모 없음"
              className="w-full text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white px-3 py-2 mb-4 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={handleRecall}
                disabled={isRecalling}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold rounded-xl text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isRecalling ? '되돌리는 중...' : '되돌리기'}
              </button>
              <button
                onClick={() => setRecallOpen(false)}
                disabled={isRecalling}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
