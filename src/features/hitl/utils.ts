import type { HitlTask } from './types/hitl';

/**
 * 결재 대기 목록의 정렬 기준 시각(HITL 이관/회수 시점)을 "08-13 09:15" 형태로 보여준다.
 * 이 값이 화면에 없으면 목록이 최신순인지 결재자가 확인할 방법이 없다.
 */
export function formatQueuedAt(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * agent_logs.defects[](Vision/YOLO가 실제로 낸 결함 목록)에서 hitl_excluded/evidence_suspect가
 * 아닌 것 중 감점 비중이 가장 큰 유형을 대표 결함으로 반환한다. "AI 비전 감지 사유" 컬럼과
 * "오버라이드 사유" 초기값이 반드시 같은 값을 봐야 하므로(둘 다 이 함수 하나로 통일),
 * 컴포넌트 바깥으로 뺐다 - 두 군데서 각자 계산하면 로직이 갈라져 서로 다른 값을 보여줄 수 있다.
 */
export function getPrimaryDefectReason(t: HitlTask): string | null {
  const defects: any[] = Array.isArray(t.agent_logs?.defects) ? t.agent_logs.defects : [];
  const candidates = defects.filter(
    (d) => d && typeof d.type === "string" && d.type && !d.hitl_excluded && !d.evidence_suspect
  );
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      Number(b.applied_deduction ?? b.preliminary_deduction ?? 0) -
      Number(a.applied_deduction ?? a.preliminary_deduction ?? 0)
  );
  return candidates[0].type;
}
