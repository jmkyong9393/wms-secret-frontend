import type { InventoryItem } from '../model/types';

/** 신품 Fast-Track 여부 판별 (LPN 미발급/ISBN 바코드 사용 품목) */
export function isNewBookItem(item: Pick<InventoryItem, 'lpn_barcode' | 'grade'>): boolean {
  const lpn = item.lpn_barcode || '';
  const grade = (item.grade || '').toUpperCase();
  return (
    !lpn ||
    lpn.includes('미발급') ||
    lpn.includes('신품') ||
    lpn.startsWith('ISBN') ||
    lpn.startsWith('NEW') ||
    grade === 'NEW_FASTTRACK' ||
    grade.includes('FASTTRACK')
  );
}
