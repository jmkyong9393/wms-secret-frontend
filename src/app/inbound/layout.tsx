import { cookies } from 'next/headers';
import MainLayout from '@/widgets/layout/MainLayout';
import WorkerMobileShell from '@/widgets/layout/WorkerMobileShell';

/**
 * 도서 입고 검수 — 역할 적응형 레이아웃.
 *
 * /inbound에는 layout.tsx가 아예 없어 페이지가 <Header />를 직접
 * 렌더하고 있었다. 그 결과 WORKER가 이 화면에 들어오면 **하단 탭바가 사라져** 다른
 * 메뉴로 이동할 수단이 없었고(사이드바도 없음), ADMIN도 이 화면에서만 사이드바가
 * 유실되어 다른 관제 화면과 셸이 어긋났다. /inspections·/inventory와 동일한 역할
 * 적응형 분기로 통일한다. role 쿠키는 서버에서 읽어 첫 페인트부터 올바른 셸을 그린다.
 */
export default async function InboundLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="도서 입고 검수" fallbackHref="/inspections?scope=mine">
        {children}
      </WorkerMobileShell>
    );
  }
  return <MainLayout>{children}</MainLayout>;
}
