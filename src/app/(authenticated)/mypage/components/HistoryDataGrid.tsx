'use client';

import { useState } from 'react';
import { Search, Download, Filter, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { inboundService } from '@/services/inbound.service';

export default function HistoryDataGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: allMockData = [], isLoading } = useQuery({
    queryKey: ['historyLogs'],
    queryFn: inboundService.getHistoryLogs,
  });

  // 검색 필터링
  const filteredData = allMockData.filter(item => {
    const matchesSearch = item.lpn.includes(searchTerm) || 
                          item.title.includes(searchTerm) || 
                          item.isbn.includes(searchTerm);
    
    // 날짜 필터링 로직 (간단한 문자열 비교)
    const itemDateStr = item.date.split(' ')[0]; // YYYY-MM-DD 추출
    const matchesStartDate = startDate ? itemDateStr >= startDate : true;
    const matchesEndDate = endDate ? itemDateStr <= endDate : true;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 페이지네이션 계산
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  const currentData = filteredData.slice(startIndex, endIndex);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // 갯수 변경 시 1페이지로 초기화
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-2 w-6 h-6 text-indigo-600" />
          상세 작업 내역 (Data Grid)
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* 기간 조회 필터 */}
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="text-sm text-gray-500 font-medium">기간:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="text-sm bg-transparent outline-none text-gray-700"
            />
            <span className="text-gray-400">~</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="text-sm bg-transparent outline-none text-gray-700"
            />
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="LPN, 도서명, ISBN 검색..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <select 
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none bg-white cursor-pointer"
            >
              <option value={5}>5건 보기</option>
              <option value={10}>10건 보기</option>
              <option value={20}>20건 보기</option>
            </select>
          </div>

          <button className="flex items-center px-4 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200">
            <Download className="w-4 h-4 mr-2" />
            Excel 다운로드
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">검수 일시</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">LPN 바코드</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">ISBN</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">도서명</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">최종 판정</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">AI 확신도</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">판정 주체</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  작업 내역을 불러오는 중입니다...
                </td>
              </tr>
            ) : currentData.length > 0 ? (
              currentData.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-4 text-indigo-600 font-mono font-bold whitespace-nowrap">{row.lpn}</td>
                  <td className="px-4 py-4 text-gray-500 font-mono whitespace-nowrap">{row.isbn}</td>
                  <td className="px-4 py-4 font-semibold text-gray-800 whitespace-nowrap">{row.title}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.status.includes('S') || row.status.includes('A') ? 'bg-emerald-100 text-emerald-700' :
                      row.status === '반려' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.aiConfidence}</td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                    <span className="flex items-center">
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${row.reviewer.includes('AI') ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                      {row.reviewer}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <button className="text-indigo-600 hover:text-indigo-800 font-medium">상세</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-500">
          총 <span className="font-bold text-gray-900">{totalItems}</span>건 중 {totalItems > 0 ? startIndex + 1 : 0}-{endIndex} 렌더링
        </p>
        
        {totalPages > 0 && (
          <div className="flex space-x-1">
            <button 
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-tighter"
              title="첫 페이지"
            >
              &lt;&lt;
            </button>
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 border rounded text-sm font-bold ${
                  currentPage === page 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
            <button 
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-tighter"
              title="마지막 페이지"
            >
              &gt;&gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
