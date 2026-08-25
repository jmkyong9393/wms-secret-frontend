'use client';
import type { AgentLogs, CertificateDoc, CertificateFinding } from '@/entities/inspection/model/types';
import { API_BASE_URL } from '@/shared/api/api-client';

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
import { ShieldCheck, BookOpen, Download, Medal, AlertTriangle } from 'lucide-react';

import {
  resolveInspectionImages,
  resolveDefectCoordinates,
  pickRepresentativeImageIndex,
  bboxToPercent,
} from '@/entities/inspection/api/inspectionImageService';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || `${API_BASE_URL}`;

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
  interface CertificateItem {
    lpn_barcode?: string;
    date?: string;
    grade?: string | null;
    ubci_score?: number | null;
    book?: { title?: string; author?: string; publisher?: string; cover_image_url?: string; base_price?: number };
    certificate?: CertificateDoc | null;
    pricing?: { list_price?: number; used_retail_price?: number; buyback_price?: number; discount_rate_vs_list?: number } | null;
    agent_logs?: AgentLogs | null;
    image_urls?: string[];
  }
  const [item, setItem] = useState<CertificateItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/inventory/${lpn}`);
        if (res.status === 404) throw new Error('해당 보증서를 찾을 수 없습니다.');
        if (!res.ok) throw new Error('품질 보증서를 불러오지 못했습니다.');
        const json = await res.json();
        if (!cancelled) setItem(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
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
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm">AI 비전 검수 보증서를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-6">
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

  // [수정 이력] 종전에는 여기서 `정가 × UBCI/100`으로 직접 계산했다. UBCI 100점(MINT)이면
  // 계수가 1.0이라 중고 판매가가 신품 정가와 완전히 같아졌고(정가 20,000원 / 중고 20,000원),
  // 카테고리별 차등도 반영되지 않았다. 가격 산정은 백엔드 단일 엔진(orders/pricing.py)이
  // 담당하고 프론트는 렌더만 한다.
  const pricing = item.pricing || null;
  const basePrice: number = pricing?.list_price ?? item.book?.base_price ?? 0;
  const usedPrice: number = pricing?.used_retail_price ?? 0;
  const discountPct = Math.round((pricing?.discount_rate_vs_list ?? 0) * 100);

  // Report Agent가 생성한 보증서 문서. 프론트는 문장을 만들지 않고 그대로 렌더한다.
  const cert = item.certificate || null;
  const findings: CertificateFinding[] = cert?.findings || [];

  const images = resolveInspectionImages(item);
  const defectCoords = resolveDefectCoordinates(item);
  // 결함 감점이 가장 큰 이미지를 대표로. 결함이 없으면 첫 촬영본(index 0).
  const repIdx = pickRepresentativeImageIndex(item);
  const repImage = images[repIdx] || images[0] || null;
  const repBBoxes = defectCoords.find((c) => c.image_index === repIdx)?.bboxes || [];

  return (
    // print-color-adjust: exact - 등급 배지 그라데이션/배경색이 PDF 출력물에서 날아가지 않게 강제
    //
    // PDF 저장(window.print)이 화면과 같은 여백/폰트 크기로 그대로 찍혀 A4 두 장으로
    // 넘쳤다(실측: "명품 C++ Programming" 보증서). 화면용 레이아웃은 그대로 두고, print: 변형으로
    // 패딩/여백만 압축해 한 장에 들어가게 한다. 결함 사진은 세로가 긴 실물 촬영본이 많아
    // print:max-h로 높이를 별도 제한하지 않으면 이 블록 하나가 남은 페이지를 다 먹는다.
    <div
      className="min-h-dvh bg-slate-50 flex flex-col font-sans pb-12 print:pb-0 print:min-h-0"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
      {/* Header */}
      <div className="bg-indigo-600 text-white p-6 print:p-3 shadow-md rounded-b-3xl print:rounded-b-lg">
        <div className="flex items-center justify-center gap-2 mb-2 print:mb-1">
          <ShieldCheck size={28} className="text-emerald-300 print:w-5 print:h-5" />
          <h1 className="text-xl print:text-base font-bold tracking-tight">AI 품질 보증서</h1>
        </div>
        <p className="text-indigo-100 text-center text-xs opacity-90">
          Nexus WMS Vision AI가 투명하게 검증한 도서입니다.
        </p>
      </div>

      <div className="max-w-md w-full mx-auto px-4 print:px-0 -mt-4 print:mt-2 relative z-10">
        <div className="bg-white rounded-2xl print:rounded-lg shadow-xl print:shadow-none overflow-hidden border border-gray-100">
          {/* Grade Badge */}
          <div className={`p-6 print:p-3 flex flex-col items-center border-b ${view.bg}`}>
            <div className="bg-white p-3 print:p-1.5 rounded-full shadow-md mb-3 print:mb-1 border border-emerald-100">
              <Medal size={42} className={`print:w-6 print:h-6 ${view.icon}`} />
            </div>
            <h2 className={`text-3xl sm:text-4xl print:text-xl font-black tracking-tight mb-1 ${view.text}`}>{view.title}</h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-full border border-emerald-200 mt-1">
              Nexus AI 검증 완료 도서
            </span>
            {cert?.headline && (
              <p className={`text-sm print:text-xs font-bold mt-3 print:mt-1 text-center leading-snug ${view.text}`}>{cert.headline}</p>
            )}
          </div>

          {/* Book Info */}
          <div className="p-6 print:p-3">
            <div className="flex items-start gap-4 mb-6 print:mb-2">
              <div className="w-20 h-28 bg-gray-200 rounded shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                {item.book?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다
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
                    <div className="flex items-baseline gap-1.5">
                      {discountPct > 0 && (
                        <span className="text-xs font-black text-rose-600">-{discountPct}%</span>
                      )}
                      <span className="text-xl text-gray-900">{usedPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100 my-4" />

            {/* AI 정밀 진단 리포트 */}
            <div>
              <div className="flex items-center justify-between mb-3 print:mb-1.5 gap-2">
                <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base print:text-sm">
                  <ShieldCheck size={18} className="text-emerald-600 print:w-3.5 print:h-3.5" /> AI 정밀 진단 리포트
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                  UBCI {score}점
                </span>
              </div>

              <div className="bg-slate-50/80 rounded-2xl print:rounded-lg p-4 print:p-2 border border-slate-200/80 text-sm space-y-4 print:space-y-1.5">
                {cert ? (
                  <>
                    <div className="bg-white p-3.5 print:p-2 rounded-xl print:rounded-md border border-slate-100 shadow-2xs space-y-2 print:space-y-1">
                      <p className="text-gray-700 text-xs sm:text-sm leading-relaxed font-medium">{cert.summary}</p>
                    </div>

                    <div className="bg-white p-3.5 print:p-2 rounded-xl print:rounded-md border border-slate-100 shadow-2xs space-y-1.5">
                      <p className="text-xs font-bold text-gray-800">상세 사유</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{cert.condition_detail}</p>
                    </div>

                    {/* 반품 처분 안내 - Policy Stage B가 규정 근거로 판단한 결과.
                        근거 조항이 함께 없으면 표시하지 않는다 (근거 없는 안내는 통보로 읽힌다). */}
                    {cert.policy_notice && (cert.policy_basis?.length ?? 0) > 0 && (
                      <div className="bg-white p-3.5 print:p-2 rounded-xl print:rounded-md border border-slate-100 shadow-2xs space-y-1.5">
                        <p className="text-xs font-bold text-gray-800">반품 안내</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{cert.policy_notice}</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          근거 · {cert.policy_basis!.join(' / ')}
                        </p>
                      </div>
                    )}

                    {cert.care_tip && (
                      <div className="bg-indigo-50/70 p-3 print:p-1.5 rounded-xl print:rounded-md border border-indigo-100 print:hidden">
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
                  <div className="bg-white p-3.5 print:p-2 rounded-xl print:rounded-md border border-slate-100 text-xs text-gray-500 leading-relaxed">
                    이 도서는 UBCI {score}점 판정을 받았습니다. 상세 진단 문서는 아직 발행되지 않았습니다.
                  </div>
                )}

                {/* 3대 핵심 품질 보증 항목 — 인쇄본에서는 생략(장식용, 지면 절약) */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] print:hidden">
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
                <div className="mt-4 print:mt-1.5">
                  <p className="text-xs font-bold text-gray-700 mb-1">📷 AI 실물 검수 및 결함 판독 내역</p>
                  <p className="text-[11px] text-gray-500 mb-2 print:hidden">
                    {findings.length > 0
                      ? '감점 사유가 가장 큰 실물 스캔 사진과 판독 위치를 그대로 공개합니다.'
                      : '결함이 발견되지 않아 첫 번째 실물 스캔 사진을 그대로 공개합니다.'}
                  </p>

                  {!repImage ? (
                    <div className="py-8 text-center text-[11px] text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                      공개 가능한 실물 스캔 사진이 없습니다.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 print:gap-1.5 mt-3 print:mt-1.5">
                      <div className="bg-white p-3 print:p-1.5 rounded-lg print:rounded-md border border-gray-200 shadow-sm space-y-3 print:space-y-1.5">
                        {/* 세로로 긴 실물 촬영본이 PDF 한 장을 다 먹는 걸 막기 위해 인쇄본만
                            높이를 제한한다 (object-contain이라 비율은 유지되고 잘리지 않는다). */}
                        <div className="relative inline-block w-full rounded overflow-hidden bg-gray-100 border border-gray-200 print:max-h-[220px]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다 */}
                          <img src={repImage} alt="실물 검수 사진" className="w-full h-auto object-contain block print:max-h-[220px] print:mx-auto" />
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
                            {findings.map((f, idx: number) => (
                              <div key={idx} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-gray-800">{f.label}</span>
                                    {f.location && (
                                      <span className="ml-1.5 text-[10px] text-gray-500">{f.location}</span>
                                    )}
                                  </div>
                                  {/* 마모처럼 부위 합산으로 산정되는 유형은 같은 감점이 여러 항목에
                                      실리므로, 서버가 첫 항목에만 값을 남기고 나머지는 0으로 내린다. */}
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
                        ) : cert ? (
                          // 위 "AI 정밀 진단 리포트" 카드가 이미 cert.condition_detail을 보여준다.
                          // 결함 0건이면 여기 또 같은 문장이 반복될 뿐이라 인쇄본에서는 뺀다
                          // (화면은 스크롤이라 중복이 덜 거슬리지만, 인쇄는 그대로 지면을 먹는다).
                          <div className="border-t border-gray-100 pt-2 print:hidden">
                            <span className="text-xs font-bold text-gray-800">상세 사유</span>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">
                              {cert.condition_detail || '검출된 결함이 없습니다.'}
                            </p>
                          </div>
                        ) : (
                          /* 보증서 문서가 없는 건은 "결함이 없다"고 말할 근거가 없다.
                             검수하지 못한 것과 흠이 없는 것을 같게 표기하지 않는다. */
                          <div className="border-t border-gray-100 pt-2">
                            <span className="text-xs font-bold text-gray-800">상세 사유</span>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">
                              이 도서는 아직 AI 검수 보증서가 발급되지 않았습니다. 결함 유무는
                              보증서 발급 후 확인하실 수 있습니다.
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
          <div className="bg-slate-50 p-4 print:p-2 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-400 font-mono text-center">
            <p>LPN: {item.lpn_barcode || lpn}</p>
            <p>Inspection: {item.date}</p>
            {cert?.cert_id && <p>Cert: {cert.cert_id}</p>}
          </div>
        </div>

        {/*
          아무 동작 없던 "확인 완료" 버튼을 보증서 저장 버튼으로 교체.
          외부 캡처 라이브러리 없이 브라우저 인쇄 엔진으로 PDF를 만든다(window.print) -
          html2canvas 계열은 Tailwind v4의 oklch 색상과 외부 표지 이미지 CORS에서 깨지므로
          채택하지 않았다. 버튼 자체는 print:hidden으로 출력물에서 제외한다.
        */}
        <div className="mt-6 flex justify-center print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-gray-900 text-white rounded-full px-6 py-3 font-bold text-sm shadow-lg flex items-center gap-2 hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          >
            <Download size={16} />
            보증서 PDF 저장 (인쇄)
          </button>
        </div>
      </div>
    </div>
  );
}
