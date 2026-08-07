/**
 * 재고/검수 통합 그리드 공용 유틸.
 * 4개 페이지에 흩어져 있던 동일 로직(신품 판별, 등급 배지, Zone 포맷, KST 날짜)의 단일 소스.
 */
import type { InventoryItem } from './types';

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

/** "Zone A-Rack 01-Shelf 02" → "A-1-2" 압축 표기 */
export function formatZone(zone?: string): string {
  if (!zone) return 'A-1-1';
  return zone
    .replace(/^Zone\s*/gi, '')
    .replace(/Rack\s*0*/gi, '')
    .replace(/Shelf\s*0*/gi, '')
    .replace(/\s+/g, '')
    .replace(/--+/g, '-');
}

const GRADE_BADGE: Record<string, string> = {
  MINT: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  GOOD: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  REJECT: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  검수대기: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
};

/** 등급 문자열의 별칭 → 표준 등급. 부분 문자열 매칭을 쓰지 않기 위한 정확 매핑. */
const GRADE_ALIAS: Record<string, string> = {
  MINT: 'MINT', S: 'MINT',
  GOOD: 'GOOD', A: 'GOOD',
  NORMAL: 'NORMAL', B: 'NORMAL',
  POOR: 'REJECT', REJECT: 'REJECT', C: 'REJECT',
};

/**
 * UBCI 점수/등급 → 표기 등급 + 배지 클래스 (UBCI_Specification_v2.0.0.0 경계값).
 *
 * 확정 등급 문자열이 있으면 그것이 정답이다(HITL 결재 등). 점수는 등급이 비어 있을
 * 때만 쓰는 폴백이며, 둘 다 없으면 '검수대기'로 표기한다 — 검수하지 않은 품목에
 * 기본 점수를 씌워 등급을 지어내지 않는다.
 */
export function gradeMeta(
  // 등급은 검수 전(PENDING)이나 판독 보류 시 null로 내려온다.
  grade: string | null | undefined,
  ubciScore?: number | null,
): { display: string; badge: string } {
  const g = (grade || '').toUpperCase().trim();

  // NEW/NEW_FASTTRACK 등 중고 등급 체계 밖의 값은 점수 폴백으로 넘긴다.
  const named = GRADE_ALIAS[g];
  if (named) return { display: named, badge: GRADE_BADGE[named] };

  if (ubciScore == null) return { display: '검수대기', badge: GRADE_BADGE['검수대기'] };

  const display =
    ubciScore >= 95 ? 'MINT' : ubciScore >= 85 ? 'GOOD' : ubciScore >= 65 ? 'NORMAL' : 'REJECT';
  return { display, badge: GRADE_BADGE[display] };
}

/** 'YYYY-MM-DD HH:mm:ss' 고정 표기 (이미 표준 포맷이면 그대로 반환해 JS 타임존 왜곡 방지) */
export function formatKSTDate(dateStr: string): string {
  if (!dateStr) return '-';
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  try {
    const raw = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(raw);
    if (isNaN(d.getTime())) return dateStr;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return dateStr;
  }
}

export const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  FP_SHADOW: { label: '그림자 오탐 방어', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐 방어', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EDGE_WEAR: { label: '모서리 마모', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_DOODLE: { label: '내부 손글씨/낙서', category: '내부 훼손', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_STAIN: { label: '내부 낙서/오염', category: '내부 훼손', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  DMG_NONE: { label: '결함 없음 (정상)', category: '정상 승인', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
};

export const SCAN_ANGLE_LABELS = [
  '각도 1 (전면 표지)',
  '각도 2 (후면 표지)',
  '각도 3 (결함 부위)',
  '각도 4 (결함 부위)',
  '각도 5 (결함 부위)',
  '각도 6 (결함 부위)',
  '각도 7 (결함 부위)',
];
