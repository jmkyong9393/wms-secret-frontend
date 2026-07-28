'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  Cpu, 
  Printer, 
  Sun, 
  Moon, 
  BellRing, 
  ShieldAlert, 
  Save, 
  CheckCircle2, 
  Sliders, 
  Volume2, 
  Sparkles,
  Zap
} from 'lucide-react';

export default function SystemSettingsPage() {
  // 1. AI Threshold State
  const [ubciThreshold, setUbciThreshold] = useState<number>(95);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.70);
  const [showBboxDebug, setShowBboxDebug] = useState<boolean>(true);

  // 2. Thermal Printer State
  const [labelWidth, setLabelWidth] = useState<number>(50);
  const [labelHeight, setLabelHeight] = useState<number>(30);
  const [autoPrintTrigger, setAutoPrintTrigger] = useState<boolean>(true);

  // 3. Theme State (Light / Dark)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // 4. Alert & Sound State
  const [hitlAlertCount, setHitlAlertCount] = useState<number>(10);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Sync initial theme from document & listen to real-time events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('nexus-theme') === 'dark';
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }

      const handleThemeEvent = (e: Event) => {
        const customEvt = e as CustomEvent<{ isDark: boolean }>;
        if (customEvt.detail && typeof customEvt.detail.isDark === 'boolean') {
          setIsDarkMode(customEvt.detail.isDark);
        }
      };

      window.addEventListener('nexus-theme-change', handleThemeEvent);
      return () => window.removeEventListener('nexus-theme-change', handleThemeEvent);
    }
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

  const handleSave = () => {
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
            Nexus 멀티 에이전트 AI 비전 검수 임계값, 50×30mm 열전사 프린터 및 화면 라이트/다크 모드 통합 제어
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2 rounded-xl shadow-md flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> 설정값 즉시 적용
          </Button>
        </div>
      </div>

      {/* Grid Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 1. Theme & Display Settings */}
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

        {/* 2. AI Vision & Fast Track Settings */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">AI 검수 & Fast Track 임계값</CardTitle>
                  <CardDescription className="text-xs">UBCI 점수 및 5-Agent BBox 신뢰도 설정</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                AI CORE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* UBCI Score slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" /> MINT Fast Track 직행 UBCI 점수
                </label>
                <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {ubciThreshold}점 이상
                </span>
              </div>
              <input 
                type="range" 
                min="80" 
                max="99" 
                value={ubciThreshold} 
                onChange={(e) => setUbciThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-[11px] text-gray-400">이 점수 이상 판정 건은 HITL을 건너뛰고 A-01-01 셀로 즉시 자동 입고됩니다.</p>
            </div>

            {/* Bbox Confidence */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  HITL 수동 이관 BBox 신뢰도 하한선
                </label>
                <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {(confidenceThreshold * 100).toFixed(0)}% 미만 시 이관
                </span>
              </div>
              <input 
                type="range" 
                min="0.50" 
                max="0.90" 
                step="0.05"
                value={confidenceThreshold} 
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Thermal Printer Settings */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">열전사 프린터 & 라벨 규격</CardTitle>
                  <CardDescription className="text-xs">LPN 50×30mm 스티커 라벨 인쇄 파라미터</CardDescription>
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
                {labelWidth}mm × {labelHeight}mm (203 DPI)
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">LPN 발급 즉시 열전사 자동 인쇄 트리거</p>
                <p className="text-[11px] text-gray-400">LPN 생성 즉시 인쇄 대화상자(window.print)를 자동 호출합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPrintTrigger(!autoPrintTrigger)}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
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

        {/* 4. Alert & Sound Notifications */}
        <Card className="border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 rounded-2xl">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-gray-900 dark:text-white">WMS 관제 알림 & 경보</CardTitle>
                  <CardDescription className="text-xs">HITL 대기열 경보 및 효과음 설정</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                NOTIFICATION
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">HITL 승인 대기열 누적 팝업 경보</p>
                <p className="text-[11px] text-gray-400">{hitlAlertCount}건 이상 미처리 시 상단 알림 뱃지 강조</p>
              </div>
              <input
                type="number"
                value={hitlAlertCount}
                onChange={(e) => setHitlAlertCount(Number(e.target.value))}
                className="w-16 p-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-xs font-mono font-bold text-center"
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
