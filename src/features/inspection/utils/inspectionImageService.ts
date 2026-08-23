import { API_BASE_URL } from '@/shared/api/api-client';
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
  /** HITL 관리자가 오탐으로 제외한 결함. 확정 결과 오버레이에서 빠진다. */
  hitl_excluded?: boolean;
  /** HITL 관리자가 직접 추가한 결함. */
  hitl_added?: boolean;
  /** HITL 관리자가 YOLO 후보를 채택한 결함. */
  hitl_adopted?: boolean;
  /** HITL 관리자가 좌표를 수정한 결함. */
  hitl_bbox_edited?: boolean;
  /** 감점 반영 범위. 'excluded'면 AI 증거 대조 검증이 오탐 지목해 감점 0 처리된 결함. */
  deduction_scope?: string;
  /** AI 증거 대조 검증(크롭 건별 심사)이 오탐으로 지목한 결함. */
  evidence_suspect?: boolean;
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
 *
 * **HITL 관리자가 오탐으로 제외한 결함(`hitl_excluded`)은 제외한다.** 이 화면이 보여줄
 * 것은 검수의 **최종 확정 결과**이지 AI의 1차 판독이 아니다. 사람이 "결함 아님"이라고
 * 판정한 박스를 그대로 그리면 확정 등급·감점과 화면이 어긋난다.
 * 제외분은 삭제하지 않고 `resolveExcludedDefectCoordinates()`로 따로 꺼내 쓴다 —
 * 판정 근거를 남겨야 감사 추적이 된다.
 */
export function resolveDefectCoordinates(itemOrJob: any): PerImageDefectCoordinate[] {
  return collectDefectCoordinates(itemOrJob, false);
}

/** HITL 관리자가 오탐으로 제외한 BBox만 반환한다 (대조 표시용). */
export function resolveExcludedDefectCoordinates(itemOrJob: any): PerImageDefectCoordinate[] {
  return collectDefectCoordinates(itemOrJob, true);
}

function collectDefectCoordinates(
  itemOrJob: any,
  wantExcluded: boolean,
): PerImageDefectCoordinate[] {
  const logs = itemOrJob?.agent_logs ?? {};
  // "제외" = 감점에 반영되지 않은 결함. 두 경로가 있다:
  //  1) HITL 관리자가 오탐 판정 (hitl_excluded)
  //  2) AI 증거 대조 검증이 오탐 지목 (deduction_scope='excluded', applied_deduction=0)
  // 종전에는 1)만 걸러서, AI가 감점 제외한 박스까지 "확정 결함"으로 세고 그렸다
  // (실측: UBCI 40점 = 확정 6건 감점인데 화면은 "확정 결함 23건" 표기).
  const isExcluded = (b: any) =>
    Boolean(b?.hitl_excluded) || b?.deduction_scope === 'excluded';
  const keep = (b: any) => isExcluded(b) === wantExcluded;

  const normalized = logs.defect_coordinates;
  if (Array.isArray(normalized) && normalized.length > 0) {
    return (normalized as PerImageDefectCoordinate[])
      .map((entry) => ({ ...entry, bboxes: (entry.bboxes || []).filter(keep) }))
      .filter((entry) => entry.bboxes.length > 0);
  }

  const all = logs.defects ?? itemOrJob?.defects;
  const defects = Array.isArray(all) ? all.filter(keep) : [];
  if (defects.length === 0) return [];

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
      // HITL 편집 표식을 그대로 옮긴다. 화면이 "AI 판독"과 "관리자 확정"을 구분해
      // 표기하려면 이 정보가 박스까지 따라와야 한다.
      hitl_excluded: d.hitl_excluded,
      hitl_added: d.hitl_added,
      hitl_adopted: d.hitl_adopted,
      hitl_bbox_edited: d.hitl_bbox_edited,
      // AI 증거 대조 검증의 감점 제외 표식도 박스까지 따라와야 필터가 동작한다.
      deduction_scope: d.deduction_scope,
      evidence_suspect: d.evidence_suspect,
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
