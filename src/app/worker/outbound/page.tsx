"use client";
import { API_BASE_URL } from '@/lib/api-client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Search,
  Barcode,
  Smartphone,
  Zap,
  Volume2,
  FileCheck,
  PackageCheck,
  MapPin,
  BookOpen,
  ClipboardList,
  RefreshCcw,
  Bot,
  CheckCircle2,
} from 'lucide-react';
import PickingBarcodeScanner from '@/features/outbound/components/PickingBarcodeScanner';
import { useAtomValue } from 'jotai';
import { currentUserAtom } from '@/features/auth/store/authAtoms';

const API_BASE = `${API_BASE_URL}/api/v1`;

/**
 * LPN / ISBN 겸용 바코드 포맷터
 * - 978/979 시작 13자리 숫자는 ISBN으로 판정해 그대로 유지
 * - 그 외에는 LPN-YYMMDD-XXXX 규격으로 자동 하이픈 생성
 */
function formatBarcodeOrIsbn(input: string): string {
  if (!input) return '';
  let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('978') || clean.startsWith('979') || (clean.length === 13 && /^[0-9]+$/.test(clean))) {
    return clean;
  }
  if (clean.startsWith('LPN')) {
    clean = clean.substring(3);
  }
  if (clean.length === 0) return 'LPN-';
  if (clean.length <= 6) return `LPN-${clean}`;
  return `LPN-${clean.substring(0, 6)}-${clean.substring(6, 10)}`;
}

