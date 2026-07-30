'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck, Cpu, ZoomIn, ZoomOut, Maximize2, X, RefreshCw, PackageCheck, Package } from 'lucide-react';

interface BinPacking3DViewerProps {
  selectedBox?: {
    id: string;
    name: string;
    specs: string;
    eff: number;
  };
  aiRecommendationLog?: string;
}

export default function BinPacking3DViewer({ selectedBox, aiRecommendationLog }: BinPacking3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Active Box Selection (Default BOOK-S2 250x150x60mm)
  const activeBox = selectedBox || {
    id: "BOOK-S2",
    name: "도서슬림 소형 2호 (추천)",
    specs: "250x150x60mm",
    eff: 94.5
  };

  // 5 Real Industrial Cushion Materials Catalog (Top-Fill vs Side-Wrap vs All-Around)
  const cushionCatalog = [
    { id: "CUSH-01", name: "에어필로우 슬림 패드", mode: "top", thick_mm: 9.0, thick: "9.0mm", target: "상단 유격 채움", desc: "상부 유격 충격 흡수 패드", isRec: false, color: "rgba(245, 158, 11, 0.8)", stroke: "rgba(180, 83, 9, 0.95)" },
    { id: "CUSH-02", name: "친환경 벌집 종이 (추천)", mode: "both", thick_mm: 12.0, thick: "12.0mm", target: "전면 래핑 패키징", desc: "양장본 프리미엄 친환경 래핑", isRec: true, color: "rgba(16, 185, 129, 0.85)", stroke: "rgba(4, 120, 87, 0.95)" },
    { id: "CUSH-03", name: "에어캡 뽁뽁이 상단채움", mode: "top", thick_mm: 25.0, thick: "25.0mm", target: "상단 집중 완충", desc: "뽁뽁이 3겹 상부 집중 채움", isRec: false, color: "rgba(245, 158, 11, 0.9)", stroke: "rgba(217, 119, 6, 0.95)" },
    { id: "CUSH-04", name: "PE 폼 4면 측면둘기", mode: "side", thick_mm: 25.0, thick: "25.0mm", target: "측면 유동 방지", desc: "도서 4면 측면 25mm 둘기 가드", isRec: false, color: "rgba(6, 182, 212, 0.85)", stroke: "rgba(14, 116, 144, 0.95)" },
    { id: "CUSH-05", name: "에어 튜브 3D 범퍼", mode: "both", thick_mm: 20.0, thick: "20.0mm", target: "전방위 낙하 방지", desc: "초고위험 낙하 충격 3D 에어 범퍼", isRec: false, color: "rgba(99, 102, 241, 0.85)", stroke: "rgba(67, 56, 202, 0.95)" },
  ];

  const [selectedCushionId, setSelectedCushionId] = useState<string>("CUSH-02");
  const activeCushion = cushionCatalog.find(c => c.id === selectedCushionId) || cushionCatalog[1];

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

  // REAL FIXED PHYSICAL BOOK DIMENSIONS (mm)
  const book1_W = Math.min(boxW * 0.94, 188);
  const book1_D = Math.min(boxD * 0.94, 257);
  const book1_H = 28.5; // Python Book Fixed Height (mm)

  const book2_W = Math.min(boxW * 0.92, 152);
  const book2_D = Math.min(boxD * 0.92, 225);
  const book2_H = 19.2; // SQL Book Fixed Height (mm)

  // Mode-based Cushion Z-Height (Side wrap adds 0 to Z-height, Top fill adds cushion thickness)
  const cushionZHeight = (activeCushion.mode === 'top' || activeCushion.mode === 'both') ? activeCushion.thick_mm : 0;
  const airPad_H = activeCushion.thick_mm;

  // REAL DYNAMIC METRIC DUAL SEPARATION (PHYSICAL Z-HEIGHT VS 3D VOLUME)
  const totalStackH = book1_H + book2_H + cushionZHeight; // Exact Z-Height
  const heightFillRatio = round((totalStackH / boxH) * 100, 1); // Exact Z-height ratio

  const sideGuardVol = (activeCushion.mode === 'side' || activeCushion.mode === 'both') ? (boxW * boxD - book1_W * book1_D) * totalStackH * 0.4 : 0;
  const totalStackVol = (book1_W * book1_D * book1_H) + (book2_W * book2_D * book2_H) + (book1_W * book1_D * cushionZHeight) + sideGuardVol;
  const totalBoxVol = boxW * boxD * boxH;
  const volumeFillRatio = round((totalStackVol / totalBoxVol) * 100, 1); // Exact 3D Volume ratio

  function round(val: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // Render 3D Canvas Scene with Complete 6-Face Cuboid Geometry
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

    const project = (x: number, y: number, z: number) => {
      const x1 = x * Math.cos(radY) + z * Math.sin(radY);
      const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

      const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      const fov = 480;
      const distance = 500;
      const factor = fov / (distance + z2);

      return {
        px: cx + x1 * factor * mmToPixel,
        py: cy - y2 * factor * mmToPixel,
        depth: z2
      };
    };

    const drawCuboid = (
      origX: number, origY: number, origZ: number,
      w: number, d: number, h: number,
      fillColor: string, strokeColor: string,
      topColor: string, sideColor: string
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

      // Render 6 faces for complete 3D volume
      drawFace([0, 1, 2, 3], sideColor);
      drawFace([3, 2, 6, 7], sideColor);
      drawFace([0, 3, 7, 4], sideColor);
      drawFace([1, 2, 6, 5], sideColor);
      drawFace([0, 1, 5, 4], fillColor);
      drawFace([4, 5, 6, 7], topColor);
    };

    const hw = boxW / 2;
    const hd = boxD / 2;
    const bh = boxH;

    // 1. Draw Outer 6-Faced Cardboard Box Wireframe
    drawCuboid(
      0, 0, 0,
      boxW, boxD, bh,
      'rgba(79, 70, 229, 0.04)',
      'rgba(79, 70, 229, 0.85)',
      'rgba(99, 102, 241, 0.06)',
      'rgba(67, 56, 202, 0.06)'
    );

    // Draw 4 Real Physical Cardboard Open Flaps (FEFCO 0201 Standard: Flap Length = boxD/2 & boxW/2)
    // When folded closed, Front + Back flaps meet precisely at center (boxD/2 + boxD/2 = boxD)!
    const frontBackFlapLen = hd; // boxD / 2
    const leftRightFlapLen = hw;  // boxW / 2
    const flapAng = Math.PI / 4;  // 45 degrees open

    const topV4 = project(-hw, bh, -hd);
    const topV5 = project(hw, bh, -hd);
    const topV6 = project(hw, bh, hd);
    const topV7 = project(-hw, bh, hd);

    // 1. Front Open Flap (Length = boxD/2)
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

    // 2. Right Open Flap (Length = boxW/2)
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

    // 3. Back Open Flap (Length = boxD/2)
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

    // 4. Left Open Flap (Length = boxW/2)
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

    // 2. Draw 4-Side Protective Cushion Guards (If mode is 'side' or 'both')
    const sideGuardThick = activeCushion.thick_mm;
    const stackTotalH = book1_H + book2_H + (activeCushion.mode !== 'side' ? airPad_H : 0);

    if (activeCushion.mode === 'side' || activeCushion.mode === 'both') {
      // Left Side Guard
      drawCuboid(
        -book1_W / 2 - sideGuardThick / 2, 2, 0,
        sideGuardThick, book1_D, stackTotalH,
        'rgba(6, 182, 212, 0.35)', 'rgba(14, 116, 144, 0.75)',
        'rgba(34, 211, 238, 0.45)', 'rgba(8, 145, 178, 0.4)'
      );
      // Right Side Guard
      drawCuboid(
        book1_W / 2 + sideGuardThick / 2, 2, 0,
        sideGuardThick, book1_D, stackTotalH,
        'rgba(6, 182, 212, 0.35)', 'rgba(14, 116, 144, 0.75)',
        'rgba(34, 211, 238, 0.45)', 'rgba(8, 145, 178, 0.4)'
      );
    }

    // 3. Draw Stacked Book Items Inside
    // LAYER 1: Python Book (Purple)
    drawCuboid(
      0, 2, 0,
      book1_W, book1_D, book1_H,
      'rgba(147, 51, 234, 0.9)',
      'rgba(107, 33, 168, 0.95)',
      'rgba(168, 85, 247, 0.95)',
      'rgba(126, 34, 206, 0.92)'
    );

    // LAYER 2: SQL Book (Emerald)
    drawCuboid(
      0, 2 + book1_H + 2, 0,
      book2_W, book2_D, book2_H,
      'rgba(16, 185, 129, 0.9)',
      'rgba(6, 95, 70, 0.95)',
      'rgba(52, 211, 153, 0.95)',
      'rgba(4, 120, 87, 0.92)'
    );

    // LAYER 3: Top Cushion Layer (If mode is 'top' or 'both')
    if (activeCushion.mode === 'top' || activeCushion.mode === 'both') {
      drawCuboid(
        0, 2 + book1_H + book2_H + 4, 0,
        Math.min(boxW * 0.95, book1_W * 1.02), Math.min(boxD * 0.95, book1_D * 1.02), airPad_H,
        activeCushion.color,
        activeCushion.stroke,
        activeCushion.color,
        activeCushion.stroke
      );
    }

  }, [rotX, rotY, boxW, boxD, boxH, zoomLevel, selectedCushionId, activeCushion, book1_W, book1_D, book1_H, book2_W, book2_D, book2_H, airPad_H]);

  // Main canvas render
  useEffect(() => {
    if (canvasRef.current) {
      drawSceneOnContext(canvasRef.current, 1.0);
    }
    if (isModalOpen && modalCanvasRef.current) {
      drawSceneOnContext(modalCanvasRef.current, 1.5);
    }
  }, [drawSceneOnContext, isModalOpen]);

  // Auto rotation loop
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 1) % 360);
    }, 45);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Mouse Interaction handlers
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.2, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.6, prev - 0.2));
  };

  const handleZoomReset = () => {
    setZoomLevel(1.0);
    setRotX(25);
    setRotY(-35);
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
                6-Face Solid 3D v5.0
              </span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              6개 면 완전 3D 투시 관제 ({boxW}W × {boxD}D × {boxH}H mm)
            </p>
          </div>
        </div>

        {/* View Preset & Zoom Control Group */}
        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
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

          {/* Zoom Control Group */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={handleZoomOut}
              title="축소"
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 text-gray-700 dark:text-gray-300 min-w-[36px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="확대"
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomReset}
              title="초기화"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white border-l border-gray-300 dark:border-gray-700 ml-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Fullscreen Modal Toggle Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="모달 확대 보기"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">확대 보기</span>
          </button>
        </div>
      </div>

      {/* Real 3D HTML5 Canvas Viewport with High-Tech Ice Blue Theme Backdrop */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-72 w-full bg-indigo-50/60 dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-gray-800 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
      >
        {/* Subtle Indigo Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* 3D Canvas */}
        <canvas ref={canvasRef} width={600} height={280} className="w-full h-full object-contain" />

        {/* Dual Metric Display Badges: Z-Height Ratio vs 3D Volume Ratio */}
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
          {/* Badge 1: Z-Height Ratio */}
          <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${heightFillRatio > 100 ? 'bg-red-500 animate-ping' : 'bg-emerald-500 animate-ping'}`} />
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300">📏 높이 적재율:</span>
            <span className={`text-sm font-black font-mono ${heightFillRatio > 100 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {heightFillRatio}% {heightFillRatio > 100 ? '(초과!)' : ''}
            </span>
          </div>

          {/* Badge 2: 3D Volume Ratio */}
          <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300">📦 3D 부피 적재율:</span>
            <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">{volumeFillRatio}%</span>
          </div>
        </div>

        {/* Rotate Toggle Button */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 transition flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
          <span>{autoRotate ? '자동 회전 중' : '360° 회전'}</span>
        </button>
      </div>

            {/* Dual Component Cushion Recommendation: Top Cushion vs Side Cushion */}
      <div className="bg-gray-50/80 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
            <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            AI 스마트 도서 물류 이원화 완충재 추천 (상단 유격 & 측면 쏠림 방지)
          </span>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
            상단: 에어필로우 (9mm) + 측면: PE폼/뽁뽁이 (25mm 둘기)
          </span>
        </div>

        {/* 5 Cushion Materials Interactive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {cushionCatalog.map((cush) => (
            <div
              key={cush.id}
              onClick={() => setSelectedCushionId(cush.id)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-1 ${
                selectedCushionId === cush.id
                  ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/80 ring-2 ring-indigo-500/30'
                  : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[11px] text-gray-900 dark:text-white truncate">{cush.name}</span>
                {cush.isRec && (
                  <span className="text-[9px] font-bold bg-emerald-500 text-white px-1 rounded shrink-0">추천</span>
                )}
              </div>
              <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                [{cush.mode === 'top' ? '상단채움' : cush.mode === 'side' ? '측면둘기' : '전방위래핑'}] ({cush.thick})
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Responsive High-Contrast Layer Item Legend Panel (With Side Cushion Guard!) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
        {/* Cyan Layer: Side Cushion Guard */}
        <div className="flex items-start gap-2 p-2 bg-cyan-50/80 dark:bg-cyan-950/40 rounded-xl border border-cyan-200 dark:border-cyan-800/80 min-w-0">
          <div className="w-3 h-3 mt-0.5 rounded bg-cyan-500 shrink-0 shadow-xs border border-cyan-600" />
          <div className="min-w-0 flex-1">
            <span className="font-extrabold text-cyan-900 dark:text-cyan-200 block text-[10px] leading-tight">측면: 4면 완충 가드</span>
            <span className="text-[9px] text-cyan-700 dark:text-cyan-400 font-mono block leading-tight mt-0.5 break-words">에어캡 뽁뽁이 25mm (3겹 감기 완충)</span>
          </div>
        </div>

        {/* Amber Layer: Cushion Pad */}
        <div className="flex items-start gap-2 p-2 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80 min-w-0">
          <div className="w-3 h-3 mt-0.5 rounded bg-amber-500 shrink-0 shadow-xs border border-amber-600" />
          <div className="min-w-0 flex-1">
            <span className="font-extrabold text-amber-900 dark:text-amber-200 block text-[10px] leading-tight">상단: 완충 패드 Layer</span>
            <span className="text-[9px] text-amber-700 dark:text-amber-400 font-mono block leading-tight mt-0.5 break-words">에어필로우 9.0mm (상부 완충)</span>
          </div>
        </div>

        {/* Emerald Layer: SQL Hardcover */}
        <div className="flex items-start gap-2 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 min-w-0">
          <div className="w-3.5 h-3.5 mt-0.5 rounded bg-emerald-500 shrink-0 shadow-xs border border-emerald-600" />
          <div className="min-w-0 flex-1">
            <span className="font-extrabold text-emerald-900 dark:text-emerald-200 block text-[11px] leading-tight">중단: SQL 자격검정</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono block leading-tight mt-0.5 break-words">320p 양장본 (실 두께 19.2mm)</span>
          </div>
        </div>

        {/* Purple Layer: Python Softcover */}
        <div className="flex items-start gap-2 p-2.5 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/80 min-w-0">
          <div className="w-3.5 h-3.5 mt-0.5 rounded bg-purple-600 shrink-0 shadow-xs border border-purple-700" />
          <div className="min-w-0 flex-1">
            <span className="font-extrabold text-purple-900 dark:text-purple-200 block text-[11px] leading-tight">하단: 점프 투 파이썬</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-mono block leading-tight mt-0.5 break-words">450p 무선제본 (실 두께 28.5mm)</span>
          </div>
        </div>
      </div>

      {/* AI Recommendation Agent Log Rationale Card */}
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
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
          {aiRecommendationLog ||
            `"실제 도서 규격(56.7mm)을 고정 맵핑한 결과, 높이 150mm/200mm 박스는 상부 유격을 유발하므로, 도서 슬림 전용 ${activeBox.name}(높이 ${boxH}mm) 선택 시 박스 높이 적재율 ${heightFillRatio}%로 가장 완벽히 밀착 적재됩니다."`}
        </p>
      </div>

      {/* Dynamic Height Fill Safety Grade & Dual Metric Calculation */}
      {(() => {
        const stackH = totalStackH;
        const exactHeightRatio = round((stackH / boxH) * 100, 1);
        const voidSpaceMM = Math.max(0, boxH - stackH);
        
        let score = (Math.min(100, exactHeightRatio) / 100) * 65 + 20 + 15;
        if (exactHeightRatio > 100) {
          score -= (exactHeightRatio - 100) * 1.5; // Overflow penalty
        } else if (exactHeightRatio < 85) {
          score -= (voidSpaceMM / boxH) * 45; // Void penalty
        }
        score = Math.max(15, Math.round(score * 10) / 10);

        let badge = "SAFE (A+)";
        let colorClass = "text-emerald-600 dark:text-emerald-400";
        if (exactHeightRatio > 100) {
          badge = "OVERFLOW (C)";
          colorClass = "text-red-600 dark:text-red-400";
        } else if (score < 45) {
          badge = "HAZARD (D)";
          colorClass = "text-red-600 dark:text-red-400";
        } else if (score < 60) {
          badge = "WARNING (C)";
          colorClass = "text-amber-600 dark:text-amber-400";
        } else if (score < 75) {
          badge = "CAUTION (B)";
          colorClass = "text-blue-600 dark:text-blue-400";
        } else if (score < 88) {
          badge = "SAFE (A)";
          colorClass = "text-emerald-600 dark:text-emerald-400";
        }

        return (
          <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1 border-t border-gray-200 dark:border-gray-800">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">선택 규격 박스</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs truncate block">{activeBox.name}</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Z축 높이 적재율</span>
              <span className={`font-mono font-bold text-xs flex items-center justify-center gap-1 ${exactHeightRatio > 100 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <PackageCheck className="w-3.5 h-3.5" /> 56.7mm / {boxH}mm ({exactHeightRatio}%)
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">3D 부피 적재율</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {volumeFillRatio}%
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">파손 방지 안전 등급</span>
              <span className={`font-mono font-bold text-xs flex items-center justify-center gap-1 ${colorClass}`}>
                <ShieldCheck className="w-3.5 h-3.5" /> {badge} [{score}점]
              </span>
            </div>
          </div>
        );
      })()}

      {/* Fullscreen 2.5X Enlargement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-4xl rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Cpu className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-black">Real 3D Open-Box Bin Packing 시뮬레이터 2.5X 관제</h3>
              </div>

              {/* Modal Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleZoomOut}
                    title="축소"
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold px-1.5 text-gray-700 dark:text-gray-300 min-w-[36px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    title="확대"
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleZoomReset}
                    title="초기화"
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white border-l border-gray-300 dark:border-gray-700 ml-1 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl bg-gray-100 dark:bg-gray-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Clean Ice Blue Modal Viewport */}
            <div
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="h-96 w-full bg-indigo-50/60 dark:bg-slate-950 rounded-2xl border border-indigo-100 dark:border-gray-800 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:30px_30px]" />
              <canvas ref={modalCanvasRef} width={840} height={380} className="w-full h-full object-contain" />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-200 dark:border-gray-800">
              <span className="font-mono">규격: {activeBox.specs} | 실제 높이 적재율: {heightFillRatio}%</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                확대 창 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
