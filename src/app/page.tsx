"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootIndexPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const storedUserStr = localStorage.getItem('wms_user') || sessionStorage.getItem('wms_user');
      const userRole = localStorage.getItem('wms_user_role') || sessionStorage.getItem('wms_user_role');

      if (!storedUserStr && !userRole) {
        // 미로그인 상태: Toast 알림 없이 즉시 /login 으로 이동
        router.replace('/login');
        return;
      }

      let parsedRole = userRole || '';
      if (!parsedRole && storedUserStr) {
        try {
          const userObj = JSON.parse(storedUserStr);
          parsedRole = userObj.role || userObj.user_role || '';
        } catch (e) {
          console.error("Failed to parse user session", e);
        }
      }

      const upperRole = String(parsedRole).toUpperCase();

      if (upperRole === 'WORKER') {
        // Worker 역할: 나의 검수내역 (/worker/inspections) 전용 메인으로 진입
        router.replace('/worker/inspections');
      } else if (upperRole === 'ADMIN' || upperRole === 'MASTER') {
        // Admin / Master 역할: 종합 대시보드 (/admin/dashboard) 로 진입
        router.replace('/admin/dashboard');
      } else {
        // 미인증/기타: /login 진입
        router.replace('/login');
      }
    } catch (err) {
      console.error("Root redirection error:", err);
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-indigo-300 font-bold">Nexus WMS 권한 확인 및 자동 이동 중...</p>
      </div>
    </div>
  );
}
