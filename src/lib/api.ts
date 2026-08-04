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
  scanSafetyStock: async () => {
    const res = await apiClient.post<ProposalScanResult>("/api/v1/po/proposals/scan");
    return res.data;
  },
};
