export interface DefectCoordinate {
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitlTask {
  id: string;
  book_id: string;
  book_title?: string;
  isbn?: string;
  cover_image_url?: string;
  image_urls: string[];
  status: string;
  ubci_score?: number;
  agent_logs?: {
    defect_coordinates?: DefectCoordinate[];
    reason?: string;
    suggested_grade?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface HitlOverrideRequest {
  ticketId: string;
  decision: string; // APPROVE_NORMAL | APPROVE_DOWNGRADE | REJECT_RETURN | RE_CHECK
  targetGrade: string; // S | A | B | REJECT
  primaryReasonCode: string;
  reasonComment: string;
  defectCoordinates: DefectCoordinate[];
  reviewDurationMs: number;
}

export interface BulkOverridePayload {
  items: HitlOverrideRequest[];
}
