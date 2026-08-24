import * as Sentry from "@sentry/nextjs";

import { apiClient } from "@/shared/api/api-client";
import type { HitlTask, HitlOverrideRequest } from "@/features/hitl/types/hitl";

/** Sentry Application Metrics 카운터. 계측 실패가 업무 동작을 막으면 안 되므로 삼킨다. */
const metricCount = (name: string, attributes?: Record<string, string | number>) => {
  try {
    Sentry.metrics?.count?.(name, 1, attributes ? { attributes } : undefined);
  } catch {
    /* 계측은 부가 기능 - 실패해도 무시 */
  }
};

// --- app/domains/admin/router.py (/admin/hitl/*) 응답 타입 ---

interface HitlOverrideResult {
  status: string;
  processed_count: number;
  message: string;
}

interface HitlReinspectResult {
  status: string;
  message: string;
  job_id: string;
}

/** BBox 편집분으로 계산한 점수. 저장 전 확인용이라 서버는 아무것도 기록하지 않는다. */
export interface HitlScorePreview {
  ubci_score: number | null;
  grade: string | null;
  policy_text: string | null;
  score_unverified: boolean;
  defect_count: number;
  excluded_count: number;
  integrity_issues: string[];
  current_score: number | null;
  delta: number | null;
}

export interface HitlScorePreviewPayload {
  excludedDefectIndexes?: number[];
  adoptedCandidateIndexes?: number[];
  editedBboxes?: { index: number; xmin: number; ymin: number; xmax: number; ymax: number }[];
  addedBboxes?: { type: string; xmin: number; ymin: number; xmax: number; ymax: number; imageIndex: number }[];
}

export interface HitlRecallResult {
  status: string;
  job_id: string;
  item_id: string | null;
  previous_status: string;
  previous_score: number | null;
  message: string;
}

export const adminAPI = {
  getPendingHitlTasks: async () => {
    const res = await apiClient.get<HitlTask[]>("/api/v1/admin/hitl/pending");
    return res.data;
  },
  submitHitlOverrides: async (items: HitlOverrideRequest[]) => {
    const res = await apiClient.post<HitlOverrideResult>("/api/v1/admin/hitl/override", { items });
    // 관리자 결재 처리량 — HITL 운영 부하를 Sentry Metrics에서 추적한다.
    metricCount("hitl.override.submitted", { batch_size: items.length });
    return res.data;
  },
  triggerAiReinspection: async (jobId: string) => {
    const res = await apiClient.post<HitlReinspectResult>(`/api/v1/admin/hitl/${jobId}/re-inspect`);
    // AI 재검수 요청 빈도 — 재검수 폭주(비용)를 조기에 본다.
    metricCount("inspection.reinspect.triggered");
    return res.data;
  },
  /**
   * 재검수 결과 조회용. re-inspect는 Celery 큐에 등록만 하고 즉시 반환하므로
   * (실제 파이프라인은 십수 초 뒤 끝난다) 결과는 이 엔드포인트로 폴링해서 받는다.
   */
  getInspectionResult: async (jobId: string) => {
    const res = await apiClient.get<{
      id: string;
      ubci_score: number | null;
      grade?: string;
      agent_logs?: Record<string, unknown>;
    }>(`/api/v1/inventory/${jobId}`);
    return res.data;
  },
  /**
   * 편집한 BBox 기준 점수를 결재 전에 확인한다. 서버는 저장하지 않는다.
   * Policy Agent가 LLM 없는 결정론적 산식이라 호출 비용이 없다.
   */
  previewHitlScore: async (jobId: string, payload: HitlScorePreviewPayload) => {
    const res = await apiClient.post<HitlScorePreview>(
      `/api/v1/admin/hitl/${jobId}/score-preview`,
      payload,
    );
    return res.data;
  },
  /** 적재된 재고를 HITL 재검수 대기로 되돌린다 (ADMIN/MASTER). */
  recallToHitl: async (itemId: string, reason?: string) => {
    const res = await apiClient.post<HitlRecallResult>(
      `/api/v1/admin/hitl/recall/${itemId}`,
      { reason: reason || null },
    );
    return res.data;
  },
};
