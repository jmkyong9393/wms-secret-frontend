'use client';

/**
 * 검수 처리 내역 (전체, Admin).
 * [수정 이력 2026-08-04] features/stock 공용 그리드로 통합. 기존에 상태만 바꾸고 모달을
 * 렌더하지 않던 "AI 검수 리포트" 죽은 버튼도 공용 모달로 복구됨.
 * 원본은 archive/2026-08-04_4페이지통합_원본백업/ 참조.
 */
import { InspectionDataTable } from '@/features/stock/components/InspectionDataTable';

export default function AdminInspectionsPage() {
  return <InspectionDataTable role="ADMIN" scope="ALL" />;
}
