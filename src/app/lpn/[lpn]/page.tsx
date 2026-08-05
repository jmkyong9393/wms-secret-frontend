'use client';
import { API_BASE_URL } from '@/lib/api-client';

/**
 * LPN 내부 조회 (직원 전용)
 *
 * 물리 라벨의 QR이 가리키는 진입점이다.
 *  - WORKER / ADMIN / MASTER : 현장 업무에 필요한 내부 정보(랙 위치, 등급 확정 주체,
 *    검수 이미지 + BBox, Agent 파이프라인 원본 로그)를 본다.
 *  - 고객 / 비로그인            : /certificate/[lpn] 고객용 보증서로 자동 전환된다.
 *
 * [분리 배경] 예전에는 /certificate/[lpn] 한 페이지가 role에 따라 두 화면을 토글했다.
 * 그래서 관리자가 재고 상세에서 "고객 공개용 보증서 미리보기"를 눌러도 고객 화면이 아니라
 * LPN 내부 조회가 떴다. 두 화면은 대상 독자도 노출 범위도 다르므로 라우트를 분리했다.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { ShieldCheck, BookOpen, MapPin, Package, UserCheck, Bot, Eye, AlertTriangle } from 'lucide-react';

import { currentUserAtom } from '@/features/auth/store/authAtoms';
import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  bboxToPercent,
} from '@/features/inspection/utils/inspectionImageService';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || `${API_BASE_URL}`;
const INTERNAL_ROLES = ['WORKER', 'ADMIN', 'MASTER'];

export default function LpnInternalLookupPage() {
  const params = useParams();
  const router = useRouter();
  const lpn = params.lpn as string;
  const user = useAtomValue(currentUserAtom);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);

  const isInternalViewer = Boolean(user?.role && INTERNAL_ROLES.includes(user.role));

  // 직원이 아니면 고객용 보증서로 즉시 전환한다 (QR을 스캔한 구매자의 기본 경로).
  useEffect(() => {
    if (!isInternalViewer) {
      router.replace(`/certificate/${lpn}`);
    }
  }, [isInternalViewer, lpn, router]);

  useEffect(() => {
    if (!isInternalViewer || !lpn) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/inventory/${lpn}`);
        if (res.status === 404) throw new Error(`LPN을 찾을 수 없습니다: ${lpn}`);
        if (!res.ok) throw new Error('LPN 정보를 불러오지 못했습니다.');
        const json = await res.json();
        if (!cancelled) setItem(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '알 수 없는 오류');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lpn, isInternalViewer]);

  if (!isInternalViewer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 text-sm">고객용 품질 보증서로 이동 중입니다...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm">LPN 내부 정보를 조회하는 중...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-rose-900">LPN 조회 실패</h2>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const images = resolveInspectionImages(item);
  const defectCoords = resolveDefectCoordinates(item);
  const logs = item.agent_logs || {};
  const executedAgents: string[] = logs.executed_agents || [];
  const currentBBoxes = defectCoords.find((c) => c.image_index === selectedImgIdx)?.bboxes || [];
  const totalDefects = defectCoords.reduce((n, c) => n + c.bboxes.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      <div className="bg-slate-900 text-white p-5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-400" />
            <div>
              <h1 className="text-base font-bold tracking-tight">LPN 내부 조회 ({user?.role})</h1>
              <p className="text-slate-400 text-[11px] font-mono">{item.lpn_barcode || lpn}</p>
            </div>
          </div>
          <Link
            href={`/certificate/${item.lpn_barcode || lpn}`}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
          >
            <Eye size={14} />
            고객용 보증서 미리보기
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-4 mt-6">
        {/* Book Info */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-22 bg-gray-100 rounded shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
              {item.book?.cover_image_url ? (
                <img src={item.book.cover_image_url} alt={item.book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <BookOpen className="text-gray-400" size={28} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">{item.book?.title}</h3>
              <p className="text-xs text-gray-500 mb-2">
                {item.book?.author} | {item.book?.publisher}
              </p>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                UBCI {item.ubci_score ?? '-'}점 ({item.grade} 등급)
              </span>
            </div>
          </div>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" /> 적치 로케이션
            </span>
            <p className="text-sm font-mono font-black text-indigo-950">{item.zone || '미배정'}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-indigo-600" /> 재고 수량
            </span>
            <p className="text-sm font-mono font-black text-gray-900">{item.quantity ?? 1}권</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-gray-500" /> 등급 확정 주체
            </span>
            <p className="text-sm font-bold text-gray-900 truncate">{item.inspector?.label || item.worker_id}</p>
          </div>
        </div>

        {/* 검수 이미지 + BBox */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900">검수 촬영 이미지 및 결함 BBox</h3>
            <span className="text-[11px] font-bold text-gray-500">
              {images.length === 0 ? '이미지 없음' : `촬영 ${images.length}장 / 결함 ${totalDefects}건`}
            </span>
          </div>

          {images.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              이 LPN에 연결된 검수 촬영 이미지가 없습니다.
            </p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, idx) => {
                  const cnt = defectCoords.find((c) => c.image_index === idx)?.bboxes.length || 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedImgIdx(idx)}
                      className={`shrink-0 p-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                        selectedImgIdx === idx ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <img src={url} alt={`검수 ${idx}`} className="w-14 h-18 object-cover rounded mb-0.5 bg-gray-200" />
                      #{idx} {cnt > 0 ? `결함 ${cnt}` : '정상'}
                    </button>
                  );
                })}
              </div>

              <div className="relative bg-gray-900 rounded-xl p-2 flex justify-center">
                <div className="relative inline-block">
                  <img src={images[selectedImgIdx] || images[0]} alt="검수 이미지" className="max-h-[420px] w-auto object-contain block rounded" />
                  {currentBBoxes.map((box, i) => {
                    const { left, top, width, height } = bboxToPercent(box);
                    return (
                      <div
                        key={i}
                        className="absolute border-2 border-red-500 bg-red-500/25 rounded pointer-events-none"
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                      >
                        <span className="absolute -top-5 left-0 bg-red-600 text-white text-[9px] px-1.5 py-0.5 font-bold rounded whitespace-nowrap">
                          {box.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI 결함 스캔 원본 로그 */}
        <div className="bg-gray-950 text-gray-100 rounded-2xl p-5 space-y-3 border border-gray-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-400" />
            AI 결함 스캔 원본 로그
            <span className="text-[10px] font-normal text-gray-400">
              (실행 노드: {executedAgents.length > 0 ? executedAgents.join(' → ') : '기록 없음'})
            </span>
          </h3>
          {Object.keys(logs).length > 0 ? (
            <pre className="bg-gray-900/90 p-3 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-words max-h-[420px]">
              {JSON.stringify(logs, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-gray-400">이 LPN에 대한 원본 스캔 로그가 아직 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
