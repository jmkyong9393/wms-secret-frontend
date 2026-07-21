'use client';

import { Search, Filter, Box, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '@/features/inventory/api';

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventoryList', searchTerm],
    queryFn: () => inventoryService.getInventoryList({ searchTerm }),
  });

  const inventoryList = inventoryData?.content || [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">가상 재고 창고</h1>
        <p className="text-gray-500 text-sm mt-1">LPN 기반 단품 추적 및 상태별 적치 위치를 확인합니다.</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-2 w-full md:w-1/2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="도서명, LPN, ISBN 검색" 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center text-gray-600 hover:bg-gray-100 font-medium">
            <Filter className="w-4 h-4 mr-2" /> 필터
          </button>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-bold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
          <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></div>S/A등급: 842권</div>
          <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-yellow-500 mr-2 shadow-sm"></div>B등급: 156권</div>
          <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-500 mr-2 shadow-sm"></div>C/D등급: 42권</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-4 px-5 font-bold">LPN 바코드</th>
                <th className="py-4 px-5 font-bold">도서명</th>
                <th className="py-4 px-5 font-bold">UBCI 등급</th>
                <th className="py-4 px-5 font-bold">적치 위치 (Zone)</th>
                <th className="py-4 px-5 font-bold">입고 일자</th>
              </tr>
            </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      재고 데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : inventoryList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">재고 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  inventoryList.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-5 text-sm font-mono text-gray-700 font-bold flex items-center">
                        <Box className="w-4 h-4 mr-2 text-blue-400" />
                        {item.id}
                      </td>
                      <td className="py-3 px-5 text-sm font-extrabold text-gray-900">{item.book}</td>
                      <td className="py-3 px-5">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
                          item.grade.includes('S등급') ? 'bg-emerald-100 text-emerald-800' :
                          item.grade.includes('A등급') ? 'bg-blue-100 text-blue-800' :
                          item.grade.includes('B등급') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.grade}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-sm text-gray-600 font-medium flex items-center">
                        <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                        {item.zone}
                      </td>
                      <td className="py-3 px-5 text-sm text-gray-500 font-medium">{item.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
