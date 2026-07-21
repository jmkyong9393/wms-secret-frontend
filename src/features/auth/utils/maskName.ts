// 이름의 중간 글자를 *로 마스킹 (예: 박준희 → 박*희)
export function maskName(name: string): string {
  if (name.length <= 1) return "*";
  if (name.length ===2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length -2)}${name[name.length -1]}`;
}
