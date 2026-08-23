'use client';
import { API_BASE_URL } from '@/shared/api/api-client';
import { maskName } from '@/shared/lib/privacy-mask';

import Link from 'next/link';
import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { inFlightUploadCountAtom } from '@/entities/upload-task/model/uploadQueueAtoms';
import { useHydratedUser } from '@/entities/user/model/useHydratedUser';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { Bell, BellOff, User, CloudUpload, CloudOff, Sun, Moon, VolumeX } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 헤더 알림 드롭다운이 렌더하는 항목. 백엔드 notifications 응답을 화면용으로 변환한 형태. */
interface NotificationItem {
  id: string;
  badge: string;
  badgeBg: string;
  title: string;
  desc: string;
  time: string;
  link?: string | null;
  read: boolean;
}

/**
 * 심각도별 뱃지 색. 문구(category)와 심각도(severity)는 백엔드가 확정해 내려주므로
 * 프론트는 색만 매핑한다 (같은 사건이 화면마다 다르게 표시되는 것을 막기 위함).
 */
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300',
  WARN: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
};

/** ISO 시각을 "27초 전" 같은 상대 표기로 변환. */
function formatTimeAgo(iso?: string | null): string {
  if (!iso) return '방금 전';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
}

function toNotificationItem(evt: any): NotificationItem {
  return {
    id: String(evt.id ?? `N-${Date.now()}`),
    badge: evt.category || '시스템 알림',
    badgeBg: SEVERITY_BADGE[evt.severity] || SEVERITY_BADGE.INFO,
    title: evt.title || '알림',
    desc: evt.description || '',
    time: formatTimeAgo(evt.created_at),
    link: evt.link_url,
    read: Boolean(evt.is_read),
  };
}

