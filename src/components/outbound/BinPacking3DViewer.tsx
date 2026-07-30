'use client';

import React, { useState } from 'react';
import { Box, RotateCw, Sparkles, ShieldCheck } from 'lucide-react';

interface BinPacking3DViewerProps {
  selectedBox: {
    id: string;
    name: string;
    specs: string;
    eff: number;
  };
}

export default function BinPacking3DViewer({ selectedBox }: BinPacking3DViewerProps) {
  const [viewAngle, setViewAngle] = useState<'iso' | 'top' | 'front'>('iso');
  const [isRotating, setIsRotating] = useState(false);

  // Derive dimensions from specs e.g. "300x200x150mm"
  const dimensions = selectedBox.specs.replace(/mm/g, '').split('x');
  const width = dimensions[0] || '300';
  const depth = dimensions[1] || '200';
  const height = dimensions[2] || '150';

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <span>3D 적재 시뮬레이션 프리뷰</span>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-mono font-bold">
                WebGL 3D Engine
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-mono">
              규격: {width}W × {depth}D × {height}H (mm)
            </p>
          </div>
        </div>

        {/* View Angle Selector Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewAngle('iso')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              viewAngle === 'iso' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            입체 (ISO 45°)
          </button>
          <button
            onClick={() => setViewAngle('top')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              viewAngle === 'top' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            평면 (Top)
          </button>
          <button
            onClick={() => setViewAngle('front')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
              viewAngle === 'front' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            정면 (Front)
          </button>
        </div>
      </div>

      {/* 3D Canvas Visualizer Viewport */}
      <div className="h-64 w-full bg-slate-900/80 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden group">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-30" />

        {/* 3D Isometric Outer Box Container */}
        <div
          className={`relative transition-all duration-700 ease-out transform ${
            viewAngle === 'iso'
              ? 'rotate-x-[60deg] rotate-z-[-35deg] skew-y-[10deg] scale-90'
              : viewAngle === 'top'
              ? 'rotate-x-[0deg] rotate-z-0 scale-100'
              : 'rotate-x-[85deg] rotate-z-0 scale-95'
          } ${isRotating ? 'animate-spin' : ''}`}
          style={{ width: '220px', height: '150px' }}
        >
          {/* Outer Translucent Box Wireframe */}
          <div className="absolute inset-0 border-2 border-indigo-500/60 bg-indigo-500/10 rounded-lg shadow-[0_0_25px_rgba(99,102,241,0.25)] backdrop-blur-xs flex flex-col justify-between p-2">
            
            {/* Top Layer: Air Cushioning Padding */}
            <div className="h-6 w-full bg-cyan-400/20 border border-cyan-400/50 rounded flex items-center justify-between px-2 text-[10px] text-cyan-300 font-mono animate-pulse">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> 완충재 에어캡 (6%)
              </span>
              <span>Pad Layer</span>
            </div>

            {/* Middle Layer: Book 1 (Hardcover Novel) */}
            <div className="h-14 w-full bg-blue-600/60 border border-blue-400/80 rounded-md p-2 shadow-lg flex justify-between items-center text-white">
              <div>
                <div className="text-[11px] font-bold leading-tight">SQL 자격검정 실전문제 (하드커버)</div>
                <div className="text-[9px] text-blue-200 font-mono">152 × 225 × 25mm | 신국판</div>
              </div>
              <span className="px-1.5 py-0.5 bg-blue-500 text-[9px] font-mono rounded font-bold">Item 1</span>
            </div>

            {/* Bottom Layer: Book 2 (Standard Softcover Novel) */}
            <div className="h-14 w-full bg-indigo-700/70 border border-indigo-400/80 rounded-md p-2 shadow-lg flex justify-between items-center text-white">
              <div>
                <div className="text-[11px] font-bold leading-tight">Do it! 점프 투 파이썬</div>
                <div className="text-[9px] text-indigo-200 font-mono">152 × 225 × 22mm | 4륙판</div>
              </div>
              <span className="px-1.5 py-0.5 bg-indigo-500 text-[9px] font-mono rounded font-bold">Item 2</span>
            </div>
          </div>
        </div>

        {/* Dynamic Volume Fill Ratio Badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono text-slate-300">공간 적재율:</span>
          <span className="text-sm font-black font-mono text-emerald-400">{selectedBox.eff}%</span>
        </div>

        {/* Rotate Button */}
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="absolute bottom-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl border border-slate-700 transition flex items-center gap-1 text-xs font-bold"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-indigo-400' : ''}`} />
          <span>{isRotating ? '회전 멈춤' : '360° 회전'}</span>
        </button>
      </div>

      {/* Bottom Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-800/80">
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 block">선택 박스 규격</span>
          <span className="font-mono font-bold text-slate-200">{selectedBox.name}</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 block">완충재 필요 여부</span>
          <span className="font-mono font-bold text-cyan-400">최소 완충재 (6%)</span>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-400 block">파손 방지 등급</span>
          <span className="font-mono font-bold text-emerald-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SAFE (A+)
          </span>
        </div>
      </div>
    </div>
  );
}
