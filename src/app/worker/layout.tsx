import { cookies } from 'next/headers';
import MainLayout from '@/widgets/layout/MainLayout';
import WorkerMobileShell from '@/widgets/layout/WorkerMobileShell';

/**
 * Worker 전용 라우트(/worker/outbound 출고 피킹 스캐너) — 역할 적응형 레이아웃.
 *
 * 종전에는 MainLayout(데스크톱 사이드바+헤더) 고정이라, WORKER가
 * 피킹 화면에 들어오면 **하단 탭바가 사라져** 다른 메뉴로 이동하려면 사이드바 드로어를
 * 열어야 했다. /inbound·/inspections·/inventory와 동일하게 WORKER는 모바일 셸(하단 탭바),
 * ADMIN/MASTER는 MainLayout으로 분기한다.
 */
export default async function WorkerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="출고 피킹 스캐너" fallbackHref="/inspections?scope=mine">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
