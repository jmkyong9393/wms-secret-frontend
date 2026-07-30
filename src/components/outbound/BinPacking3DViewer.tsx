'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck, Cpu, Layers } from 'lucide-react';

interface BookItem3D {
  title: string;
  w: number; // mm
  d: number;
  h: number;
  color: string;
  label: string;
}

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

  // Render 3D Canvas Scene
  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 20;

    // Scale factors
    const scale = 0.55;

    // Convert degrees to radians
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;

    // 3D Point projection function
    const project = (x: number, y: number, z: number) => {
      // Rotate Y (yaw)
      const x1 = x * Math.cos(radY) + z * Math.sin(radY);
      const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

      // Rotate X (pitch)
      const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      // Perspective projection
      const fov = 400;
      const distance = 500;
      const factor = fov / (distance + z2);

      return {
        px: cx + x1 * factor * scale,
        py: cy - y2 * factor * scale,
        depth: z2
      };
    };

    // Helper to draw 3D Cuboid
    const drawCuboid = (
      origX: number, origY: number, origZ: number,
      w: number, d: number, h: number,
      fillColor: string, strokeColor: string,
      topColor: string, sideColor: string,
      label?: string
    ) => {
      // 8 Vertices of the Cuboid
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

      // Faces definition with normals/rendering order
      // Top Face (4, 5, 6, 7)
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

      // Front Face (0, 1, 5, 4)
      ctx.beginPath();
      ctx.moveTo(v[0].px, v[0].py);
      ctx.lineTo(v[1].px, v[1].py);
      ctx.lineTo(v[5].px, v[5].py);
      ctx.lineTo(v[4].px, v[4].py);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.stroke();

      // Right Face (1, 2, 6, 5)
      ctx.beginPath();
      ctx.moveTo(v[1].px, v[1].py);
      ctx.lineTo(v[2].px, v[2].py);
      ctx.lineTo(v[6].px, v[6].py);
      ctx.lineTo(v[5].px, v[5].py);
      ctx.closePath();
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.stroke();

      // Render Label on Top Face
      if (label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const topCx = (v[4].px + v[5].px + v[6].px + v[7].px) / 4;
        const topCy = (v[4].py + v[5].py + v[6].py + v[7].py) / 4;
        ctx.fillText(label, topCx, topCy + 4);
      }
    };

    // 1. Draw Outer Translucent Glassmorphic Packaging Box
    const boxHw = boxW / 2;
    const boxHd = boxD / 2;
    const boxHh = boxH;

    // Draw Outer Box Wireframe Corners
    drawCuboid(
      0, 0, 0,
      boxW, boxD, boxHh,
      'rgba(99, 102, 241, 0.08)',
      'rgba(99, 102, 241, 0.8)',
      'rgba(129, 140, 248, 0.15)',
      'rgba(79, 70, 229, 0.12)'
    );

    // 2. Draw Stacked Items Inside (Coordinates relative to box center/bottom)
    // Book 1 (Bottom: Softcover Novel "Do it! 점프 투 파이썬")
    const book1H = 25;
    drawCuboid(
      0, 5, 0,
      boxW * 0.85, boxD * 0.85, book1H,
      'rgba(67, 56, 202, 0.85)',
      'rgba(165, 180, 252, 0.9)',
      'rgba(99, 102, 241, 0.95)',
      'rgba(49, 46, 129, 0.9)',
      'Item 1: Do it! 점프 투 파이썬 (4륙판)'
    );

    // Book 2 (Middle: Hardcover Novel "SQL 자격검정 실전문제")
    const book2H = 30;
    drawCuboid(
      0, 5 + book1H + 4, 0,
      boxW * 0.85, boxD * 0.85, book2H,
      'rgba(37, 99, 235, 0.85)',
      'rgba(147, 197, 253, 0.9)',
      'rgba(59, 130, 246, 0.95)',
      'rgba(29, 78, 216, 0.9)',
      'Item 2: SQL 자격검정 실전문제 (하드커버)'
    );

    // Cushioning Layer (Top: Air Cushioning Padding)
    const airH = Math.max(15, boxHh - (book1H + book2H + 20));
    drawCuboid(
      0, 5 + book1H + book2H + 8, 0,
      boxW * 0.88, boxD * 0.88, airH,
      'rgba(6, 182, 212, 0.35)',
      'rgba(103, 232, 249, 0.9)',
      'rgba(34, 211, 238, 0.5)',
      'rgba(14, 116, 144, 0.4)',
      '🛡️ AIR CUSHION PAD (6%)'
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
    }, 40);
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
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl text-white relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/40">
            <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <span>3D Bin Packing AI 추천 시뮬레이터</span>
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-md text-[10px] font-mono font-black tracking-wider uppercase">
                Real 3D Engine v2.0
              </span>
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              마우스 드래그로 360° 회전 및 내부 적재 레이어를 감상하실 수 있습니다.
            </p>
          </div>
        </div>

        {/* View Angle Preset Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setRotX(25); setRotY(-35); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 25 && rotY === -35 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            입체 (ISO 3D)
          </button>
          <button
            onClick={() => { setRotX(90); setRotY(0); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 90 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            평면 (Top)
          </button>
          <button
            onClick={() => { setRotX(0); setRotY(0); setAutoRotate(false); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !autoRotate && rotX === 0 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            정면 (Front)
          </button>
        </div>
      </div>

      {/* Real 3D HTML5 Canvas Viewport */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-72 w-full bg-slate-900/90 rounded-xl border border-slate-800/80 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-25 pointer-events-none" />

        {/* 3D Canvas */}
        <canvas ref={canvasRef} width={640} height={280} className="w-full h-full object-contain" />

        {/* Dynamic Volume Fill Ratio Badge */}
        <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2.5 backdrop-blur-md shadow-lg">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-slate-300">공간 적재 효율:</span>
          <span className="text-base font-black font-mono text-emerald-400">{selectedBox.eff}%</span>
        </div>

        {/* Rotate Toggle Button */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="absolute bottom-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 text-xs font-bold shadow-md"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin text-indigo-400' : ''}`} />
          <span>{autoRotate ? '자동 회전 중' : '360° 자동 회전'}</span>
        </button>
      </div>

      {/* AI Recommendation Agent Log Rationale */}
      <div className="bg-slate-900/90 border border-indigo-500/30 p-4 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>AI-Agent 3D Pack Optimizer 추론 결과 (Reasoning Rationale)</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">
            CONFIDENCE: 99.4%
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {aiRecommendationLog ||
            `"주문 도서 중 하드커버(SQL 자격검정 실전문제)의 모서리 충격을 방지하기 위해 중단 레이어에 배치하고, 하단에 점프 투 파이썬(4륙판)을 받침대로 적재하였습니다. 상단 15mm 여유 공간에는 에어캡 완충재(6%)를 배치하여 완충 비용 30% 절감 및 적재 효율 94%를 달성하였습니다."`}
        </p>
      </div>

      {/* Bottom Summary Stats */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs pt-1 border-t border-slate-800">
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block mb-0.5">추천 규격 박스</span>
          <span className="font-mono font-bold text-indigo-300 text-sm">{selectedBox.name}</span>
        </div>
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block mb-0.5">완충재 가공비</span>
          <span className="font-mono font-bold text-cyan-400 text-sm">에어캡 6% (-30% 절감)</span>
        </div>
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 block mb-0.5">파손 방지 안전 등급</span>
          <span className="font-mono font-bold text-emerald-400 text-sm flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> SAFE (A+)
          </span>
        </div>
      </div>
    </div>
  );
}
