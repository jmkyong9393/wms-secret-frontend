'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { ArrowLeft, Printer, ShieldCheck, MapPin, Tag, UserCheck, Package, ExternalLink, Bot, Image as ImageIcon, AlertTriangle, Eye, EyeOff, ScanSearch } from 'lucide-react';

import BookCover from '@/components/BookCover';
import { LpnPrintLabel, LpnLabelData } from '@/features/inbound/components/LpnPrintLabel';
import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  bboxToPercent,
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * LangGraph 파이프라인 노드 표시 정의. executed_agents에 없으면 SKIPPED로 렌더한다.
 *
 * Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report
 * (MINT Fast-track 분기와 Auto-Refund 노드는 2026-08-04 구조 개편으로 제거됨 -
 *  검증을 건너뛰고 자동 매입이 확정되던 경로였다. 이제 전 건이 동일 경로를 통과한다.)
 */
const PIPELINE_STEPS = [
  { node: 'detector_node', label: 'Detector (YOLO)', icon: '🔬', logKey: 'detector_text', tone: 'text-gray-700 dark:text-gray-300' },
  { node: 'vision_agent', label: 'Vision Agent', icon: '👁️', logKey: 'vision_text', tone: 'text-gray-700 dark:text-gray-300' },
  { node: 'policy_agent', label: 'Policy Agent', icon: '📜', logKey: 'policy_text', tone: 'text-amber-700 dark:text-amber-300' },
  { node: 'critic_agent', label: 'Critic Agent', icon: '🛡️', logKey: 'critic_text', tone: 'text-emerald-700 dark:text-emerald-400' },
  { node: 'supervisor', label: 'Supervisor', icon: '🧭', logKey: 'supervisor_rationale', tone: 'text-sky-700 dark:text-sky-300' },
  { node: 'report_agent', label: 'Report Agent', icon: '💬', logKey: 'report_text', tone: 'text-emerald-700 dark:text-emerald-400' },
] as const;

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inventoryId = params?.id as string;

  const [data, setData] = useState<InventoryDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePrintData, setActivePrintData] = useState<LpnLabelData | null>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState<number>(0);
  const [isReinspecting, setIsReinspecting] = useState<boolean>(false);
  // AI 판독 오버레이 표시 여부. Vision 확정 결함과 YOLO 사전탐지 후보를 각각 껐다 켤 수 있다
  // (원본 사진 그대로도 봐야 하고, AI가 무엇을 기각했는지도 대조해야 하므로 분리한다).
  const [showVisionBoxes, setShowVisionBoxes] = useState<boolean>(true);
  const [showYoloBoxes, setShowYoloBoxes] = useState<boolean>(false);

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
      // 재검수는 Celery 비동기이므로 응답 일부만 병합하지 않고 상세를 통째로 다시 읽는다.
      await fetchDetail();
      alert('AI 재검수가 완료되었습니다. 상세 결과가 화면에 반영되었습니다.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReinspecting(false);
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

  const images = resolveInspectionImages(data);
  const defectCoords: PerImageDefectCoordinate[] = resolveDefectCoordinates(data);
  const logs = data.agent_logs || {};
  const executedAgents: string[] = logs.executed_agents || [];
  const totalDefects = defectCoords.reduce((n, c) => n + c.bboxes.length, 0);
  const currentCoords = defectCoords.find((c) => c.image_index === selectedImgIdx);
  const currentBBoxes = currentCoords?.bboxes || [];

  // WBF 3-YOLO 앙상블 사전탐지 후보. Vision이 채택하지 않은 것도 그대로 남아 있어,
  // 검수자가 "AI가 무엇을 보고 무엇을 기각했는지"까지 대조할 수 있다.
  const yoloCandidates: any[] = Array.isArray(logs.yolo_candidates) ? logs.yolo_candidates : [];
  const currentYoloBoxes = yoloCandidates
    .filter((c) => Number(c?.image_index ?? 0) === selectedImgIdx && c?.bbox)
    .map((c) => ({
      xmin: c.bbox.xmin,
      ymin: c.bbox.ymin,
      xmax: c.bbox.xmax,
      ymax: c.bbox.ymax,
      coord_space: 1000,
      type: c.type,
      label: c.type || 'YOLO 후보',
      confidence: c.confidence,
    }));
  const inspectionTime = data.date ? data.date.split(' ')[1] : 'KST';

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-900 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          재고 목록으로 돌아가기
        </button>

        <div className="flex items-center gap-2">
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
                    worker_id: data.worker_id,
                  })
                }
                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                50x30mm 라벨 인쇄
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

              {/*
                [수정 이력] 이 버튼은 /certificate/[lpn]로 갔지만 그 페이지가 role에 따라
                내부 조회 화면을 대신 띄워서, "고객 공개용 보증서 미리보기"를 눌러도 관리자에게는
                LPN 내부 조회가 나왔다. 내부 조회는 /lpn/[lpn]으로 분리했고 이 버튼은
                이제 순수 고객 화면으로 직행한다.
              */}
              <Link
                href={`/certificate/${data.lpn_barcode}`}
                target="_blank"
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
              검수 이미지 + AI 판독 오버레이.
              Vision 확정 결함(빨강 실선)과 YOLO 사전탐지 후보(주황 점선)를 각각 on/off 한다.
              원본 사진 그대로도 확인해야 하고, YOLO가 잡았는데 Vision이 기각한 항목까지
              대조해야 검수 판단이 빨라지므로 두 레이어를 분리했다.
            */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 gap-3 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  검수 촬영 이미지 및 AI 판독 오버레이
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
                  {images.length === 0 ? '검수 이미지 없음' : `촬영 ${images.length}장 / 확정 결함 ${totalDefects}건`}
                </span>
              </div>

              {images.length === 0 ? (
                <div className="py-14 text-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  이 LPN에 연결된 검수 촬영 이미지가 없습니다.
                </div>
              ) : (
                <>
                  {/* AI 판독 오버레이 on/off (HITL 모달의 "AI 결함 영역 숨기기"와 동일 개념) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowVisionBoxes((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        showVisionBoxes
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                      }`}
                      title="GPT-4o Vision이 최종 확정해 UBCI 감점에 반영한 결함"
                    >
                      {showVisionBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {showVisionBoxes ? 'AI 결함 영역 숨기기' : 'AI 결함 영역 표시'} ({totalDefects}건)
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowYoloBoxes((v) => !v)}
                      disabled={yoloCandidates.length === 0}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        yoloCandidates.length === 0
                          ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                          : showYoloBoxes
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 cursor-pointer'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 cursor-pointer'
                      }`}
                      title="WBF 3-YOLO 앙상블 사전탐지 후보 (Vision이 채택하지 않은 것 포함)"
                    >
                      <ScanSearch className="w-3.5 h-3.5" />
                      YOLO 사전탐지 후보 ({yoloCandidates.length}건)
                    </button>

                    {showYoloBoxes && yoloCandidates.length > 0 && totalDefects === 0 && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        YOLO가 {yoloCandidates.length}건을 잡았으나 Vision이 전부 기각했습니다 (인쇄물 오탐 가능성).
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Bar - 라벨은 결함 유무에 따라 실제 데이터로 생성한다 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {images.map((imgUrl, idx) => {
                      const coords = defectCoords.find((c) => c.image_index === idx);
                      const defectCnt = coords?.bboxes.length || 0;
                      const isSelected = selectedImgIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedImgIdx(idx)}
                          className={`flex flex-col items-center p-1.5 rounded-xl border text-[11px] font-bold transition-all shrink-0 min-w-[95px] cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-xs ring-2 ring-indigo-500/20'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`검수 이미지 ${idx}`}
                            className="w-16 h-20 object-cover rounded-lg mb-1 border border-gray-200 dark:border-gray-700 bg-gray-200"
                          />
                          <span className="truncate max-w-[90px]">
                            #{idx} {defectCnt > 0 ? `결함 ${defectCnt}` : '정상'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* BBox Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pt-2">
                    <div className="md:col-span-2 relative bg-gray-900 rounded-xl overflow-hidden shadow-inner border border-gray-800 flex justify-center items-center p-2 min-h-[480px]">
                      <div className="relative inline-block max-w-full rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
                        <img
                          src={images[selectedImgIdx] || images[0]}
                          alt={`검수 이미지 ${selectedImgIdx}`}
                          className="max-h-[520px] w-auto object-contain block"
                        />

                        {/* YOLO 사전탐지 후보 - 주황 점선 (Vision 확정보다 아래 레이어) */}
                        {showYoloBoxes &&
                          currentYoloBoxes.map((box, i) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            return (
                              <div
                                key={`y-${i}`}
                                className="absolute border-2 border-dashed border-amber-400 bg-amber-400/10 rounded z-10 group"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              >
                                <span className="absolute -bottom-6 left-0 bg-amber-500 text-white text-[10px] px-2 py-0.5 font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                  YOLO 후보: {box.type}
                                  {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                                </span>
                              </div>
                            );
                          })}

                        {/*
                          Vision 확정 결함 - 빨강 실선.
                          [수정 이력] 예전에는 좌표계를 값 크기로 추측(xmin>1이면 1000, ...)했고,
                          BBox 데이터가 없으면 하드코딩된 가짜 좌표를 그렸다. 이제 백엔드가
                          coord_space를 명시해 내려주며, 데이터가 없으면 아무것도 그리지 않는다.
                        */}
                        {showVisionBoxes &&
                          currentBBoxes.map((box, bIdx) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            return (
                              <div
                                key={bIdx}
                                className="absolute border-2 border-red-500 bg-red-500/25 rounded shadow-lg z-20"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              >
                                <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 font-extrabold rounded shadow-md whitespace-nowrap z-30">
                                  {box.label}
                                  {box.deduction ? ` -${box.deduction}점` : ''}
                                  {box.confidence ? ` (${Math.round(box.confidence * 100)}%)` : ''}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Defect Metadata Panel - 인덱스 하드코딩이 아니라 실제 결함 데이터 기반 */}
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-between">
                        <span>선택한 이미지 결함 분석</span>
                        <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                          Image #{selectedImgIdx}
                        </span>
                      </h4>

                      {currentBBoxes.length === 0 ? (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs font-bold">
                          [CLEAN] 이 이미지에서 검출된 결함 없음
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-lg">
                            <p className="font-bold">[DEFECT_DETECTED] 결함 {currentBBoxes.length}건 검출</p>
                          </div>
                          {currentBBoxes.map((box, i) => (
                            <div key={i} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-1">
                              <p className="text-gray-900 dark:text-white font-bold">{box.label}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                {box.type}
                                {box.deduction ? ` · -${box.deduction}점` : ''}
                                {box.confidence ? ` · conf ${box.confidence.toFixed(2)}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {showYoloBoxes && currentYoloBoxes.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            YOLO 후보 {currentYoloBoxes.length}건 (미채택 포함)
                          </p>
                          {currentYoloBoxes.map((box, i) => (
                            <div key={i} className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-2 py-1 font-mono">
                              {box.type}
                              {box.confidence ? ` · ${Math.round(box.confidence * 100)}%` : ''}
                            </div>
                          ))}
                        </div>
                      )}

                      {logs.special_notes && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-[11px] text-amber-900 dark:text-amber-200">
                          <span className="font-bold">특이사항: </span>
                          {logs.special_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/*
              Multi-Agent Pipeline Trace
              [수정 이력 2026-08-04] 페이지에서 이 섹션만 다크 터미널(bg-gray-950) 고정이라
              라이트 모드에서 붕 떠 보였다. 주변과 동일한 화이트 카드 + dark: 변형으로 통일.
            */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg text-purple-600 dark:text-purple-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      LangGraph Multi-Agent 파이프라인 진단 기록
                      {/*
                        [수정 이력] 예전에는 DB에 없는 값을 프론트에서 지어내면서
                        "PostgreSQL DB Verified" 뱃지를 붙였다. 실제로 DB에 Agent 서술이
                        저장된 경우에만 검증 뱃지를 표시한다.
                      */}
                      {executedAgents.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          PostgreSQL DB Verified
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          로그 미기록 (재검수 필요)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report
                      {(logs.retry_count ?? 0) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold"> · 재검수 {logs.retry_count}회</span>
                      )}
                      {logs.auto_refund_eligible && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold"> · ⚡ MINT 자동 매입 승인</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {executedAgents.length === 0 ? (
                <div className="bg-amber-50/60 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  이 건에는 저장된 Agent 실행 기록이 없습니다. 파이프라인 로그 영속화 이전에 검수된
                  건이므로, 상단의 <span className="text-rose-600 dark:text-rose-300 font-bold">AI 재검수 요청</span>을 실행하면
                  각 Agent의 실제 판정 근거가 DB에 기록됩니다.
                </div>
              ) : (
                <div className="bg-gray-50/70 dark:bg-gray-800/60 p-4 rounded-xl text-xs space-y-2.5 border border-gray-200 dark:border-gray-700">
                  {PIPELINE_STEPS.map((step) => {
                    const ran = executedAgents.includes(step.node);
                    const text = ran ? logs[step.logKey] : null;
                    return (
                      <div key={step.node} className="flex items-start gap-3 py-1 border-b border-gray-200/70 dark:border-gray-700/60 last:border-0">
                        <span className="text-gray-400 dark:text-gray-500 font-mono text-[11px] min-w-[65px]">[{inspectionTime}]</span>
                        <span className={`font-bold min-w-[150px] ${ran ? 'text-purple-700 dark:text-purple-400' : 'text-gray-400 dark:text-gray-600'}`}>
                          {step.label} {step.icon}
                        </span>
                        {ran ? (
                          <span className={`leading-relaxed ${step.tone}`}>{text || '(서술 미기록)'}</span>
                        ) : (
                          // HITL로 조기 종료된 건은 Report Agent에 도달하지 않는다.
                          <span className="text-gray-400 dark:text-gray-600 italic">
                            미실행 — 이 건은 해당 단계에 도달하지 않았습니다 (HITL 이관 또는 조기 종료)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* LPN Print Label Modal */}
      {activePrintData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl space-y-4 border border-transparent dark:border-gray-800">
            <LpnPrintLabel data={activePrintData} />
            <button
              onClick={() => setActivePrintData(null)}
              className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
