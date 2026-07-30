'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';
import { 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  Camera, 
  RefreshCcw, 
  Activity,
  Layers,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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

// Mock Recharts Data
const volumeData = [
  { date: '07-21', inbound: 1200, outbound: 980 },
  { date: '07-22', inbound: 1450, outbound: 1100 },
  { date: '07-23', inbound: 1300, outbound: 1250 },
  { date: '07-24', inbound: 1680, outbound: 1400 },
  { date: '07-25', inbound: 1900, outbound: 1550 },
  { date: '07-26', inbound: 2100, outbound: 1800 },
  { date: '07-27', inbound: 2450, outbound: 1980 },
];

const categoryData = [
  { name: '소설/문학', count: 480, fill: '#6366f1' },
  { name: 'IT/컴퓨터', count: 340, fill: '#10b981' },
  { name: '경제/경영', count: 290, fill: '#f59e0b' },
  { name: '자연과학', count: 160, fill: '#ec4899' },
  { name: '만화/웹툰', count: 220, fill: '#8b5cf6' },
];

const ubciGradeDataDefault = [
  { name: 'MINT (90~100점)', value: 58, color: '#10b981' },
  { name: 'GOOD (75~89점)', value: 28, color: '#3b82f6' },
  { name: 'NORMAL (60~74점)', value: 10, color: '#f59e0b' },
  { name: 'REJECT (60점 미만)', value: 4, color: '#ef4444' },
];

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

export default function AdvancedDashboardPage() {
  const user = useAtomValue(userAtom);

  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/v1/dashboard/kpi');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: charts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/v1/dashboard/charts');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 10000,
  });

  const ubciGradeData = charts?.ubci_grade_data || ubciGradeDataDefault;
  const volumeDataChart = charts?.volume_data || volumeData;
  const categoryDataChart = charts?.category_data || categoryData;

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500 font-sans min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* High-Tech Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> EXECUTIVE MASTER DASHBOARD
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">v2.6.0.7 Recharts High-Tech Edition</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            📊 최고 관리자 종합 통계 관제 대시보드
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            환영합니다, <span className="font-bold text-gray-800 dark:text-gray-200">{user?.name || user?.employee_id || '최초관리자'}</span>님! 실시간 입출고 물동량 추이 및 AI UBCI 품질 지표입니다.
          </p>
        </div>

        <Link 
          href="/inbound" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all shadow-md shadow-blue-200 dark:shadow-none active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Camera className="w-4 h-4 mr-2" />
          현장 반품 검수 앱 실행
        </Link>
      </div>

      {/* 4대 실시간 KPI 미니 도넛/바 위젯 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: 금일 누적 처리량 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">금일 누적 처리량</span>
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                {kpi?.today_inspection !== undefined ? kpi.today_inspection.toLocaleString() : '0'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">건</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />실시간 동기화
            </span>
          </div>
        </div>

        {/* Widget 2: 실시간 자동 승인율 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">실시간 자동 승인율</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">91.7%</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />+3.4%
            </span>
          </div>
        </div>

        {/* Widget 3: 에이전트 반려율 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">에이전트 반려율</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">4.8%</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" />-1.2%
            </span>
          </div>
        </div>

        {/* Widget 4: 검수 재확인 (HITL) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">HITL 심사 대기</span>
            <RefreshCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                {kpi?.pending_issues !== undefined ? kpi.pending_issues.toLocaleString() : '0'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">건</span>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
              실시간 조율
            </span>
          </div>
        </div>
      </div>

      {/* Recharts 3대 핵심 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: 일별 입출고 물동량 추이 (AreaChart - 2Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> 최근 7일간 일별 입출고 물동량 추이
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">입고(Inbound) 및 출고(Outbound) 일별 처리 수량 듀얼 곡선입니다.</p>
            </div>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold font-mono border border-indigo-200 dark:border-indigo-800">
              실시간 동기화
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                <Area type="monotone" dataKey="inbound" name="입고 수량" stroke="#6366f1" fillOpacity={1} fill="url(#colorInbound)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="outbound" name="출고 수량" stroke="#10b981" fillOpacity={1} fill="url(#colorOutbound)" strokeWidth={2.5} />
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">전체 입고 도서의 UBCI 상태 점수 분포입니다.</p>

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
                  >
                    {ubciGradeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">86%</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">MINT+GOOD</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t dark:border-gray-800 text-xs">
            {ubciGradeData.map((item) => (
              <div key={item.name} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold font-mono text-gray-900 dark:text-white">{item.value}%</span>
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
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> 5대 도서 카테고리별 재고 자산 보유 현황
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">창고 보관 랙(Zone A-E)에 적치된 장르별 재고 장수입니다.</p>
          </div>
          <Link href="/admin/inventory" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            재고 관리 이동 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="보유 수량 (권)" radius={[8, 8, 0, 0]}>
                {categoryData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
