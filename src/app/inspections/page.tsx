'use client';

/**
 * 검수 처리 내역 (통합 URL, 역할+스코프 자동 적응).
 * [수정 이력 2026-08-05] C안 URL 물리 통합: /admin/inspections · /worker/inspections 를
 * 단일 /inspections 로 수렴. 스코프는 ?scope=mine 쿼리로 표현하되,
 * WORKER는 scope 미지정·scope=all 요청 시에도 강제 MINE (권한 하향 고정).
 * 설계서: PM_정답지_백업/16_C안_URL_물리통합_설계서 참조.
 */
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { InspectionDataTable } from '@/features/stock/components/InspectionDataTable';

function InspectionsShell() {
  const params = useSearchParams();
  const user = useAtomValue(currentUserAtom);
  const isWorker = user?.role?.toUpperCase() === 'WORKER';
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
