// 수동 선택 모드(지시서 미연동)에서 쓰는 표시용 주문 ID/거래처 — 실제 지시서 연동 시 activeInstruction 값으로 대체된다.
const B2B_CUSTOMER_POOL = [
  "교보문고 B2B 지점",
  "영풍문고 종로점",
  "YES24 강남물류센터",
  "알라딘 중고매입센터",
  "북센 도매유통",
  "교보문고 B2B 물류센터 (인천)",
];

export function todayYYYYMMDD(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export function randomB2bCustomerName(): string {
  return B2B_CUSTOMER_POOL[Math.floor(Math.random() * B2B_CUSTOMER_POOL.length)];
}