export default function Header() {
  // 전송·분석이 진행 중인 AI 검수 건수 (실패·완료 건 제외)
  const pendingCount = useAtomValue(inFlightUploadCountAtom);
  // 사용자명·역할을 그대로 렌더하므로 하이드레이션 안전 훅을 쓴다 (Sidebar와 동일한 이유).
  const { user } = useHydratedUser();
  const logout = useLogout();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(false); // Notification Mute State
  const isOnline = true; // PWA Network Connectivity Status

  // Sync isMuted state with localStorage so Mute mode stays active across page transitions & sidebar navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('nexus-notif-muted') === 'true';
      setIsMuted(savedMute);

      // 시스템 설정(/admin/settings) 페이지의 음소거 토글과 실시간 동기화
      const handleMuteEvent = (e: Event) => {
        const evt = e as CustomEvent<{ isMuted: boolean }>;
        if (evt.detail && typeof evt.detail.isMuted === 'boolean') {
          setIsMuted(evt.detail.isMuted);
        }
      };
      window.addEventListener('nexus-notif-mute-change', handleMuteEvent);
      return () => window.removeEventListener('nexus-notif-mute-change', handleMuteEvent);
    }
  }, []);

  const toggleMute = (mutedState?: boolean) => {
    const nextMute = mutedState !== undefined ? mutedState : !isMuted;
    setIsMuted(nextMute);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus-notif-muted', String(nextMute));
    }
    if (nextMute) setActiveToast(null);
  };
  // 실시간 AI Agent / FDS 알림.
  //
  // [수정 이력] 종전에는 여기에 더미 알림 4건("품질 검증 오류", "대체 발주 추천 생성",
  // "정책상 관리자 검토 필요", "FDS 이상거래 적발")이 useState 초기값으로 하드코딩되어
  // 있었다. 백엔드에 알림 테이블도 조회 API도 없었고, notifications:global 채널에
  // 발행하는 곳이 데모용 /trigger-fds 하나뿐이라 실제 파이프라인 사건은 알림이 되지
  // 않았기 때문이다. 이제 GET /api/v1/notifications로 이력을 불러오고 SSE로 실시간
  // 추가되며, 읽음 상태는 DB에 저장되어 새로고침해도 유지된다.
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Active Toast Notification Popup State (Shows up at top-right, disappears after 5 seconds)
  const [activeToast, setActiveToast] = useState<any | null>(null);

  // 저장된 알림 이력 초기 로드 (새로고침해도 남아야 하므로 DB에서 읽는다)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/notifications?limit=20&role=${encodeURIComponent(user.role || '')}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setNotifications((json.items || []).map(toNotificationItem));
        setUnreadCount(json.unread_count || 0);
      } catch {
        // 알림은 부가 기능이므로 조회 실패가 헤더 렌더를 막지 않는다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 실시간 WMS 전역 알림 SSE 구독 (app/domains/notifications/router.py의
  // notifications:global Redis Pub/Sub 채널을 EventSource로 중계받는다)
  useEffect(() => {
    if (isMuted || !user) return;

    const es = new EventSource(`${API_BASE_URL}/api/v1/notifications/stream`);

    es.onmessage = (event) => {
      try {
        const evt = JSON.parse(event.data);
        if (!evt || evt.type === 'CONNECTED') return;

        // 이 사용자에게 공개되지 않은 역할 전용 알림은 무시한다.
        if (evt.target_role && user.role && evt.target_role !== user.role) return;

        const newEvt = toNotificationItem(evt);
        setNotifications(prev => [newEvt, ...prev.filter(n => n.id !== newEvt.id).slice(0, 19)]);
        setUnreadCount(prev => prev + 1);
        setActiveToast(newEvt);
      } catch (e) {
        console.error('알림 SSE 이벤트 파싱 실패:', e);
      }
    };

    es.onerror = () => {
      // EventSource는 연결이 끊기면 자동 재연결을 시도하므로 여기서는 로깅만 한다.
      console.warn('알림 SSE 연결 오류 - 자동 재연결 대기 중');
    };

    return () => es.close();
  }, [isMuted, user]);

  // 알림 1건 읽음 처리 (DB에 반영해 새로고침 후에도 유지)
  const markRead = React.useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // 낙관적 갱신 유지 - 다음 로드 때 서버 상태로 다시 맞춰진다.
    }
  }, []);

  // Auto-hide Toast Banner after 5 seconds
  useEffect(() => {
    if (activeToast) {
      const t = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [activeToast]);

  const handleMarkAllAsRead = async () => {
    // 낙관적 갱신 후 서버에 반영한다. 종전에는 프론트 state만 바꿔 새로고침하면 되살아났다.
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch(
        `${API_BASE_URL}/api/v1/notifications/read-all?role=${encodeURIComponent(user?.role || '')}`,
        { method: 'POST' }
      );
    } catch {
      // 실패해도 화면은 읽음으로 유지 - 다음 로드 시 서버 상태로 재동기화된다.
    }
  };

  // [2026-08-06 신설] 알림 이력 일괄 삭제. "모두 읽음"은 배지만 끄고 목록은 계속 쌓이므로
  // 누적된 이력을 정리할 수단이 없었다. 삭제는 되돌릴 수 없어 confirm 한 번을 거친다.
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm(`알림 ${notifications.length}건을 모두 삭제할까요? (되돌릴 수 없습니다)`)) return;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await fetch(
        `${API_BASE_URL}/api/v1/notifications?role=${encodeURIComponent(user?.role || '')}`,
        { method: 'DELETE' }
      );
    } catch {
      // 실패해도 화면은 비운 상태 유지 - 다음 로드 시 서버 상태로 재동기화된다.
    }
  };

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

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('nexus-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('nexus-theme', 'light');
    }
    window.dispatchEvent(new CustomEvent('nexus-theme-change', { detail: { isDark: nextDark } }));
  };

  const pathname = usePathname();
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/admin/dashboard':
      case '/admin':
        return '종합 대시보드';
      case '/inbound':
        return '도서 입고 검수 (카메라)';
      case '/inspections': // C안 통합 URL (역할 중립 타이틀, 구 URL 4종은 라우트 삭제됨)
        return '검수 처리 내역';
      case '/admin/hitl':
        return '승인 대기 (HITL)';
      case '/admin/fds':
        return 'FDS 이상거래 관제';
      case '/inventory': // C안 통합 URL (역할 중립 타이틀)
        return '재고 현황 관리';
      case '/admin/orders':
        return '주문 & AI 피킹 지시서';
      case '/admin/outbound':
        return '출고 최적화 및 송장 발급';
      // WORKER 모바일 셸에서도 이 Header를 쓰므로 피킹 스캐너 경로를 명시한다
      // (없으면 default로 떨어져 "종합 대시보드"라는 엉뚱한 제목이 떴다).
      case '/worker/outbound':
        return '출고 피킹 스캐너';
      case '/admin/po':
      case '/po':
        return '발주 관리 (AI)';
      case '/admin/employees':
        return '사원 관리';
      case '/admin/settings':
        return '시스템 설정';
      default:
        if (path.startsWith('/admin/')) return '관제 콘솔';
        return '종합 대시보드';
    }
  };
  const pageTitle = getPageTitle(pathname);

  // ISMS-P 2.6.3 개인정보 표시제한 규칙은 @/shared/lib/privacy-mask 한 곳에서만 정의한다.
  // (종전에는 이 컴포넌트에 인라인 구현이 박혀 있어, 다른 화면은 마스킹 없이 원본을 노출했다.)

  return (
    <header className="h-[clamp(3.75rem,6.5vh,5.5rem)] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Left / Center Brand Emblem & Page Title Container */}
      <div className="flex items-center gap-3 min-w-0">
        
        {/* Original Signature Logo Emblem (Light / Dark Mode Adaptive) */}
        <div className="flex items-center gap-[clamp(0.4rem,0.8vw,0.85rem)]">
          <Link href="/admin/dashboard" className="flex items-center gap-2 group shrink-0">
            {/* Light Mode Original Signature Emblem */}
            <img 
              src="/nexus_header_logo_light.jpg" 
              alt="Nexus WMS Logo Light" 
              className="h-[clamp(2.25rem,4.2vh,3.5rem)] max-w-[18vw] w-auto rounded-xl border-2 border-blue-200/80 shadow-sm object-cover hover:scale-105 transition-all duration-200 dark:hidden"
            />
            {/* Dark Mode Original Signature Emblem */}
            <img 
              src="/nexus_header_logo_dark.jpg" 
              alt="Nexus WMS Logo Dark" 
              className="h-[clamp(2.25rem,4.2vh,3.5rem)] max-w-[18vw] w-auto rounded-xl border-2 border-blue-500/50 shadow-sm object-cover hover:scale-105 transition-all duration-200 hidden dark:block"
            />
          </Link>
          <div className="h-[clamp(1.25rem,2.5vh,2.2rem)] w-px bg-gray-300 dark:bg-gray-700 hidden sm:block mx-1"></div>
        </div>

        {/* Page Title */}
        <h1 className="text-base sm:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none truncate ml-1 sm:ml-0">
          {pageTitle}
        </h1>
      </div>

      {/* Right Side: Status & Profile — 모바일에서는 간격을 좁혀 타이틀 공간을 확보한다 */}
      <div className="flex items-center space-x-1.5 sm:space-x-4 shrink-0">
        
        {/* Network & Queue Status */}
        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          {isOnline ? (
            <CloudUpload className="w-4 h-4 text-green-500 mr-2" />
          ) : (
            <CloudOff className="w-4 h-4 text-red-500 mr-2" />
          )}
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-3"></div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            대기열: <span className={pendingCount > 0 ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>{pendingCount}건</span>
          </span>
        </div>

        {/* Global Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-90" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
        </button>

        {/* Notifications Dropdown (FDS & Real-time AI Agent Event Stream with Mute Control) */}
        <div className="relative">
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            title={isMuted ? "알림이 켜져있지 않음 (클릭하여 설정)" : "실시간 WMS / FDS 이상거래 알림"}
          >
            {isMuted ? (
              <BellOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            {!isMuted && unreadCount > 0 && (
              <>
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-black font-mono border-2 border-white dark:border-gray-900 shadow-xs animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-ping"></span>
              </>
            )}
            {isMuted && (
              <span className="absolute -top-1 -right-1 px-1 bg-gray-500 text-white rounded-full text-[9px] font-bold border border-white dark:border-gray-900">
                OFF
              </span>
            )}
          </button>

          {/* FDS Notification Popup Menu matching User Screenshot Specification */}
          {/*
            w-80(320px) 고정 + 종 아이콘 기준 absolute right-0 배치라
            모바일에서 패널이 뷰포트 왼쪽 밖으로 밀려 잘렸다. 모바일(<sm)에서는 화면 폭에
            맞춘 fixed 배치(inset-x-3), sm 이상에서는 기존 앵커 드롭다운을 유지한다.
          */}
          {notifOpen && (
            <div className="fixed inset-x-3 top-16 w-auto max-h-[70vh] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:mt-2 sm:w-80 sm:max-h-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 z-50 border border-gray-100 dark:border-gray-800 font-sans animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-gray-900 dark:text-white">알림</span>
                  {unreadCount > 0 && !isMuted && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-full text-[10px] font-bold font-mono">
                      미확인 {unreadCount}건
                    </span>
                  )}
                  {isMuted && (
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[10px] font-bold font-mono flex items-center gap-1">
                      <VolumeX className="w-3 h-3" />
                      알림 끄기 모드
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleMute()}
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      isMuted 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                    }`}
                    title={isMuted ? '알림 다시 켜기' : '실시간 팝업 알림 끄기'}
                  >
                    {isMuted ? '🔔 알림 켜기' : '🔕 알림 끄기'}
                  </button>
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    모두 읽음
                  </button>
                  <button
                    onClick={handleClearAll}
                    title="알림 이력 일괄 삭제 (되돌릴 수 없음)"
                    className="text-xs font-bold text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    모두 삭제
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {notifications.length === 0 && (
                  <div className="py-10 text-center">
                    <Bell className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">새로운 알림이 없습니다.</p>
                  </div>
                )}
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) markRead(notif.id);
                      // 알림마다 원인 화면 경로(link_url)를 백엔드가 지정해 내려준다.
                      if (notif.link) {
                        setNotifOpen(false);
                        router.push(notif.link);
                      }
                    }}
                    className={`p-3.5 rounded-xl border space-y-1.5 hover:shadow-xs transition-all cursor-pointer relative ${
                      notif.read 
                        ? 'bg-gray-50/60 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-75' 
                        : 'bg-blue-50/50 dark:bg-gray-800/80 border-blue-100/80 dark:border-gray-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${notif.badgeBg}`}>
                        {notif.badge}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 font-mono">
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                        {notif.time}
                      </span>
                    </div>
                    <h4 className={`font-extrabold text-xs tracking-tight ${notif.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                      {notif.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                      {notif.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile (Interactive Dropdown) */}
        <div className="flex items-center pl-2 border-l border-gray-200 dark:border-gray-800 relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-md transition-colors"
            title="사용자 메뉴 (ISMS-P 마스킹 적용)"
          >
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/80 rounded-full flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              {user?.name ? maskName(user.name).charAt(0) : <User className="w-4 h-4" />}
            </div>
            <span className="ml-2 text-sm font-bold text-gray-700 dark:text-gray-200 hidden md:flex items-center">
              {user ? maskName(user.name) : '로그인 필요'}
              <svg className="w-4 h-4 ml-1 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl py-2 z-50 border border-gray-200 dark:border-gray-700 font-sans text-gray-900 dark:text-white">
              {!user ? (
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  🔑 로그인 페이지로 이동
                </button>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/90">
                    <p className="text-sm font-black text-gray-900 dark:text-white flex items-center justify-between">
                      {maskName(user.name)}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold">ISMS-P</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{user.employeeId} ({user.role})</p>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      window.location.href = '/mypage';
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    마이페이지
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      window.location.href = '/login';
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Live AI Toast Banner (Matching User Screenshot 100% with 1-Click Mute Control) */}
      {!isMuted && activeToast && (
        // 모바일에서는 좌우 여백 기준으로 펼치고, sm 이상에서만 우측 고정 카드 폭(w-84)을 쓴다
        <div className="fixed top-16 inset-x-3 w-auto sm:inset-x-auto sm:right-6 sm:w-84 z-50 bg-amber-500 text-white p-4 rounded-2xl shadow-2xl space-y-2 animate-in slide-in-from-top-5 fade-in duration-300 border border-amber-400/50">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-extrabold text-sm tracking-tight leading-snug">
              {activeToast.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleMute(true)}
                className="px-2 py-0.5 bg-amber-600/80 hover:bg-amber-700 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 border border-amber-400/40"
                title="실시간 알림 끄기 모드 전환"
              >
                <VolumeX className="w-3 h-3" />
                알림 끄기
              </button>
              <button 
                onClick={() => setActiveToast(null)}
                className="text-amber-100 hover:text-white font-black text-xs p-1 rounded-full hover:bg-amber-600 transition-colors"
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-50 leading-relaxed font-medium">
            {activeToast.desc}
          </p>

          <div className="flex items-center gap-1.5 pt-1">
            <span className="px-2.5 py-0.5 bg-amber-400/90 text-amber-950 font-extrabold text-[10px] rounded-full shadow-xs">
              {activeToast.tag1}
            </span>
            <span className="px-2.5 py-0.5 bg-amber-100/90 text-amber-900 font-extrabold text-[10px] rounded-full shadow-xs">
              {activeToast.tag2}
            </span>
          </div>

          <button 
            onClick={() => {
              setNotifOpen(true);
              setActiveToast(null);
            }}
            className="w-full mt-2 py-1.5 bg-amber-400/40 hover:bg-amber-400/70 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center border border-amber-300/50 active:scale-95 shadow-xs"
          >
            바로 보기
          </button>
        </div>
      )}
    </header>
  );
}
