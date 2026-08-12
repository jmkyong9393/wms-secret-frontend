import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import WorkerMobileShell from '@/components/layout/WorkerMobileShell';

/**
 * LPN 내부 조회 — 역할 적응형 레이아웃.
 *
 * QR 라벨의 공용 진입점이므로 역할이 세 갈래로 갈린다:
 *  - WORKER               : 모바일 풀스크린 셸 (QR 딥링크라 히스토리가 없을 수 있어 fallbackHref)
 *  - ADMIN / MASTER       : 데스크톱 관제 셸 (MainLayout)
 *  - 비로그인 / 고객       : 여기서 바로 고객용 보증서로 서버 리다이렉트
 *
 * [수정 이력 2026-08-12] 비로그인도 MainLayout에 태우던 버그 수정. MainLayout의 인증
 * 가드가 페이지의 /certificate 클라이언트 전환보다 먼저 /login으로 튕겨내, 구매자가
 * QR을 찍으면 보증서 대신 로그인 화면이 떴다. 역할 분기는 쿠키 기준으로 레이아웃(서버)에서
 * 끝내고, 내부 역할이 아니면 셸을 씌우기 전에 보증서로 보낸다.
 * (페이지 내부의 클라이언트 전환 로직은 이중 안전망으로 유지)
 */
export default async function LpnDetailLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lpn: string }>;
}>) {
  const role = (await cookies()).get('role')?.value?.toUpperCase();

  if (role === 'WORKER') {
    return (
      <WorkerMobileShell title="LPN 상세 조회" fallbackHref="/inventory">
        {children}
      </WorkerMobileShell>
    );
  }
  if (role === 'ADMIN' || role === 'MASTER') {
    return <MainLayout>{children}</MainLayout>;
  }

  const { lpn } = await params;
  redirect(`/certificate/${encodeURIComponent(lpn)}`);
}
