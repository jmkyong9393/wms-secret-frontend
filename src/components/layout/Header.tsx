'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { API_BASE_URL } from '@/lib/api-client';
import { Bell, BellOff, User, CloudUpload, CloudOff, Sun, Moon, VolumeX } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function Header() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  const user = useAtomValue(currentUserAtom);
  const logout = useLogout();
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
  const pendingCount = uploadQueue.filter(t => t.status !== 'COMPLETED').length;
  // Real-time AI Agent & FDS Notifications State Stream matching Teamwork Track
  const [notifications, setNotifications] = useState([
    {
      id: "N-101",
      badge: "에이전트 이상감지",
      badgeBg: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300",
      title: "품질 검증 오류",
      desc: "Critic 에이전트가 검수 파이프라인에서 처리 불가능한 오류를 반환했습니다.",
      time: "5초 전",
      read: false
    },
    {
      id: "N-102",
      badge: "자동발주 알림",
      badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
      title: "대체 발주 추천 생성",
      desc: "'클린 코드' 반려 건에 대한 대체 발주 추천안이 생성되었습니다. (추천 수량: 6권)",
      time: "27초 전",
      read: false
    },
    {
      id: "N-103",
      badge: "정책상 관리자 검토",
      badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300",
      title: "정책상 관리자 검토 필요",
      desc: "Policy 에이전트가 자동 처리 대신 관리자 검토를 요청했습니다.",
      time: "1분 전",
      read: false
    },
    {
      id: "N-104",
      badge: "FDS 이상거래",
      badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
      title: "FDS 이상거래 적발 (위험점수 61점)",
      desc: "비정상적인 야간 대량 주문 패턴이 감지되었습니다.",
      time: "3분 전",
      read: false
    }
  ]);

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  // Active Toast Notification Popup State (Shows up at top-right, disappears after 5 seconds)
  const [activeToast, setActiveToast] = useState<any | null>(null);

  // 실시간 WMS 전역 알림 SSE 구독 (app/domains/notifications/router.py의
  // notifications:global Redis Pub/Sub 채널을 EventSource로 중계받는다)
  useEffect(() => {
    if (isMuted || !user) return;

    const es = new EventSource(`${API_BASE_URL}/api/v1/notifications/stream`);

    es.onmessage = (event) => {
      try {
        const evt = JSON.parse(event.data);
        if (!evt || evt.type === 'CONNECTED') return;

        const newEvt = {
          id: `N-${Date.now()}`,
          badge: evt.category || '실시간 알림',
          badgeBg: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300',
          toastBg: 'bg-amber-500 text-white',
          title: evt.title || '실시간 알림',
          desc: evt.description || '',
          tag1: evt.category || 'ALERT',
          tag2: evt.time_ago || '방금 전',
          time: '방금 전',
          read: false
        };

        setNotifications(prev => [newEvt, ...prev.slice(0, 9)]);
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

  // Auto-hide Toast Banner after 5 seconds
  useEffect(() => {
    if (activeToast) {
      const t = setTimeout(() => {
        setActiveToast(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [activeToast]);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
      case '/worker/inspections':
        return '나의 검수 내역 (Worker)';
      case '/admin/hitl':
        return '승인 대기 (HITL)';
      case '/admin/inspections':
        return '검수 처리 내역 (전체)';
      case '/admin/inventory':
        return '재고 현황 관리 (Master)';
      case '/worker/inventory':
      case '/inventory':
        return '현장 재고 조회 (Worker)';
      case '/admin/outbound':
        return '출고 최적화 및 송장 발급';
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

  // ISMS-P 2.6.3 개인정보 표시제한 (가운데 글자 마스킹: 장*경, 홍*동)
  const maskName = (name: string) => {
    if (!name) return '사용자';
    if (name.length <= 2) return name.charAt(0) + '*';
    if (name.length === 3) {
      return name.charAt(0) + '*' + name.charAt(2); // 가운데 글자 마스킹 (장*경)
    }
    return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
  };

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

      {/* Right Side: Status & Profile */}
      <div className="flex items-center space-x-4">
        
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
          {notifOpen && (
            <div className="absolute right-0 top-12 mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 z-50 border border-gray-100 dark:border-gray-800 font-sans animate-in fade-in zoom-in-95 duration-150 max-h-[420px] overflow-y-auto">
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
                </div>
              </div>

              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => {
                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
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
        <div className="fixed top-16 right-6 z-50 w-84 bg-amber-500 text-white p-4 rounded-2xl shadow-2xl space-y-2 animate-in slide-in-from-top-5 fade-in duration-300 border border-amber-400/50">
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
