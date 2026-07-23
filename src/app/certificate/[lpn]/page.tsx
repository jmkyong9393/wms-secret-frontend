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
        const localEvals = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
        const existingBook = [...localEvals].reverse().find((e: any) => e.lpn === lpn);
        
        if (existingBook) {
          // Fetch actual images and defect data from API if job_id is present
          let defectImage = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300&h=200';
          let defectType = existingBook.reasonCode || '없음';
          
          if (existingBook.job_id) {
            try {
              const res = await fetch(`http://localhost:8000/api/v1/inbound/result/${existingBook.job_id}`);
              if (res.ok) {
                const apiData = await res.json();
                if (apiData.images && apiData.images.length > 0) {
                  defectImage = apiData.images[0];
                }
              }
            } catch (err) {
              console.warn("Failed to fetch result API for certificate", err);
            }
          }

          let gradeStr = existingBook.grade?.toUpperCase() || 'NORMAL';
          let displayGrade = 'B';
          if (gradeStr.includes('MINT') || gradeStr === 'S') displayGrade = 'S';
          else if (gradeStr.includes('A') || gradeStr.includes('GOOD')) displayGrade = 'A';
          else if (gradeStr.includes('DAMAGED') || gradeStr.includes('REJECT') || gradeStr.includes('반려')) displayGrade = '반려';

          setCertData({
            lpn: existingBook.lpn,
            title: existingBook.title || '알 수 없는 도서',
            author: existingBook.author || '-',
            publisher: existingBook.publisher || '-',
            grade: displayGrade,
            ubciScore: existingBook.score !== undefined ? existingBook.score : 100,
            priceOriginal: 28000,
            priceUsed: Math.floor(28000 * (existingBook.score !== undefined ? existingBook.score / 100 : 0.8)),
            inspectionDate: new Date(existingBook.timestamp || Date.now()).toISOString(),
            aiModel: 'Nexus Vision AI v2.1',
            hash: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...`,
            defects: defectType !== '정상' && defectType !== 'PERFECT_CONDITION' && defectType !== '없음' ? [
              { type: defectType, image: defectImage }
            ] : []
          });
        } else {
          // Fallback mock if not found
          setCertData({
            lpn,
            title: '클린 아키텍처 (테스트)',
            author: '로버트 C. 마틴',
            publisher: '인사이트',
            grade: 'S',
            ubciScore: 98,
            priceOriginal: 28000,
            priceUsed: 22400,
            inspectionDate: new Date().toISOString(),
            aiModel: 'Nexus Vision AI v2.1',
            hash: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...`,
            defects: []
          });
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
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
          <div className={`p-6 flex flex-col items-center border-b ${
            certData.grade === 'S' || certData.grade === 'A' ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' :
            certData.grade === 'B' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100' :
            'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'
          }`}>
            <div className="bg-white p-3 rounded-full shadow-sm mb-3">
              <Medal size={40} className={
                certData.grade === 'S' || certData.grade === 'A' ? 'text-emerald-500' :
                certData.grade === 'B' ? 'text-amber-500' : 'text-red-500'
              } />
            </div>
            <h2 className={`text-3xl font-black tracking-tighter mb-1 ${
                certData.grade === 'S' || certData.grade === 'A' ? 'text-emerald-700' :
                certData.grade === 'B' ? 'text-amber-700' : 'text-red-700'
            }`}>
              {certData.grade} 등급
            </h2>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${
                certData.grade === 'S' || certData.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                certData.grade === 'B' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
            }`}>
              <Sparkles size={14} />
              <span>UBCI {certData.ubciScore}점</span>
            </div>
          </div>

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
              <h4 className="font-bold text-gray-800 flex items-center gap-1.5 mb-3">
                <Info size={16} className="text-indigo-500" /> 투명성 리포트 (Transparency)
              </h4>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                <p className="text-gray-600 mb-3 leading-relaxed">
                  본 도서는 <strong className="text-gray-800">{certData.aiModel}</strong> 엔진을 통해 360도 스캔을 마쳤습니다. 기계적 정밀 분석 결과, {
                    certData.grade === 'S' ? '전반적으로 훼손이 없는 최상급 상태입니다.' :
                    certData.grade === 'A' ? '경미한 훼손만 있는 우수한 상태입니다.' :
                    certData.grade === 'B' ? '일반적인 중고 도서 수준의 상태입니다.' :
                    '재판매가 불가능한 심각한 훼손이 발견되어 반려 처리되었습니다.'
                  }
                </p>
                
                {/* Defect Images */}
                {certData.defects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">💡 투명성 보장: 대표 결함 사진</p>
                    <p className="text-[11px] text-gray-400 mb-2">고객님의 안심 구매를 위해 가장 큰 결함 1개의 사진을 미리 공개합니다. (단순 변심 반품 방지)</p>
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
