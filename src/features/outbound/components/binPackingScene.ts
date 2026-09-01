/**
 * 3D Bin Packing 캔버스 렌더러와 완충재 카탈로그 (BinPacking3DViewer에서 분리, 2026-09-01).
 *
 * renderPackingScene은 순수 그리기 함수다 - React 상태를 읽지 않고 params로만 받아
 * 캔버스에 정사영 큐보이드 씬을 그린다. 본문은 뷰어의 drawSceneOnContext에서
 * 무수정 이동했다(파라미터 구조분해만 추가).
 */

export interface BookItem {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  listPrice?: number;
  category?: string;
  width?: number;        // mm (Width)
  depth?: number;        // mm (Depth)
  height?: number;       // mm (Thickness)
  width_mm?: number;
  depth_mm?: number;
  thickness_mm?: number;
  weight_g?: number;     // g (Weight)
  page_count?: number;
  quantity?: number;     // Quantity multiplier for 3D stacking
}

// 8 Industrial Cushion Materials Catalog (See-Through Translucent Glass Packaging)
export const cushionCatalog = [
  { id: "CUSH-08", name: "3D 폼 블록 코너 캡", mode: "side", thick_mm: 30.0, thick: "30.0mm", target: "B2B 코너 파손 방지 (보호 99점)", color: "rgba(147, 51, 234, 0.25)", stroke: "rgba(126, 34, 206, 0.95)", protection_score: 99 },
  { id: "CUSH-05", name: "에어 튜브 3D 범퍼", mode: "both", thick_mm: 20.0, thick: "20.0mm", target: "전방위 낙하 방지 (보호 98점)", color: "rgba(99, 102, 241, 0.25)", stroke: "rgba(67, 56, 202, 0.95)", protection_score: 98 },
  { id: "CUSH-06", name: "코너 에어 범퍼 가드", mode: "side", thick_mm: 15.0, thick: "15.0mm", target: "모서리 충격 흡수 (보호 95점)", color: "rgba(59, 130, 246, 0.25)", stroke: "rgba(29, 78, 216, 0.95)", protection_score: 95 },
  { id: "CUSH-04", name: "PE폼/뽁뽁이 4면 측면 래핑", mode: "side", thick_mm: 25.0, thick: "25.0mm", target: "표준 4면 측면 래핑 (보호 92점)", color: "rgba(6, 182, 212, 0.25)", stroke: "rgba(14, 116, 144, 0.95)", protection_score: 92 },
  { id: "CUSH-02", name: "친환경 벌집 종이", mode: "both", thick_mm: 12.0, thick: "12.0mm", target: "전방위 3D 래핑 패키징 (보호 88점)", color: "rgba(16, 185, 129, 0.25)", stroke: "rgba(4, 120, 87, 0.95)", protection_score: 88 },
  { id: "CUSH-07", name: "크라프트 종이 4면 패킹", mode: "side", thick_mm: 10.0, thick: "10.0mm", target: "친환경 4면 측면 래핑 (보호 85점)", color: "rgba(217, 119, 6, 0.25)", stroke: "rgba(180, 83, 9, 0.95)", protection_score: 85 },
  { id: "CUSH-03", name: "뽁뽁이 상단 25mm 채움", mode: "top", thick_mm: 25.0, thick: "25.0mm", target: "상단 완충 패딩 (보호 80점)", color: "rgba(245, 158, 11, 0.28)", stroke: "rgba(217, 119, 6, 0.95)", protection_score: 80 },
  { id: "CUSH-01", name: "에어필로우 슬림패드", mode: "top", thick_mm: 9.0, thick: "9.0mm", target: "상단 완충 패딩 (보호 75점)", color: "rgba(245, 158, 11, 0.25)", stroke: "rgba(180, 83, 9, 0.95)", protection_score: 75 },
];

export type CushionSpec = (typeof cushionCatalog)[number];

export interface PackingSceneParams {
  rotX: number;
  rotY: number;
  boxW: number;
  boxD: number;
  boxH: number;
  zoomLevel: number;
  activeCushion: CushionSpec;
  sortedBooks: BookItem[];
  airPad_H: number;
  showCutaway: boolean;
  cushionGhostMode: boolean;
}

