"use client";

import React, { useState } from 'react';
import BinPacking3DViewer from '@/components/outbound/BinPacking3DViewer';
import { 
  Package, 
  Box, 
  Camera, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCcw, 
  Layers, 
  QrCode,
  ShieldCheck,
  Check,
  Search,
  Scan,
  Barcode,
  ArrowRightCircle,
  Smartphone,
  Zap,
  Volume2,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import CameraScanner from '@/features/inbound/components/CameraScanner';

interface BoxOption {
  id: string;
  name: string;
  specs: string;
  desc: string;
  eff: number;
}

const BOOK_SLIM_BOX_OPTIONS: BoxOption[] = [
  { id: "BOOK-S1", name: "도서슬림 소형 1호", specs: "250x150x50mm", desc: "단권 슬림형", eff: 98.2 },
  { id: "BOOK-S2", name: "도서슬림 소형 2호 (추천)", specs: "250x150x60mm", desc: "도서 2권 밀착 슬림", eff: 94.5 },
  { id: "BOOK-M1", name: "도서슬림 중형 1호", specs: "300x200x70mm", desc: "중형 도서 묶음", eff: 81.0 },
  { id: "BOOK-M2", name: "도서슬림 중형 2호", specs: "300x200x90mm", desc: "대형 도서 묶음", eff: 63.0 },
];

const STANDARD_COURIER_BOX_OPTIONS: BoxOption[] = [
  { id: "STD-01", name: "우체국 1호 (표준)", specs: "220x190x90mm", desc: "표준 소형", eff: 63.0 },
  { id: "STD-02", name: "우체국 2호 (표준)", specs: "270x180x150mm", desc: "표준 중형", eff: 37.8 },
  { id: "STD-03", name: "우체국 3호 (중형)", specs: "340x250x210mm", desc: "우체국 중형", eff: 27.0 },
  { id: "STD-04", name: "우체국 4호 (대형)", specs: "410x310x280mm", desc: "우체국 대형", eff: 20.2 },
];

const MOBILE_BOX_OPTIONS: BoxOption[] = [...BOOK_SLIM_BOX_OPTIONS, ...STANDARD_COURIER_BOX_OPTIONS];

/**
 * LPN 자동 하이픈 생성 포맷터 (모바일 터치 특화)
 * 입력된 텍스트/숫자를 LPN-YYMMDD-XXXX 규격으로 자동 트랜스폼합니다.
 * 예: "260727A801" -> "LPN-260727-A801"
 */
function formatLpnBarcode(input: string): string {
  if (!input) return '';

  let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('LPN')) {
    clean = clean.substring(3);
  }

  if (clean.length === 0) {
    return 'LPN-';
  } else if (clean.length <= 6) {
    return `LPN-${clean}`;
  } else {
    const part1 = clean.substring(0, 6);
    const part2 = clean.substring(6, 10);
    return `LPN-${part1}-${part2}`;
  }
}

