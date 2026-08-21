'use client';

/**
 * 검수 처리 내역 (통합 URL, 역할+스코프 자동 적응).
 * C안 URL 물리 통합: /admin/inspections · /worker/inspections 를
 * 단일 /inspections 로 수렴. 스코프는 ?scope=mine 쿼리로 표현하되,
 * WORKER는 scope 미지정·scope=all 요청 시에도 강제 MINE (권한 하향 고정).
 */
import { Suspense } from 'react';
import { useHydratedUser } from '@/features/auth/hooks/useHydratedUser';
import { useSearchParams } from 'next/navigation';

import { InspectionDataTable } from '@/features/stock/components/InspectionDataTable';

function InspectionsShell() {
  const params = useSearchParams();
  const { user, hydrated } = useHydratedUser();
  // 하이드레이션 전에는 최소 권한으로 판단한다 (관리자 뷰 선노출 방지)
  const isWorker = !hydrated || user?.role?.toUpperCase() === 'WORKER';
  const scope = isWorker || params.get('scope') === 'mine' ? 'MINE' : 'ALL';
  return <InspectionDataTable role={isWorker ? 'WORKER' : 'ADMIN'} scope={scope} />;
}

export default function InspectionsPage() {
  // useSearchParams는 빌드 시 Suspense 경계가 필요하다 (Next.js App Router 규칙)
  return (
    <Suspense>
      <InspectionsShell />
    </Suspense>
  );
}