export function renderPackingScene(
  canvas: HTMLCanvasElement,
  scaleMultiplier: number,
  params: PackingSceneParams,
) {
  const { rotX, rotY, boxW, boxD, boxH, zoomLevel, activeCushion, sortedBooks, airPad_H, showCutaway, cushionGhostMode } = params;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Retina/HiDPI 선명도 보정: 논리 해상도는 유지하고 물리 픽셀만 devicePixelRatio 배율로 확장
  if (!canvas.dataset.logicalW) {
    canvas.dataset.logicalW = String(canvas.width);
    canvas.dataset.logicalH = String(canvas.height);
  }
  const width = Number(canvas.dataset.logicalW);
  const height = Number(canvas.dataset.logicalH);
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2 + (scaleMultiplier > 1.2 ? 20 : 10);

  const mmToPixel = (width < 600 ? 0.75 : 0.85) * zoomLevel * scaleMultiplier;

  const radX = (rotX * Math.PI) / 180;
  const radY = (rotY * Math.PI) / 180;

  // Pure Orthographic Projection Formula to guarantee PERFECT 1:1 Parallel Cuboid Rendering (0% Distortion)
  const project = (x: number, y: number, z: number) => {
    const x1 = x * Math.cos(radY) + z * Math.sin(radY);
    const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

    const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
    const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

    return {
      px: cx + x1 * mmToPixel,
      py: cy - y2 * mmToPixel,
      depth: z2
    };
  };

  // Painter's Algorithm 렌더 큐: 원거리(depth 큰) 큐보이드부터 그려 전후 가림 왜곡 제거
  const cuboidQueue: { depth: number; render: () => void }[] = [];

  const renderCuboidNow = (
    origX: number, origY: number, origZ: number,
    w: number, d: number, h: number,
    fillColor: string, strokeColor: string,
    topColor: string, sideColor: string,
    labelText?: string
  ) => {
    const hw = w / 2;
    const hd = d / 2;
    
    const v = [
      project(origX - hw, origY, origZ - hd),     // 0
      project(origX + hw, origY, origZ - hd),     // 1
      project(origX + hw, origY, origZ + hd),     // 2
      project(origX - hw, origY, origZ + hd),     // 3
      project(origX - hw, origY + h, origZ - hd), // 4
      project(origX + hw, origY + h, origZ - hd), // 5
      project(origX + hw, origY + h, origZ + hd), // 6
      project(origX - hw, origY + h, origZ + hd), // 7
    ];

    const drawFace = (indices: number[], style: string) => {
      ctx.beginPath();
      ctx.moveTo(v[indices[0]].px, v[indices[0]].py);
      for (let i = 1; i < indices.length; i++) {
        ctx.lineTo(v[indices[i]].px, v[indices[i]].py);
      }
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawFace([0, 1, 2, 3], sideColor);
    drawFace([3, 2, 6, 7], sideColor);
    drawFace([0, 3, 7, 4], sideColor);
    drawFace([1, 2, 6, 5], sideColor);
    drawFace([0, 1, 5, 4], fillColor);
    drawFace([4, 5, 6, 7], topColor);

    // Book Number & Title Label Marking on 3D Mesh Top & Front Side Face (No Block Visibility)
    if (labelText) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Top Face Marking
      const topCenterX = (v[4].px + v[6].px) / 2;
      const topCenterY = (v[4].py + v[6].py) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(labelText, topCenterX + 1, topCenterY + 1);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, topCenterX, topCenterY);

      // 2. Front Side Face Marking (Visible even when stacked vertically!)
      const frontCenterX = (v[0].px + v[1].px + v[5].px + v[4].px) / 4;
      const frontCenterY = (v[0].py + v[1].py + v[5].py + v[4].py) / 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(labelText, frontCenterX + 1, frontCenterY + 1);
      ctx.fillStyle = '#FFD700'; // Gold accent for front side visibility
      ctx.fillText(labelText, frontCenterX, frontCenterY);
    }
  };

  // 큐 적재용 drawCuboid: 중심점 투영 depth 기준으로 렌더 순서를 지연 결정
  const drawCuboid = (
    origX: number, origY: number, origZ: number,
    w: number, d: number, h: number,
    fillColor: string, strokeColor: string,
    topColor: string, sideColor: string,
    labelText?: string
  ) => {
    const center = project(origX, origY + h / 2, origZ);
    cuboidQueue.push({
      depth: center.depth,
      render: () => renderCuboidNow(origX, origY, origZ, w, d, h, fillColor, strokeColor, topColor, sideColor, labelText),
    });
  };

  const flushCuboidQueue = () => {
    cuboidQueue.sort((a, b) => b.depth - a.depth); // 원거리 우선 렌더
    cuboidQueue.forEach(q => q.render());
    cuboidQueue.length = 0;
  };

  const hw = boxW / 2;
  const hd = boxD / 2;
  const bh = boxH;

  // 1. Draw Outer Cardboard Box Wireframe (반투명 배경 컨테이너 — 큐 미적용 즉시 렌더)
  renderCuboidNow(
    0, 0, 0,
    boxW, boxD, bh,
    'rgba(79, 70, 229, 0.04)',
    'rgba(79, 70, 229, 0.85)',
    'rgba(99, 102, 241, 0.06)',
    'rgba(67, 56, 202, 0.06)'
  );

  // Draw Open Flaps
  const frontBackFlapLen = hd;
  const leftRightFlapLen = hw;
  const flapAng = Math.PI / 4;

  const topV4 = project(-hw, bh, -hd);
  const topV5 = project(hw, bh, -hd);
  const topV6 = project(hw, bh, hd);
  const topV7 = project(-hw, bh, hd);

  const flapFront1 = project(-hw, bh + frontBackFlapLen * Math.sin(flapAng), -hd - frontBackFlapLen * Math.cos(flapAng));
  const flapFront2 = project(hw, bh + frontBackFlapLen * Math.sin(flapAng), -hd - frontBackFlapLen * Math.cos(flapAng));
  ctx.beginPath();
  ctx.moveTo(topV4.px, topV4.py);
  ctx.lineTo(topV5.px, topV5.py);
  ctx.lineTo(flapFront2.px, flapFront2.py);
  ctx.lineTo(flapFront1.px, flapFront1.py);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(79, 70, 229, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const flapRight1 = project(hw + leftRightFlapLen * Math.cos(flapAng), bh + leftRightFlapLen * Math.sin(flapAng), -hd);
  const flapRight2 = project(hw + leftRightFlapLen * Math.cos(flapAng), bh + leftRightFlapLen * Math.sin(flapAng), hd);
  ctx.beginPath();
  ctx.moveTo(topV5.px, topV5.py);
  ctx.lineTo(topV6.px, topV6.py);
  ctx.lineTo(flapRight2.px, flapRight2.py);
  ctx.lineTo(flapRight1.px, flapRight1.py);
  ctx.closePath();
  ctx.fillStyle = 'rgba(79, 70, 229, 0.12)';
  ctx.fill();
  ctx.stroke();

  const flapBack1 = project(hw, bh + frontBackFlapLen * Math.sin(flapAng), hd + frontBackFlapLen * Math.cos(flapAng));
  const flapBack2 = project(-hw, bh + frontBackFlapLen * Math.sin(flapAng), hd + frontBackFlapLen * Math.cos(flapAng));
  ctx.beginPath();
  ctx.moveTo(topV6.px, topV6.py);
  ctx.lineTo(topV7.px, topV7.py);
  ctx.lineTo(flapBack2.px, flapBack2.py);
  ctx.lineTo(flapBack1.px, flapBack1.py);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
  ctx.fill();
  ctx.stroke();

  const flapLeft1 = project(-hw - leftRightFlapLen * Math.cos(flapAng), bh + leftRightFlapLen * Math.sin(flapAng), hd);
  const flapLeft2 = project(-hw - leftRightFlapLen * Math.cos(flapAng), bh + leftRightFlapLen * Math.sin(flapAng), -hd);
  ctx.beginPath();
  ctx.moveTo(topV7.px, topV7.py);
  ctx.lineTo(topV4.px, topV4.py);
  ctx.lineTo(flapLeft2.px, flapLeft2.py);
  ctx.lineTo(flapLeft1.px, flapLeft1.py);
  ctx.closePath();
  ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
  ctx.fill();
  ctx.stroke();

  // 2. DYNAMIC MULTI-ROW / MULTI-COLUMN GRID 3D STACKING ARRANGEMENT
  const colorPalettes = [
    { fill: 'rgba(147, 51, 234, 0.9)', stroke: 'rgba(107, 33, 168, 0.95)', top: 'rgba(168, 85, 247, 0.95)', side: 'rgba(126, 34, 206, 0.92)' }, // Purple (Bottom/Heavy)
    { fill: 'rgba(16, 185, 129, 0.9)', stroke: 'rgba(6, 95, 70, 0.95)', top: 'rgba(52, 211, 153, 0.95)', side: 'rgba(4, 120, 87, 0.92)' },    // Emerald
    { fill: 'rgba(59, 130, 246, 0.9)', stroke: 'rgba(29, 78, 216, 0.95)', top: 'rgba(96, 165, 250, 0.95)', side: 'rgba(37, 99, 235, 0.92)' },    // Blue
    { fill: 'rgba(245, 158, 11, 0.9)', stroke: 'rgba(180, 83, 9, 0.95)', top: 'rgba(251, 191, 36, 0.95)', side: 'rgba(217, 119, 6, 0.92)' },    // Amber
  ];

  const sampleBook = sortedBooks[0];
  const rawSampleW = sampleBook ? (sampleBook.width_mm || sampleBook.width || 185.0) : 185.0;
  const rawSampleD = sampleBook ? (sampleBook.depth_mm || sampleBook.depth || 257.0) : 257.0;

  const sideThick = (activeCushion.mode === 'side' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0.0;
  const innerBoxW = Math.max(10, boxW - (2 * sideThick));
  const innerBoxD = Math.max(10, boxD - (2 * sideThick));

  // Smart Box-Fit 90° Orientation Check: Test both 0° normal placement vs 90° rotated placement
  const fitsNormal = (rawSampleW <= innerBoxW) && (rawSampleD <= innerBoxD);
  const fitsRotated = (rawSampleD <= innerBoxW) && (rawSampleW <= innerBoxD);

  const colsNormal = Math.max(1, Math.floor(innerBoxW / rawSampleW));
  const rowsNormal = Math.max(1, Math.floor(innerBoxD / rawSampleD));
  const perLayerNormal = colsNormal * rowsNormal;

  const colsRotated = Math.max(1, Math.floor(innerBoxW / rawSampleD));
  const rowsRotated = Math.max(1, Math.floor(innerBoxD / rawSampleW));
  const perLayerRotated = colsRotated * rowsRotated;

  // Pick 90° rotation if 90° fits inside box while 0° overflows, or if perLayerRotated is superior!
  let shouldRotate90 = false;
  if (fitsRotated && !fitsNormal) {
    shouldRotate90 = true; // Essential 90° rotation to fit inside box dimensions!
  } else if (perLayerRotated > perLayerNormal) {
    shouldRotate90 = true;
  } else if (!fitsNormal && (rawSampleD > innerBoxD)) {
    shouldRotate90 = true;
  }

  const horizCols = shouldRotate90 ? colsRotated : colsNormal;
  const horizRows = shouldRotate90 ? rowsRotated : rowsNormal;
  

  const orientedBookW = shouldRotate90 ? rawSampleD : rawSampleW;
  const orientedBookD = shouldRotate90 ? rawSampleW : rawSampleD;

  const sW = orientedBookW;
  const sD = orientedBookD;

  // Independent Column/Row Z-Height Accumulator for Zero-Overlap Multi-Column Grid Stacking
  const colRowAccumY = new Array(horizCols).fill(0).map(() => new Array(horizRows).fill(0.0));
  let overallMaxZHeight = 0.0;

  // Render Books in Height-Balanced Multi-Column Flat Grid with Number Markings
  sortedBooks.forEach((book, idx) => {
    const bH = book.thickness_mm || book.height || 20.0;
    const palette = colorPalettes[idx % colorPalettes.length];

    // Greedy Minimum-Height Column/Row Selection for Perfect Level Height Balance
    let targetCol = 0;
    let targetRow = 0;
    let minAccumH = Infinity;

    for (let c = 0; c < horizCols; c++) {
      for (let r = 0; r < horizRows; r++) {
        if (colRowAccumY[c][r] < minAccumH) {
          minAccumH = colRowAccumY[c][r];
          targetCol = c;
          targetRow = r;
        }
      }
    }

    const col = targetCol;
    const row = targetRow;

    // Calculate X and Z-Depth Grid Center Offsets accurately within Inner Box Space
    const startX = -((horizCols - 1) * orientedBookW) / 2;
    const startZ = -((horizRows - 1) * orientedBookD) / 2;

    const gridX = horizCols === 1 ? 0 : (startX + col * orientedBookW);
    const gridZ = horizRows === 1 ? 0 : (startZ + row * orientedBookD);
    const gridY = colRowAccumY[col][row];

    // Advance height for this specific column/row stack
    colRowAccumY[col][row] += bH;
    overallMaxZHeight = Math.max(overallMaxZHeight, colRowAccumY[col][row]);

    const shortName = book.title ? (book.title.length > 8 ? book.title.slice(0, 7) + '..' : book.title) : `도서`;
    const markLabel = `#${idx + 1} ${shortName}`;

    drawCuboid(
      gridX, gridY, gridZ,
      orientedBookW, orientedBookD, bH,
      palette.fill, palette.stroke, palette.top, palette.side,
      markLabel
    );
  });

  const stackTotalH = Math.max(20, overallMaxZHeight);
  const sideGuardThick = activeCushion.thick_mm;
  const stackBoundingW = Math.min(Math.max(20, boxW - 2 * sideGuardThick), horizCols * sW);
  const stackBoundingD = Math.min(Math.max(20, boxD - 2 * sideGuardThick), horizRows * sD);

  // 3. Render Full 4-Sides Protective Side Wrapping Cushions with Cutaway & See-Through Translucent Modes

  // See-Through Glass Opacity: Ultra-transparent (0.10) when showCutaway is TRUE so back/side books are 100% visible
  const cColor = showCutaway
    ? 'rgba(147, 51, 234, 0.10)' 
    : (cushionGhostMode ? 'rgba(99, 102, 241, 0.15)' : activeCushion.color);
  const cStroke = showCutaway
    ? 'rgba(126, 34, 206, 0.5)'
    : (cushionGhostMode ? 'rgba(79, 70, 229, 0.4)' : activeCushion.stroke);

  if (activeCushion.mode === 'side' || activeCushion.mode === 'both') {
    // Left Side Cushion Guard (Always Visible with Ultra-translucent glass fill)
    drawCuboid(
      -stackBoundingW / 2 - sideGuardThick / 2, 0, 0,
      sideGuardThick, stackBoundingD + 2 * sideGuardThick, stackTotalH,
      cColor, cStroke, cColor, cStroke,
      showCutaway ? '' : `좌측 래핑 (${sideGuardThick}mm)`
    );

    // Back Side Cushion Guard (Always Visible with Ultra-translucent glass fill)
    drawCuboid(
      0, 0, -stackBoundingD / 2 - sideGuardThick / 2,
      stackBoundingW, sideGuardThick, stackTotalH,
      cColor, cStroke, cColor, cStroke,
      showCutaway ? '' : `후면 래핑 (${sideGuardThick}mm)`
    );

    // Right & Front Side Cushion Guards (Hidden when showCutaway is TRUE for Clear Unobstructed Book Stack View)
    if (!showCutaway) {
      // Right Side Cushion Guard
      drawCuboid(
        stackBoundingW / 2 + sideGuardThick / 2, 0, 0,
        sideGuardThick, stackBoundingD + 2 * sideGuardThick, stackTotalH,
        cColor, cStroke, cColor, cStroke,
        `우측 래핑 (${sideGuardThick}mm)`
      );
      // Front Side Cushion Guard
      drawCuboid(
        0, 0, stackBoundingD / 2 + sideGuardThick / 2,
        stackBoundingW, sideGuardThick, stackTotalH,
        cColor, cStroke, cColor, cStroke,
        `전면 래핑 (${sideGuardThick}mm)`
      );
    }
  }

  // 4. Render Top Protective Cushion Layer (See-through when cutaway is active)
  if (activeCushion.mode === 'top' || activeCushion.mode === 'both') {
    const topColor = showCutaway ? 'rgba(245, 158, 11, 0.08)' : cColor;
    const topStroke = showCutaway ? 'rgba(217, 119, 6, 0.4)' : cStroke;
    drawCuboid(
      0, stackTotalH, 0,
      stackBoundingW + 2 * (activeCushion.mode === 'both' ? sideGuardThick : 0),
      stackBoundingD + 2 * (activeCushion.mode === 'both' ? sideGuardThick : 0),
      airPad_H,
      topColor, topStroke, topColor, topStroke,
      showCutaway ? '' : `상단 완충패딩 (${airPad_H}mm)`
    );
  }

  // 5. Painter's Algorithm 일괄 플러시: 도서/완충재 큐보이드를 depth 내림차순 렌더
  flushCuboidQueue();

}