export default function WorkerOutboundPage() {
  const currentWorkerId = 'WM2607001';
  const [selectedBoxId, setSelectedBoxId] = useState<string>("BOOK-S2");
  const [showScanner, setShowScanner] = useState<boolean>(true);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Manual LPN State
  const [manualLpn, setManualLpn] = useState<string>('LPN-260727-A801');
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  const activeBox = MOBILE_BOX_OPTIONS.find(b => b.id === selectedBoxId) || MOBILE_BOX_OPTIONS[1];

  const handleManualLpnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const formatted = formatLpnBarcode(val);
    setManualLpn(formatted);
  };

  const handleVerifyLpn = () => {
    if (!manualLpn || manualLpn.length < 8) {
      alert("유효한 LPN 바코드를 입력하세요. (예: 260727A801)");
      return;
    }

    setVerificationResult({
      lpn: manualLpn,
      title: manualLpn.includes('A802') ? 'SQL 자격검정 실전문제' : manualLpn.includes('A801') ? 'Do it! 점프 투 파이썬 (개정 2판)' : '클린 아키텍처 (Clean Architecture)',
      isbn: '9791163033455',
      status: 'VERIFIED',
      grade: 'MINT (99점)',
      box: activeBox.name,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen px-3 py-4 space-y-4 font-sans text-gray-900 dark:text-gray-100 pb-28 bg-gray-50 dark:bg-gray-950 transition-colors">
      
      {/* Mobile Sticky Top App Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black font-mono flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> MOBILE OUTBOUND WORKER
            </span>
          </div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-1.5">
            🚚 현장 출고 패킹 스캐너
          </h1>
          <p className="text-gray-400 dark:text-gray-500 text-[11px] font-mono">
            작업자: [{currentWorkerId}]
          </p>
        </div>

        <button
          onClick={() => setShowScanner(!showScanner)}
          className={`p-3 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
            showScanner
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'bg-indigo-600 text-white shadow-md'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>{showScanner ? '카메라 끄기' : '카메라 켜기'}</span>
        </button>
      </div>

      {/* Mobile WebCam Camera Scanner Viewport */}
      {showScanner && (
        <div className="bg-gray-950 p-4 rounded-2xl border-2 border-indigo-500 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-300 font-bold border-b border-gray-800 pb-2">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Zap className="w-4 h-4 animate-pulse" /> 라이브 카메라 바코드 스캔
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
              <Volume2 className="w-3 h-3 text-amber-400" /> 볼륨키/풋페달 촬영 지원
            </span>
          </div>

          <div className="w-full">
            <CameraScanner />
          </div>
        </div>
      )}

      {/* Mobile Manual LPN Touch Input Card */}
      <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            LPN 바코드 수동 입력 <span className="text-indigo-600 dark:text-indigo-400 font-normal">('-' 자동 생성)</span>
          </label>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={manualLpn}
            onChange={handleManualLpnChange}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyLpn()}
            placeholder="숫자 입력 (예: 260727A801)"
            className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 focus:border-indigo-600 rounded-xl font-mono text-lg font-black tracking-wider text-indigo-900 dark:text-indigo-200 outline-none text-center shadow-inner"
          />

          <button
            onClick={handleVerifyLpn}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4.5 h-4.5" />
            <span>LPN 출고 패킹 검증 실행</span>
          </button>
        </div>

        {/* Quick Touch Preset Pills */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400 font-bold">빠른 테스트:</span>
          <div className="flex items-center gap-1.5">
            {['260727A801', '260727A802', '260727A805'].map((code) => (
              <button
                key={code}
                onClick={() => setManualLpn(formatLpnBarcode(code))}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300 active:bg-indigo-100"
              >
                {code.slice(-4)}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Result Output */}
        {verificationResult && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5 text-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 검증 성공 (VERIFIED)
              </span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                {verificationResult.timestamp}
              </span>
            </div>

            <p className="font-mono font-black text-emerald-900 dark:text-emerald-200 text-sm">
              {verificationResult.lpn}
            </p>
            <p className="font-extrabold text-gray-900 dark:text-white text-xs">
              {verificationResult.title}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-1 text-emerald-800 dark:text-emerald-300 border-t border-emerald-200/60 dark:border-emerald-800/60">
              <span>등급: <strong>{verificationResult.grade}</strong></span>
              <span>적재: <strong>{verificationResult.box}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile 3D Bin Packing Box Selection Card */}
      <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
            <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            3D Bin Packing 추천 박스
          </h3>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
            공간 효율 {activeBox.eff}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MOBILE_BOX_OPTIONS.map((box) => (
            <button
              key={box.id}
              onClick={() => {
                setSelectedBoxId(box.id);
                setConfirmed(false);
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-0.5 ${
                selectedBoxId === box.id
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-gray-900 dark:text-white truncate">{box.name.split(' ')[0]}</span>
                {selectedBoxId === box.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />}
              </div>
              <p className="text-[9px] font-mono text-gray-500 dark:text-gray-400">{box.specs.split('mm')[0]}</p>
              <p className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">{box.eff}%</p>
            </button>
          ))}
        </div>

        {/* Real 3D Bin Packing Visualizer Canvas Viewport */}
        <div className="pt-2">
          <BinPacking3DViewer selectedBox={activeBox} />
        </div>

        <button
          onClick={() => {
            setConfirmed(true);
            alert(`[3D Bin Packing 패킹 확정 완료] ${activeBox.name} (공간효율 ${activeBox.eff}%)이 출고 박스로 최종 확정되었습니다.`);
          }}
          className={`w-full py-3.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
            confirmed
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{confirmed ? '3D Bin Packing 패킹 확정 완료' : `${activeBox.name} 패킹 확정`}</span>
        </button>
      </div>

      {/* Mobile Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t dark:border-gray-800 z-40 max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyLpn}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
          >
            <Scan className="w-4 h-4" />
            <span>LPN 수동 검증</span>
          </button>
          <button
            onClick={() => {
              setConfirmed(true);
              alert(`[출고 완공] ${manualLpn} 건 출고 패킹 처리가 완료되었습니다.`);
            }}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
          >
            <FileCheck className="w-4 h-4" />
            <span>출고 패킹 완공</span>
          </button>
        </div>
      </div>

    </div>
  );
}
