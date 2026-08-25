import type { StockBook } from '@/entities/book/model/types';

export type InspectionStatus = 'AUTO_APPROVED' | 'HITL_PENDING' | 'REJECTED';

export interface InspectionDefect {
  reason_code: string;
  description: string;
  confidence: number;
  /** 관리자가 HITL에서 오탐으로 제외한 결함 - 감사 기록으로 남기되 감점엔 미반영. */
  excluded?: boolean;
}

export interface InspectionItem {
  id: string;
  lpn_barcode: string;
  book: StockBook;
  /**
   * 값이 없을 수 있다(null).
   *
   * 종전에는 `ubci_score or 85`, `condition_grade or 'GOOD'` 식으로 **없는 값을 지어내
   * 채웠고**, 그 결과 검수를 거치지 않은 재고까지 "AI 검수 완료"로 보였다.
   * 판독 전이거나 판독에 실패한 건은 점수·등급이 존재하지 않는 것이 사실이므로
   * null을 그대로 받고 화면에서 "미산출"로 표기한다.
   */
  ubci_score: number | null;
  grade: string | null;
  /** HITL 결재로 확정된 등급 (AI 산출 등급과 다를 수 있다) */
  confirmed_grade?: string | null;
  status: InspectionStatus;
  worker_id: string;
  /** 라벨 인쇄용 - AI/HITL 판정 주체(worker_id)가 아니라 실제 입고 처리한 사람. */
  worker_label: string;
  inspected_at: string;
  /** 백엔드가 산출·저장하지 않는 지표다. 하드코딩 금지 — 없으면 표시하지 않는다. */
  ai_confidence?: number | null;
  defects_found: InspectionDefect[];
  image_urls?: string[];
}

/** 파이프라인 산출 BBox — 검수 편집·심사 표식(hitl_*)까지 실려 온다. 좌표는 coord_space 기준. */
export interface RawBBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  type?: string;
  label?: string;
  confidence?: number;
  image_index?: number;
  coord_space?: number;
  deduction?: number;
  preliminary_deduction?: number;
  applied_deduction?: number;
  deduction_note?: string;
  deduction_scope?: string;
  evidence_suspect?: boolean;
  conf_copied_from_candidate?: boolean;
  hitl_excluded?: boolean;
  hitl_added?: boolean;
  hitl_adopted?: boolean;
  hitl_bbox_edited?: boolean;
  bbox?: { xmin: number; ymin: number; xmax: number; ymax: number };
  kind?: string;
  isLowConf?: boolean;
  defectIndex?: number;
  candIndex?: number;
  tempId?: string;
}

/** 이미지별 결함 좌표 묶음 (agent_logs.defect_coordinates 원소) */
export interface DefectCoordinateGroup {
  image_index?: number;
  image_idx?: number;
  image_url?: string;
  bboxes?: RawBBox[];
}

/** 파이프라인 감사 로그 — 노드별 산출물이 누적된다. 미선언 키는 unknown으로 취급. */
export interface AgentLogs {
  defects?: RawBBox[];
  defect_coordinates?: DefectCoordinateGroup[];
  yolo_candidates?: RawBBox[];
  invalid_image_indexes?: number[];
  executed_agents?: string[];
  node_timings?: Record<string, number>;
  reason?: string;
  reason_code?: string;
  primary_reason_code?: string;
  suggested_grade?: string;
  suggested_decision?: string;
  policy_text?: string;
  vision_text?: string;
  critic_text?: string;
  detector_text?: string;
  supervisor_rationale?: string;
  report_generated_at?: string;
  retry_count?: number;
  auto_refund_eligible?: boolean;
  /** BBox 편집 후 2차 재검증 기록 — 1차 판독 로그와 분리 보존된다 */
  hitl_revalidation?: {
    revalidated_at?: string;
    revalidated_by?: string;
    policy_text?: string;
    policy_score?: number;
    policy_error?: string;
    critic_stage_a_passed?: boolean;
    critic_stage_a_issues?: string[];
    critic_stage_a_error?: string;
  };
  report_text?: string;
  special_notes?: string;
  lpn_barcode?: string;
  book_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Report Agent가 생성한 고객 보증서 문서의 결함 항목 */
export interface CertificateFinding {
  label?: string;
  reason?: string;
  location?: string;
  deduction?: number;
}

/** Report Agent 보증서 문서 — 프론트는 문장을 만들지 않고 그대로 렌더한다 */
export interface CertificateDoc {
  cert_id?: string;
  headline?: string;
  summary?: string;
  condition_detail?: string;
  care_tip?: string;
  policy_basis?: string[];
  policy_notice?: string;
  findings?: CertificateFinding[];
}
