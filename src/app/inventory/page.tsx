'use client';

/**
 * 재고 현황 (통합 URL, 역할 자동 적응).
 * [수정 이력 2026-08-05] C안 URL 물리 통합: /admin/inventory · /worker/inventory 를
 * 단일 /inventory 로 수렴. URL은 리소스만 가리키고 권한은 세션 role이 표현한다.
 */
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';
import { InventoryDataTable } from '@/features/stock/components/InventoryDataTable';

export default function InventoryPage() {
  const user = useAtomValue(currentUserAtom);
  // MASTER/ADMIN → 관리자 뷰(벌크바 노출), WORKER → 조회 전용 뷰
  const role = user?.role?.toUpperCase() === 'WORKER' ? 'WORKER' : 'ADMIN';
  return <InventoryDataTable role={role} />;
}
