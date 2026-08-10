'use client';
import React from 'react';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
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
import { apiClient } from '@/lib/api-client';
import { ShieldAlert, Lightbulb, ScrollText } from 'lucide-react';
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

// 차트 데이터는 전량 백엔드 실집계다. 조회에 실패하면 빈 배열로 두어 화면이
// "데이터 없음"을 보이게 한다 - 목업 수치로 대체하면 실패가 정상처럼 보인다.
// (종전 폴백은 등급 경계까지 90/75/60으로 적혀 있어 UBCI 규격 95/85/65와 어긋났다.)

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
  const user = useAtomValue(currentUserAtom);

  // 대시보드 API는 전부 인증이 필요하다. 토큰을 붙이는 apiClient로 호출해야 한다
  // (맨 fetch로 부르면 401이 나고, 화면은 실패를 알리지 못한 채 0건으로 보인다).
  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/kpi')).data,
    refetchInterval: 5000,
  });

  const { data: charts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/charts')).data,
    refetchInterval: 10000,
  });

  const { data: fdsSummary } = useQuery({
    queryKey: ['fds-summary'],
    queryFn: async () => (await apiClient.get('/api/v1/fds/summary')).data,
    refetchInterval: 15000,
  });

  const { data: weekly } = useQuery({
    queryKey: ['weekly-insights'],
    // 지연 물질화: 이번 주 row가 없으면 백엔드가 즉석 집계 + Insight Agent 서사 생성 후 캐시
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/weekly-insights')).data,
    staleTime: 10 * 60 * 1000,
  });

  // 로그 비우기 기준 시각.
  //
  // 검수 로그의 원장은 return_jobs이고 이는 매입가 산정 근거이자 감사 대상이라 지우지 않는다.
  // "비우기"는 이 브라우저에서 언제 이후 것만 볼지를 정하는 화면 설정이며, 서버에는
  // `since`로만 전달된다.
  const [logsClearedAt, setLogsClearedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLogsClearedAt(localStorage.getItem('dashboard_logs_cleared_at'));
  }, []);

  const { data: recentLogs } = useQuery({
    queryKey: ['dashboard-logs', logsClearedAt],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 30 };
      if (logsClearedAt) params.since = logsClearedAt;
      return (await apiClient.get('/api/v1/dashboard/logs', { params })).data;
    },
    refetchInterval: 10000,
  });

  const clearLogs = () => {
    const now = new Date().toISOString();
    localStorage.setItem('dashboard_logs_cleared_at', now);
    setLogsClearedAt(now);
  };

  const ubciGradeData = charts?.ubci_grade_data ?? [];
  // [수정 이력] 종전에는 이 값이 "86%" 문자열로 하드코딩되어 실데이터와 무관하게 항상
  // 같았다. 등급 비율(pct)도 프론트가 value(실개수)에 그대로 "%"를 붙여 617%처럼
  // 표시됐다 - 총합 대비 비율은 백엔드가 계산해 pct 필드로 내려준다(charts/router.py).
  const ubciMintGoodPct = charts?.ubci_mint_good_pct;
  const volumeDataChart = charts?.volume_data ?? [];
  const categoryDataChart = charts?.category_data ?? [];

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500 font-sans min-h-dvh text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* High-Tech Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> EXECUTIVE MASTER DASHBOARD
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">v2.15.0.1 Recharts High-Tech Edition</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            📊 최고 관리자 종합 통계 관제 대시보드
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            환영합니다, <span className="font-bold text-gray-800 dark:text-gray-200">{user?.name || user?.employeeId || '최초관리자'}</span>님! 실시간 입출고 물동량 추이 및 AI UBCI 품질 지표입니다.
          </p>
        </div>

        <Link 
          href="/inbound" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all shadow-md shadow-blue-200 dark:shadow-none active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Camera className="w-4 h-4 mr-2" />
          도서 입고 검수 앱 실행
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
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {kpi?.approval_rate !== undefined ? `${kpi.approval_rate}%` : '-'}
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />전체 {kpi?.decided_total ?? 0}건 기준
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
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                {kpi?.rejection_rate !== undefined ? `${kpi.rejection_rate}%` : '-'}
              </span>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" />HITL 이관 {kpi?.hitl_rate ?? 0}%
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
              <Bar dataKey="used" stackId="stock" name="중고 (검수 완료)" fill="#6366f1" />
              <Bar dataKey="new" stackId="stock" name="신품 (Fast-track)" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 주간 인사이트 (Insight Agent) + FDS 이상거래 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 주간 인사이트 카드 (집계=결정론적 SQL, 서사=gpt-4o-mini) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" /> 주간 인사이트 {weekly?.report_week ? `(${weekly.report_week})` : ''}
            </h3>
            <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full font-bold font-mono border border-amber-200 dark:border-amber-800">
              Insight Agent (gpt-4o-mini)
            </span>
          </div>

          {weekly ? (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl p-4">
                {weekly.ai_narrative || '주간 서사가 아직 생성되지 않았습니다.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500">절감 인건비 (추정)</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{(weekly.saved_labor_cost_krw ?? 0).toLocaleString()}원</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500">주간 검수</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white font-mono">{weekly.logistics?.week_inspections ?? 0}건</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500">주간 주문</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white font-mono">{weekly.logistics?.week_orders ?? 0}건</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500">차주 반품 예측</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{weekly.predicted_returns ?? 0}건</p>
                </div>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-gray-400 text-sm font-bold">주간 인사이트를 생성하는 중...</p>
          )}
        </div>

        {/* FDS 이상거래 요약 위젯 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" /> FDS 이상거래
            </h3>
            <Link href="/admin/fds" className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
              관제 이동 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center justify-around text-center mb-3">
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white font-mono">{fdsSummary?.total_reports ?? 0}</p>
              <p className="text-[11px] font-bold text-gray-400">누적 적발</p>
            </div>
            <div>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{fdsSummary?.this_week ?? 0}</p>
              <p className="text-[11px] font-bold text-gray-400">금주 적발</p>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            {(fdsSummary?.recent || []).length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4 font-bold">최근 적발 건이 없습니다.</p>
            ) : (
              (fdsSummary.recent as Array<{ id: string; rule_code: string; target_name: string; fraud_score: number }>).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-lg px-3 py-2">
                  <span className="font-bold text-gray-800 dark:text-gray-200 truncate mr-2">{r.target_name}</span>
                  <span className="font-black font-mono text-rose-600 dark:text-rose-400 shrink-0">{r.fraud_score}점</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 실시간 검수 처리 로그 (기존 /dashboard/logs 실소비) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> 실시간 검수 처리 로그
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold font-mono border border-blue-200 dark:border-blue-800">
              최근 30건 · 10초 자동 갱신
            </span>
            {logsClearedAt && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('dashboard_logs_cleared_at');
                  setLogsClearedAt(null);
                }}
                className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                전체 보기
              </button>
            )}
            <button
              type="button"
              onClick={clearLogs}
              title="원장은 그대로 두고 이 화면의 표시만 비웁니다"
              className="text-xs font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              로그 비우기
            </button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto font-mono text-xs">
          {(recentLogs || []).length === 0 ? (
            <p className="text-center text-gray-400 py-4 font-bold font-sans">
              {logsClearedAt ? '비운 이후 새로 처리된 검수 건이 없습니다.' : '최근 처리 로그가 없습니다.'}
            </p>
          ) : (
            (recentLogs as Array<{ id: string; transaction_type: string; book_title: string | null; condition_grade: string | null; date: string | null }>).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                <span className="text-gray-400 shrink-0">{(log.date || '').replace('T', ' ').substring(5, 19)}</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 truncate flex-1">{log.book_title || '도서 미지정'}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded font-black text-[10px] ${
                  log.transaction_type === 'HITL_PENDING'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>{log.condition_grade || '미산출'}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
