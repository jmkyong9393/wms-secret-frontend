'use client';
import { API_BASE_URL } from '@/lib/api-client';

import { useState, useEffect } from 'react';
import { Search, Download, Filter, FileText, Loader2, AlertTriangle, Trash2, Camera, Printer, RefreshCcw, Check, Edit2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inboundService } from '@/features/inbound/api';
import { HistoryLog } from '@/features/inbound/types';
import * as xlsx from 'xlsx';
import { BBoxImageRenderer } from '@/components/ui/BBoxImageRenderer';
import { QRCodeSVG } from 'qrcode.react';
import { labelsAPI } from '@/lib/api';

export default function HistoryDataGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBook, setSelectedBook] = useState<HistoryLog | null>(null);
  const queryClient = useQueryClient();
  
  // AI Detail Result Fetching
  const [detailData, setDetailData] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // 수동 ISBN 입력 관련 상태
  const [editingLpn, setEditingLpn] = useState<string | null>(null);
  const [editIsbnVal, setEditIsbnVal] = useState('');
  const [isUpdatingIsbn, setIsUpdatingIsbn] = useState(false);

  useEffect(() => {
    if (selectedBook && selectedBook.job_id) {
      setIsDetailLoading(true);
      setSelectedImageIndex(0); // Reset index when opening a new book
      fetch(`${API_BASE_URL}/api/v1/inbound/result/${selectedBook.job_id}`)
        .then(res => res.json())
        .then(data => {
          setDetailData(data);
        })
        .catch(err => console.error(err))
        .finally(() => setIsDetailLoading(false));
    } else {
      setDetailData(null);
    }
  }, [selectedBook]);

  const handleUpdateIsbn = async (lpn: string) => {
    if (!editIsbnVal.trim()) {
      setEditingLpn(null);
      return;
    }
    
    setIsUpdatingIsbn(true);
    try {
      const res = await fetch(`/api/book?isbn=${editIsbnVal.trim()}`);
      let bookInfo = null;
      if (res.ok) {
        bookInfo = await res.json();
      }

      const localData = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
      const updated = localData.map((item: any) => 
        item.lpn === lpn 
          ? { 
              ...item, 
              isbn: editIsbnVal.trim(),
              title: bookInfo?.title || item.title,
              author: bookInfo?.author || item.author,
              publisher: bookInfo?.publisher || item.publisher,
              category: bookInfo?.categoryName?.split('>').pop() || item.category
            } 
          : item
      );
      localStorage.setItem('local_evaluations', JSON.stringify(updated));
      
      queryClient.invalidateQueries({ queryKey: ['historyLogs'] });
      setEditingLpn(null);
    } catch (e) {
      console.error(e);
      alert('도서 정보 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingIsbn(false);
    }
  };

  const handlePrintQRCode = async () => {
    if (!selectedBook?.lpn) return;
    try {
      const result = await labelsAPI.printLpn(selectedBook.lpn, selectedBook.title, selectedBook.isbn);
      if (result.skipped) {
        alert('라벨 프린터가 비활성화되어 있습니다 (LABEL_PRINTER_ENABLED).');
      } else if (!result.sent && !result.queued) {
        alert('라벨 전송에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('라벨 프린터 통신 중 오류가 발생했습니다. 프린터 전원/LAN 연결을 확인해주세요.');
    }
  };

  // Dummy action handlers
  const handleDelete = () => {
    if (selectedBook && confirm(`[관리자 권한] 해당 작업 내역(${selectedBook.lpn})을 삭제하시겠습니까?`)) {
      if (selectedBook.id.startsWith('local_')) {
        // 실제 스캔한 데이터 삭제
        const localData = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
        const updated = localData.filter((item: any) => item.job_id !== selectedBook.job_id);
        localStorage.setItem('local_evaluations', JSON.stringify(updated));
      } else {
        // Mock 데이터 삭제 (숨김 처리)
        const deletedMocks = JSON.parse(localStorage.getItem('deleted_mocks') || '[]');
        deletedMocks.push(selectedBook.id);
        localStorage.setItem('deleted_mocks', JSON.stringify(deletedMocks));
      }
      
      // React Query 캐시 초기화 (목록 리렌더링)
      queryClient.invalidateQueries({ queryKey: ['historyLogs'] });
      
      alert("삭제가 완료되었습니다.");
      setSelectedBook(null);
    }
  };

  const handleRetake = () => {
    if (confirm(`현장 작업자에게 해당 도서(${selectedBook?.lpn})의 재촬영을 요청하시겠습니까?`)) {
      alert("재촬영 요청이 전송되었습니다. (Prototype)");
      setSelectedBook(null);
    }
  };

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

  const handleExcelDownload = () => {
    const exportData = filteredData.map(item => ({
      '검수 일시': item.date,
      'LPN 바코드': item.lpn,
      'ISBN': item.isbn,
      '도서명': item.title,
      '최종 판정': item.status,
      'UBCI 점수': item.ubciScore || '-',
      '사유 코드': item.reasonCode || '-',
      'AI 확신도': item.aiConfidence,
      '판정 주체': item.reviewer
    }));
    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Inventory Data");
    xlsx.writeFile(workbook, `nexus_inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatReasonCode = (code: string) => {
    if (!code || code === '-') return '-';
    let cleaned = code.replace(/\[감점:\s*-?\d+점\]\s*/g, ''); // [감점: -xx점] 텍스트 제거
    cleaned = cleaned.replace(/주요 훼손 사유 요약\s*\(/g, '').replace(/\)$/g, ''); // 불필요한 접두/접미어 제거
    return cleaned.trim() || '-';
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

          <button 
            onClick={handleExcelDownload}
            className="flex items-center px-4 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-colors border border-green-200">
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
              <th className="px-4 py-3 font-medium whitespace-nowrap text-gray-500 hidden md:table-cell">저자</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap text-gray-500 hidden lg:table-cell">분류</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap text-gray-500 hidden sm:table-cell">출판사</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">최종 판정</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">UBCI 점수</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">사유 코드</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">AI 확신도</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">판정 주체</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  작업 내역을 불러오는 중입니다...
                </td>
              </tr>
            ) : currentData.length > 0 ? (
              currentData.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-4 text-indigo-600 font-mono font-bold whitespace-nowrap">
                    <button onClick={() => setSelectedBook(row)} className="hover:underline">{row.lpn}</button>
                  </td>
                  <td className="px-4 py-4 text-gray-500 font-mono whitespace-nowrap">
                    {editingLpn === row.lpn ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={editIsbnVal}
                          onChange={(e) => setEditIsbnVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateIsbn(row.lpn);
                            if (e.key === 'Escape') setEditingLpn(null);
                          }}
                          className="border border-gray-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="ISBN 입력"
                          autoFocus
                          disabled={isUpdatingIsbn}
                        />
                        <button 
                          onClick={() => handleUpdateIsbn(row.lpn)} 
                          className="bg-emerald-600 text-white p-1 rounded hover:bg-emerald-700 disabled:opacity-50"
                          disabled={isUpdatingIsbn}
                        >
                          {isUpdatingIsbn ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button 
                          onClick={() => setEditingLpn(null)} 
                          className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300"
                          disabled={isUpdatingIsbn}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : row.isbn === '알 수 없음' || !row.isbn ? (
                      <button 
                        onClick={() => { setEditingLpn(row.lpn); setEditIsbnVal(''); }}
                        className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded text-xs font-bold border border-amber-200 flex items-center shadow-sm"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        수동 입력
                      </button>
                    ) : (
                      <button onClick={() => setSelectedBook(row)} className="hover:underline">{row.isbn}</button>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold text-gray-800 whitespace-nowrap max-w-[200px] truncate" title={row.title}>{row.title}</td>
                  <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap max-w-[120px] truncate hidden md:table-cell" title={row.author}>{row.author || '-'}</td>
                  <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap max-w-[100px] truncate hidden lg:table-cell" title={row.category}>{row.category || '-'}</td>
                  <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap max-w-[100px] truncate hidden sm:table-cell" title={row.publisher}>{row.publisher || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.status.includes('S') || row.status.includes('A') ? 'bg-emerald-100 text-emerald-700' :
                      row.status === '반려' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-bold text-gray-700 whitespace-nowrap">
                    {row.ubciScore !== undefined && row.ubciScore !== null ? `${row.ubciScore}점` : '-'}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-gray-500 whitespace-nowrap max-w-[200px] truncate" title={row.reasonCode || '-'}>
                    {formatReasonCode(row.reasonCode || '-')}
                  </td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.aiConfidence}</td>
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                    <span className="flex items-center">
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${row.reviewer.includes('AI') ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                      {row.reviewer}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <button onClick={() => setSelectedBook(row as any)} className="text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-3 py-1 rounded-lg">상세</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
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

      {/* Book Info Modal */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                도서 상세 검수 리포트
              </h3>
              <button onClick={() => setSelectedBook(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            
            {/* Body */}
            <div className="flex flex-col md:flex-row flex-1 overflow-auto">
              {/* Left Column: Image & BBox */}
              <div className="w-full md:w-3/5 border-b md:border-b-0 md:border-r border-gray-100 p-6 flex flex-col bg-slate-50">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                  <Camera className="w-4 h-4 mr-2" />
                  현장 촬영 증빙 (Evidence)
                </h4>
                
                {/* Main Evidence Image */}
                <div className="bg-gray-100 rounded-lg h-80 flex items-center justify-center overflow-hidden relative">
                  {isDetailLoading ? (
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-500" />
                      <p>AI 판독 데이터 불러오는 중...</p>
                    </div>
                  ) : detailData?.images?.length > 0 ? (
                    <BBoxImageRenderer 
                      src={detailData.images[selectedImageIndex]} 
                      bboxes={(detailData.result?.defect_coordinates || []).filter((box: any) => (box.image_index || 0) === selectedImageIndex)}
                      alt="선택된 이미지"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                      <p>등록된 증빙 사진이 없습니다.</p>
                    </div>
                  )}
                </div>
                
                {/* Thumbnails (Carousel) */}
                {detailData?.images?.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                    {detailData.images.map((img: string, idx: number) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-20 h-20 flex-shrink-0 border-2 rounded cursor-pointer transition-all ${
                          selectedImageIndex === idx ? 'border-indigo-500 opacity-100' : 'border-transparent hover:border-gray-300 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Right Column: Meta Info & Actions */}
              <div className="w-full md:w-2/5 p-6 flex flex-col">
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">LPN 바코드</span>
                      <p className="font-mono text-indigo-700 font-bold text-lg">{selectedBook.lpn}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="bg-white p-1 rounded border border-gray-200">
                        <QRCodeSVG 
                          id="lpn-qr-code" 
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/certificate/${selectedBook.lpn}`} 
                          size={64} 
                        />
                      </div>
                      <button 
                        onClick={handlePrintQRCode}
                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors font-medium bg-gray-50 hover:bg-indigo-50 px-2 py-1 rounded border border-gray-200"
                        title="QR코드 인쇄"
                      >
                        <Printer size={12} /> 라벨 인쇄
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">도서명</span>
                    <p className="font-semibold text-gray-800 text-base">{selectedBook.title}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">판독 등급</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        selectedBook.status.includes('S') || selectedBook.status.includes('A') ? 'bg-emerald-100 text-emerald-700' :
                        selectedBook.status === '반려' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedBook.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">UBCI 점수</span>
                      <p className="font-bold text-gray-800 text-lg">{selectedBook.ubciScore !== undefined && selectedBook.ubciScore !== null ? selectedBook.ubciScore : '-'}점</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">상세 사유</span>
                      <p className="font-mono text-gray-600 text-sm line-clamp-2" title={detailData?.result?.defect_description || selectedBook.reasonCode}>{detailData?.result?.defect_description || selectedBook.reasonCode || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">검수자</span>
                      <p className="font-medium text-gray-700 text-sm">{selectedBook.reviewer}</p>
                    </div>
                  </div>
                  
                  {/* Warning Box */}
                  {selectedBook.status === '반려' && (
                    <div className="bg-red-50 p-3 rounded-lg flex items-start border border-red-100">
                      <AlertTriangle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-bold text-red-800">심각한 훼손 발견</h5>
                        <p className="text-xs text-red-600 mt-1">이 도서는 재판매가 불가능한 심각한 손상이 있습니다. 보증서 폐기 및 반품 절차를 진행해야 합니다.</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="mt-8 pt-4 border-t space-y-2">
                  <button 
                    onClick={async () => {
                      try {
                        const btn = document.getElementById('retry-btn');
                        if (btn) btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> AI 재평가 진행 중... (최대 30초 소요)';
                        
                        const res = await fetch(`${API_BASE_URL}/api/v1/inbound/retry/${selectedBook.job_id}`, {
                          method: 'POST'
                        });
                        if (!res.ok) throw new Error('재평가 실패');
                        const data = await res.json();
                        
                        // Update local_evaluations
                        const localData = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
                        const updated = localData.map((item: any) => 
                          item.job_id === selectedBook.job_id 
                            ? { ...item, grade: data.grade, score: data.ubci_score, reasonCode: data.defect_description, timestamp: new Date().toISOString() } 
                            : item
                        );
                        localStorage.setItem('local_evaluations', JSON.stringify(updated));
                        
                        alert(`AI 재평가 완료! 최종 등급: ${data.grade}`);
                        // 쿼리 클라이언트 무효화 생략 가능 (페이지 리로드 유도 또는 상위 컴포넌트에서 훅 사용 필요)
                        if (typeof window !== 'undefined') window.location.reload();
                      } catch(e) {
                        alert('재평가 중 오류가 발생했습니다.');
                      }
                    }}
                    id="retry-btn"
                    className="w-full flex items-center justify-center py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-lg transition-colors mb-2"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    AI 재판단 요청 (Retry)
                  </button>
                  <button 
                    onClick={handleRetake}
                    className="w-full flex items-center justify-center py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-lg transition-colors"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    현장 재촬영 요청 (Worker)
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    목록에서 삭제 (Admin)
                  </button>
                  <button 
                    onClick={() => setSelectedBook(null)}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors mt-2"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
