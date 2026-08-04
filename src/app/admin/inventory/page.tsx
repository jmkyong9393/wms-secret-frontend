'use client';

/**
 * 재고 현황 관리 (Master/Admin).
 * [수정 이력 2026-08-04] 1,331줄의 페이지 전용 구현을 features/stock 공용 그리드 1벌로
 * 통합 (B안: URL 유지 + 코드 단일화). 원본은 archive/2026-08-04_4페이지통합_원본백업/ 참조.
 */
import { InventoryDataTable } from '@/features/stock/components/InventoryDataTable';

export default function AdminInventoryPage() {
  return <InventoryDataTable role="ADMIN" />;
}
