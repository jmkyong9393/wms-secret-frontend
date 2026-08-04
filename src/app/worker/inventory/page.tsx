'use client';

/**
 * 현장 재고 조회 (Worker, 조회 전용).
 * [수정 이력 2026-08-04] features/stock 공용 그리드로 통합. Worker의 상세 링크가
 * /admin/inventory/{id}로 걸려 미들웨어 RBAC에 의해 튕겨나가던 버그도 공용 컴포넌트에서
 * /lpn/{lpn} 내부 조회로 교정됨. 원본은 archive/2026-08-04_4페이지통합_원본백업/ 참조.
 */
import { InventoryDataTable } from '@/features/stock/components/InventoryDataTable';

export default function WorkerInventoryPage() {
  return <InventoryDataTable role="WORKER" />;
}
