import { Camera, MessageSquare, PackageSearch, ShieldCheck, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * WORKER(현장 작업자) 전용 메뉴 정의 — 단일 출처(SSOT).
 *
 * [신설 2026-08-06] 종전에는 Sidebar.tsx 안에만 있어서, WORKER가 /inspections·/inventory로
 * 이동하면 WorkerMobileShell(사이드바 없음)로 셸이 바뀌며 **메뉴에 접근할 방법이 사라졌다.**
 * /inbound(MainLayout)로 돌아가야만 다른 메뉴로 갈 수 있었다.
 * 이 파일로 정의를 분리해 Sidebar(데스크톱)와 WorkerMobileShell(모바일 하단 탭바)이
 * 같은 목록을 쓰게 한다 - 한쪽만 수정되어 메뉴가 어긋나는 것을 방지한다.
 */
export interface WorkerMenuItem {
  name: string;
  /** 하단 탭바처럼 폭이 좁은 곳에서 쓸 축약 라벨 */
  shortName: string;
  href: string;
  icon: LucideIcon;
}

export const WORKER_MENU_ITEMS: WorkerMenuItem[] = [
  { name: '도서 입고 검수 (카메라)', shortName: '입고검수', href: '/inbound', icon: Camera },
  { name: '나의 검수 내역 (Worker)', shortName: '검수내역', href: '/inspections?scope=mine', icon: ShieldCheck },
  { name: '출고 피킹 스캐너 (Worker)', shortName: '피킹', href: '/worker/outbound', icon: Truck },
  { name: '현장 재고 조회 (Worker)', shortName: '재고조회', href: '/inventory', icon: PackageSearch },
  { name: '게시판', shortName: '게시판', href: '/board', icon: MessageSquare },
];

/** 현재 경로가 해당 메뉴 항목인지 판정. href에 쿼리가 붙는 항목이 있어 경로만 비교한다. */
export function isWorkerMenuActive(pathname: string, href: string): boolean {
  return pathname === href.split('?')[0];
}
