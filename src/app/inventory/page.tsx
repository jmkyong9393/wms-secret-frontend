'use client';

/**
 * 재고 현황 (통합 URL, 역할 자동 적응).
 * C안 URL 물리 통합: /admin/inventory · /worker/inventory 를
 * 단일 /inventory 로 수렴. URL은 리소스만 가리키고 권한은 세션 role이 표현한다.
 */

import { InventoryDataTable } from '@/widgets/inventory-table/ui/InventoryDataTable';
import { useHydratedUser } from '@/entities/user/model/useHydratedUser';

export default function InventoryPage() {
  const { user, hydrated } = useHydratedUser();
  // MASTER/ADMIN → 관리자 뷰(벌크바 노출), WORKER → 조회 전용 뷰.
  // 하이드레이션 전에는 최소 권한으로 그려 관리자 UI가 한 프레임 스쳐 보이는 것을 막는다.
  const role = !hydrated || user?.role?.toUpperCase() === 'WORKER' ? 'WORKER' : 'ADMIN';
  return <InventoryDataTable role={role} />;
}
