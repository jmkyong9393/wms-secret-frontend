'use client';

/**
 * 고객 공개용 AI 품질 보증서
 *
 * [수정 이력]
 * 1) 예전에는 이 페이지가 role을 보고 직원에게는 "LPN 내부 조회" 화면을 대신 렌더했다.
 *    그래서 관리자가 "고객 공개용 보증서 미리보기"를 눌러도 고객 화면을 볼 수 없었다.
 *    내부 조회는 /lpn/[lpn]으로 분리했고, 이 페이지는 이제 role 분기 없는 순수 고객 화면이다.
 * 2) 진단 리포트 본문이 등급별 if-else 문장으로 프론트에 하드코딩되어 있었고, 결함 사유도
 *    "[감점: -15점] 내지 필기/낙서/밑줄" 한 줄이 고정값으로 박혀 있었다(결함이 없는 MINT
 *    도서에도 그대로 표시됨). 이제 모든 문장은 백엔드 Report Agent가 생성한
 *    certificate 문서를 그대로 렌더한다 - 이 파일은 문장을 만들지 않는다.
 * 3) 결함 사진은 image_urls[3]을 맹목적으로 골랐다. 이제 감점이 가장 큰 이미지를 고르고,
 *    결함이 없으면 첫 번째 촬영본을 보여준다.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, BookOpen, ThumbsUp, Medal, AlertTriangle } from 'lucide-react';

import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  pickRepresentativeImageIndex,
  bboxToPercent,
} from '@/features/inspection/utils/inspectionImageService';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function gradeView(grade: string, score: number) {
  const isMint = score >= 95 || grade === 'MINT' || grade === 'S';
  const isGood = !isMint && (score >= 85 || grade === 'GOOD' || grade === 'A');
  const isNormal = !isMint && !isGood && (score >= 65 || grade === 'NORMAL' || grade === 'B');

  if (isMint || isGood) {
    return {
      title: isMint ? 'S등급' : 'A등급',
      bg: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 border-emerald-200',
      icon: 'text-emerald-600',
      text: 'text-emerald-800',
    };
  }
  if (isNormal) {
    return {
      title: 'B등급',
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200',
      icon: 'text-blue-600',
      text: 'text-blue-900',
    };
  }
  return {
    title: 'C등급 (반려)',
    bg: 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200',
    icon: 'text-rose-600',
    text: 'text-rose-800',
  };
}

export default function CertificatePage() {
  const params = useParams();
  const lpn = params.lpn as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/inventory/${lpn}`);
        if (res.status === 404) throw new Error('해당 보증서를 찾을 수 없습니다.');
        if (!res.ok) throw new Error('품질 보증서를 불러오지 못했습니다.');
        const json = await res.json();
        if (!cancelled) setItem(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '알 수 없는 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lpn]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm">AI 비전 검수 보증서를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-2 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="font-bold text-gray-900">보증서를 열 수 없습니다</h2>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-[11px] text-gray-400 font-mono pt-2">LPN: {lpn}</p>
        </div>
      </div>
    );
  }

  const score: number = item.ubci_score ?? 0;
  const view = gradeView(item.grade || '', score);
  const basePrice: number = item.book?.base_price || 0;
  const usedPrice = Math.floor((basePrice * (score / 100)) / 100) * 100;

  // Report Agent가 생성한 보증서 문서. 프론트는 문장을 만들지 않고 그대로 렌더한다.
  const cert = item.certificate || null;
  const findings: any[] = cert?.findings || [];

  const images = resolveInspectionImages(item);
  const defectCoords = resolveDefectCoordinates(item);
  // 결함 감점이 가장 큰 이미지를 대표로. 결함이 없으면 첫 촬영본(index 0).
  const repIdx = pickRepresentativeImageIndex(item);
  const repImage = images[repIdx] || images[0] || null;
  const repBBoxes = defectCoords.find((c) => c.image_index === repIdx)?.bboxes || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-6 shadow-md rounded-b-3xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck size={28} className="text-emerald-300" />
          <h1 className="text-xl font-bold tracking-tight">AI 품질 보증서</h1>
        </div>
        <p className="text-indigo-100 text-center text-xs opacity-90">
          Nexus WMS Vision AI가 투명하게 검증한 도서입니다.
        </p>
      </div>

      <div className="max-w-md w-full mx-auto px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Grade Badge */}
          <div className={`p-6 flex flex-col items-center border-b ${view.bg}`}>
            <div className="bg-white p-3 rounded-full shadow-md mb-3 border border-emerald-100">
              <Medal size={42} className={view.icon} />
            </div>
            <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-1 ${view.text}`}>{view.title}</h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-full border border-emerald-200 mt-1">
              Nexus AI 검증 완료 도서
            </span>
            {cert?.headline && (
              <p className={`text-sm font-bold mt-3 text-center leading-snug ${view.text}`}>{cert.headline}</p>
            )}
          </div>

          {/* Book Info */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-20 h-28 bg-gray-200 rounded shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                {item.book?.cover_image_url ? (
                  <img src={item.book.cover_image_url} alt={item.book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <BookOpen className="text-gray-400" size={32} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{item.book?.title}</h3>
                <p className="text-sm text-gray-500 mb-2">
                  {item.book?.author} | {item.book?.publisher}
                </p>
                <div className="flex flex-col gap-1 mt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">정가</span>
                    <span className="text-gray-400 line-through">{basePrice.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-indigo-600">중고 판매가</span>
                    <span className="text-xl text-gray-900">{usedPrice.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100 my-4" />

            {/* AI 정밀 진단 리포트 */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                  <ShieldCheck size={18} className="text-emerald-600" /> AI 정밀 진단 리포트
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  UBCI {score}점
                </span>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 text-sm space-y-4">
                {cert ? (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs space-y-2">
                      <p className="text-gray-700 text-xs sm:text-sm leading-relaxed font-medium">{cert.summary}</p>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs space-y-1.5">
                      <p className="text-xs font-bold text-gray-800">상세 사유</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{cert.condition_detail}</p>
                    </div>

                    {cert.care_tip && (
                      <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                        <p className="text-[11px] text-indigo-900 leading-relaxed">
                          <span className="font-bold">보관 팁 · </span>
                          {cert.care_tip}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  // Report Agent 문서가 없는 과거 건. 프론트가 그럴듯한 문장을 지어내지 않고
                  // 문서가 아직 없다는 사실을 그대로 알린다.
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 text-xs text-gray-500 leading-relaxed">
                    이 도서는 UBCI {score}점 판정을 받았습니다. 상세 진단 문서는 아직 발행되지 않았습니다.
                  </div>
                )}

                {/* 3대 핵심 품질 보증 항목 */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                    <span className="text-base mb-0.5">🛡️</span>
                    <span className="font-bold text-slate-700">100% 픽셀 검증</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                    <span className="text-base mb-0.5">🔍</span>
                    <span className="font-bold text-slate-700">결함 위치 투명 공개</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col items-center">
                    <span className="text-base mb-0.5">⚡</span>
                    <span className="font-bold text-slate-700">출고 준비 보증</span>
                  </div>
                </div>

                {/* AI 실물 검수 및 결함 판독 내역 */}
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-700 mb-1">📷 AI 실물 검수 및 결함 판독 내역</p>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {findings.length > 0
                      ? '감점 사유가 가장 큰 실물 스캔 사진과 판독 위치를 그대로 공개합니다.'
                      : '결함이 발견되지 않아 첫 번째 실물 스캔 사진을 그대로 공개합니다.'}
                  </p>

                  {!repImage ? (
                    <div className="py-8 text-center text-[11px] text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                      공개 가능한 실물 스캔 사진이 없습니다.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 mt-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm space-y-3">
                        <div className="relative inline-block w-full rounded overflow-hidden bg-gray-100 border border-gray-200">
                          <img src={repImage} alt="실물 검수 사진" className="w-full h-auto object-contain block" />
                          {repBBoxes.map((box, i) => {
                            const { left, top, width, height } = bboxToPercent(box);
                            return (
                              <div
                                key={i}
                                className="absolute border-2 border-red-500 bg-red-500/20 rounded pointer-events-none"
                                style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                              />
                            );
                          })}
                        </div>

                        {findings.length > 0 ? (
                          <div className="space-y-2">
                            {findings.map((f: any, idx: number) => (
                              <div key={idx} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-gray-800">{f.label}</span>
                                  {f.deduction ? (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                      -{f.deduction}점
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed mt-1">{f.reason}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="border-t border-gray-100 pt-2">
                            <span className="text-xs font-bold text-gray-800">상세 사유</span>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">
                              {cert?.condition_detail || '검출된 결함이 없습니다.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-400 font-mono text-center">
            <p>LPN: {item.lpn_barcode || lpn}</p>
            <p>Inspection: {item.date}</p>
            {cert?.cert_id && <p>Cert: {cert.cert_id}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button className="bg-gray-900 text-white rounded-full px-6 py-3 font-bold text-sm shadow-lg flex items-center gap-2 hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
            <ThumbsUp size={16} />
            품질 보증서 확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
