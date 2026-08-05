import { API_BASE_URL } from '@/lib/api-client';
/**
 * WMS 검수 이미지 / BBox 좌표 단일 소스(Single Source of Truth) 서비스
 *
 * /admin/inspections, /worker/inspections, /admin/inventory/[id], /admin/hitl, /lpn/[lpn],
 * /certificate/[lpn] 에서 공통으로 사용한다.
 *
 * [설계 원칙 - 목업 금지]
 * 이 모듈은 어떤 경우에도 이미지 URL이나 BBox 좌표를 "지어내지" 않는다.
 * 데이터가 없으면 빈 배열을 반환하고, 화면이 빈 상태를 정직하게 표시하도록 한다.
 *
 * [수정 이력]
 * 1) 예전 resolveInspectionImages()는 DB 이미지가 없으면 Unsplash 스톡 사진 4장을 검수
 *    이미지인 척 반환했다. 실제 검수 사진이 아닌 이미지가 "검수 촬영 이미지"로 표시됐다.
 * 2) 예전 resolveDefectCoordinates()는 agent_logs.defect_coordinates를 찾았지만, 백엔드는
 *    agent_logs.defects[] 평면 배열만 저장해 키/구조가 전혀 달라 조회에 100% 실패했다.
 *    그 결과 항상 하드코딩 폴백으로 떨어져, UBCI 100점 MINT 도서에도 존재하지 않는
 *    "표지 우상단 모서리 눌림" BBox가 그려졌다. 이제 백엔드가 defect_coordinates를
 *    정규화해 내려주며, 여기서는 그것과 defects[] 원본만 읽는다.
 */

export interface BBoxItem {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  label: string;
  type?: string;
  confidence?: number;
  deduction?: number;
  /** 좌표계 기준값. Vision Agent는 0~1000 상대좌표를 산출한다. */
  coord_space?: number;
}

export interface PerImageDefectCoordinate {
  image_index: number;
  image_url?: string;
  bboxes: BBoxItem[];
}

/** 백엔드 StaticFiles 마운트(/experiment_data) 호스트. CloudFront URL이 없는 레거시 건 폴백용. */
export const BASE_IMAGE_HOST =
  process.env.NEXT_PUBLIC_API_BASE_URL || `${API_BASE_URL}`;

/**
 * DB에 적재된 이미지 경로를 브라우저가 실제로 열 수 있는 URL로 정규화한다.
 * 신규 건은 백엔드가 이미 CloudFront URL을 내려주므로 그대로 통과한다.
 * 레거시 컨테이너 절대경로(/app/app/experiment_data/...)만 StaticFiles URL로 환원한다.
 */
export function normalizeImageUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const posix = url.replace(/\\/g, '/');
  const marker = 'experiment_data';
  if (posix.includes(marker)) {
    const tail = posix.split(marker)[1].replace(/^\/+/, '');
    return `${BASE_IMAGE_HOST}/${marker}/${tail}`;
  }

  return url.startsWith('/') ? `${BASE_IMAGE_HOST}${url}` : `${BASE_IMAGE_HOST}/${url}`;
}

/**
 * 검수 촬영 이미지 목록을 반환한다. 실제 촬영본이 없으면 빈 배열.
 * (표지 이미지는 검수 사진이 아니므로 여기서 대체물로 끼워넣지 않는다.)
 */
export function resolveInspectionImages(itemOrJob: any): string[] {
  const raw = itemOrJob?.image_urls ?? itemOrJob?.images ?? [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((u: string) => normalizeImageUrl(u))
    .filter((u: string | null): u is string => Boolean(u));
}

/**
 * 이미지별 결함 BBox 좌표를 반환한다.
 *
 * 1순위: 백엔드가 정규화해 내려준 agent_logs.defect_coordinates
 * 2순위: agent_logs.defects[] 평면 배열을 image_index 기준으로 직접 묶음
 *        (백엔드 재검수 전의 과거 데이터 호환)
 * 데이터가 없으면 빈 배열 - 절대 좌표를 생성하지 않는다.
 */
export function resolveDefectCoordinates(itemOrJob: any): PerImageDefectCoordinate[] {
  const logs = itemOrJob?.agent_logs ?? {};

  const normalized = logs.defect_coordinates;
  if (Array.isArray(normalized) && normalized.length > 0) {
    return normalized as PerImageDefectCoordinate[];
  }

  const defects = logs.defects ?? itemOrJob?.defects;
  if (!Array.isArray(defects) || defects.length === 0) return [];

  const grouped = new Map<number, PerImageDefectCoordinate>();
  for (const d of defects) {
    const box = d?.bbox;
    // BBox 좌표가 없는 결함은 그릴 수 없다. 임의 좌표를 만들지 않고 건너뛴다.
    if (!box || typeof box !== 'object') continue;

    const idx = Number(d.image_index ?? 0);
    if (!grouped.has(idx)) {
      grouped.set(idx, { image_index: idx, bboxes: [] });
    }
    grouped.get(idx)!.bboxes.push({
      xmin: box.xmin,
      ymin: box.ymin,
      xmax: box.xmax,
      ymax: box.ymax,
      coord_space: 1000,
      type: d.type,
      label: d.label ?? d.type ?? '상태 결함',
      confidence: d.confidence,
      deduction: d.preliminary_deduction,
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.image_index - b.image_index);
}

/**
 * BBox 좌표를 CSS 퍼센트 값으로 변환한다.
 *
 * [수정 이력] 예전 상세페이지는 좌표계를 값 크기로 추측했다
 * (`box.xmin > 1 ? 1000 : box.xmin > 0.01 ? 1 : 100`). xmin이 0인 결함은 스케일이
 * 100으로 잘못 잡히는 등 좌표가 어긋났다. 이제 백엔드가 coord_space를 명시해 내려주므로
 * 추측하지 않는다.
 */
export function bboxToPercent(box: BBoxItem) {
  const scale = box.coord_space && box.coord_space > 0 ? box.coord_space : 1000;

  const left = Math.max(0, Math.min(100, (Number(box.xmin) / scale) * 100));
  const top = Math.max(0, Math.min(100, (Number(box.ymin) / scale) * 100));
  const width = Math.max(0.5, Math.min(100 - left, ((Number(box.xmax) - Number(box.xmin)) / scale) * 100));
  const height = Math.max(0.5, Math.min(100 - top, ((Number(box.ymax) - Number(box.ymin)) / scale) * 100));

  return { left, top, width, height };
}

/**
 * 결함이 가장 심한(감점 합계가 큰) 이미지의 인덱스를 반환한다.
 * 결함이 하나도 없으면 0(첫 촬영본)을 반환한다.
 * 고객 보증서의 "AI 실물 검수 및 결함 판독 내역"이 대표 사진을 고를 때 사용한다.
 */
export function pickRepresentativeImageIndex(itemOrJob: any): number {
  const coords = resolveDefectCoordinates(itemOrJob);
  if (coords.length === 0) return 0;

  let bestIdx = coords[0].image_index;
  let bestScore = -1;

  for (const c of coords) {
    // 감점 합계를 우선 기준으로, 감점 정보가 없으면 결함 개수로 대체한다.
    const score = c.bboxes.reduce((sum, b) => sum + (Number(b.deduction) || 1), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = c.image_index;
    }
  }
  return bestIdx;
}
