export interface PurchaseOrder {
  id: string;
  book: string;
  author: string;
  qty: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  status: 'WAITING' | 'APPROVED' | 'REJECTED';
}

export interface ApprovePoRequest {
  poIds: string[];
}
