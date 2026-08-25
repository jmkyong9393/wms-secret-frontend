/** 날짜·로케이션 표기 유틸 (도메인 무관). */

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
