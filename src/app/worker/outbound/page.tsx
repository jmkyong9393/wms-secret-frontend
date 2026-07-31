"use client";

import React, { useState } from 'react';
import { 
  Camera, 
  CheckCircle2, 
  Search, 
  Barcode, 
  Smartphone, 
  Zap, 
  Volume2, 
  FileCheck,
  PackageCheck,
  MapPin,
  BookOpen
} from 'lucide-react';
import CameraScanner from '@/features/inbound/components/CameraScanner';

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
  const [showScanner, setShowScanner] = useState<boolean>(true);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Manual LPN State
  const [manualLpn, setManualLpn] = useState<string>('LPN-260727-A801');
  const [verificationResult, setVerificationResult] = useState<any | null>({
    lpn: 'LPN-260727-A801',
    title: 'Do it! 점프 투 파이썬 (개정 2판)',
    isbn: '9791163033455',
    location: 'D-3-3',
    quantity: 1,
    status: 'PICKING_READY',
    timestamp: new Date().toLocaleTimeString()
  });

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
      location: manualLpn.includes('A802') ? 'A-1-2' : 'D-3-3',
      quantity: 1,
      status: 'PICKING_VERIFIED',
      timestamp: new Date().toLocaleTimeString()
    });
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 font-sans text-gray-900 dark:text-gray-100 pb-6 bg-gray-50 dark:bg-gray-950 transition-colors">
      
      {/* Mobile Sticky Top App Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black font-mono flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> MOBILE PICKING WORKER
            </span>
          </div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-1.5">
            📦 현장 출고 피킹 스캐너
          </h1>
          <p className="text-gray-400 dark:text-gray-500 text-[11px] font-mono">
            작업자 ID: [{currentWorkerId}]
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
              <Zap className="w-4 h-4 animate-pulse" /> 현장 도서 피킹 카메라 스캔
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
              <Volume2 className="w-3 h-3 text-amber-400" /> 풋페달/버튼 지원
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
            LPN 바코드 피킹 검증 <span className="text-indigo-600 dark:text-indigo-400 font-normal">('-' 자동 생성)</span>
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
            <span>LPN 도서 피킹 검증 실행</span>
          </button>
        </div>

        {/* Quick Touch Preset Pills */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-gray-400 font-bold">빠른 테스트:</span>
          <div className="flex items-center gap-1.5">
            {['260727A801', '260727A802', '260727A805'].map((code) => (
              <button
                key={code}
                onClick={() => {
                  setManualLpn(formatLpnBarcode(code));
                }}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300 active:bg-indigo-100"
              >
                {code.slice(-4)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Picking Target Verification Output Card */}
      {verificationResult && (
        <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border-2 border-indigo-500 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black rounded-lg text-xs font-mono flex items-center gap-1">
              <PackageCheck className="w-4 h-4 text-emerald-600" /> 피킹 대상 검증 성공
            </span>
            <span className="text-[11px] font-mono text-gray-400 font-bold">
              {verificationResult.timestamp}
            </span>
          </div>

          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl space-y-2 border border-indigo-100 dark:border-indigo-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-bold">LPN 바코드</span>
              <span className="font-mono font-black text-indigo-900 dark:text-indigo-200 text-sm">
                {verificationResult.lpn}
              </span>
            </div>

            <div className="flex items-start gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/60">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 dark:text-white text-sm truncate">
                  {verificationResult.title}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">ISBN: {verificationResult.isbn}</p>
              </div>
            </div>

            {/* Location Pill */}
            <div className="flex items-center justify-between pt-2 border-t border-indigo-100 dark:border-indigo-900/60">
              <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-rose-500" /> 보관 위치:
              </span>
              <span className="px-3 py-1 bg-indigo-600 text-white font-black font-mono text-sm rounded-lg shadow-xs">
                {verificationResult.location}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Inline Action Button (No Fixed Overlay) */}
      <div className="pt-2">
        <button
          onClick={() => {
            setConfirmed(true);
            alert(`[출고 피킹 완료] LPN: ${manualLpn} 건의 피킹 검증이 완료되어 출고 대기 상태로 전환되었습니다.`);
          }}
          className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
            confirmed
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30'
          }`}
        >
          <FileCheck className="w-5 h-5" />
          <span>{confirmed ? '✅ 피킹 완료 처리됨' : '📦 출고 피킹 완료'}</span>
        </button>
      </div>

    </div>
  );
}
