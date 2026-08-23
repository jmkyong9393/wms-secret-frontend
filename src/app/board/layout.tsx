import { cookies } from 'next/headers';
import MainLayout from '@/widgets/layout/MainLayout';
import WorkerMobileShell from '@/widgets/layout/WorkerMobileShell';

/**
 * 게시판 라우트 - 역할 적응형 레이아웃.
 * MANUAL/GENERAL 카테고리는 WORKER도 작성해야 하므로 /admin 하위에 둘 수 없다
 * (MainLayout이 WORKER의 /admin/* 접근을 강제 리다이렉트한다). /worker/layout.tsx와
 * 동일하게 WORKER는 모바일 셸, 그 외(MASTER/ADMIN)는 데스크톱 MainLayout으로 분기한다.
 */
export default async function BoardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="게시판" fallbackHref="/inspections?scope=mine">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
