'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck, Cpu, Layers, CheckCircle2 } from 'lucide-react';

interface BinPacking3DViewerProps {
  selectedBox: {
    id: string;
    name: string;
    specs: string;
    eff: number;
  };
  aiRecommendationLog?: string;
}

export default function BinPacking3DViewer({ selectedBox, aiRecommendationLog }: BinPacking3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Rotation angles (deg)
  const [rotX, setRotX] = useState<number>(25);
  const [rotY, setRotY] = useState<number>(-35);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Parse Box Dimensions e.g. "300x200x150mm"
  const dimMatches = selectedBox.specs.match(/(\d+)x(\d+)x(\d+)/);
  const boxW = dimMatches ? parseInt(dimMatches[1]) : 300;
  const boxD = dimMatches ? parseInt(dimMatches[2]) : 200;
  const boxH = dimMatches ? parseInt(dimMatches[3]) : 150;

  // Render 3D Canvas Scene with High-Contrast Colors
  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 15;

    // Scale factors
    const scale = 0.65;

    // Convert degrees to radians
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;

    // 3D Point projection function
    const project = (x: number, y: number, z: number) => {
      const x1 = x * Math.cos(radY) + z * Math.sin(radY);
      const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

      const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      const fov = 420;
      const distance = 500;
      const factor = fov / (distance + z2);

      return {
        px: cx + x1 * factor * scale,
        py: cy - y2 * factor * scale,
        depth: z2
      };
    };

    // Helper to draw 3D Cuboid cleanly
    const drawCuboid = (
      origX: number, origY: number, origZ: number,
      w: number, d: number, h: number,
      fillColor: string, strokeColor: string,
      topColor: string, sideColor: string
    ) => {
      const hw = w / 2;
      const hd = d / 2;
      
      const v = [
        project(origX - hw, origY, origZ - hd), // 0: Front-Left-Bottom
        project(origX + hw, origY, origZ - hd), // 1: Front-Right-Bottom
        project(origX + hw, origY, origZ + hd), // 2: Back-Right-Bottom
        project(origX - hw, origY, origZ + hd), // 3: Back-Left-Bottom
        project(origX - hw, origY + h, origZ - hd), // 4: Front-Left-Top
        project(origX + hw, origY + h, origZ - hd), // 5: Front-Right-Top
        project(origX + hw, origY + h, origZ + hd), // 6: Back-Right-Top
        project(origX - hw, origY + h, origZ + hd), // 7: Back-Left-Top
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

    // 1. Outer Translucent Glassmorphic Box (Glowing Electric Indigo Wireframe)
    drawCuboid(
      0, 0, 0,
      boxW, boxD, boxH,
      'rgba(99, 102, 241, 0.05)',
      'rgba(129, 140, 248, 0.95)',
      'rgba(165, 180, 252, 0.15)',
      'rgba(99, 102, 241, 0.12)'
    );

    // 2. STACKED LAYERS WITH HIGH-CONTRAST DISTINCT COLOR CODING
    
    // LAYER 1 (Bottom: Softcover Novel "Do it! 점프 투 파이썬") -> VIBRANT PURPLE / VIOLET
    const book1H = 26;
    drawCuboid(
      0, 4, 0,
      boxW * 0.86, boxD * 0.86, book1H,
      'rgba(147, 51, 234, 0.85)',   # Front Face
      'rgba(233, 213, 255, 0.95)',  # Wireframe Stroke
      'rgba(168, 85, 247, 0.95)',   # Top Face
      'rgba(126, 34, 206, 0.9)'     # Side Face
    );

    // LAYER 2 (Middle: Hardcover Novel "SQL 자격검정 실전문제") -> VIBRANT EMERALD / TEAL
    const book2H = 32;
    drawCuboid(
      0, 4 + book1H + 4, 0,
      boxW * 0.86, boxD * 0.86, book2H,
      'rgba(16, 185, 129, 0.85)',   # Front Face
      'rgba(167, 243, 208, 0.95)',  # Wireframe Stroke
      'rgba(52, 211, 153, 0.95)',   # Top Face
      'rgba(4, 120, 87, 0.9)'       # Side Face
    );

    // LAYER 3 (Top: Air Cushion Pad Layer) -> TRANSLUCENT AMBER / GOLD
    const airH = Math.max(16, boxH - (book1H + book2H + 18));
    drawCuboid(
      0, 4 + book1H + book2H + 8, 0,
      boxW * 0.88, boxD * 0.88, airH,
      'rgba(245, 158, 11, 0.45)',   # Front Face
      'rgba(254, 243, 199, 0.95)',  # Wireframe Stroke
      'rgba(251, 191, 36, 0.65)',   # Top Face
      'rgba(180, 83, 9, 0.5)'       # Side Face
    );

  }, [rotX, rotY, boxW, boxD, boxH]);

  // Auto rotation loop
  useEffect(() => {
    renderScene();
  }, [renderScene]);

  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 1) % 360);
    }, 45);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Mouse Interaction handlers for 360 Orbit Rotation
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
                Canvas 3D v2.6
              </span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              고대비 층별 컬러 매핑 ({boxW}W × {boxD}D × {boxH}H mm)
            </p>
          </div>
        </div>

        {/* View Preset Buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => { setRotX(25); setRotY(-35); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 25 && rotY === -35 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            입체 (ISO 3D)
          </button>
          <button
            onClick={() => { setRotX(90); setRotY(0); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 90 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            평면 (Top)
          </button>
          <button
            onClick={() => { setRotX(0); setRotY(0); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 0 ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            정면 (Front)
          </button>
        </div>
      </div>

      {/* Real 3D HTML5 Canvas Viewport with Adaptive Indigo Grid Backdrop */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-64 w-full bg-slate-900 dark:bg-slate-950 rounded-2xl border border-indigo-900/40 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner"
      >
        {/* Subtle glowing grid background matching UI */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#312e81_1px,transparent_1px),linear-gradient(to_bottom,#312e81_1px,transparent_1px)] bg-[size:20px_20px] opacity-25 pointer-events-none" />

        {/* 3D Canvas */}
        <canvas ref={canvasRef} width={580} height={260} className="w-full h-full object-contain" />

        {/* Dynamic Volume Fill Ratio Badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-indigo-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-slate-300">공간 적재 효율:</span>
          <span className="text-sm font-black font-mono text-emerald-400">{selectedBox.eff}%</span>
        </div>

        {/* Rotate Toggle Button */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="absolute bottom-3 right-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 text-xs font-bold shadow-md"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin text-indigo-400' : ''}`} />
          <span>{autoRotate ? '자동 회전 중' : '360° 회전'}</span>
        </button>
      </div>

      {/* High-Contrast Distinct Stacking Layer Item Legend Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-sans">
        {/* Amber Layer: Cushion Pad */}
        <div className="flex items-center gap-2.5 p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80">
          <div className="w-4 h-4 rounded bg-amber-500 shrink-0 shadow-xs border border-amber-600" />
          <div className="truncate">
            <span className="font-extrabold text-amber-900 dark:text-amber-200 block text-[11px]">상단: 완충재 Pad Layer</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono block">에어캡 6% (유격 충격 흡수)</span>
          </div>
        </div>

        {/* Emerald Layer: SQL Hardcover */}
        <div className="flex items-center gap-2.5 p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80">
          <div className="w-4 h-4 rounded bg-emerald-500 shrink-0 shadow-xs border border-emerald-600" />
          <div className="truncate">
            <span className="font-extrabold text-emerald-900 dark:text-emerald-200 block text-[11px]">중단: SQL 자격검정</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono block">신국판 하드커버 (32mm)</span>
          </div>
        </div>

        {/* Purple Layer: Python Softcover */}
        <div className="flex items-center gap-2.5 p-2.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/80">
          <div className="w-4 h-4 rounded bg-purple-600 shrink-0 shadow-xs border border-purple-700" />
          <div className="truncate">
            <span className="font-extrabold text-purple-900 dark:text-purple-200 block text-[11px]">하단: 점프 투 파이썬</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-mono block">4륙판 받침대 (26mm)</span>
          </div>
        </div>
      </div>

      {/* AI Recommendation Agent Log Rationale Card */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 p-4 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>AI Multi-Agent 3D Pack Optimizer 고대비 추천 결과</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold">
            CONFIDENCE: 99.4%
          </span>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
          {aiRecommendationLog ||
            `"AI-Agent Multi-Agent 3D Pack Optimizer 분석 결과: 하드커버(SQL 자격검정)의 모서리 충격을 방지하기 위해 중단 에메랄드 레이어에 배치하고, 하단에 점프 투 파이썬(4륙판)을 퍼플 받침대로 적재하였습니다. 상단 15mm 여유 공간에는 앰버 에어캡 완충재(6%)를 배치하여 완충 비용 30% 절감 및 적재 효율 94%를 달성하였습니다."`}
        </p>
      </div>

      {/* Bottom Summary Stats */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs pt-1 border-t border-gray-200 dark:border-gray-800">
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">추천 규격 박스</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{selectedBox.name}</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">완충재 가공비</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">에어캡 6% (-30% 절감)</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">파손 방지 안전 등급</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> SAFE (A+)
          </span>
        </div>
      </div>
    </div>
  );
}
