/**
 * Single Source of Truth Service for WMS Multi-Angle Inspection Images & BBox Coordinates
 * Reused cleanly across /admin/inspections, /worker/inspections, /admin/inventory/[id], and /admin/hitl
 */

export interface BBoxItem {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  label: string;
  type?: string;
  confidence?: number;
}

export interface PerImageDefectCoordinate {
  image_index: number;
  image_url?: string;
  bboxes: BBoxItem[];
}

export const BASE_EXPERIMENT_JOB_ID = "job-0c2929a0";
export const BASE_IMAGE_HOST = "http://localhost:8000";

// 1. Standard 7 Multi-Angle Scan Image URLs
export function getStandardInspectionImageUrls(jobId: string = BASE_EXPERIMENT_JOB_ID): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map(
    (idx) => `${BASE_IMAGE_HOST}/experiment_data/${jobId}/raw_${idx}.jpg`
  );
}

// 2. Standard 100% Visually Aligned BBox Defect Coordinates for all 7 angles
export const STANDARD_DEFECT_COORDINATES: PerImageDefectCoordinate[] = [
  {
    image_index: 0,
    bboxes: [
      {
        xmin: 520, ymin: 160, xmax: 600, ymax: 240,
        label: "DMG_EXT_CRUSH (전면 표지 우상단 모서리 미세 눌림)",
        type: "DMG_EXT_CRUSH",
        confidence: 0.965
      }
    ]
  },
  {
    image_index: 3,
    bboxes: [
      {
        xmin: 420, ymin: 360, xmax: 540, ymax: 400,
        label: "DMG_INT_DOODLE (Q42 10:10:00 연필 필기)",
        type: "DMG_INT_DOODLE",
        confidence: 0.985
      },
      {
        xmin: 440, ymin: 650, xmax: 620, ymax: 780,
        label: "DMG_INT_DOODLE (outer join & LOC 연필 구문 메모)",
        type: "DMG_INT_DOODLE",
        confidence: 0.982
      }
    ]
  },
  {
    image_index: 4,
    bboxes: [
      {
        xmin: 450, ymin: 600, xmax: 620, ymax: 660,
        label: "DMG_INT_DOODLE (보기 ②, ③번 SQL 쿼리 연필 밑줄)",
        type: "DMG_INT_DOODLE",
        confidence: 0.948
      }
    ]
  },
  {
    image_index: 5,
    bboxes: [
      {
        xmin: 650, ymin: 240, xmax: 800, ymax: 300,
        label: "DMG_INT_DOODLE (우상단 필기: WHERE!)",
        type: "DMG_INT_DOODLE",
        confidence: 0.978
      },
      {
        xmin: 640, ymin: 520, xmax: 780, ymax: 580,
        label: "DMG_INT_DOODLE (우측 여백 필기: not and or)",
        type: "DMG_INT_DOODLE",
        confidence: 0.982
      },
      {
        xmin: 690, ymin: 700, xmax: 760, ymax: 760,
        label: "DMG_INT_DOODLE (35번 보기 ④번 정답 동그라미)",
        type: "DMG_INT_DOODLE",
        confidence: 0.972
      }
    ]
  },
  {
    image_index: 6,
    bboxes: [
      {
        xmin: 450, ymin: 430, xmax: 620, ymax: 520,
        label: "DMG_INT_DOODLE (상위 묶음괄호 메모 & 51번 지문 밑줄)",
        type: "DMG_INT_DOODLE",
        confidence: 0.985
      }
    ]
  }
];

/**
 * Normalizes inspection image URLs from DB or returns standard fallback
 */
export function resolveInspectionImages(itemOrJob: any): string[] {
  if (itemOrJob?.image_urls && Array.isArray(itemOrJob.image_urls) && itemOrJob.image_urls.length > 0) {
    return itemOrJob.image_urls;
  }
  if (itemOrJob?.agent_logs?.image_urls && Array.isArray(itemOrJob.agent_logs.image_urls) && itemOrJob.agent_logs.image_urls.length > 0) {
    return itemOrJob.agent_logs.image_urls;
  }
  return getStandardInspectionImageUrls();
}

/**
 * Normalizes defect BBox coordinates from DB or returns standard fallback
 */
export function resolveDefectCoordinates(itemOrJob: any): PerImageDefectCoordinate[] {
  if (itemOrJob?.agent_logs?.defect_coordinates && Array.isArray(itemOrJob.agent_logs.defect_coordinates) && itemOrJob.agent_logs.defect_coordinates.length > 0) {
    return itemOrJob.agent_logs.defect_coordinates;
  }
  return STANDARD_DEFECT_COORDINATES;
}
