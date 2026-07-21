'use client';

import { TrendingUp, Award, BarChart3, Target, Zap } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { userAtom } from '@/stores/auth';

export default function KPICharts() {
  const user = useAtomValue(userAtom);

  return (
    <div className="space-y-8 pt-4">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-16 h-16 text-yellow-500" />
          </div>
          <h3 className="text-gray-500 text-sm font-medium">나의 UPH (시간당 처리량)</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">142 <span className="text-sm font-medium text-gray-500">건/hr</span></p>
          <p className="text-xs font-semibold text-green-600 mt-2 flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" /> 전주 대비 +12% 증가
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">전체 순위 (Gamification)</h3>
          <p className="text-3xl font-bold text-indigo-600 mt-2 flex items-center">
            상위 5% <Award className="w-8 h-8 ml-2 text-yellow-500" />
          </p>
          <p className="text-xs font-semibold text-gray-500 mt-2">
            전체 120명의 작업자 중 6위
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">AI 자동 승인율</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">94.2<span className="text-lg text-gray-500">%</span></p>
          <p className="text-xs font-medium text-gray-500 mt-2">
            평균(88%)보다 높음
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">치명적 오분류 횟수</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0 <span className="text-sm font-medium text-gray-500">건</span></p>
          <p className="text-xs font-medium text-emerald-600 mt-2">
            PERFECT! 무결점 작업 유지 중
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: UPH Weekly Trend (Mockup using CSS) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <BarChart3 className="mr-2 w-5 h-5 text-indigo-600" />
              주간 생산성 (UPH) 추이
            </h3>
            <select className="text-xs border-gray-200 rounded-md bg-gray-50 text-gray-600">
              <option>최근 1주일</option>
              <option>최근 1개월</option>
            </select>
          </div>
          
          <div className="h-64 flex items-end justify-between px-2 pb-6 pt-10 border-b border-gray-200 relative">
            {/* Y축 가이드라인 */}
            <div className="absolute top-10 left-0 w-full border-t border-dashed border-gray-200"></div>
            <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-gray-200"></div>
            <span className="absolute top-8 left-0 text-xs text-gray-400">150</span>
            <span className="absolute top-1/2 left-0 -mt-2 text-xs text-gray-400">75</span>
            
            {/* Bars */}
            <div className="w-12 bg-indigo-100 hover:bg-indigo-200 rounded-t-md transition-all relative group" style={{ height: '60%' }}>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">110</span>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">월</span>
            </div>
            <div className="w-12 bg-indigo-100 hover:bg-indigo-200 rounded-t-md transition-all relative group" style={{ height: '75%' }}>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">125</span>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">화</span>
            </div>
            <div className="w-12 bg-indigo-500 hover:bg-indigo-600 rounded-t-md transition-all relative shadow-sm group" style={{ height: '90%' }}>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-indigo-600">142</span>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-800 font-bold">수</span>
            </div>
            <div className="w-12 bg-indigo-100 hover:bg-indigo-200 rounded-t-md transition-all relative group" style={{ height: '50%' }}>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">80</span>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">목</span>
            </div>
            <div className="w-12 bg-indigo-100 hover:bg-indigo-200 rounded-t-md transition-all relative group" style={{ height: '70%' }}>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">115</span>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">금</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Gamification Target */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-md p-8 text-white relative overflow-hidden flex flex-col justify-center">
          <div className="absolute right-0 top-0 opacity-10">
            <Target className="w-48 h-48" />
          </div>
          
          <div className="relative z-10">
            <span className="bg-indigo-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Next Tier</span>
            <h3 className="text-3xl font-extrabold mt-4 mb-2 flex items-center">
              마스터 작업자 (Top 1%)
            </h3>
            <p className="text-slate-300 text-sm mb-8">
              다음 등급으로 승급하기 위해 UPH 150 달성이 필요합니다. 현재 142 UPH로 마스터 승급까지 단 8건 남았습니다!
            </p>
            
            <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full w-11/12 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 font-bold">
              <span>현재: 시니어 (Top 5%)</span>
              <span>목표: 마스터 (Top 1%)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
