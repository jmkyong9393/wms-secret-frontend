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
  special_notes?: string;
  human_issue_notes?: string;
  inspection_type?: "RETURN" | "BUYBACK";
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
  /** 검수자가 화면에서 감점 제외한 결함 (agent_logs.defects 인덱스) */
  excludedDefectIndexes?: number[];
  /** 검수자가 결함으로 채택한 YOLO 후보 (agent_logs.yolo_candidates 인덱스) */
  adoptedCandidateIndexes?: number[];
  /** 검수자가 드래그로 직접 고친 결함 좌표 (agent_logs.defects 인덱스, 0~1000 상대좌표) */
  editedBboxes?: { index: number; xmin: number; ymin: number; xmax: number; ymax: number }[];
}

export interface BulkOverridePayload {
  items: HitlOverrideRequest[];
}
