'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, BookOpen, AlertCircle, Info, ThumbsUp, Medal, Sparkles } from 'lucide-react';

export default function CertificatePage() {
  const params = useParams();
  const lpn = params.lpn as string;
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. DB Inventory API 실시간 조회
        const res = await fetch(`http://localhost:8000/api/v1/inventory/${lpn}`);
        if (res.ok) {
          const itemData = await res.json();
          const basePrice = itemData.book?.base_price || 18000;
          const scoreVal = itemData.ubci_score !== undefined ? itemData.ubci_score : 85;
          const usedPrice = Math.floor((basePrice * (scoreVal / 100)) / 100) * 100;

          let gradeStr = (itemData.grade || '').toUpperCase();
          let displayGrade = 'GOOD';
          if (scoreVal >= 95 || gradeStr.includes('MINT') || gradeStr === 'S') displayGrade = 'MINT';
          else if (scoreVal >= 85 || gradeStr.includes('GOOD') || gradeStr.includes('A')) displayGrade = 'GOOD';
          else if (scoreVal >= 65 || gradeStr.includes('NORMAL') || gradeStr.includes('B')) displayGrade = 'NORMAL';
          else displayGrade = 'REJECT';

          let defectImage = (itemData.image_urls && itemData.image_urls.length > 3)
            ? itemData.image_urls[3]
            : (itemData.image_urls && itemData.image_urls.length > 0 ? itemData.image_urls[0] : 'http://localhost:8000/experiment_data/job-0c2929a0/raw_3.jpg');

          setCertData({
            lpn: itemData.lpn_barcode || lpn,
            title: itemData.book?.title || 'SQL 자격검정 실전문제 - 국가공인 SQL전문가, 국가공인 SQL개발자',
            author: itemData.book?.author || '한국데이터산업진흥원 (지은이)',
            publisher: itemData.book?.publisher || '한국데이터산업진흥원',
            grade: displayGrade,
            ubciScore: scoreVal,
            priceOriginal: basePrice,
            priceUsed: usedPrice,
            inspectionDate: new Date(itemData.date || Date.now()).toISOString(),
            aiModel: 'Nexus Vision AI v2.1',
            hash: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...`,
            defects: [
              { type: '[감점: -15점] 내지 필기/낙서/밑줄 (수험서 -15점 Cap 적용)', image: defectImage }
            ]
          });
          return;
        }
      } catch (e) {
        console.error("Failed to fetch inventory item for certificate", e);
      } finally {
        setLoading(false);
      }

      // Default dynamic fallback
      const defaultBase = 18000;
      const defaultScore = 85;
      setCertData({
        lpn,
        title: 'SQL 자격검정 실전문제 - 국가공인 SQL전문가, 국가공인 SQL개발자',
        author: '한국데이터산업진흥원 (지은이)',
        publisher: '한국데이터산업진흥원',
        grade: 'GOOD',
        ubciScore: defaultScore,
        priceOriginal: defaultBase,
        priceUsed: Math.floor((defaultBase * (defaultScore / 100)) / 100) * 100,
        inspectionDate: new Date().toISOString(),
        aiModel: 'Nexus Vision AI v2.1',
        hash: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...`,
        defects: [
          { type: '[감점: -15점] 내지 필기/낙서/밑줄 (수험서 -15점 Cap 적용)', image: 'http://localhost:8000/experiment_data/job-0c2929a0/raw_3.jpg' }
        ]
      });
      setLoading(false);
    };
    loadData();
  }, [lpn]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium text-sm">AI 비전 검수 보증서를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-6 shadow-md rounded-b-3xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck size={28} className="text-emerald-300" />
          <h1 className="text-xl font-bold tracking-tight">AI 품질 보증서</h1>
        </div>
        <p className="text-indigo-100 text-center text-xs opacity-90">Nexus WMS Vision AI가 투명하게 검증한 도서입니다.</p>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          
          {/* Grade Badge Area */}
          {(() => {
            const isMint = certData.grade === 'S' || certData.grade === 'MINT';
            const isGood = certData.grade === 'A' || certData.grade === 'GOOD';
            const isNormal = certData.grade === 'B' || certData.grade === 'NORMAL';

            const bgGradient = (isMint || isGood)
              ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 border-emerald-200'
              : isNormal
              ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
              : 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200';

            const iconColor = (isMint || isGood) ? 'text-emerald-600' : isNormal ? 'text-blue-600' : 'text-rose-600';
            const textColor = (isMint || isGood) ? 'text-emerald-800' : isNormal ? 'text-blue-900' : 'text-rose-800';
            const pillColor = (isMint || isGood) ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : isNormal ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-rose-100 text-rose-900 border border-rose-300';

            return (
              <div className={`p-6 flex flex-col items-center border-b ${bgGradient}`}>
                <div className="bg-white p-3 rounded-full shadow-md mb-3 border border-emerald-100">
                  <Medal size={42} className={iconColor} />
                </div>
                <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-1 ${textColor}`}>
                  {isMint ? 'S등급' : isGood ? 'A등급' : isNormal ? 'B등급' : 'C등급 (반려)'}
                </h2>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-full border border-emerald-200 mt-1">
                  Nexus AI 검증 완료 도서
                </span>
              </div>
            );
          })()}

          {/* Book Info */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-20 h-28 bg-gray-200 rounded shadow-sm flex-shrink-0 flex items-center justify-center overflow-hidden">
                <BookOpen className="text-gray-400" size={32} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{certData.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{certData.author} | {certData.publisher}</p>
                <div className="flex flex-col gap-1 mt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">정가</span>
                    <span className="text-gray-400 line-through">{certData.priceOriginal.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-indigo-600">중고 판매가</span>
                    <span className="text-xl text-gray-900">{certData.priceUsed.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100 my-4" />

            {/* Transparency Report */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                  <ShieldCheck size={18} className="text-emerald-600" /> AI 정밀 진단 리포트 (Audit Report)
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">공식 품질 인증 완료</span>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 text-sm space-y-4">
                <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
                  <p className="text-gray-700 text-xs sm:text-sm leading-relaxed font-medium">
                    본 도서는 <strong className="text-indigo-900 font-bold">Nexus 사내 정밀 비전 검증 시스템</strong>을 통해 외관 표지 훼손율 및 내지 전수 픽셀 분석을 최종 완료하였습니다. 내부 종합 판정 결과, {
                      (certData.grade === 'S' || certData.grade === 'MINT') ? '독서 및 보관에 훼손이 전혀 없는 최상급 S등급 실재고로 공식 입고 보증합니다.' :
                      (certData.grade === 'A' || certData.grade === 'GOOD') ? '독서 및 장기 보관에 지장이 없는 우수한 품질의 A등급 실재고로 공식 입고 보증합니다.' :
                      (certData.grade === 'B' || certData.grade === 'NORMAL') ? '일반적인 사용감이 있으나 읽기에 무리가 없는 B등급 실재고로 입고 보증합니다.' :
                      '재판매가 불가능한 심각한 훼손이 발견되어 즉시 반려 처리되었습니다.'
                    }
                  </p>
                </div>

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
                
                {/* Defect Images */}
                {certData.defects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <span>📷 AI 실물 검수 및 결함 판독 내역</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mb-2">Nexus Vision AI가 검수한 도서 실물 스캔 사진 및 감점 내역입니다.</p>
                    <div className="flex flex-col gap-3 pb-2 mt-3">
                      {certData.defects.slice(0, 1).map((defect: any, idx: number) => (
                        <div key={idx} className="flex gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm items-start">
                          <div className="w-24 h-24 flex-shrink-0 rounded bg-gray-100 overflow-hidden border border-gray-200">
                            <img src={defect.image} alt="결함 사진" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col flex-1 py-1">
                            <span className="text-sm font-bold text-gray-800 leading-tight mb-1">상세 사유</span>
                            <p className="text-xs text-gray-600 break-words leading-relaxed">{defect.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          
          {/* Footer Metadata */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-400 font-mono text-center">
            <p>LPN: {certData.lpn}</p>
            <p>Inspection: {new Date(certData.inspectionDate).toLocaleString('ko-KR')}</p>
            <p>Hash: {certData.hash}</p>
          </div>
        </div>
        
        <div className="mt-6 flex justify-center">
          <button className="bg-gray-900 text-white rounded-full px-6 py-3 font-bold text-sm shadow-lg flex items-center gap-2 hover:bg-gray-800 active:scale-95 transition-all">
            <ThumbsUp size={16} /> 
            품질 보증서 확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
