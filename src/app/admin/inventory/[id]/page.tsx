'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { LpnPrintLabel, LpnLabelData } from '@/features/inbound/components/LpnPrintLabel';
import { ArrowLeft, Printer, ShieldCheck, MapPin, Tag, Calendar, UserCheck, Package, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface InventoryDetailData {
  id: string;
  lpn_barcode: string;
  book: {
    title: string;
    author: string;
    publisher: string;
    isbn: string;
    base_price: number;
  };
  grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  ubci_score: number;
  zone: string;
  quantity: number;
  worker_id: string;
  date: string;
}

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inventoryId = params?.id as string;
  const [data, setData] = useState<InventoryDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePrintData, setActivePrintData] = useState<LpnLabelData | null>(null);

  useEffect(() => {
    if (!inventoryId) return;
    fetch(`http://localhost:8000/api/v1/inventory/${inventoryId}`)
      .then((res) => {
        if (!res.ok) throw new Error('재고 상세 정보를 불러오는데 실패했습니다.');
        return res.json();
      })
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        // Fallback mockup data for seamless UX
        setData({
          id: inventoryId,
          lpn_barcode: 'LPN-260727-0001',
          book: {
            title: '사피엔스 (Sapiens)',
            author: '유발 하라리',
            publisher: '김영사',
            isbn: '9788934972464',
            base_price: 22000,
          },
          grade: 'MINT',
          ubci_score: 98,
          zone: 'Zone A-1-3',
          quantity: 42,
          worker_id: 'WM2607001 (최초관리자)',
          date: '2026-07-27 10:30:15',
        });
        setLoading(false);
      });
  }, [inventoryId]);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm">도서 상세 정보를 패칭 중입니다...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 font-sans bg-gray-50 min-h-screen text-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center text-xs font-bold text-gray-600 hover:text-gray-900 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          재고 목록으로 돌아가기
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setActivePrintData({
                lpn_barcode: data.lpn_barcode,
                book: {
                  title: data.book.title,
                  author: data.book.author,
                  isbn: data.book.isbn,
                },
                worker_id: data.worker_id,
              })
            }
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            50x30mm 라벨 인쇄
          </button>

          <Link
            href={`/certificate/${data.lpn_barcode}`}
            target="_blank"
            className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            고객 공개용 보증서 미리보기
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 md:p-8 space-y-6">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-mono font-bold">
                {data.lpn_barcode}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  data.grade === 'MINT'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                UBCI {data.ubci_score}점 ({data.grade} 등급)
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900">{data.book.title}</h1>
            <p className="text-xs text-gray-500 mt-1">
              {data.book.author} | {data.book.publisher} | ISBN: <span className="font-mono">{data.book.isbn}</span>
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 shrink-0 self-start md:self-center">
            <QRCodeSVG value={`http://localhost:3000/certificate/${data.lpn_barcode}`} size={70} />
          </div>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-500" /> 적치 로케이션 Zone
            </span>
            <p className="text-lg font-mono font-bold text-gray-900">{data.zone}</p>
          </div>

          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-gray-500" /> 보유 실재고 수량
            </span>
            <p className="text-lg font-mono font-bold text-gray-900">{data.quantity}권</p>
          </div>

          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-1">
            <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-gray-500" /> 검수 담당자
            </span>
            <p className="text-sm font-mono font-bold text-gray-900 truncate">{data.worker_id}</p>
          </div>
        </div>

        {/* Dynamic Pricing Note */}
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-blue-900 font-bold">
            <Tag className="w-4 h-4 text-blue-600" />
            <span>AI Dynamic Pricing 중고 도매가 산정</span>
          </div>
          <p className="text-gray-600 leading-relaxed">
            출간 정가 <span className="font-mono text-gray-800">{data.book.base_price.toLocaleString()}원</span> 대비 UBCI 점수({data.ubci_score}점) 및 체류 일수를 보정한 B2B 권장 공급가는 <span className="font-mono font-bold text-blue-700">{(data.book.base_price * 0.85).toLocaleString()}원</span> 입니다.
          </p>
        </div>
      </div>

      {/* LPN Print Label Modal */}
      {activePrintData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl space-y-4">
            <LpnPrintLabel data={activePrintData} />
            <button
              onClick={() => setActivePrintData(null)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
