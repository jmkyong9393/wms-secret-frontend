import type { RawBBox, DefectCoordinateGroup, AgentLogs } from '@/entities/inspection/model/types';
export type { RawBBox, DefectCoordinateGroup, AgentLogs };

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
  agent_logs?: AgentLogs;
  created_at: string;
  /** 상태가 마지막으로 바뀐 시각(HITL 이관·회수 시점). 결재 대기 목록의 정렬 기준이다. */
  updated_at?: string;
}


export interface HitlOverrideRequest {
  ticketId: string;
  decision: string; // APPROVE_NORMAL | APPROVE_DOWNGRADE | REJECT_RETURN | RE_CHECK
  targetGrade: string; // S | A | B | REJECT
  primaryReasonCode: string;
  reasonComment: string;
  defectCoordinates: DefectCoordinate[] | DefectCoordinateGroup[];
  reviewDurationMs: number;
  /** 검수자가 화면에서 감점 제외한 결함 (agent_logs.defects 인덱스) */
  excludedDefectIndexes?: number[];
  /** 검수자가 결함으로 채택한 YOLO 후보 (agent_logs.yolo_candidates 인덱스) */
  adoptedCandidateIndexes?: number[];
  /** 검수자가 드래그로 직접 고친 결함 좌표 (agent_logs.defects 인덱스, 0~1000 상대좌표) */
  editedBboxes?: { index: number; xmin: number; ymin: number; xmax: number; ymax: number }[];
  /** 검수자가 직접 그린 신규 결함 (AI가 놓친 것 보완) */
  addedBboxes?: { type: string; xmin: number; ymin: number; xmax: number; ymax: number; imageIndex: number }[];
}

export interface BulkOverridePayload {
  items: HitlOverrideRequest[];
}