export default function WorkerOutboundPage() {
  // 로그인 사용자 사번 기준 (수락/스캔/포장 기록의 작업자 식별자)
  const currentUser = useAtomValue(currentUserAtom);
  const currentWorkerId = currentUser?.employeeId || 'WM2608001';
  const [showScanner, setShowScanner] = useState<boolean>(false);

  // 피킹 지시서 실시간 연동 상태
  const [instructions, setInstructions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const activeInstruction = instructions.find(i => i.id === selectedId) || null;

  const [manualLpn, setManualLpn] = useState<string>('');
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  // 실시간 알림 toast (SSE 수신)
  const [toast, setToast] = useState<{ title: string; desc: string } | null>(null);

  const fetchInstructions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/orders/picking-instructions?active_only=true&limit=20`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // worker 작업 대상: 수락 대기 ~ 포장 대기(PACKED)까지 (SHIPPED/CANCELLED 제외)
        const workable = data.filter((i: any) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'PICKED', 'PACKED'].includes(i.status));
        setInstructions(workable);
        setSelectedId(prev => {
          if (prev && workable.some((i: any) => i.id === prev)) return prev;
          return workable.length > 0 ? workable[0].id : null;
        });
      }
    } catch (e) {
      console.error("Failed to fetch picking instructions:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstructions(); }, [fetchInstructions]);

  // notifications:global SSE 구독 - 신규 지시서/송장 발급 실시간 toast + 목록 갱신
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/notifications/stream`);
    es.onmessage = (event) => {
      try {
        const evt = JSON.parse(event.data);
        if (!evt || evt.type === 'CONNECTED') return;
        if (['PICKING_INSTRUCTION_ISSUED', 'WAYBILL_ISSUED'].includes(evt.type)) {
          setToast({ title: evt.title, desc: evt.description || '' });
          fetchInstructions();
          if (evt.type === 'PICKING_INSTRUCTION_ISSUED' && evt.instruction_id) {
            setSelectedId(evt.instruction_id);
          }
        }
      } catch { /* 파싱 실패 무시 */ }
    };
    // 폴백: SSE 유실 대비 20초 주기 목록 동기화
    const interval = setInterval(fetchInstructions, 20000);
    return () => { es.close(); clearInterval(interval); };
  }, [fetchInstructions]);

  // toast 5초 후 자동 숨김
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAcceptInstruction = async () => {
    if (!activeInstruction) return;
    try {
      setIsAccepting(true);
      const res = await fetch(`${API_BASE}/orders/picking-instructions/${activeInstruction.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: currentWorkerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`수락 실패: ${data.detail || data.message}`);
        return;
      }
      await fetchInstructions();
    } catch (e) {
      alert('백엔드 연결 실패');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCompletePacking = async () => {
    if (!activeInstruction) return;
    try {
      setIsCompleting(true);
      const res = await fetch(`${API_BASE}/orders/picking-instructions/${activeInstruction.id}/complete-packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: currentWorkerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`포장 완료 처리 실패: ${data.detail || data.message}`);
        return;
      }
      alert(`✅ ${data.message}`);
      await fetchInstructions();
    } catch (e) {
      alert('백엔드 연결 실패');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleManualLpnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualLpn(formatBarcodeOrIsbn(e.target.value));
  };

  const handleVerifyLpn = async () => {
    if (!manualLpn || manualLpn.length < 8) {
      alert("유효한 LPN 바코드 또는 13자리 ISBN을 입력하세요. (예: 260728A002 또는 9791163033455)");
      return;
    }
    if (!activeInstruction) {
      alert("진행할 피킹 지시서를 먼저 선택하세요.");
      return;
    }
    try {
      setIsScanning(true);
      setScanError(null);
      const res = await fetch(`${API_BASE}/orders/picking-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: manualLpn,
          worker_id: currentWorkerId,
          instruction_id: activeInstruction.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanResult(null);
        setScanError(data.detail || data.message || '피킹 매칭에 실패했습니다.');
        return;
      }
      setScanResult({ ...data, timestamp: new Date().toLocaleTimeString() });
      setManualLpn('');
      await fetchInstructions();
      if (data.all_picked) {
        alert(`✅ [피킹 전량 완료] 지시서 ${data.instruction_no}의 모든 품목 피킹이 완료되었습니다.\n관리자 출고 화면에서 패킹 박스 확정 후 송장이 발급됩니다.`);
      }
    } catch (e) {
      setScanError('백엔드 연결 실패');
    } finally {
      setIsScanning(false);
    }
  };

  const progressPct = activeInstruction && activeInstruction.total_items > 0
    ? Math.round((activeInstruction.picked_items / activeInstruction.total_items) * 100)
    : 0;

  const isPackingStage = activeInstruction?.status === 'PACKED';
  const isPendingAccept = activeInstruction?.status === 'PENDING';
  const canScan = activeInstruction && ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(activeInstruction.status);

  return (
    <div className="w-full max-w-md mx-auto space-y-4 font-sans text-gray-900 dark:text-gray-100 pb-6 bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* 실시간 지시서 알림 Toast (SSE) */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md p-3.5 bg-indigo-600 text-white rounded-2xl shadow-2xl border border-indigo-400 animate-in slide-in-from-top-4 duration-300">
          <p className="font-black text-sm flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 shrink-0" /> {toast.title}
          </p>
          {toast.desc && <p className="text-[11px] opacity-90 mt-0.5">{toast.desc}</p>}
        </div>
      )}

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

      {/* 피킹 지시서 선택 & 진행률 카드 */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            내 피킹 지시서 (AI 발행)
          </label>
          <button onClick={fetchInstructions} className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer">
            <RefreshCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>

        {instructions.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-gray-400 font-bold border border-dashed rounded-xl dark:border-gray-700">
            {isLoading ? '지시서 조회 중...' : '진행 대기 중인 피킹 지시서가 없습니다.\n관리자 주문 관제에서 지시서 발행 후 이용하세요.'}
          </div>
        ) : (
          <>
            <select
              value={selectedId || ''}
              onChange={e => { setSelectedId(e.target.value); setScanResult(null); setScanError(null); }}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-black font-mono outline-none focus:border-indigo-600 cursor-pointer"
            >
              {instructions.map(i => (
                <option key={i.id} value={i.id}>
                  {i.status === 'PENDING' ? '🔔 [수락 대기] ' : i.status === 'PACKED' ? '📦 [포장 대기] ' : ''}
                  {i.instruction_no} · {i.customer_name || 'B2B'} · {i.picked_items}/{i.total_items}권
                </option>
              ))}
            </select>

            {/* 신규 지시서 수락 단계 */}
            {isPendingAccept && (
              <button
                onClick={handleAcceptInstruction}
                disabled={isAccepting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 animate-pulse"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>{isAccepting ? '수락 처리 중...' : '🔔 신규 피킹 지시서 수락하기'}</span>
              </button>
            )}
            {activeInstruction?.accepted_by && (
              <p className="text-[10px] font-mono font-bold text-gray-400 text-right">
                ✓ {activeInstruction.accepted_by} 수락 · {activeInstruction.accepted_at ? new Date(activeInstruction.accepted_at).toLocaleTimeString() : ''}
              </p>
            )}

            {activeInstruction && (
              <>
                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-black font-mono">
                    <span className="text-indigo-700 dark:text-indigo-300">피킹 진행률</span>
                    <span className={progressPct >= 100 ? 'text-emerald-600' : 'text-gray-500'}>
                      {activeInstruction.picked_items}/{activeInstruction.total_items}권 ({progressPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>
                </div>

                {/* AI 동선/지시문 */}
                {(activeInstruction.route_summary || activeInstruction.worker_note) && (
                  <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-1">
                    {activeInstruction.route_summary && (
                      <p className="text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600" />
                        {activeInstruction.route_summary}
                      </p>
                    )}
                    {activeInstruction.worker_note && (
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300 flex items-start gap-1">
                        <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600" />
                        {activeInstruction.worker_note}
                      </p>
                    )}
                  </div>
                )}

                {/* 피킹 대상 체크리스트 */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {activeInstruction.items.map((it: any) => {
                    const done = it.status === 'PICKED';
                    return (
                      <div key={it.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        done
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-[11px] truncate flex items-center gap-1">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">#{it.pick_seq}</span>
                            <span className={`px-1 py-0.5 rounded text-[8px] font-black shrink-0 ${
                              it.is_new ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            }`}>{it.is_new ? '신품' : '중고'}</span>
                            <span className="truncate">{it.title}</span>
                          </p>
                          <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                            {it.lpn_barcode || `ISBN ${it.isbn}`} · 📍 {it.location_label}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded shrink-0 font-mono ${
                          done
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {done ? '✓ 완료' : `${it.picked_quantity}/${it.quantity}권`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile WebCam Camera Scanner Viewport */}
      {showScanner && (
        <div className="bg-gray-950 p-4 rounded-2xl border-2 border-indigo-500 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-300 font-bold border-b border-gray-800 pb-2">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Zap className="w-4 h-4 animate-pulse" /> 현장 도서 피킹 카메라 스캔
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
              <Volume2 className="w-3 h-3 text-amber-400" /> 풋페달 추후 지원 예정
            </span>
          </div>
          <div className="w-full">
            {/* 스캔 결과는 아래 입력창에 채우기만 한다. 피킹 확정은 작업자가
                검증 버튼을 눌러야 이뤄진다 - 잘못 스친 바코드가 자동으로
                피킹 완료로 찍히면 되돌리기가 번거롭다. */}
            <PickingBarcodeScanner
              paused={isScanning}
              onDetected={(code) => {
                setManualLpn(formatBarcodeOrIsbn(code));
                setScanError(null);
              }}
            />
          </div>
          <p className="text-[11px] text-gray-400 font-bold text-center">
            바코드가 잡히면 아래 입력창에 자동으로 채워집니다. 확인 후 검증 버튼을 누르세요.
          </p>
        </div>
      )}

      {/* Manual Barcode Input Card */}
      <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            LPN(중고) / ISBN(신품) 피킹 검증
          </label>
          <span className="text-[10px] font-mono text-gray-400">'-' 자동 생성</span>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={manualLpn}
            onChange={handleManualLpnChange}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyLpn()}
            placeholder="LPN 또는 13자리 ISBN 입력"
            className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-700 focus:border-indigo-600 rounded-xl font-mono text-lg font-black tracking-wider text-indigo-900 dark:text-indigo-200 outline-none text-center shadow-inner"
          />
          <button
            onClick={handleVerifyLpn}
            disabled={isScanning || !canScan}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Search className="w-4.5 h-4.5" />
            <span>{isScanning ? '검증 중...' : canScan ? '피킹 스캔 검증 실행' : isPackingStage ? '피킹 완료됨 (포장 단계)' : '피킹 스캔 검증 실행'}</span>
          </button>
        </div>

        {/* 지시서 바코드 빠른 선택 (실제 지시서 데이터 기반) */}
        {activeInstruction && (
          <div className="flex items-center justify-between pt-1 gap-2">
            <span className="text-[11px] text-gray-400 font-bold shrink-0">빠른 스캔:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {activeInstruction.items
                .filter((it: any) => it.status !== 'PICKED')
                .slice(0, 3)
                .map((it: any) => {
                  const code = it.lpn_barcode || it.isbn;
                  return (
                    <button
                      key={it.id}
                      onClick={() => setManualLpn(formatBarcodeOrIsbn(code))}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-mono font-bold text-gray-700 dark:text-gray-300 active:bg-indigo-100 shrink-0 cursor-pointer"
                      title={it.title}
                    >
                      {code.slice(-6)}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Scan Error */}
      {scanError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-2xl border-2 border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
          ⚠️ {scanError}
        </div>
      )}

      {/* Scan Success Result Card */}
      {scanResult && (
        <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border-2 border-emerald-500 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black rounded-lg text-xs font-mono flex items-center gap-1">
              <PackageCheck className="w-4 h-4 text-emerald-600" /> 피킹 검증 성공
            </span>
            <span className="text-[11px] font-mono text-gray-400 font-bold">{scanResult.timestamp}</span>
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl space-y-2 border border-emerald-100 dark:border-emerald-900">
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 dark:text-white text-sm truncate">
                  {scanResult.matched_item.title}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">
                  {scanResult.matched_item.stock_type === 'USED'
                    ? `LPN: ${scanResult.matched_item.lpn_barcode}`
                    : `ISBN: ${scanResult.matched_item.isbn} (신품)`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-900/60">
              <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-rose-500" /> 위치:
              </span>
              <span className="px-3 py-1 bg-emerald-600 text-white font-black font-mono text-sm rounded-lg shadow-xs">
                {scanResult.matched_item.location_label}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-gray-500">
              <span>해당 품목 {scanResult.matched_item.picked_quantity}/{scanResult.matched_item.quantity}권</span>
              <span className="text-indigo-600 dark:text-indigo-400">지시서 전체 {scanResult.progress}권</span>
            </div>
          </div>
        </div>
      )}

      {/* 전량 피킹 완료 - admin 패킹 확정 대기 */}
      {activeInstruction?.status === 'PICKED' && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-2.5">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-black text-sm">피킹 전량 완료! ({activeInstruction.instruction_no})</p>
            <p className="text-[11px] opacity-90 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" />
              관리자 출고 최적화 화면에서 패킹 확정 시 CJ 송장이 발급됩니다. 발급되면 이 화면에 포장 가이드가 표시됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 송장 발급 완료 - 포장 작업 카드 (PACKED 단계) */}
      {isPackingStage && (
        <div className="bg-white dark:bg-gray-900 p-4.5 rounded-2xl border-2 border-amber-400 shadow-lg space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-2">
            <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black rounded-lg text-xs font-mono flex items-center gap-1">
              📦 송장 발급 완료 - 포장 작업
            </span>
            <span className="text-[11px] font-mono font-black text-indigo-700 dark:text-indigo-300">
              {activeInstruction.cj_waybill_no}
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold">패킹 박스</span>
              <span className="font-mono font-black text-gray-900 dark:text-white">{activeInstruction.box_id}</span>
            </div>
            {activeInstruction.cushion_name && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-bold">완충재</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{activeInstruction.cushion_name}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold">수령 거래처</span>
              <span className="font-bold text-gray-900 dark:text-white">{activeInstruction.customer_name || 'B2B 거래처'}</span>
            </div>
          </div>

          {/* 3D Bin Packing 적재 가이드 (하단→상단 순서) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              적재 가이드 - 아래 순서대로 하단부터 적재 (Bottom-Heavy Stack)
            </p>
            {activeInstruction.items.map((it: any, idx: number) => (
              <div key={it.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-[11px]">
                <span className="w-5 h-5 rounded bg-indigo-600 text-white font-black font-mono flex items-center justify-center shrink-0 text-[10px]">
                  {idx + 1}
                </span>
                <span className="font-bold truncate flex-1">{it.title}</span>
                <span className="font-mono text-gray-400 shrink-0">x{it.quantity}권</span>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 pl-0.5">
              💡 두껍고 무거운 도서를 하단에, 경량 도서를 상단에 적재하고 {activeInstruction.cushion_name || '완충재'}로 유격을 채우세요.
            </p>
          </div>

          <button
            onClick={handleCompletePacking}
            disabled={isCompleting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <PackageCheck className="w-4.5 h-4.5" />
            <span>{isCompleting ? '출고 확정 중...' : '📦 포장 완료 - 최종 출고 확정'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
