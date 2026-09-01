'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, Cpu, ZoomIn, ZoomOut, Maximize2, X, RefreshCw, Package, BookOpen, Layers, Eye } from 'lucide-react';
import { BookItem, cushionCatalog, renderPackingScene } from './binPackingScene';

// BookItem은 binPackingScene으로 이동 - 기존 임포트 경로 호환을 위해 재수출
export type { BookItem } from './binPackingScene';

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


  // Rotation angles (deg)
  const [rotX, setRotX] = useState<number>(25);
  const [rotY, setRotY] = useState<number>(-35);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Zoom, Modal & Cutaway Inspect States
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showCutaway, setShowCutaway] = useState<boolean>(false); // Front & Right Cushion Cutaway Inspect Mode
  const [cushionGhostMode] = useState<boolean>(false); // Semi-transparent Ghost Cushion Mode

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

  const minBookDim = Math.min(maxBookW, maxBookD);
  const maxBookDim = Math.max(maxBookW, maxBookD);

  const [userSelectedCushionId, setUserSelectedCushionId] = useState<string | null>(null);

  // Helper: Calculate actual physical Z-stacking height for a specific cushion option
  const getStackHeightForCushion = useCallback((cush: typeof cushionCatalog[0]) => {
    const sThick = (cush.mode === 'side' || cush.mode === 'both') ? cush.thick_mm : 0.0;
    const zThick = (cush.mode === 'top' || cush.mode === 'both') ? cush.thick_mm : 0.0;

    const inW = Math.max(10, boxW - (2 * sThick));
    const inD = Math.max(10, boxD - (2 * sThick));

    const c0 = Math.max(1, Math.floor(inW / Math.max(1, minBookDim))) * Math.max(1, Math.floor(inD / Math.max(1, maxBookDim)));
    const c90 = Math.max(1, Math.floor(inW / Math.max(1, maxBookDim))) * Math.max(1, Math.floor(inD / Math.max(1, minBookDim)));
    const cap = Math.max(1, Math.max(c0, c90));

    const colH = new Array(cap).fill(0.0);
    sortedBooks.forEach((b, idx) => {
      const pos = idx % cap;
      colH[pos] += (b.thickness_mm || b.height || 20.0);
    });

    const maxColH = sortedBooks.length > 0 ? Math.max(...colH) : 0.0;
    return maxColH + zThick;
  }, [boxW, boxD, minBookDim, maxBookDim, sortedBooks]);

  // Dynamic AI Cushion Recommendation Engine: Exclude cushions that cause height overflow or 1-col stacking overflow!
  const recommendedCushion = React.useMemo(() => {
    const validCushions = cushionCatalog.filter(c => {
      const totalH = getStackHeightForCushion(c);
      const isZValid = totalH <= boxH;

      const sThick = (c.mode === 'side' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isXYValid = (maxBookW + (2 * sThick) <= boxW) && (maxBookD + (2 * sThick) <= boxD);

      return isZValid && isXYValid;
    });

    if (validCushions.length > 0) {
      const sortedValid = [...validCushions].sort((a, b) => b.protection_score - a.protection_score);
      return sortedValid[0];
    }
    // Fallback: Default to thinnest top cushion or standard slim pad if side fit overflows
    return cushionCatalog.find(c => c.id === "CUSH-01") || cushionCatalog[cushionCatalog.length - 1];
  }, [boxW, boxD, boxH, maxBookW, maxBookD, getStackHeightForCushion]);

  // Reset user manual override when books or box change to restore AI recommendation.
  // 객체 참조가 아닌 내용 키로 비교한다 — 부모가 렌더마다 selectedBooks 배열을 새로
  // 만들어 넘기므로, 참조 비교로 두면 무관한 리렌더(박스 카테고리 탭 전환 등)에도
  // 완충재 수동 선택이 초기화된다.
  const selectedBoxId = selectedBox?.id;
  const booksContentKey = (selectedBooks ?? []).map(b => `${b.id}:${(b as { quantity?: number }).quantity ?? 1}`).join('|');
  const cushionResetKey = `${selectedBoxId}|${booksContentKey}`;
  const [appliedCushionResetKey, setAppliedCushionResetKey] = useState(cushionResetKey);
  if (cushionResetKey !== appliedCushionResetKey) {
    setAppliedCushionResetKey(cushionResetKey);
    setUserSelectedCushionId(null);
  }

  const activeCushion = userSelectedCushionId
    ? (cushionCatalog.find(c => c.id === userSelectedCushionId) || recommendedCushion)
    : recommendedCushion;

  // Active Cushion Side Thickness & True Inner Space Calculation
  const sideThick = (activeCushion.mode === 'side' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0.0;
  const innerBoxW = Math.max(10, boxW - (2 * sideThick));
  const innerBoxD = Math.max(10, boxD - (2 * sideThick));

  // Dynamic Layer Grid Capacity based on TRUE INNER SPACE (innerBoxW & innerBoxD)
  const cap0Deg = Math.max(1, Math.floor(innerBoxW / Math.max(1, minBookDim))) * Math.max(1, Math.floor(innerBoxD / Math.max(1, maxBookDim)));
  const cap90Deg = Math.max(1, Math.floor(innerBoxW / Math.max(1, maxBookDim))) * Math.max(1, Math.floor(innerBoxD / Math.max(1, minBookDim)));
  const perLayerGridCap = Math.max(1, Math.max(cap0Deg, cap90Deg));

  // Column/Row Z-Height Accumulator dynamically recalculated for 1-col vs multi-col stacking!
  const columnZHeights = React.useMemo(() => {
    const colHeights = new Array(perLayerGridCap).fill(0.0);
    sortedBooks.forEach((b, idx) => {
      const posInLayer = idx % perLayerGridCap;
      const thickness = b.thickness_mm || b.height || 20.0;
      colHeights[posInLayer] += thickness;
    });
    return colHeights;
  }, [sortedBooks, perLayerGridCap]);

  const maxColumnZHeight = sortedBooks.length > 0 ? Math.max(...columnZHeights) : 0.0;
  const booksTotalH = maxColumnZHeight;

  // Cushion Z-Height & AirPad Height Alias
  const cushionZHeight = (activeCushion.mode === 'top' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0;
  const airPad_H = activeCushion.thick_mm;

  // Physical Maximum Z-Height Fill Ratio (Calculated based on the TRUE inner-space stack height)
  const totalStackH = booksTotalH + cushionZHeight;
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

  // ESG Environmental Over-Packaging Diagnosis Engine (User Directive)
  const totalCushionVol = topCushionVol + sideGuardVol;
  const cushionVolRatio = totalBoxVol > 0 ? round((totalCushionVol / totalBoxVol) * 100, 1) : 0;
  const isOverpackaged = (cushionThick >= 25.0) || (cushionVolRatio >= 18.0) || (volumeFillRatio < 40.0 && cushionThick >= 20.0);

  // 물리 수용성 실측 검증 (하드코딩 신뢰도 수치 폐기 — 3중 제약 실계산 결과로 표기)
  const isFitVerified = sortedBooks.length > 0
    && heightFillRatio <= 100
    && maxBookW <= boxW
    && maxBookD <= boxD;

  function round(val: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // Render 3D Canvas Scene with Pure Orthographic Projection
  // 캔버스 렌더는 binPackingScene.renderPackingScene(순수 함수)이 담당한다
  const drawSceneOnContext = useCallback((canvas: HTMLCanvasElement, scaleMultiplier: number = 1.0) => {
    renderPackingScene(canvas, scaleMultiplier, {
      rotX, rotY, boxW, boxD, boxH, zoomLevel, activeCushion, sortedBooks, airPad_H, showCutaway, cushionGhostMode,
    });
  }, [rotX, rotY, boxW, boxD, boxH, zoomLevel, activeCushion, sortedBooks, airPad_H, showCutaway, cushionGhostMode]);

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
    // requestAnimationFrame 기반 시간 보정 회전 (약 22°/s — 기존 setInterval 속도 동일 유지)
    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setRotY((prev) => (prev + dt * 0.022) % 360);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
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

        {/* View Preset, Cutaway Inspect & Zoom Control Group */}
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* User Feature Directive: Cutaway Inspection Toggle Button (Removes Front & Right Cushions) */}
          <button
            onClick={() => setShowCutaway(!showCutaway)}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 border ${
              showCutaway 
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs animate-pulse' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
            }`}
            title={showCutaway ? '단면 투시 중 (전·우 완충 가드 제거됨) - 눌러서 4면 전체 보기' : '전면 및 우측 완충 가드를 제거하여 내부 도서 적재 단면 정밀 검증'}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            {/* 라벨 길이를 상태와 무관하게 고정한다 - 켤 때 "(전·우 제거됨)"이 붙으면
                툴바 폭이 늘어 "확대 보기"가 다음 줄로 밀렸다(1366px 실측). 상태는
                amber 배경+펄스가 이미 표시하고, 상세 설명은 title이 담당한다. */}
            <span className="whitespace-nowrap">{showCutaway ? '✂️ 단면 투시' : '👁️ 4면 전체'}</span>
          </button>

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

      {/* Real 3D HTML5 Canvas Viewport with Cool Indigo-Blue Tinted Light Background (h-96 / 400px) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        className="h-96 w-full bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-slate-100/70 dark:from-slate-900 dark:via-slate-900 dark:to-gray-900 rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-900/60 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
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

      {/* Cushion Selector Catalog & Over-Packaging Alert Banner */}
      <div className="bg-gray-50/80 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
        {/* User Directive: ESG Over-Packaging Risk Diagnostic Alert Banner */}
        {isOverpackaged && (
          <div className="bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-bold font-mono">
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] uppercase font-black animate-pulse">
                ⚠️ ESG 과대포장 경고
              </span>
              <span>완충재 부피 점유율 {cushionVolRatio}% ({cushionThick}mm 완충재 과다 적용 위험!)</span>
            </div>
            <button
              onClick={() => setUserSelectedCushionId("CUSH-01")}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white underline cursor-pointer font-mono"
            >
              👉 9mm 에어필로우 슬림패드로 과대포장 완화
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="break-keep">스마트 도서 완충재 추천 (유격 & 쏠림 방지)</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 shrink-0 w-fit whitespace-nowrap">
            선택: [{activeCushion.mode === 'top' ? '상단 완충' : activeCushion.mode === 'side' ? '4면 측면 래핑' : '전방위 3D 래핑'}] {activeCushion.name} ({activeCushion.thick})
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
                    <span className="text-[9px] font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shrink-0 shadow-2xs animate-pulse">추천</span>
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
            {/* 3D 뷰 색상 범례 점 — 사각형이면 체크박스로 오인되므로 원형 유지 */}
            <div className="w-2.5 h-2.5 mt-1 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
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
                <div className={`w-2.5 h-2.5 mt-1 rounded-full ${idx === 0 ? 'bg-purple-600' : 'bg-emerald-500'} shrink-0`} aria-hidden="true" />
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
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold shrink-0 ${
            sortedBooks.length === 0
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700'
              : isFitVerified
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
          }`}>
            {sortedBooks.length === 0
              ? 'FIT-CHECK: 대기'
              : isFitVerified
                ? `FIT-CHECK PASS (높이 ${heightFillRatio}% · 부피 ${volumeFillRatio}%)`
                : 'FIT-CHECK FAIL (물리 제약 초과)'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-5xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
            {/* Modal Header matching main card 100% */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Real 3D Bin Packing 시뮬레이터 (풀스크린 정밀 관제)
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>적용 피킹 정렬: {sortedBooks.length}권 적재 상세</span>
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                    ({boxW}W × {boxD}D × {boxH}H mm)
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                  title="풀스크린 관제 닫기"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 3D Viewport Controls Bar matching main card 100% (Light Mode White Theme) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-100 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white text-xs font-bold font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => { setRotX(25); setRotY(-35); setAutoRotate(false); }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-extrabold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5" /> 입체 3D
                </button>
                <button
                  onClick={() => { setRotX(85); setRotY(0); setAutoRotate(false); }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" /> 평면 Top
                </button>
                <button
                  onClick={() => { setRotX(5); setRotY(0); setAutoRotate(false); }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition flex items-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" /> 정면
                </button>
                <button
                  onClick={() => { setRotX(5); setRotY(90); setAutoRotate(false); }}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition flex items-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" /> 측면
                </button>
                {/* User Directive: Cutaway Inspection Toggle Button in Fullscreen Modal */}
                <button
                  onClick={() => setShowCutaway(!showCutaway)}
                  className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                    showCutaway 
                      ? 'bg-amber-500 text-white border-amber-600 font-bold shadow-xs' 
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                  title="전면 및 우측 완충 가드를 제거하여 내부 도서 적재 단면 정밀 검증"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> ✂️ 단면 투시 (전·우 제거)
                </button>
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                    autoRotate 
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold' 
                      : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} /> 
                  360° {autoRotate ? '회전' : '정지'}
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* 축소 - % - 확대 순서. 일반 뷰 툴바(§상단)와 배치를 맞춘다 */}
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
                  className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  title="축소 (Zoom Out)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))}
                  className="p-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  title="확대 (Zoom In)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setZoomLevel(1.0); setRotX(25); setRotY(-35); }}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 transition cursor-pointer ml-1"
                  title="시점/줌 리셋"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3D Canvas Drag Container matching main card 100% (Cool Indigo-Blue Tinted Light Theme) */}
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              className="h-[520px] w-full bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-slate-100/70 dark:from-slate-900 dark:via-slate-900 dark:to-gray-900 rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-900/60 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.06)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
              <canvas ref={modalCanvasRef} width={900} height={520} className="w-full h-full object-contain" />
              
              <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-xl text-xs font-mono backdrop-blur-md shadow-md flex items-center gap-3">
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  높이 적재율: <b className="text-emerald-600 dark:text-emerald-400 font-extrabold">{heightFillRatio}%</b>
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  3D 부피 적재율: <b className="text-indigo-600 dark:text-indigo-400 font-extrabold">{volumeFillRatio}%</b>
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-gray-500 dark:text-gray-400 font-bold">🖱️ 360° 마우스 드래그 회전 가능</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
              >
                관제 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
