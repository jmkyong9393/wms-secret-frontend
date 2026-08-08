'use client';
// [미사용/확장예정] 적치(putaway) 단계 모달. 랙 배정 흐름에 연결할 수 있다.

import React, { useState } from 'react';
import { X, CheckCircle2, MapPin, PackageCheck, AlertCircle } from 'lucide-react';

interface PutawayStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  lpnBarcode: string;
  bookTitle?: string;
  recommendedLocation?: string;
  onSuccess?: () => void;
}

export default function PutawayStepModal({
  isOpen,
  onClose,
  lpnBarcode,
  bookTitle = 'SQL 자격검정 실전문제 (노랭이)',
  recommendedLocation = 'Zone B-1-4',
  onSuccess
}: PutawayStepModalProps) {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const handleConfirmPutaway = async () => {
    setLoading(true);
    try {
      // Simulate or call putaway API endpoint
      await new Promise((res) => setTimeout(res, 800));
      setCompleted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setCompleted(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error("Putaway error", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">현장 랙 적치 (Putaway)</h3>
            <p className="text-xs text-slate-400">검수 완료 도서를 지정 랙에 물리적으로 보관합니다.</p>
          </div>
        </div>

        {completed ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-xl font-bold text-emerald-300">적치 완료 처리되었습니다!</h4>
            <p className="text-sm text-slate-400">LPN: {lpnBarcode} ➔ {recommendedLocation}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 border border-slate-700">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">LPN 바코드:</span>
                <span className="font-mono text-emerald-400 font-bold">{lpnBarcode || 'LPN-260728-A002'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">도서명:</span>
                <span className="font-medium text-slate-200 truncate max-w-[200px]">{bookTitle}</span>
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl flex items-center gap-3">
              <MapPin className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">추천 랙 로케이션</span>
                <div className="text-2xl font-black text-white font-mono">{recommendedLocation}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-400/90 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>실제 물류 랙의 라벨과 추천 로케이션이 일치하는지 확인 후 완료하세요.</span>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
              >
                취소
              </button>
              <button
                onClick={handleConfirmPutaway}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {loading ? '적치 처리 중...' : '랙 적치 완료'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
