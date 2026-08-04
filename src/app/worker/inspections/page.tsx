'use client';

/**
 * 나의 검수 내역 (Worker 개인).
 * [수정 이력 2026-08-04] features/stock 공용 그리드로 통합 (scope="MINE": 개인 KPI 카드 +
 * HITL 승인 대기 건 병합 + 라벨 인쇄). 하드코딩 사번(WM2608001) 대신 로그인 사용자의
 * 사번을 사용한다. 원본은 archive/2026-08-04_4페이지통합_원본백업/ 참조.
 */
import { InspectionDataTable } from '@/features/stock/components/InspectionDataTable';

export default function WorkerInspectionsPage() {
  return <InspectionDataTable role="WORKER" scope="MINE" />;
}
