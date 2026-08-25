'use client';

/**
 * FDS(Fraud Detection System) 이상거래 관제 콘솔.
 *
 * 백엔드 구조: 결정론적 룰 엔진 4종(R1 블라인드 결재 / R2 등급 오버라이드 남용 /
 * R3 야간 대량 주문 / R4 반품 남용)이 적발·위험점수를 확정하고,
 * FDS Analyst Agent(gpt-4o-mini)가 각 건의 정황 해석과 권고 조치 서술만 생성한다.
 * 적발 즉시 notifications:global 채널로 발행되어 상단 알림 종에도 실시간 노출된다.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, RefreshCw, Radar, AlertTriangle, UserX, Moon, Undo2, Bot, Sparkles,
} from 'lucide-react';
import { apiClient } from '@/shared/api/api-client';

interface FdsReportItem {
  id: string;
  target_name: string;
  target_type: 'CUSTOMER' | 'ADMIN' | string;
  rule_code: string;
  fraud_score: number;
  fraud_reason: string | null;
  recommended_action: string | null;
  detected_at: string | null;
}

interface FdsSummary {
  total_reports: number;
  this_week: number;
  by_rule: Record<string, number>;
  recent: FdsReportItem[];
}

const RULE_META: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  R1_BLIND_APPROVAL: {
    label: '블라인드 결재 의심',
    icon: <UserX className="w-3.5 h-3.5" />,
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  },
  R2_GRADE_OVERRIDE: {
    label: '등급 오버라이드 남용',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  R3_NIGHT_BULK: {
    label: '야간 대량 주문',
    icon: <Moon className="w-3.5 h-3.5" />,
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  },
  R4_RETURN_ABUSE: {
    label: '반품 어뷰징',
    icon: <Undo2 className="w-3.5 h-3.5" />,
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  },
  SIMULATED: {
    label: '데모 시뮬레이션',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  },
};

function scoreBadge(score: number): string {
  if (score >= 75) return 'bg-rose-600 text-white';
  if (score >= 55) return 'bg-amber-500 text-white';
  return 'bg-gray-400 text-white';
}

export default function AdminFdsPage() {
  const [reports, setReports] = useState<FdsReportItem[]>([]);
  const [summary, setSummary] = useState<FdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        apiClient.get<FdsReportItem[]>('/api/v1/fds/reports?limit=50'),
        apiClient.get<FdsSummary>('/api/v1/fds/summary'),
      ]);
      setReports(r.data || []);
      setSummary(s.data || null);
    } catch (e) {
      console.error('FDS 데이터 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiClient.post('/api/v1/fds/scan');
      const d = res.data;
      setScanResult(
        `룰 ${d.scanned_rules}종 스캔 완료 — 원시 탐지 ${d.raw_detections}건 / 신규 적발 ${d.new_reports}건 / 중복 억제 ${d.deduplicated}건`
      );
      await fetchAll();
    } catch (e: unknown) {
      console.error(e);
      setScanResult('스캔 실행에 실패했습니다. 서버 로그를 확인하세요.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Banner Header (관제 표준 패턴) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> FRAUD DETECTION SYSTEM CONSOLE
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">룰 엔진 4종 + Analyst Agent (gpt-4o-mini)</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            FDS 이상거래 관제
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            결정론적 룰 엔진이 적발·위험점수를 확정하고, AI Analyst가 정황 해석과 권고 조치를 생성합니다. 적발 즉시 상단 알림 종으로 실시간 통보됩니다.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="shrink-0 whitespace-nowrap px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Radar className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Analyst Agent 분석 중...' : '전체 스캔 실행 (룰 4종)'}</span>
        </button>
      </div>

      {scanResult && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold px-4 py-3 rounded-2xl">
          📡 {scanResult}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>누적 적발 건수</span>
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">
            {summary?.total_reports ?? 0}<span className="text-sm font-bold text-gray-500 ml-1">건</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>금주 신규 적발</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {summary?.this_week ?? 0}<span className="text-sm font-bold text-gray-500 ml-1">건</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>내부(관리자) 적발</span>
            <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">
            {reports.filter((r) => r.target_type === 'ADMIN').length}<span className="text-sm font-bold text-gray-500 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">모럴 해저드 방어 (R1/R2)</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>외부(고객사) 적발</span>
            <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white font-mono">
            {reports.filter((r) => r.target_type === 'CUSTOMER').length}<span className="text-sm font-bold text-gray-500 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">거래 패턴 이상 (R3/R4)</p>
        </div>
      </div>

      {/* 적발 이력 카드 리스트 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            적발 이력 및 AI Analyst 권고 조치
          </h2>
          <button
            onClick={fetchAll}
            className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-400 text-sm font-bold">FDS 데이터를 불러오는 중...</p>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 space-y-1">
            <p className="text-sm font-bold">적발 이력이 없습니다.</p>
            <p className="text-xs">[전체 스캔 실행]으로 룰 엔진 4종을 즉시 가동할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const meta = RULE_META[r.rule_code] || RULE_META.SIMULATED;
              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 space-y-2.5 hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border font-mono ${meta.badge}`}>
                        {meta.icon} [{r.rule_code}] {meta.label}
                      </span>
                      <span className="font-black text-sm text-gray-900 dark:text-white">{r.target_name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {r.target_type === 'ADMIN' ? '내부 관리자' : '고객사'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono ${scoreBadge(r.fraud_score)}`}>
                        위험 {r.fraud_score}점
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {r.detected_at ? r.detected_at.replace('T', ' ').substring(0, 19) : '-'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong className="text-gray-500 dark:text-gray-400">정황 해석:</strong> {r.fraud_reason || '-'}
                  </p>
                  {r.recommended_action && (
                    <div className="flex items-start gap-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                      <Bot className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        <strong className="text-rose-600 dark:text-rose-400">AI 권고 조치:</strong> {r.recommended_action}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
