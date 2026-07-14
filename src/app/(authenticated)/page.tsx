'use client';

import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';
import { Package, CheckCircle2, AlertTriangle, TrendingUp, ArrowRight, Camera, RefreshCcw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';

/**
 * WMS 시스템의 메인 대시보드 페이지 컴포넌트입니다.
 * 관리자가 로그인 후 가장 먼저 접하는 화면으로, 핵심 성과 지표(KPI)와 최근 로그, 액션 센터를 한눈에 보여줍니다.
 * 
 * @component
 */
export default function DashboardPage() {
  // 전역 상태관리(Jotai)를 통해 로그인된 사용자 정보를 가져옵니다.
  const user = useAtomValue(userAtom);

  // React Query를 통한 데이터 패칭: 서버 캐싱 및 로딩 상태를 자동으로 관리합니다.
  const { data: kpiData, isLoading: isKpiLoading } = useQuery({
    queryKey: ['dashboardKPIs'],
    queryFn: dashboardService.getKPIs,
  });

  const { data: recentLogs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['recentLogs'],
    queryFn: dashboardService.getRecentLogs,
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">환영합니다, {user?.name || '관리자'}님! 금일 물류 센터 현황입니다.</p>
        </div>
        <Link 
          href="/inbound" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md shadow-blue-200"
        >
          <Camera className="w-5 h-5 mr-2" />
          현장 반품 검수 앱 실행
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-bold">금일 AI 판독 건수</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Package className="w-5 h-5" /></div>
          </div>
          <div className="flex items-end gap-2">
            {isKpiLoading ? <Loader2 className="w-8 h-8 animate-spin text-gray-300" /> : (
              <>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{kpiData?.todayScans.toLocaleString()}</span>
                <span className="text-sm font-bold text-emerald-500 mb-1 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1"/>+{kpiData?.scanGrowthRate}%
                </span>
              </>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-bold">S등급 (최상) 판정률</h3>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
          </div>
          <div className="flex items-end gap-2">
            {isKpiLoading ? <Loader2 className="w-8 h-8 animate-spin text-gray-300" /> : (
              <>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{kpiData?.sGradeRate}%</span>
                <span className="text-sm font-bold text-emerald-500 mb-1">매우 양호</span>
              </>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-bold">파손 폐기 (C/D등급)</h3>
            <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          </div>
          <div className="flex items-end gap-2">
            {isKpiLoading ? <Loader2 className="w-8 h-8 animate-spin text-gray-300" /> : (
              <>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{kpiData?.discardCount.toLocaleString()}</span>
                <span className="text-sm font-bold text-red-500 mb-1">건</span>
              </>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-bold">자동 발주 트리거</h3>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><RefreshCcw className="w-5 h-5" /></div>
          </div>
          <div className="flex items-end gap-2">
            {isKpiLoading ? <Loader2 className="w-8 h-8 animate-spin text-gray-300" /> : (
              <>
                <span className="text-3xl font-black text-gray-900 tracking-tight">{kpiData?.pendingPoCount.toLocaleString()}</span>
                <span className="text-sm font-bold text-gray-500 mb-1">건 승인 대기중</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent AI Logs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">최근 AI 판독 및 적치 현황</h2>
            <Link href="/inventory" className="text-sm text-blue-600 font-bold hover:underline flex items-center">
              전체 재고 보기 <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-5 font-bold">시간</th>
                  <th className="py-4 px-5 font-bold">LPN 바코드</th>
                  <th className="py-4 px-5 font-bold">도서명</th>
                  <th className="py-4 px-5 font-bold">UBCI 등급</th>
                  <th className="py-4 px-5 font-bold">상태</th>
                </tr>
              </thead>
              <tbody>
                {isLogsLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      로그 불러오는 중...
                    </td>
                  </tr>
                ) : recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">최근 판독 로그가 없습니다.</td>
                  </tr>
                ) : (
                  recentLogs.map((log, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-5 text-sm text-gray-500 font-medium">{log.time}</td>
                      <td className="py-3 px-5 text-sm font-mono text-gray-700 font-bold">{log.lpn}</td>
                      <td className="py-3 px-5 text-sm font-extrabold text-gray-900">{log.book}</td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
                          log.grade.includes('S등급') ? 'bg-emerald-100 text-emerald-800' :
                          log.grade.includes('A등급') ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {log.grade}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-bold flex items-center ${
                          log.status === 'COMPLETED' ? 'text-gray-500' : 'text-red-500'
                        }`}>
                          {log.status === 'COMPLETED' ? '적치 완료' : '폐기 분류'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Center */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">액션 센터</h2>
          </div>
          <div className="p-5 space-y-4 flex-1 bg-white">
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl shadow-sm">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-red-800">안전 재고 경고</h4>
                  <p className="text-xs text-red-600/90 mt-1.5 font-medium leading-relaxed">
                    '이것이 자바다' 도서의 파손 폐기율이 높아 C-존의 가용 재고가 부족합니다.
                  </p>
                  <Link href="/po" className="text-xs font-bold text-red-700 mt-3 inline-flex items-center hover:underline bg-red-100 px-3 py-1.5 rounded-lg">
                    자동 발주 승인하러 가기 <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm">
              <div className="flex items-start">
                <Package className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-blue-800">주간 입고 리포트</h4>
                  <p className="text-xs text-blue-600/90 mt-1.5 font-medium leading-relaxed">
                    금주 반품 입고량이 지난주 대비 15% 증가했습니다. AI 리소스 추가 할당을 권장합니다.
                  </p>
                  <Link href="/reports" className="text-xs font-bold text-blue-700 mt-3 inline-flex items-center hover:underline bg-blue-100 px-3 py-1.5 rounded-lg">
                    AI 품질 리포트 보기 <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
