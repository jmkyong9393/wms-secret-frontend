'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { CURRENT_USER_STORAGE_KEY, currentUserAtom } from '@/features/auth/store/authAtoms';
import { login } from '@/features/auth/api/authService';
import LoginFailureAlert from '@/features/auth/components/LoginFailureAlert';
import { resolveLoginFailure, type LoginFailure } from '@/features/auth/utils/loginFailure';
import {
  UserCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

// POST /api/v1/auth/login (app/domains/auth/router.py)을 호출한다. JWT는 응답 본문이
// 아니라 백엔드가 내려주는 HttpOnly 쿠키로만 전달되므로, 여기서는 그 쿠키를 다루지 않고
// 응답으로 받은 사용자 프로필만 정본 스토어(authAtoms.ts)에 기록한다.
export default function LoginPage() {
  const [employee_id, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // 인라인 배너와 별개로, 실패 사유를 코드/조치와 함께 알림창으로 띄운다.
  const [failure, setFailure] = useState<LoginFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setCurrentUser = useSetAtom(currentUserAtom);

  // 로그인 페이지 진입 시 기존 세션 표시 정보 초기화 (레거시 stores/auth.ts 잔재 포함)
  useEffect(() => {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    localStorage.removeItem('auth-user');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee_id || !password) {
      setError('사번과 비밀번호를 입력해 주세요.');
      setFailure({
        code: 'CLIENT_EMPTY_INPUT',
        title: '입력값이 비어 있습니다',
        message: '사번과 비밀번호를 모두 입력해야 인증을 요청할 수 있습니다.',
        severity: 'warning',
      });
      return;
    }

    setError('');
    setFailure(null);
    setLoading(true);

    try {
      const loginRes = await login({ employee_id, password });

      setCurrentUser({
        employeeId: loginRes.employee_id,
        name: loginRes.name,
        role: loginRes.role,
        mustChangePassword: loginRes.must_change_password,
      });

      // 초기 비밀번호 미변경 계정은 강제로 온보딩(비밀번호 변경) 화면으로 보낸다.
      if (loginRes.must_change_password) {
        router.push('/onboarding');
      } else if (loginRes.role === 'WORKER') {
        router.push('/inspections?scope=mine');
      } else {
        router.push('/admin/dashboard');
      }

    } catch (err: any) {
      // [수정 이력] 종전에는 모든 실패를 문구 하나로 뭉개, 시도 제한(429)조차
      // "비밀번호가 올바르지 않습니다"로 표시됐다. 이제 백엔드 error_code를 근거로
      // 사유를 특정해 알림창과 인라인 배너에 함께 노출한다.
      const resolved = resolveLoginFailure(err);
      console.error(`[Login Failed] ${resolved.code}`, {
        status: resolved.status,
        body: err?.response?.data,
      });
      setFailure(resolved);
      setError(resolved.message);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans text-gray-900 transition-colors duration-200">

      {/* 실패 사유 알림창 (사유 코드 + 조치 안내 포함) */}
      <LoginFailureAlert failure={failure} onClose={() => setFailure(null)} />

      {/* Soft Light Ambient Glow Orbs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-200/40 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Main Container Layout */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16 z-10">
        
        {/* LEFT SIDE: Bright Clean Giant Hero Emblem & Brief Intro */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 max-w-xl">
          
          {/* Giant Light Mode Emblem Showcase */}
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition duration-500"></div>
            <img 
              src="/nexus_hero_light_emblem.jpg" 
              alt="Bright Giant Nexus Hero Emblem" 
              className="relative w-64 sm:w-80 md:w-96 lg:w-[420px] h-auto rounded-3xl border-2 border-blue-200 shadow-xl object-cover hover:scale-105 transition-transform duration-300 bg-white"
            />
          </div>

          {/* Clean Title & Brief Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
              <span className="px-3.5 py-1 bg-blue-100/80 text-blue-800 border border-blue-200 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> B2B ENTERPRISE WMS v2.12.4.0
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight font-mono">
              Nexus <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">WMS</span>
            </h1>
            <p className="text-base sm:text-lg font-extrabold text-blue-950 tracking-tight">
              멀티 에이전트 AI 기반 B2B 스마트 물류 관제 파이프라인
            </p>
            <p className="text-xs sm:text-sm text-gray-600 max-w-md pt-1 leading-relaxed">
              비전 딥러닝 앙상블, UBCI 검증 등급 평가, LangGraph Multi-Agent 오케스트레이션 및 3D Bin Packing 알고리즘이 통합된 차세대 풀필먼트 관제실입니다.
            </p>
          </div>

          {/* Author Metadata Tag */}
          <div className="pt-2 text-xs text-gray-500 font-mono">
            대표자: <strong className="text-gray-900 font-bold">장문경 (Lead Architect & Project Owner)</strong> | 팀: AI_05조
          </div>
        </div>

        {/* RIGHT SIDE: Shifted Bright Clean Login Card */}
        <div className="w-full lg:w-[440px] bg-white/95 border border-gray-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 text-gray-900">
          
          {/* Form Header */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold font-mono mb-2 border border-blue-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" /> SECURE AUTHENTICATION
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              관제실 로그인
            </h2>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              사번과 비밀번호(초기 암호: <strong className="text-indigo-600 font-bold">1234</strong>)를 입력하여 접속하십시오.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-start gap-2 animate-in fade-in">
              <span className="w-2 h-2 mt-1 shrink-0 rounded-full bg-rose-500 animate-ping"></span>
              <span className="min-w-0">
                {error}
                {failure && (
                  <span className="block mt-0.5 font-mono text-[10px] text-rose-500/80">
                    {failure.code}
                    {failure.status ? ` · HTTP ${failure.status}` : ''}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>사번 (Employee ID)</span>
                <span className="text-[10px] text-gray-400 font-mono">예: WM2608001</span>
              </label>
              <input 
                type="text" 
                value={employee_id}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-gray-900 transition-all" 
                placeholder="사번 입력 (예: WM2608001)"
                required 
              />
            </div>



            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>비밀번호 (Password)</span>
                <a href="#" onClick={(e) => { e.preventDefault(); alert("관리자(jmkyong2002@naver.com)에게 비밀번호 재설정을 문의하세요."); }} className="text-[10px] text-blue-600 hover:underline">재설정 요청</a>
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 text-gray-900 transition-all" 
                placeholder="비밀번호 입력"
                required 
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <span>로그인 처리 중...</span>
              ) : (
                <>
                  <span>NEXUS 관제실 접속</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Legal Compliance Footer */}
          <div className="pt-4 border-t border-gray-200 text-center space-y-2 text-[11px] text-gray-500 font-mono">
            <div className="flex items-center justify-center gap-3 font-bold">
              <a href="/privacy" className="text-gray-900 font-black hover:text-blue-600 underline underline-offset-4">개인정보 처리방침</a>
              <span className="text-gray-300">|</span>
              <a href="/terms" className="text-gray-600 hover:text-blue-600">이용약관</a>
              <span className="text-gray-300">|</span>
              <a href="/opensource" className="text-gray-600 hover:text-blue-600">오픈소스라이선스</a>
            </div>

            <div className="text-[10px] text-gray-400">
              Contact: <a href="mailto:jmkyong2002@naver.com" className="hover:underline text-blue-600 font-bold">jmkyong2002@naver.com</a>
              <p className="mt-0.5">© 2026 Nexus AI_05조. All rights reserved.</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
