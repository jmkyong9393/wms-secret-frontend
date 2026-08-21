'use client';

// 대시보드 차트 4종 - 초기 번들에서 Recharts를 떼어내기 위한 분리 청크.
// charts prop이 실제로 바뀔 때만 다시 그린다 (React.memo).
import React from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowRight, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

// Custom Recharts Tooltip Component for Pixel-Perfect Dark / Light Mode Support
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-3 rounded-xl shadow-xl text-xs font-sans space-y-1 z-50">
        <p className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-1 font-mono">{label}</p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              {item.name}:
            </span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function DashboardCharts({ charts }: { charts: any }) {
    const ubciGradeData = charts?.ubci_grade_data ?? [];
    // 등급 비율(pct)·MINT+GOOD 합계는 백엔드가 계산해 pct 필드로 내려준다(charts/router.py).
    const ubciMintGoodPct = charts?.ubci_mint_good_pct;
    const volumeDataChart = charts?.volume_data ?? [];
    const categoryDataChart = charts?.category_data ?? [];
  return (
    <>
      {/* Recharts 3대 핵심 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: 일별 입출고 물동량 추이 (AreaChart - 2Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> 최근 14일간 일별 입출고 물동량 추이
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">입고(Inbound) 및 출고(Outbound) 일별 처리 수량 듀얼 곡선입니다.</p>
            </div>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold font-mono border border-indigo-200 dark:border-indigo-800">
              실시간 동기화
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeDataChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="inbound" name="입고 수량" stroke="#6366f1" fillOpacity={1} fill="url(#colorInbound)" strokeWidth={2.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="outbound" name="출고 수량" stroke="#10b981" fillOpacity={1} fill="url(#colorOutbound)" strokeWidth={2.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: AI UBCI 품질 등급 비율 (PieChart - 1Col) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> AI UBCI 품질 등급 비율
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              보유 중고 재고의 UBCI 등급 구성입니다. 신품 Fast-track은 무검수 입고라 제외됩니다.
            </p>

            <div className="h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ubciGradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {ubciGradeData.map((entry: { name: string; value: number; color: string }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                  {ubciMintGoodPct != null ? `${ubciMintGoodPct}%` : '—'}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">MINT+GOOD</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t dark:border-gray-800 text-xs">
            {ubciGradeData.map((item: { name: string; value: number; pct?: number; color: string }) => (
              <div key={item.name} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold font-mono text-gray-900 dark:text-white">
                  {item.value.toLocaleString()}건 ({item.pct ?? 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Chart 2: 카테고리별 재고 보유 현황 (BarChart - Full Width) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> 주요 카테고리별 재고 자산 보유 현황
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              보유 재고 수량을 카테고리별로 집계했습니다. 중고(검수 완료분)와 신품(Fast-track)을 나눠 표시합니다.
            </p>
          </div>
          <Link href="/inventory" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            재고 관리 이동 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {/* 중고/신품을 한 막대에 쌓아 카테고리별 총량과 구성비를 함께 읽는다. */}
            <BarChart data={categoryDataChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="used" stackId="stock" name="중고 (검수 완료)" fill="#6366f1" isAnimationActive={false} />
              <Bar dataKey="new" stackId="stock" name="신품 (Fast-track)" fill="#10b981" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export default React.memo(DashboardCharts);
