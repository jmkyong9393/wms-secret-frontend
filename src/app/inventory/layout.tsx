import { cookies } from 'next/headers';
import MainLayout from '@/components/layout/MainLayout';
import WorkerMobileShell from '@/components/layout/WorkerMobileShell';

/**
 * 재고 현황 — 역할 적응형 레이아웃.
 * [수정 이력 2026-08-05] C안 URL 물리 통합 시 구 /admin·/worker 상위 layout.tsx가 사라지며
 * 사이드바/헤더가 유실된 누락 보완. ADMIN/MASTER는 MainLayout(사이드바+헤더),
 * WORKER는 모바일 풀스크린 셸(뒤로가기 상단바)로 분기한다.
 */
export default async function InventoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="현장 재고 조회" fallbackHref="/inspections?scope=mine">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
