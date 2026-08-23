'use client';
import React from 'react';
import { useHydratedUser } from '@/features/auth/hooks/useHydratedUser';
import dynamic from 'next/dynamic';

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
  
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ShieldAlert, Lightbulb, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';

// 차트 데이터는 전량 백엔드 실집계다. 조회에 실패하면 빈 배열로 두어 화면이
// "데이터 없음"을 보이게 한다 - 목업 수치로 대체하면 실패가 정상처럼 보인다.
// (종전 폴백은 등급 경계까지 90/75/60으로 적혀 있어 UBCI 규격 95/85/65와 어긋났다.)

// 차트 청크 로딩 중 자리 고정 - 실제 카드 높이와 맞춰 레이아웃 이동(CLS)을 막는다.
function ChartsSkeleton() {
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse';
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 h-96 ${card}`} />
        <div className={`h-96 ${card}`} />
      </div>
      <div className={`h-80 ${card}`} />
    </>
  );
}

const DashboardCharts = dynamic(() => import('@/features/dashboard/components/DashboardCharts'), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

export default function AdvancedDashboardPage() {
  const { user } = useHydratedUser();

  // 대시보드 API는 전부 인증이 필요하다. 토큰을 붙이는 apiClient로 호출해야 한다
  // (맨 fetch로 부르면 401이 나고, 화면은 실패를 알리지 못한 채 0건으로 보인다).
  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/kpi')).data,
    refetchInterval: 30000,
  });

  const { data: charts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/charts')).data,
    refetchInterval: 30000,
  });

  const { data: fdsSummary } = useQuery({
    queryKey: ['fds-summary'],
    queryFn: async () => (await apiClient.get('/api/v1/fds/summary')).data,
    refetchInterval: 60000,
  });

  const { data: weekly } = useQuery({
    queryKey: ['weekly-insights'],
    // 지연 물질화: 이번 주 row가 없으면 백엔드가 즉석 집계 + Insight Agent 서사 생성 후 캐시
    queryFn: async () => (await apiClient.get('/api/v1/dashboard/weekly-insights')).data,
    staleTime: 10 * 60 * 1000,
  });

  // 지난 주간 인사이트 이력.
  //
  // weekly_insights는 실제로 방문한 주만 쌓이므로(1년에 최대 52행) DB 용량 문제는 아니다.
  // 다만 HITL 대기열처럼 "전체를 한 번에 fetch"하는 패턴을 반복하면 나중에 몇 년치가
  // 쌓였을 때 프론트가 그 전부를 한 번에 렌더링하게 된다 - 그래서 처음부터 배치
  // 페이지네이션(limit/offset)만 쓰고, "더보기"를 누른 만큼만 이어붙인다.
  const HISTORY_PAGE_SIZE = 10;
  const [historyItems, setHistoryItems] = React.useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyExpanded, setHistoryExpanded] = React.useState(false);

  const loadMoreHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiClient.get('/api/v1/dashboard/weekly-insights/history', {
        params: { limit: HISTORY_PAGE_SIZE, offset: historyItems.length },
      });
      setHistoryItems((prev) => [...prev, ...(res.data.items ?? [])]);
      setHistoryTotal(res.data.total ?? 0);
    } catch (err) {
      console.warn('주간 인사이트 이력 조회 실패:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyItems.length]);

  const toggleHistory = () => {
    const next = !historyExpanded;
    setHistoryExpanded(next);
    if (next && historyItems.length === 0) {
      loadMoreHistory();
    }
  };

  // 이번 주 카드와 중복 표시되지 않도록 이력 목록에서는 제외한다.
  const pastHistoryItems = historyItems.filter((h) => h.report_week !== weekly?.report_week);
  const hasMoreHistory = historyItems.length < historyTotal;

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
    refetchInterval: 30000,
  });

  const clearLogs = () => {
    const now = new Date().toISOString();
    localStorage.setItem('dashboard_logs_cleared_at', now);
    setLogsClearedAt(now);
  };

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

        {/* Widget 2: AI 단독 승인율 - 관리자 결재를 거친 건은 자동이 아니므로 분자에서 뺀다 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">AI 단독 승인율</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {kpi?.auto_approval_rate !== undefined ? `${kpi.auto_approval_rate}%` : '-'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                {kpi?.auto_approved ?? 0}/{kpi?.decided_total ?? 0}건
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />최종 승인율 {kpi?.approval_rate ?? 0}%
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
            {/* 누가 올렸는지로 쪼갠다. 관리자 소환은 사람이 이미 의심한 건이라 성격이 다르다 */}
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
              <span>AI 이관 {kpi?.pending_by_ai ?? 0}</span>
              <span className="text-amber-400 dark:text-amber-700">·</span>
              <span>관리자 소환 {kpi?.pending_by_admin ?? 0}</span>
            </span>
          </div>
        </div>
      </div>

      <DashboardCharts charts={charts} />

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
              {/* 지난 주간 인사이트 - 최신순, "더보기"로 배치 로딩 (§전체 fetch 지양) */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <button
                  type="button"
                  onClick={toggleHistory}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  {historyExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  지난 주간 인사이트
                </button>

                {historyExpanded && (
                  <div className="mt-3 space-y-2.5">
                    {pastHistoryItems.length === 0 && !historyLoading && (
                      <p className="text-xs text-gray-400 py-2">지난 주 이력이 없습니다.</p>
                    )}
                    {pastHistoryItems.map((h) => (
                      <div
                        key={h.report_week}
                        className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 font-mono">{h.report_week}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {h.generated_at ? new Date(h.generated_at).toLocaleDateString('ko-KR') : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {h.ai_narrative || '서사가 생성되지 않았습니다.'}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                          <span>절감 {(h.saved_labor_cost_krw ?? 0).toLocaleString()}원</span>
                          <span>검수 {h.logistics?.week_inspections ?? 0}건</span>
                          <span>주문 {h.logistics?.week_orders ?? 0}건</span>
                          <span>반품예측 {h.predicted_returns ?? 0}건</span>
                        </div>
                      </div>
                    ))}

                    {hasMoreHistory && (
                      <button
                        type="button"
                        onClick={loadMoreHistory}
                        disabled={historyLoading}
                        className="w-full py-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {historyLoading ? '불러오는 중...' : `더보기 (${historyItems.length}/${historyTotal})`}
                      </button>
                    )}
                  </div>
                )}
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
