import * as Sentry from "@sentry/nextjs";

import { apiClient } from "@/lib/api-client";
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

// --- app/domains/inventory/router.py 응답 타입 ---

interface InventoryBookInfo {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  base_price: number;
  cover_image_url: string;
}

interface InventoryItem {
  id: string;
  lpn_barcode: string;
  cover_image_url: string;
  book: InventoryBookInfo;
  grade: string;
  ubci_score: number | null;
  zone: string;
  quantity: number;
  worker_id: string;
  date: string;
}

interface CreateLpnResult {
  status: string;
  lpn_barcode: string;
  book: { title: string; author: string; isbn: string };
  location_id: string;
  worker_id?: string;
}

interface LpnListItem {
  lpn_barcode: string;
  book_id: string;
  status: string;
}

export const inventoryAPI = {
  getInventory: async () => {
    const res = await apiClient.get<InventoryItem[]>("/api/v1/inventory/");
    return res.data;
  },
  createLpn: async (data: { book_id?: string; isbn?: string; worker_id?: string; zone?: string }) => {
    const res = await apiClient.post<CreateLpnResult>("/api/v1/inventory/lpn", data);
    return res.data;
  },
  getLpnList: async () => {
    const res = await apiClient.get<LpnListItem[]>("/api/v1/inventory/lpn");
    return res.data;
  },
  // 하드 삭제 캐스케이드 (관리자 전용): 검수 이력·원장·알림까지 함께 지운다.
  // row_id = 재고 목록 행 id (중고 InventoryUsedItem.id / 신품 Inventory.id 모두 허용)
  deleteItem: async (rowId: string) => {
    const res = await apiClient.delete<{ status: string; deleted: Record<string, number> }>(
      `/api/v1/inventory/items/${rowId}`,
    );
    return res.data;
  },
};

// --- app/domains/po/router.py (/po/proposals*) 응답 타입 ---
// Restock 판정 그래프(Collector→Agent→Validator)가 적재한 order_proposals의 칸반 카드.

export type ProposalStatus = "PENDING" | "APPROVED" | "DISMISSED";
export type ProposalUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface OrderProposalCard {
  id: string;
  bookId: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  coverImageUrl: string | null;
  triggerType: "INSPECTION_REJECT" | "SAFETY_STOCK" | "MANUAL";
  rejectReasonCode: string | null;
  currentStock: number;
  salesVelocity30d: number;
  rejectedQuantity: number;
  baselineQuantity: number;
  proposedQuantity: number;
  urgency: ProposalUrgency;
  reasoning: string;
  aiSource: "LLM_GPT4O_MINI" | "FALLBACK_RULE";
  unitCost: number;
  estimatedCost: number;
  status: ProposalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  orderId: string | null;
  createdAt: string | null;
}

interface ProposalDecisionResult {
  status: string;
  approvedCount?: number;
  approved?: { proposalId: string; orderId: string; title: string; quantity: number; zone: string }[];
  dismissedCount?: number;
  skipped: string[];
}

interface ProposalScanResult {
  status: string;
  createdCount: number;
  created: { proposalId: string; title: string; currentStock: number; proposedQuantity: number; urgency: string }[];
}

// --- app/domains/labels/router.py (/labels/print) 응답 타입 ---
// Xprinter XP-423B Raw TCP 직결 출력. 브라우저 window.print()/WebUSB를 대체하는
// 단일 인쇄 경로 — LAN 라벨 프린터가 등록된 이후로는 모든 LPN 라벨 인쇄가 여기를 거친다.

interface LabelPrintResult {
  sent: boolean;
  skipped: boolean;
  queued: boolean;
  bytes_sent: number;
  zpl: string;
}

export const labelsAPI = {
  /**
   * 선부착 LPN 라벨 인쇄 - 등급/점수는 이 시점에 아직 없으므로 싣지 않는다
   * (배경: 33번 문서 zpl_label_service.py). 도서명/ISBN/작업자만 출력한다.
   */
  printLpn: async (lpn: string, bookTitle?: string, isbn?: string, workerId?: string) => {
    // 선부착 라벨은 작업자 표기만 싣는다 - 등급 확정 주체 문자열("HITL - WM..(이름)")이
    // 들어오면 확정 경위 접두어를 벗긴다 (그 경위는 상세 페이지/보증서가 보여줄 몫).
    const cleanWorker = workerId?.replace(/^\s*(HITL|AI_AUTO|AI|MANUAL)\s*[-–]\s*/i, "");
    const res = await apiClient.post<LabelPrintResult>("/api/v1/labels/print", {
      lpn,
      mode: "LPN",
      book_title: bookTitle,
      isbn,
      worker_id: cleanWorker,
    });
    return res.data;
  },
};

export const poAPI = {
  getProposals: async (status?: ProposalStatus) => {
    const query = status ? `?status=${status}` : "";
    const res = await apiClient.get<OrderProposalCard[]>(`/api/v1/po/proposals${query}`);
    return res.data;
  },
  approveProposals: async (proposal_ids: string[]) => {
    const res = await apiClient.post<ProposalDecisionResult>("/api/v1/po/proposals/approve", { proposal_ids });
    return res.data;
  },
  dismissProposals: async (proposal_ids: string[]) => {
    const res = await apiClient.post<ProposalDecisionResult>("/api/v1/po/proposals/dismiss", { proposal_ids });
    return res.data;
  },
  /** 결재가 끝난 카드만 삭제된다. PENDING 카드는 서버가 거부하고 skipped로 돌려준다. */
  deleteProposals: async (proposal_ids: string[]) => {
    const res = await apiClient.post<{ deletedCount: number; skipped: string[] }>(
      "/api/v1/po/proposals/delete",
      { proposal_ids },
    );
    return res.data;
  },
  /**
   * 저재고 스캔. 1회당 최대 8권을 순차로 gpt-4o-mini 호출하며 실측 12초 안팎 걸린다
   * (2026-08-09 실측). api-client 전역 타임아웃(10초)보다 길어서 스캔 자체는 서버에서
   * 성공했는데 클라이언트가 먼저 포기해 "실패"로 오인되는 문제가 있었다 - 이 호출에만
   * 개별 타임아웃을 넉넉히 준다(다른 빠른 API의 전역 기본값은 그대로 둔다).
   */
  scanSafetyStock: async () => {
    const res = await apiClient.post<ProposalScanResult>(
      "/api/v1/po/proposals/scan",
      undefined,
      { timeout: 60000 }
    );
    return res.data;
  },
};
