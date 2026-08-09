import { apiClient } from "@/lib/api-client";
import type { HitlTask, HitlOverrideRequest } from "@/features/hitl/types/hitl";

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

export const adminAPI = {
  getPendingHitlTasks: async () => {
    const res = await apiClient.get<HitlTask[]>("/api/v1/admin/hitl/pending");
    return res.data;
  },
  submitHitlOverrides: async (items: HitlOverrideRequest[]) => {
    const res = await apiClient.post<HitlOverrideResult>("/api/v1/admin/hitl/override", { items });
    return res.data;
  },
  triggerAiReinspection: async (jobId: string) => {
    const res = await apiClient.post<HitlReinspectResult>(`/api/v1/admin/hitl/${jobId}/re-inspect`);
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
  scanSafetyStock: async () => {
    const res = await apiClient.post<ProposalScanResult>("/api/v1/po/proposals/scan");
    return res.data;
  },
};
