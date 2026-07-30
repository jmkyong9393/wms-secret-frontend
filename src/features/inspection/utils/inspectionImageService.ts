/**
 * Single Source of Truth Service for WMS Inspection Images & BBox Coordinates
 * Supports dynamic N-image counts (Front, Back, + Problematic sides/pages)
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

export const BASE_IMAGE_HOST = "http://localhost:8000";

/**
 * Normalizes inspection image URLs from DB or constructs dynamic N-image array per book
 */
export function resolveInspectionImages(itemOrJob: any): string[] {
  if (itemOrJob?.image_urls && Array.isArray(itemOrJob.image_urls) && itemOrJob.image_urls.length > 0) {
    return itemOrJob.image_urls;
  }
  if (itemOrJob?.agent_logs?.image_urls && Array.isArray(itemOrJob.agent_logs.image_urls) && itemOrJob.agent_logs.image_urls.length > 0) {
    return itemOrJob.agent_logs.image_urls;
  }
  
  // Book cover URL extraction
  const coverUrl = itemOrJob?.book?.cover_image_url || itemOrJob?.cover_image_url || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400";
  
  // Construct dynamic 3~4 image set (0: Front Cover, 1: Back Cover, 2: Page Stain/Side, 3: Corner/Page)
  return [
    coverUrl,
    coverUrl,
    `${BASE_IMAGE_HOST}/experiment_data/job-0c2929a0/raw_3.jpg`,
    `${BASE_IMAGE_HOST}/experiment_data/job-0c2929a0/raw_4.jpg`
  ];
}

/**
 * Normalizes defect BBox coordinates from DB or generates score-aware dynamic BBoxes
 */
export function resolveDefectCoordinates(itemOrJob: any): PerImageDefectCoordinate[] {
  if (itemOrJob?.agent_logs?.defect_coordinates && Array.isArray(itemOrJob.agent_logs.defect_coordinates) && itemOrJob.agent_logs.defect_coordinates.length > 0) {
    return itemOrJob.agent_logs.defect_coordinates;
  }

  const score = itemOrJob?.ubci_score !== undefined && itemOrJob?.ubci_score !== null ? itemOrJob.ubci_score : 85;

  // Score >= 90 (MINT / High GOOD): Minimal defect or clean
  if (score >= 90) {
    return [
      {
        image_index: 0,
        bboxes: [
          {
            xmin: 520, ymin: 160, xmax: 600, ymax: 240,
            label: "DMG_EXT_CRUSH (전면 표지 우상단 미세 모서리 눌림)",
            type: "DMG_EXT_CRUSH",
            confidence: 0.965
          }
        ]
      }
    ];
  }

  // Score < 90 (GOOD / NORMAL): Dynamic page defect coordinates
  return [
    {
      image_index: 0,
      bboxes: [
        {
          xmin: 520, ymin: 160, xmax: 600, ymax: 240,
          label: "DMG_EXT_CRUSH (표지 우상단 모서리 마모)",
          type: "DMG_EXT_CRUSH",
          confidence: 0.955
        }
      ]
    },
    {
      image_index: 2,
      bboxes: [
        {
          xmin: 420, ymin: 360, xmax: 540, ymax: 400,
          label: "DMG_INT_DOODLE (내지 손글씨/필기 흔적)",
          type: "DMG_INT_DOODLE",
          confidence: 0.982
        }
      ]
    }
  ];
}
