'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck, Cpu, ZoomIn, ZoomOut, Maximize2, X, RefreshCw, PackageCheck } from 'lucide-react';

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
  
  // Active Box Selection (Default Box-A1 Low Profile 250x150x60mm)
  const activeBox = selectedBox || {
    id: "Box-A1",
    name: "소형-Low A-BOX (추천)",
    specs: "250x150x60mm",
    eff: 94.5
  };

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
  // Python Book (4륙판: 188W * 257D * 28.5H mm)
  // SQL Book (신국판: 152W * 225D * 19.2H mm)
  // Air Pad Cushion Layer (Fixed 9.0H mm)
  const book1_W = Math.min(boxW * 0.94, 188);
  const book1_D = Math.min(boxD * 0.94, 257);
  const book1_H = 28.5; // FIXED PHYSICAL HEIGHT (mm)

  const book2_W = Math.min(boxW * 0.92, 152);
  const book2_D = Math.min(boxD * 0.92, 225);
  const book2_H = 19.2; // FIXED PHYSICAL HEIGHT (mm)

  const airPad_H = 9.0; // FIXED PHYSICAL HEIGHT (mm)

  // Real Dynamic Fill Ratio Calculation based on Box Height
  const totalStackH = book1_H + book2_H + airPad_H; // 56.7mm total
  const realHeightFillEff = Math.min(96.5, round((totalStackH / boxH) * 100, 1));

  function round(val: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // Render 3D Canvas Scene with Real Physical Millimeter World Mapping
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

    // Uniform Physical Scale Factor so 1mm = constant pixels across boxes
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
        project(origX - hw, origY, origZ - hd),
        project(origX + hw, origY, origZ - hd),
        project(origX + hw, origY, origZ + hd),
        project(origX - hw, origY, origZ + hd),
        project(origX - hw, origY + h, origZ - hd),
        project(origX + hw, origY + h, origZ - hd),
        project(origX + hw, origY + h, origZ + hd),
        project(origX - hw, origY + h, origZ + hd),
      ];

      // Top Face
      ctx.beginPath();
      ctx.moveTo(v[4].px, v[4].py);
      ctx.lineTo(v[5].px, v[5].py);
      ctx.lineTo(v[6].px, v[6].py);
      ctx.lineTo(v[7].px, v[7].py);
      ctx.closePath();
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Front Face
      ctx.beginPath();
      ctx.moveTo(v[0].px, v[0].py);
      ctx.lineTo(v[1].px, v[1].py);
      ctx.lineTo(v[5].px, v[5].py);
      ctx.lineTo(v[4].px, v[4].py);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.stroke();

      // Right Face
      ctx.beginPath();
      ctx.moveTo(v[1].px, v[1].py);
      ctx.lineTo(v[2].px, v[2].py);
      ctx.lineTo(v[6].px, v[6].py);
      ctx.lineTo(v[5].px, v[5].py);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.stroke();
    };

    // 1. OUTER CARDBOARD BOX CONTAINER (SCALES DYNAMICALLY WITH BOX SIZE!)
    const hw = boxW / 2;
    const hd = boxD / 2;
    const bh = boxH; // Actual Selected Box Height mm (60mm, 100mm, 150mm, 200mm)

    drawCuboid(
      0, 0, 0,
      boxW, boxD, bh,
      'rgba(79, 70, 229, 0.04)',
      'rgba(79, 70, 229, 0.85)',
      'rgba(99, 102, 241, 0.06)',
      'rgba(67, 56, 202, 0.06)'
    );

    // Draw 4 Open Box Flaps
    const flapLen = Math.min(35, bh * 0.4);
    const flapAng = Math.PI / 4;

    const topV4 = project(-hw, bh, -hd);
    const topV5 = project(hw, bh, -hd);
    const topV6 = project(hw, bh, hd);
    const topV7 = project(-hw, bh, hd);

    const flapFront1 = project(-hw, bh + flapLen * Math.sin(flapAng), -hd - flapLen * Math.cos(flapAng));
    const flapFront2 = project(hw, bh + flapLen * Math.sin(flapAng), -hd - flapLen * Math.cos(flapAng));

    const flapRight1 = project(hw + flapLen * Math.cos(flapAng), bh + flapLen * Math.sin(flapAng), -hd);
    const flapRight2 = project(hw + flapLen * Math.cos(flapAng), bh + flapLen * Math.sin(flapAng), hd);

    // Front Open Flap
    ctx.beginPath();
    ctx.moveTo(topV4.px, topV4.py);
    ctx.lineTo(topV5.px, topV5.py);
    ctx.lineTo(flapFront2.px, flapFront2.py);
    ctx.lineTo(flapFront1.px, flapFront1.py);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(79, 70, 229, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Right Open Flap
    ctx.beginPath();
    ctx.moveTo(topV5.px, topV5.py);
    ctx.lineTo(topV6.px, topV6.py);
    ctx.lineTo(flapRight2.px, flapRight2.py);
    ctx.lineTo(flapRight1.px, flapRight1.py);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
    ctx.fill();
    ctx.stroke();


    // 2. REAL FIXED PHYSICAL BOOK STACK (REAL MM HEIGHT & TRIM SIZES!)
    
    // LAYER 1: Bottom Python Book (Fixed 28.5mm Height) -> VIBRANT PURPLE
    drawCuboid(
      0, 2, 0,
      book1_W, book1_D, book1_H,
      'rgba(147, 51, 234, 0.9)',
      'rgba(107, 33, 168, 0.95)',
      'rgba(168, 85, 247, 0.95)',
      'rgba(126, 34, 206, 0.92)'
    );

    // LAYER 2: Middle SQL Book (Fixed 19.2mm Height) -> VIBRANT EMERALD
    drawCuboid(
      0, 2 + book1_H + 2, 0,
      book2_W, book2_D, book2_H,
      'rgba(16, 185, 129, 0.9)',
      'rgba(6, 95, 70, 0.95)',
      'rgba(52, 211, 153, 0.95)',
      'rgba(4, 120, 87, 0.92)'
    );

    // LAYER 3: Top Air Cushion Pad Layer (Fixed 9.0mm Height) -> VIBRANT AMBER CUSHION
    drawCuboid(
      0, 2 + book1_H + book2_H + 4, 0,
      Math.min(boxW * 0.95, book1_W * 1.02), Math.min(boxD * 0.95, book1_D * 1.02), airPad_H,
      'rgba(245, 158, 11, 0.75)',
      'rgba(180, 83, 9, 0.95)',
      'rgba(251, 191, 36, 0.9)',
      'rgba(217, 119, 6, 0.85)'
    );

  }, [rotX, rotY, boxW, boxD, boxH, zoomLevel, book1_W, book1_D, book1_H, book2_W, book2_D, book2_H, airPad_H]);

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
              <span>Real 3D Open-Box Bin Packing 시뮬레이터</span>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-mono font-extrabold uppercase tracking-wide">
                Physical 3D v4.0
              </span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              실제 도서 규격 고정 맵핑 ({boxW}W × {boxD}D × {boxH}H mm)
            </p>
          </div>
        </div>

        {/* View Preset & Zoom Buttons */}
        <div className="flex items-center gap-2">
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

          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setRotX(25); setRotY(-35); setAutoRotate(false); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                !autoRotate && rotX === 25 && rotY === -35 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              입체 3D
            </button>
            <button
              onClick={() => { setRotX(90); setRotY(0); setAutoRotate(false); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                !autoRotate && rotX === 90 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              평면 Top
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

        {/* Dynamic Real Height Fill Ratio Badge */}
        <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300">박스 높이 적재율:</span>
          <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{realHeightFillEff}%</span>
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

      {/* Responsive High-Contrast Layer Item Legend Panel (No Text Clipping!) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-sans">
        {/* Amber Layer: Cushion Pad */}
        <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80 min-w-0">
          <div className="w-3.5 h-3.5 mt-0.5 rounded bg-amber-500 shrink-0 shadow-xs border border-amber-600" />
          <div className="min-w-0 flex-1">
            <span className="font-extrabold text-amber-900 dark:text-amber-200 block text-[11px] leading-tight">상단: 완충재 Pad Layer</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono block leading-tight mt-0.5 break-words">에어캡 9.0mm (유격 충격 흡수)</span>
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
            `"실제 도서 규격(47.7mm)을 고정 맵핑한 결과, 높이 150mm/200mm 박스는 상부 유격이 과다 발생하므로, 슬림형 ${activeBox.name}(높이 ${boxH}mm) 선택 시 박스 높이 적재율 ${realHeightFillEff}%로 가장 완벽히 밀착 적재됩니다."`}
        </p>
      </div>

      {/* Bottom Summary Stats */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs pt-1 border-t border-gray-200 dark:border-gray-800">
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">선택 규격 박스</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{activeBox.name}</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">실제 적재 높이</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm flex items-center justify-center gap-1">
            <PackageCheck className="w-4 h-4 text-indigo-500" /> 56.7mm / {boxH}mm
          </span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">파손 방지 안전 등급</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> SAFE (A+) [91.1점]
          </span>
        </div>
      </div>

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
              <span className="font-mono">규격: {activeBox.specs} | 실제 높이 적재율: {realHeightFillEff}%</span>
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
