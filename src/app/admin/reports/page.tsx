'use client';

import { Activity, BarChart3, PieChart, Target, Zap, Server, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/features/dashboard/api';

export default function ReportsPage() {
  const { data: report, isLoading } = useQuery({
    queryKey: ['aiQualityReport'],
    queryFn: dashboardService.getAIQualityReport,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-gray-500 font-medium">AI 품질 리포트를 분석 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 품질 리포트</h1>
        <p className="text-gray-500 text-sm mt-1">Vision AI 모델의 정확도, 응답 지연 시간, 판독 등급 분포 통계입니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center text-blue-600 mb-2">
            <Target className="w-5 h-5 mr-2" />
            <span className="font-bold text-sm">AI 모델 정확도</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{report?.accuracy}%</div>
          <p className="text-xs text-emerald-500 font-medium mt-1">지난주 대비 +{report?.accuracyGrowth}% 향상</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center text-purple-600 mb-2">
            <Zap className="w-5 h-5 mr-2" />
            <span className="font-bold text-sm">평균 응답 지연</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{report?.avgLatency}</div>
          <p className="text-xs text-gray-500 font-medium mt-1">이미지 렌더링 포함</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center text-orange-600 mb-2">
            <Activity className="w-5 h-5 mr-2" />
            <span className="font-bold text-sm">재촬영 요구율</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{report?.rescanRate}%</div>
          <p className="text-xs text-red-500 font-medium mt-1">조명 이슈 위주 발생</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center text-emerald-600 mb-2">
            <Server className="w-5 h-5 mr-2" />
            <span className="font-bold text-sm">서버 가동률 (Uptime)</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{report?.uptime}%</div>
          <p className="text-xs text-gray-500 font-medium mt-1">정상 작동 중</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[300px]">
          <BarChart3 className="w-16 h-16 text-gray-200 mb-4" />
          <h3 className="text-lg font-bold text-gray-800">일별 판독 소요 시간 트렌드</h3>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">차트 라이브러리(Recharts 등) 연동 대기 중입니다.<br/>백엔드 API에서 시계열 데이터를 제공받아 렌더링됩니다.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[300px]">
          <PieChart className="w-16 h-16 text-gray-200 mb-4" />
          <h3 className="text-lg font-bold text-gray-800">UBCI 등급 판정 비율</h3>
          <div className="flex gap-4 mt-6">
            <div className="text-center"><div className="text-xl font-bold text-emerald-600">{report?.gradeDistribution.S}%</div><div className="text-xs font-medium text-gray-500 mt-1">S등급</div></div>
            <div className="text-center"><div className="text-xl font-bold text-blue-600">{report?.gradeDistribution.A}%</div><div className="text-xs font-medium text-gray-500 mt-1">A등급</div></div>
            <div className="text-center"><div className="text-xl font-bold text-yellow-600">{report?.gradeDistribution.B}%</div><div className="text-xs font-medium text-gray-500 mt-1">B등급</div></div>
            <div className="text-center"><div className="text-xl font-bold text-red-600">{report?.gradeDistribution.C_D}%</div><div className="text-xs font-medium text-gray-500 mt-1">C/D등급</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
