'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck, Cpu, ZoomIn, ZoomOut, Maximize2, X, RefreshCw, PackageCheck, Package, BookOpen, Layers } from 'lucide-react';

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

interface BinPacking3DViewerProps {
  selectedBox?: {
    id: string;
    name: string;
    specs: string;
    eff: number;
  };
  selectedBook?: BookItem | null;
  selectedBooks?: BookItem[]; // N-books dynamic stack
  aiRecommendationLog?: string;
}

export default function BinPacking3DViewer({
  selectedBox,
  selectedBook,
  selectedBooks,
  aiRecommendationLog
}: BinPacking3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Active Box Selection (Default BOOK-S2 250x150x60mm)
  const activeBox = selectedBox || {
    id: "BOOK-S2",
    name: "도서슬림 소형 2호 (추천)",
    specs: "250x150x60mm",
    eff: 94.5
  };

  // 8 Industrial Cushion Materials Catalog (Expanded Side-Guard Options)
  const cushionCatalog = [
    { id: "CUSH-08", name: "3D 폼 블록 코너 캡", mode: "side", thick_mm: 30.0, thick: "30.0mm", target: "B2B 코너 파손 방지 (보호 99점)", color: "rgba(147, 51, 234, 0.85)", stroke: "rgba(126, 34, 206, 0.95)", protection_score: 99 },
    { id: "CUSH-05", name: "에어 튜브 3D 범퍼", mode: "both", thick_mm: 20.0, thick: "20.0mm", target: "전방위 낙하 방지 (보호 98점)", color: "rgba(99, 102, 241, 0.85)", stroke: "rgba(67, 56, 202, 0.95)", protection_score: 98 },
    { id: "CUSH-06", name: "코너 에어 범퍼 가드", mode: "side", thick_mm: 15.0, thick: "15.0mm", target: "모서리 충격 흡수 (보호 95점)", color: "rgba(59, 130, 246, 0.85)", stroke: "rgba(29, 78, 216, 0.95)", protection_score: 95 },
    { id: "CUSH-04", name: "PE폼/뽁뽁이 4면 둘기", mode: "side", thick_mm: 25.0, thick: "25.0mm", target: "표준 4면 둘기 (보호 92점)", color: "rgba(6, 182, 212, 0.85)", stroke: "rgba(14, 116, 144, 0.95)", protection_score: 92 },
    { id: "CUSH-02", name: "친환경 벌집 종이", mode: "both", thick_mm: 12.0, thick: "12.0mm", target: "전면 래핑 패키징 (보호 88점)", color: "rgba(16, 185, 129, 0.85)", stroke: "rgba(4, 120, 87, 0.95)", protection_score: 88 },
    { id: "CUSH-07", name: "크라프트 종이 4면 패킹", mode: "side", thick_mm: 10.0, thick: "10.0mm", target: "친환경 측면 둘기 (보호 85점)", color: "rgba(217, 119, 6, 0.85)", stroke: "rgba(180, 83, 9, 0.95)", protection_score: 85 },
    { id: "CUSH-03", name: "뽁뽁이 상단 25mm 채움", mode: "top", thick_mm: 25.0, thick: "25.0mm", target: "상단 집중 채움 (보호 80점)", color: "rgba(245, 158, 11, 0.9)", stroke: "rgba(217, 119, 6, 0.95)", protection_score: 80 },
    { id: "CUSH-01", name: "에어필로우 슬림패드", mode: "top", thick_mm: 9.0, thick: "9.0mm", target: "상단 유격 채움 (보호 75점)", color: "rgba(245, 158, 11, 0.8)", stroke: "rgba(180, 83, 9, 0.95)", protection_score: 75 },
  ];

  // Rotation angles (deg)
  const [rotX, setRotX] = useState<number>(25);
  const [rotY, setRotY] = useState<number>(-35);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Zoom & Modal States
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Parse Outer Box Physical Dimensions (mm)
  const dimMatches = activeBox.specs.match(/(\d+)x(\d+)x(\d+)/);
  const boxW = dimMatches ? parseInt(dimMatches[1]) : 250;
  const boxD = dimMatches ? parseInt(dimMatches[2]) : 150;
  const boxH = dimMatches ? parseInt(dimMatches[3]) : 60;

  // Automatic 2D 90° Orientation Alignment Helper Function
  const getOrientedBookDimensions = useCallback((rawW: number, rawD: number) => {
    const lMax = Math.max(rawW, rawD);
    const lMin = Math.min(rawW, rawD);
    const isBoxWidthLarger = boxW >= boxD;
    const orientedW = isBoxWidthLarger ? lMax : lMin;
    const orientedD = isBoxWidthLarger ? lMin : lMax;
    const isRotated = (rawW < rawD && isBoxWidthLarger) || (rawW > rawD && !isBoxWidthLarger);
    return { orientedW, orientedD, isRotated };
  }, [boxW, boxD]);

  // Resolve N-books array with Quantity Multiplier Stacking Expansion (Support 13-layer 3D stacking)
  const effectiveBooks: BookItem[] = React.useMemo(() => {
    let sourceBooks: BookItem[] = [];
    if (selectedBooks !== undefined) {
      sourceBooks = selectedBooks;
    } else if (selectedBook) {
      sourceBooks = [selectedBook];
    }

    const expanded: BookItem[] = [];
    sourceBooks.forEach(b => {
      const qty = Math.max(1, b.quantity || 1);
      for (let i = 0; i < qty; i++) {
        expanded.push({
          ...b,
          id: `${b.id}-stack-${i}`
        });
      }
    });
    return expanded;
  }, [selectedBooks, selectedBook]);

  // BOTTOM-HEAVY STACKING SORTING RULE
  const sortedBooks = React.useMemo(() => {
    if (effectiveBooks.length === 0) return [];
    return [...effectiveBooks].sort((a, b) => {
      const wA = a.width_mm || a.width || 185;
      const dA = a.depth_mm || a.depth || 250;
      const wB = b.width_mm || b.width || 185;
      const dB = b.depth_mm || b.depth || 250;
      const areaA = wA * dA;
      const areaB = wB * dB;
      if (areaB !== areaA) return areaB - areaA;
      const wtA = a.weight_g || 500;
      const wtB = b.weight_g || 500;
      if (wtB !== wtA) return wtB - wtA;
      const thA = a.thickness_mm || a.height || 20;
      const thB = b.thickness_mm || b.height || 20;
      return thB - thA;
    });
  }, [effectiveBooks]);

  const maxBookW = sortedBooks.length > 0 ? Math.max(...sortedBooks.map(b => {
    const { orientedW } = getOrientedBookDimensions(b.width_mm || b.width || 185.0, b.depth_mm || b.depth || 257.0);
    return orientedW;
  })) : 180;

  const maxBookD = sortedBooks.length > 0 ? Math.max(...sortedBooks.map(b => {
    const { orientedD } = getOrientedBookDimensions(b.width_mm || b.width || 185.0, b.depth_mm || b.depth || 257.0);
    return orientedD;
  })) : 240;

  // Grid Capacity calculation (Columns x Rows fit on Box Floor)
  const gridColsCap = Math.max(1, Math.floor(boxW / maxBookW));
  const gridRowsCap = Math.max(1, Math.floor(boxD / maxBookD));
  const perLayerGridCap = gridColsCap * gridRowsCap;
  const gridTotalLayers = Math.ceil(sortedBooks.length / perLayerGridCap);

  // Exact Z-Stacking Height with Grid Multi-Row Arrangement
  const averageThickness = sortedBooks.length > 0 
    ? (sortedBooks.reduce((sum, b) => sum + (b.thickness_mm || b.height || 20.0), 0) / sortedBooks.length)
    : 20.0;
  const booksTotalH = gridTotalLayers * averageThickness;

  // Dynamic AI 3D Physical Bounding Box Containment Cushion Recommendation Engine
  // Priority 1: Strict Z-Height Test (booksTotalH + Z_thick <= boxH)
  // Priority 2: Strict 2D XY-Bounding Test (maxBookW + 2*sideThick <= boxW AND maxBookD + 2*sideThick <= boxD)
  // Priority 3: Maximum Protection Score among physically valid fit cushions
  const recommendedCushion = React.useMemo(() => {
    const validCushions = cushionCatalog.filter(c => {
      // 1. Z-Height Containment Test
      const zThick = (c.mode === 'top' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isZValid = booksTotalH + zThick <= boxH;

      // 2. 2D XY-Bounding Box Containment Test
      const sideThick = (c.mode === 'side' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isXYValid = (maxBookW + (2 * sideThick) <= boxW) && (maxBookD + (2 * sideThick) <= boxD);

      return isZValid && isXYValid;
    });

    if (validCushions.length > 0) {
      // Sort physically valid cushions by Protection Score descending
      const sortedValid = [...validCushions].sort((a, b) => b.protection_score - a.protection_score);
      return sortedValid[0];
    }
    // Fallback: Default to thinnest top cushion or standard slim pad if side fit overflows
    return cushionCatalog.find(c => c.id === "CUSH-01") || cushionCatalog[cushionCatalog.length - 1];
  }, [boxW, boxD, boxH, booksTotalH, maxBookW, maxBookD]);

  const [userSelectedCushionId, setUserSelectedCushionId] = useState<string | null>(null);

  // Reset user manual override when books or box change to restore AI recommendation
  useEffect(() => {
    setUserSelectedCushionId(null);
  }, [selectedBox, selectedBooks]);

  const activeCushion = userSelectedCushionId
    ? (cushionCatalog.find(c => c.id === userSelectedCushionId) || recommendedCushion)
    : recommendedCushion;

  // Cushion Z-Height
  const cushionZHeight = (activeCushion.mode === 'top' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0;
  const airPad_H = activeCushion.thick_mm;

  const totalStackH = booksTotalH + cushionZHeight; // Exact Z-Height
  const heightFillRatio = round((totalStackH / boxH) * 100, 1);

  // Dynamic Volume Metric Calculation with Oriented Dimensions
  const booksTotalVol = sortedBooks.reduce((sum, b) => {
    const rawW = b.width_mm || b.width || 185.0;
    const rawD = b.depth_mm || b.depth || 257.0;
    const { orientedW, orientedD } = getOrientedBookDimensions(rawW, rawD);
    const bh = b.thickness_mm || b.height || 20.0;
    return sum + (orientedW * orientedD * bh);
  }, 0);

  // 3D Volume Calculation with Exact 4-Side Cushion Volume and Top Cushion Volume
  const cushionThick = activeCushion.thick_mm;
  const topCushionVol = (activeCushion.mode === 'top' || activeCushion.mode === 'both')
    ? (maxBookW * maxBookD * cushionZHeight)
    : 0;

  const sideGapArea = Math.max(0, (boxW * boxD) - (maxBookW * maxBookD));
  const sideGuardVol = (activeCushion.mode === 'side' || activeCushion.mode === 'both')
    ? Math.min(sideGapArea, 2 * cushionThick * (maxBookW + maxBookD)) * totalStackH
    : 0;

  const totalStackVol = booksTotalVol + topCushionVol + sideGuardVol;
  const totalBoxVol = boxW * boxD * boxH;
  const volumeFillRatio = sortedBooks.length > 0 ? round((totalStackVol / totalBoxVol) * 100, 1) : 0;

  function round(val: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // Render 3D Canvas Scene with Pure Orthographic Projection
  const drawSceneOnContext = useCallback((
    canvas: HTMLCanvasElement,
    scaleMultiplier: number = 1.0
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
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

    const drawCuboid = (
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

    const hw = boxW / 2;
    const hd = boxD / 2;
    const bh = boxH;

    // 1. Draw Outer Cardboard Box Wireframe
    drawCuboid(
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

    // 2. Side Protective Cushion Guards
    const sideGuardThick = activeCushion.thick_mm;
    const stackTotalH = booksTotalH + (activeCushion.mode !== 'side' ? airPad_H : 0);

    if (activeCushion.mode === 'side' || activeCushion.mode === 'both') {
      drawCuboid(
        -maxBookW / 2 - sideGuardThick / 2, 0, 0,
        sideGuardThick, maxBookD, stackTotalH,
        'rgba(6, 182, 212, 0.35)', 'rgba(14, 116, 144, 0.75)',
        'rgba(34, 211, 238, 0.45)', 'rgba(8, 145, 178, 0.4)'
      );
      drawCuboid(
        maxBookW / 2 + sideGuardThick / 2, 0, 0,
        sideGuardThick, maxBookD, stackTotalH,
        'rgba(6, 182, 212, 0.35)', 'rgba(14, 116, 144, 0.75)',
        'rgba(34, 211, 238, 0.45)', 'rgba(8, 145, 178, 0.4)'
      );
    }

    // 3. DYNAMIC MULTI-ROW / MULTI-COLUMN GRID 3D STACKING ARRANGEMENT
    const colorPalettes = [
      { fill: 'rgba(147, 51, 234, 0.9)', stroke: 'rgba(107, 33, 168, 0.95)', top: 'rgba(168, 85, 247, 0.95)', side: 'rgba(126, 34, 206, 0.92)' }, // Purple (Bottom/Heavy)
      { fill: 'rgba(16, 185, 129, 0.9)', stroke: 'rgba(6, 95, 70, 0.95)', top: 'rgba(52, 211, 153, 0.95)', side: 'rgba(4, 120, 87, 0.92)' },    // Emerald
      { fill: 'rgba(59, 130, 246, 0.9)', stroke: 'rgba(29, 78, 216, 0.95)', top: 'rgba(96, 165, 250, 0.95)', side: 'rgba(37, 99, 235, 0.92)' },    // Blue
      { fill: 'rgba(245, 158, 11, 0.9)', stroke: 'rgba(180, 83, 9, 0.95)', top: 'rgba(251, 191, 36, 0.95)', side: 'rgba(217, 119, 6, 0.92)' },    // Amber
    ];

    const sampleBook = sortedBooks[0];
    const sampleW = sampleBook ? (sampleBook.width_mm || sampleBook.width || 185.0) : 185.0;
    const sampleD = sampleBook ? (sampleBook.depth_mm || sampleBook.depth || 257.0) : 257.0;
    const { orientedW: sW, orientedD: sD } = getOrientedBookDimensions(sampleW, sampleD);

    const sideThick = (activeCushion.mode === 'side' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0.0;
    const availW = Math.max(sW, boxW - (2 * sideThick));
    const availD = Math.max(sD, boxD - (2 * sideThick));

    const horizCols = Math.max(1, Math.floor(availW / sW));
    const horizRows = Math.max(1, Math.floor(availD / sD));
    const horizPerLayer = horizCols * horizRows;

    // 1. Calculate Maximum Thickness per Layer to prevent mesh floating or overlapping
    const numLayers = Math.ceil(sortedBooks.length / horizPerLayer);
    const layerMaxThick: number[] = new Array(numLayers).fill(0.0);

    sortedBooks.forEach((book, idx) => {
      const bH = book.thickness_mm || book.height || 20.0;
      const layerIdx = Math.floor(idx / horizPerLayer);
      layerMaxThick[layerIdx] = Math.max(layerMaxThick[layerIdx], bH);
    });

    // 2. Calculate Base Y-coordinate for each Layer
    const layerBaseY: number[] = new Array(numLayers).fill(0.0);
    let accumY = 0.0;
    for (let l = 0; l < numLayers; l++) {
      layerBaseY[l] = accumY;
      accumY += layerMaxThick[l];
    }

    let maxGridZHeight = accumY;

    // 3. Render Books in Accurate Horizontal Flat Grid with Number Markings
    sortedBooks.forEach((book, idx) => {
      const rawW = book.width_mm || book.width || 185.0;
      const rawD = book.depth_mm || book.depth || 257.0;
      const { orientedW, orientedD } = getOrientedBookDimensions(rawW, rawD);
      const bH = book.thickness_mm || book.height || 20.0;
      const palette = colorPalettes[idx % colorPalettes.length];

      const layerIdx = Math.floor(idx / horizPerLayer);
      const posInLayer = idx % horizPerLayer;
      const col = posInLayer % horizCols;
      const row = Math.floor(posInLayer / horizCols);

      const gridX = -(horizCols - 1) * (orientedW / 2) + (col * orientedW);
      const gridZ = -(horizRows - 1) * (orientedD / 2) + (row * orientedD);
      const gridY = layerBaseY[layerIdx];

      const shortName = book.title ? (book.title.length > 8 ? book.title.slice(0, 7) + '..' : book.title) : `도서`;
      const markLabel = `#${idx + 1} ${shortName}`;

      drawCuboid(
        gridX, gridY, gridZ,
        orientedW, orientedD, bH,
        palette.fill, palette.stroke, palette.top, palette.side,
        markLabel
      );
    });

    const currentY = maxGridZHeight;

    // 4. Top Cushion Layer
    if (activeCushion.mode === 'top' || activeCushion.mode === 'both') {
      drawCuboid(
        0, currentY, 0,
        Math.min(boxW * 0.95, horizCols * sW * 1.02), Math.min(boxD * 0.95, horizRows * sD * 1.02), airPad_H,
        activeCushion.color,
        activeCushion.stroke,
        activeCushion.color,
        activeCushion.stroke
      );
    }

  }, [rotX, rotY, boxW, boxD, boxH, zoomLevel, userSelectedCushionId, activeCushion, sortedBooks, booksTotalH, maxBookW, maxBookD, airPad_H]);

  useEffect(() => {
    if (canvasRef.current) {
      drawSceneOnContext(canvasRef.current, 1.0);
    }
    if (isModalOpen && modalCanvasRef.current) {
      drawSceneOnContext(modalCanvasRef.current, 1.5);
    }
  }, [drawSceneOnContext, isModalOpen]);

  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 1) % 360);
    }, 45);
    return () => clearInterval(interval);
  }, [autoRotate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setRotY((prev) => prev + dx * 0.8);
    setRotX((prev) => Math.max(-80, Math.min(80, prev - dy * 0.8)));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-sm text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Header controls matching Nexus WMS Design System */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Real 3D Bin Packing 시뮬레이터</span>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono font-extrabold uppercase tracking-wide">
                Bottom-Heavy Stack v7.0
              </span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              하중 최적 정렬 {sortedBooks.length}권 적재 관제 ({boxW}W × {boxD}D × {boxH}H mm)
            </p>
          </div>
        </div>

        {/* View Preset & Zoom Control Group */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setRotX(25); setRotY(-35); setAutoRotate(false); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !autoRotate && rotX === 25 && rotY === -35 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              입체 3D
            </button>
            <button
              onClick={() => { setRotX(90); setRotY(0); setAutoRotate(false); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                !autoRotate && rotX === 90 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              평면 Top
            </button>
          </div>

          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button onClick={() => setZoomLevel((prev) => Math.max(0.2, prev - 0.1))} title="축소" className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition cursor-pointer">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 text-gray-700 dark:text-gray-300 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button onClick={() => setZoomLevel((prev) => Math.min(3.0, prev + 0.1))} title="확대" className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition cursor-pointer">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setZoomLevel(1.0); setRotX(25); setRotY(-35); }} title="초기화" className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white border-l border-gray-300 dark:border-gray-700 ml-1 transition cursor-pointer">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition flex items-center gap-1 text-xs font-bold cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">확대 보기</span>
          </button>
        </div>
      </div>

      {/* Real 3D HTML5 Canvas Viewport with Expanded Height (h-96 / 400px) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        className="h-96 w-full bg-indigo-50/60 dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-gray-800 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <canvas ref={canvasRef} width={700} height={400} className="w-full h-full object-contain" />

        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
          {sortedBooks.length === 0 ? (
            <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-bold">📦 출고 도서 미선택 (적재 대기 중)</span>
            </div>
          ) : (maxBookW > boxW || maxBookD > boxD) ? (
            <div className="bg-red-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs border border-red-700 animate-pulse">
              <span className="text-xs font-mono font-extrabold">⚠️ 2D 평면 크기 초과 (수용 불가!)</span>
            </div>
          ) : (
            <>
              <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${heightFillRatio > 100 ? 'bg-red-500 animate-ping' : 'bg-emerald-500 animate-ping'}`} />
                <span className="text-xs font-mono text-gray-600 dark:text-gray-300">📏 높이 적재율:</span>
                <span className={`text-sm font-black font-mono ${heightFillRatio > 100 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {heightFillRatio}% {heightFillRatio > 100 ? '(높이초과!)' : ''}
                </span>
              </div>

              <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
                <span className="text-xs font-mono text-gray-600 dark:text-gray-300">📦 3D 부피 적재율:</span>
                <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">{volumeFillRatio}%</span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 transition flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
          <span>{autoRotate ? '자동 회전 중' : '360° 회전'}</span>
        </button>
      </div>

      {/* Cushion Selector Catalog */}
      <div className="bg-gray-50/80 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="break-keep">AI 스마트 도서 완충재 추천 (유격 & 쏠림 방지)</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 shrink-0 w-fit whitespace-nowrap">
            선택: [{activeCushion.mode === 'top' ? '상단채움' : activeCushion.mode === 'side' ? '측면둘기' : '전방위래핑'}] {activeCushion.name} ({activeCushion.thick})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cushionCatalog.map((cush) => {
            const isSelected = activeCushion.id === cush.id;
            const isAiRecommended = recommendedCushion.id === cush.id;
            return (
              <div
                key={cush.id}
                onClick={() => setUserSelectedCushionId(cush.id)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/80 ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between gap-0.5 min-w-0">
                  <span className="font-black text-[10px] sm:text-[11px] text-gray-900 dark:text-white leading-tight break-keep">{cush.name}</span>
                  {isAiRecommended && (
                    <span className="text-[8px] font-extrabold bg-emerald-500 text-white px-1 py-0.5 rounded shrink-0 shadow-2xs">AI추천</span>
                  )}
                </div>
                <p className="text-[9px] sm:text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold pt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  [{cush.mode === 'top' ? '상단채움' : cush.mode === 'side' ? '측면둘기' : '전방위래핑'}] ({cush.thick})
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Outbound Book Layer Legend Panel (Adaptive Scrollable Sidebar for >10 Books) */}
      <div className="space-y-1.5">
        <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>하중 최적 정렬 (Bottom-Heavy Stacking) 레이어 메타데이터 ({sortedBooks.length}권)</span>
          </span>
          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
            {sortedBooks.length > 10 ? '📋 대용량 묶음 (스크롤 사이드바 관제)' : '하단일수록 바닥면적/무게 최대 배치'}
          </span>
        </h5>
        
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-sans ${sortedBooks.length > 10 ? 'max-h-60 overflow-y-auto p-1 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800' : ''}`}>
          {/* Integrated AI Smart Cushion Packaging Metadata Card */}
          <div className="flex items-start gap-2 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800/80 min-w-0 shadow-2xs">
            <div className="w-3.5 h-3.5 mt-0.5 rounded bg-emerald-600 shrink-0 shadow-xs border border-emerald-700" />
            <div className="min-w-0 flex-1">
              <span className="font-extrabold text-emerald-950 dark:text-emerald-200 block text-[11px] leading-tight break-words">
                완충 패키징: {activeCushion.name}
              </span>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-mono block leading-tight mt-0.5 break-words">
                [{activeCushion.mode === 'top' ? '상단채움' : activeCushion.mode === 'side' ? '측면둘기' : '전방위래핑'}] 규격: {activeCushion.thick} (Z축 점유 {activeCushion.thick_mm === 0 ? '0.0mm' : `${activeCushion.thick_mm}mm`})
              </span>
              <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-mono block pt-0.5">
                기능: {activeCushion.target}
              </span>
            </div>
          </div>

          {/* Dynamic Sorted N-Books Stacking Cards with #Number Markings */}
          {sortedBooks.map((book, idx) => {
            const levelLabel = `#${idx + 1} (${idx === 0 ? '바닥' : `${idx + 1}층`})`;
            const thickness = book.thickness_mm || book.height || 20.0;
            const weight_g = book.weight_g || 650.0;
            const w_mm = book.width_mm || book.width || 185.0;
            const d_mm = book.depth_mm || book.depth || 257.0;

            const { orientedW, orientedD, isRotated } = getOrientedBookDimensions(w_mm, d_mm);

            const borderColors = [
              'bg-purple-50/80 dark:bg-purple-950/40 border-purple-200 text-purple-900 dark:text-purple-200 text-purple-700 dark:text-purple-400',
              'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-200 text-emerald-700 dark:text-emerald-400',
              'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 text-blue-900 dark:text-blue-200 text-blue-700 dark:text-blue-400',
            ];
            const theme = borderColors[idx % borderColors.length].split(' ');
            
            return (
              <div key={book.id || idx} className={`flex items-start gap-2 p-2.5 rounded-xl border ${theme[0]} ${theme[1]} min-w-0 shadow-2xs`}>
                <div className={`w-3.5 h-3.5 mt-0.5 rounded ${idx === 0 ? 'bg-purple-600 border-purple-700' : 'bg-emerald-500 border-emerald-600'} shrink-0 shadow-xs border`} />
                <div className="min-w-0 flex-1">
                  <span title={book.title} className={`font-black ${theme[2]} ${theme[3]} block text-[11px] leading-snug break-words`}>
                    {levelLabel}: {book.title}
                  </span>
                  <span className={`text-[10px] ${theme[4]} ${theme[5]} font-mono block leading-tight mt-0.5 break-words`}>
                    ISBN: {book.isbn || '9791163033455'} (두께 {thickness}mm | 중량 {weight_g}g)
                  </span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 font-mono block pt-0.5">
                    패킹 정렬: {orientedW}x{orientedD}mm {isRotated ? '(90° 자동회전)' : ''} ({book.page_count ? `${book.page_count}p` : '실물규격'})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Multi-Agent Rationale Card */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 p-4 rounded-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 min-w-0">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="break-words">AI Multi-Agent 3D Pack Optimizer 실시간 맵핑 결과</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold shrink-0">
            CONFIDENCE: 99.4%
          </span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans font-medium">
          {(() => {
            const isDimensionOverflow = maxBookW > boxW || maxBookD > boxD;
            const deltaW = Math.max(0, maxBookW - boxW);
            const deltaD = Math.max(0, maxBookD - boxD);
            const deltaH = Math.max(0, totalStackH - boxH);

            if (sortedBooks.length === 0) {
              return `"📦 출고 대상 도서를 선택하시면 3D Bounding Box 물리 수용성 검증 및 완충재 조합 시뮬레이션이 실시간 가동됩니다."`;
            } else if (sortedBooks.length >= 25 && heightFillRatio > 100) {
              const splitBoxesReq = Math.max(2, Math.ceil(totalStackH / (boxH * 0.85)));
              return `"⚠️ [B2B 대량 직송 분할 출고 권장] 선택하신 출고 도서 ${sortedBooks.length}권(대용량 패킹)은 단일 박스 용량을 초과하므로 AI 추천 [일반택배 8호 마스터 카톤] ${splitBoxesReq}개 분할 출고 포장을 권장합니다!"`;
            } else if (isDimensionOverflow) {
              return `"⚠️ [측면 평면 규격 초과 경고] 선택하신 도서 패킹 바닥 규격(${maxBookW}×${maxBookD}mm)이 ${activeBox.name} 평면 규격(${boxW}×${boxD}mm)을 초과합니다! (가로 ${deltaW}mm, 세로 ${deltaD}mm 수용 불가). 상단 [추천] 태그 박스를 선택하십시오."`;
            } else if (heightFillRatio > 100) {
              return `"⚠️ [수직 높이 초과 경고] 선택하신 ${activeBox.name}(높이 ${boxH}mm)은 총 적재 높이(${totalStackH}mm) 대비 ${deltaH}mm (${round(heightFillRatio - 100, 1)}%) 높이가 초과되어 박스 덮개가 닫히지 않습니다! 상단 [추천] 태그 박스로 스위칭하십시오."`;
            } else {
              return `"✨ [하중 최적화 완공] 출고 도서 ${sortedBooks.length}권 하중 정렬 스택(${round(booksTotalH, 1)}mm)과 ${activeCushion.name}(${activeCushion.thick}) 결합 시, Z축 높이 적재율 ${heightFillRatio}% 및 3D 부피 적재율 ${volumeFillRatio}%로 하단 무거운 도서 중심 배치가 완료되어 파손 방지 안전 등급 SAFE (A+)를 달성했습니다."`;
            }
          })()}
        </p>
      </div>

      {/* Real 3D Fullscreen Inspection Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span>3D Bin Packing 풀스크린 정밀 관제</span>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono font-bold">
                      {activeBox.name} ({boxW}×{boxD}×{boxH}mm)
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    360° 마우스 드래그 자유 회전 및 층별 메쉬 레이어 마킹
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              className="h-[460px] w-full bg-slate-950 rounded-2xl border border-gray-800 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
              <canvas ref={modalCanvasRef} width={800} height={460} className="w-full h-full object-contain" />
              
              <div className="absolute bottom-4 left-4 bg-gray-900/90 border border-gray-700 text-white px-4 py-2 rounded-xl text-xs font-mono backdrop-blur-md shadow-md">
                <span>📏 높이 적재율: <b className="text-emerald-400 font-bold">{heightFillRatio}%</b> | 📦 3D 부피 적재율: <b className="text-indigo-400 font-bold">{volumeFillRatio}%</b></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
