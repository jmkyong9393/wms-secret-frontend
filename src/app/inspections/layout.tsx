import { cookies } from 'next/headers';
import MainLayout from '@/widgets/layout/MainLayout';
import WorkerMobileShell from '@/widgets/layout/WorkerMobileShell';

/**
 * 검수 처리 내역 — 역할 적응형 레이아웃.
 * C안 URL 물리 통합 시 구 /admin·/worker 상위 layout.tsx가 사라지며
 * 사이드바/헤더가 유실된 누락 보완. ADMIN/MASTER는 MainLayout(사이드바+헤더),
 * WORKER는 모바일 풀스크린 셸(뒤로가기 상단바)로 분기한다. role 쿠키는 서버에서 읽어
 * 첫 페인트부터 올바른 셸을 렌더한다 (클라이언트 분기 시의 레이아웃 플래시 방지).
 */
export default async function InspectionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="나의 검수 내역" fallbackHref="/inbound">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
