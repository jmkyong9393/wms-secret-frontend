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

// --- app/domains/po/router.py 응답 타입 ---

export interface SuggestedPo {
  id: string;
  book_id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  currentStock: number;
  safetyStock: number;
  recommendedQty: number;
  estimatedCost: number;
  urgency: string;
  status: string;
  triggerDate: string;
  _fallback_reason?: string;
}

interface ApprovePoResult {
  message: string;
  approved_count: number;
  created_order_ids: string[];
  created_lpns: string[];
}

interface DeductStockResult {
  [key: string]: unknown;
}

export const poAPI = {
  getSuggestedPo: async () => {
    const res = await apiClient.get<SuggestedPo[]>("/api/v1/po/suggested");
    return res.data;
  },
  approvePo: async (book_ids: string[]) => {
    const res = await apiClient.post<ApprovePoResult>("/api/v1/po/approve", { book_ids });
    return res.data;
  },
  deductStock: async (data: { book_id: string; deduct_qty?: number; reason?: string }) => {
    const res = await apiClient.post<DeductStockResult>("/api/v1/po/deduct", data);
    return res.data;
  },
};
