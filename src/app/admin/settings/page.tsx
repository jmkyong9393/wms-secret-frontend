'use client';

/**
 * 시스템 설정 관제 콘솔.
 *
 * [수정 이력 2026-08-05] 테마를 제외한 전 항목이 로컬 state 더미(저장 버튼 = 토스트만)였다.
 * - "AI 검수 & Fast Track 임계값" 슬라이더 제거: MINT 95점은 UBCI S등급 경계와 결합된
 *   파이프라인 정책 상수(프리즈 구역)라 런타임 변경 대상이 아니고, "BBox 신뢰도 하한
 *   이관"은 실제 파이프라인에 존재하지 않는 가공 설정이었다. 실제 정책을 보여주는
 *   읽기 전용 정책 뷰로 대체.
 * - 자동 인쇄 트리거 / HITL 경보 임계값은 lib/systemSettings 저장소로 실제 영속화하고
 *   /inbound(프린터 연결 시도), /admin/hitl(대기열 경보)이 소비한다.
 * - 실시간 팝업 알림 음소거는 Header와 동일 키(nexus-notif-muted)를 공유한다.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Settings, Cpu, Printer, Sun, Moon, BellRing, Save, CheckCircle2, Zap, ShieldAlert, Lock, Package,
} from 'lucide-react';
import { getSystemSettings, saveSystemSettings } from '@/lib/systemSettings';
import { apiClient } from '@/lib/api-client';
// 정책 상수는 HITL 화면과 공유한다 (features/hitl/policy.ts 단일 정의)
import { UBCI_GRADE_POLICY, HITL_ROUTING_POLICY } from '@/features/hitl/policy';


export default function SystemSettingsPage() {
  // 실연동 설정 (lib/systemSettings 영속화)
  const [autoPrintTrigger, setAutoPrintTrigger] = useState<boolean>(true);
  const [hitlAlertCount, setHitlAlertCount] = useState<number>(10);
  // Header와 공유하는 실시간 팝업 알림 음소거 (nexus-notif-muted)
  const [notifMuted, setNotifMuted] = useState<boolean>(false);
  // 테마 (기존 실연동 유지)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // SCM 자동발주 안전재고 (백엔드 system_settings 테이블 - localStorage가 아니라
  // 서버가 직접 읽어야 하므로 별도 API로 조회/저장한다. §systemSettings.ts와 혼동 금지)
  const [safetyStock, setSafetyStock] = useState<number>(3);
  const [safetyStockLoaded, setSafetyStockLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getSystemSettings();
    setAutoPrintTrigger(s.autoPrintTrigger);
    setHitlAlertCount(s.hitlAlertThreshold);
    setNotifMuted(localStorage.getItem('nexus-notif-muted') === 'true');

    apiClient
      .get('/api/v1/admin/settings')
      .then((res) => {
        setSafetyStock(res.data.safety_stock_threshold);
        setSafetyStockLoaded(true);
      })
      .catch(() => {
        // 조회 실패 시 기본값(3) 표시만 하고 loaded는 세우지 않는다 - 저장을 눌러도
        // 확인 안 된 값으로 서버 상태를 덮어쓰지 않기 위함 (handleSave에서 재확인).
      });

    const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('nexus-theme') === 'dark';
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }

    const handleThemeEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ isDark: boolean }>;
      if (customEvt.detail && typeof customEvt.detail.isDark === 'boolean') {
        setIsDarkMode(customEvt.detail.isDark);
      }
    };
    window.addEventListener('nexus-theme-change', handleThemeEvent);
    return () => window.removeEventListener('nexus-theme-change', handleThemeEvent);
  }, []);

  const toggleTheme = (dark: boolean) => {
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('nexus-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('nexus-theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('nexus-theme-change', { detail: { isDark: dark } }));
  };

  const toggleNotifMute = () => {
    const next = !notifMuted;
    setNotifMuted(next);
    localStorage.setItem('nexus-notif-muted', String(next));
    // Header가 즉시 반영하도록 브로드캐스트 (Header에 동일 이벤트 리스너 존재)
    window.dispatchEvent(new CustomEvent('nexus-notif-mute-change', { detail: { isMuted: next } }));
  };

  const handleSave = async () => {
    saveSystemSettings({
      autoPrintTrigger,
      hitlAlertThreshold: Math.max(1, Math.floor(hitlAlertCount) || 10),
    });

    if (safetyStockLoaded) {
      setIsSaving(true);
      try {
        const res = await apiClient.put('/api/v1/admin/settings', {
          safety_stock_threshold: Math.max(0, Math.floor(safetyStock) || 0),
        });
        setSafetyStock(res.data.safety_stock_threshold);
      } catch {
        alert('안전재고 설정 저장에 실패했습니다. 관리자 권한을 확인해주세요.');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 font-sans transition-colors duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">시스템 설정 관제 콘솔</h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            화면 테마 · LPN 열전사 인쇄 · HITL 경보 임계값 제어 및 AI 검수 정책 상수 조회
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> 설정 저장 완료!
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2 rounded-xl shadow-md flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {isSaving ? '저장 중...' : '설정값 즉시 적용'}
          </Button>
        </div>
      </div>

      {/* Grid Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. Theme & Display Settings (실연동) */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">화면 테마 설정 (Mode)</CardTitle>
                  <CardDescription className="text-xs">라이트 모드 및 야간 다크 모드 통합 전환</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                THEME MODE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                  !isDarkMode
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Sun className="w-8 h-8 text-amber-500" />
                <span className="text-sm font-bold">☀️ 라이트 모드 (Light)</span>
              </button>

              <button
                type="button"
                onClick={() => toggleTheme(true)}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                  isDarkMode
                    ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300 font-bold shadow-xs'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Moon className="w-8 h-8 text-indigo-400" />
                <span className="text-sm font-bold">🌙 다크 모드 (Dark)</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 2. AI 검수 정책 (읽기 전용 - 파이프라인 정책 상수 조회) */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">AI 검수 정책 (읽기 전용)</CardTitle>
                  <CardDescription className="text-xs">UBCI 등급 경계 및 HITL 자동 이관 규칙</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <Lock className="w-3 h-3" /> POLICY
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              {/* 등급·점수 열은 폭을 고정한다. justify-between으로 두면 설명 길이에 따라
                  점수 열 위치가 행마다 달라져 세로로 어긋나 보인다. */}
              {UBCI_GRADE_POLICY.map((p) => (
                <div
                  key={p.grade}
                  className="grid grid-cols-[7rem_5.5rem_1fr] items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700 text-xs"
                >
                  <span className={`font-black ${p.color}`}>{p.grade}</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-300 tabular-nums">{p.range}</span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">{p.quality}</p>
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${p.badge}`}>
                      {p.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> HITL 관리자 결재 자동 이관 규칙 (Supervisor/Critic)
              </p>
              <ul className="space-y-1">
                {HITL_ROUTING_POLICY.map((rule, i) => (
                  <li key={rule.code} className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                    <span className="text-amber-500 font-black shrink-0">{i + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-bold text-gray-700 dark:text-gray-200">{rule.title}</span>
                      <span className="ml-1.5 font-mono text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {rule.code}
                      </span>
                      <span className="block mt-0.5 leading-snug">{rule.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-2.5">
              <Lock className="w-3 h-3 inline mr-0.5 -mt-0.5" />
              위 임계값은 UBCI 등급 체계와 결합된 <strong>파이프라인 정책 상수(코드 프리즈 구역)</strong>로
              관리되며 런타임 변경을 지원하지 않습니다. 변경이 필요하면 정책 개정 절차(명세서 갱신 → 코드 반영)를 따릅니다.
            </p>
          </CardContent>
        </Card>

        {/* 3. Thermal Printer Settings (자동 인쇄 트리거 실연동) */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">열전사 프린터 & 라벨 규격</CardTitle>
                  <CardDescription className="text-xs">LPN 50×31mm 스티커 라벨 인쇄 파라미터</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                HARDWARE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">스티커 용지 규격</span>
              <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                50mm × 31mm (203 DPI) — 고정 규격
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">LPN 발급 시 LAN 라벨 프린터 자동 인쇄 시도</p>
                <p className="text-[11px] text-gray-400">
                  끄면 /inbound 입고 검수에서 프린터 전송을 시도하지 않고 바로 촬영 단계로 진행합니다
                  (프린터 미설치 현장·데모 환경용).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPrintTrigger(!autoPrintTrigger)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ml-3 ${
                  autoPrintTrigger ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  autoPrintTrigger ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 4. Alert & Notifications (실연동) */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">WMS 관제 알림 & 경보</CardTitle>
                  <CardDescription className="text-xs">HITL 대기열 경보 임계값 및 실시간 팝업 제어</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                NOTIFICATION
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">HITL 승인 대기열 누적 경보 임계값</p>
                <p className="text-[11px] text-gray-400">
                  대기 건수가 {hitlAlertCount}건 이상이면 승인 대기(HITL) 화면 상단에 경보 배너를 강조합니다.
                </p>
              </div>
              <input
                type="number"
                min={1}
                value={hitlAlertCount}
                onChange={(e) => setHitlAlertCount(Number(e.target.value))}
                className="w-16 p-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-xs font-mono font-bold text-center"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">실시간 팝업 알림 (WMS / FDS 이벤트 스트림)</p>
                <p className="text-[11px] text-gray-400">
                  상단 종 아이콘의 음소거와 동일한 설정입니다. 끄면 실시간 토스트가 표시되지 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleNotifMute}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ml-3 ${
                  !notifMuted ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                title={notifMuted ? '알림 켜기' : '알림 끄기'}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  !notifMuted ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 5. SCM 자동발주 - 안전재고 (서버 system_settings 실연동, 2026-08-09 신설) */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">SCM 자동발주 - 안전재고</CardTitle>
                  <CardDescription className="text-xs">저재고 스캔 대상 선정 기준 겸 발주 제안 수량의 안전선</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                SCM
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">안전재고 기준 (권)</p>
                <p className="text-[11px] text-gray-400">
                  가용 재고(신품+중고)가 이 값 미만이면 /admin/po 저재고 스캔의 발주 후보가 되고,
                  같은 값이 발주 제안 수량 산식의 최소 안전선으로도 쓰입니다.
                </p>
              </div>
              <input
                type="number"
                min={0}
                value={safetyStock}
                onChange={(e) => setSafetyStock(Number(e.target.value))}
                disabled={!safetyStockLoaded}
                className="w-16 p-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-xs font-mono font-bold text-center disabled:opacity-50"
              />
            </div>
            {!safetyStockLoaded && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                서버 설정을 불러오는 중이거나 조회에 실패했습니다 - 값이 확인되기 전에는 저장되지 않습니다.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
