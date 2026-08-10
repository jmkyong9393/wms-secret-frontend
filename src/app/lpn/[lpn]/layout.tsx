import { cookies } from 'next/headers';
import MainLayout from '@/components/layout/MainLayout';
import WorkerMobileShell from '@/components/layout/WorkerMobileShell';

/**
 * LPN 내부 조회 — 역할 적응형 레이아웃.
 * [수정 이력 2026-08-10] 이 라우트는 레이아웃 셸이 아예 없어(root layout.tsx만 적용) 헤더도
 * 뒤로가기도 없이 페이지 콘텐츠만 뚝 떨어져 렌더됐다. /inspections·/inventory와 같은 패턴으로
 * ADMIN/MASTER는 MainLayout, WORKER는 모바일 풀스크린 셸을 적용한다. 페이지 내부는 QR
 * 라벨을 스캔해 들어오는 딥링크라 브라우저 히스토리가 없을 수 있어 fallbackHref를 지정한다.
 */
export default async function LpnDetailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="LPN 상세 조회" fallbackHref="/inventory">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
