'use client';
// [미사용/확장예정] 작업자 피킹 체크리스트. 피킹 지시서 도메인은 활성 상태다.

import React, { useState } from 'react';
import { PackageSearch, CheckCircle, MapPin, Search } from 'lucide-react';

interface PickingItem {
  id: string;
  orderId: string;
  bookTitle: string;
  lpnBarcode: string;
  location: string;
  status: 'PENDING' | 'PICKED';
}

export default function PickingChecklist() {
  const [items, setItems] = useState<PickingItem[]>([
    { id: '1', orderId: 'ORD-2026-901', bookTitle: 'SQL 자격검정 실전문제 (노랭이)', lpnBarcode: 'LPN-260728-A002', location: 'Zone B-1-4', status: 'PENDING' },
    { id: '2', orderId: 'ORD-2026-902', bookTitle: 'Do it! 점프 투 파이썬', lpnBarcode: 'LPN-260728-B005', location: 'Zone A-2-1', status: 'PENDING' },
    { id: '3', orderId: 'ORD-2026-903', bookTitle: '이것이 취업을 위한 코딩 테스트다', lpnBarcode: 'LPN-260728-C012', location: 'Zone C-3-2', status: 'PICKED' },
  ]);

  const togglePick = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: it.status === 'PENDING' ? 'PICKED' : 'PENDING' } : it))
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
            <PackageSearch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">출고 피킹 작업 목록 (Picking Checklist)</h3>
            <p className="text-xs text-slate-400">지정된 랙 로케이션에서 도서를 찾아 가트에 담습니다.</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full font-mono font-bold">
          대기: {items.filter(i => i.status === 'PENDING').length}건 / 완료: {items.filter(i => i.status === 'PICKED').length}건
        </span>
      </div>

      <div className="space-y-2.5 pt-2">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => togglePick(item.id)}
            className={`p-4 rounded-xl border transition cursor-pointer flex justify-between items-center ${
              item.status === 'PICKED'
                ? 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-60'
                : 'bg-slate-800/80 border-slate-700 text-slate-100 hover:border-blue-500/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                  item.status === 'PICKED'
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                    : 'border-slate-600 hover:border-blue-400'
                }`}
              >
                {item.status === 'PICKED' && <CheckCircle className="w-4 h-4 stroke-[3]" />}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-blue-400 font-bold">{item.orderId}</span>
                  <span className="text-xs text-slate-400">| {item.lpnBarcode}</span>
                </div>
                <h4 className="font-semibold text-sm mt-0.5">{item.bookTitle}</h4>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700/80">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-300">{item.location}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
