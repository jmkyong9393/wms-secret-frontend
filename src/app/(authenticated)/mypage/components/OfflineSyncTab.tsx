'use client';

import { CloudOff, RefreshCw } from 'lucide-react';

/**
 * 오프라인 동기화 큐(Sync Queue) 화면을 렌더링하는 컴포넌트입니다.
 * 네트워크가 끊긴 음영 구역(Offline)에서 작업한 내역이 모이는 곳이며, 
 * 인터넷 연결이 복구되었을 때 수동으로 '재시도' 버튼을 눌러 서버에 데이터를 동기화합니다.
 * 
 * 모바일 디바이스에서 글씨가 깨지지 않도록 text-wrap 설정 및 반응형 flex 스타일이 적용되어 있습니다.
 * 
 * @component
 */
export default function OfflineSyncTab() {
  return (
    <div className="max-w-3xl mx-auto pt-4">
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center mb-2">
              <CloudOff className="mr-3 w-6 h-6 text-red-500" />
              오프라인 동기화 큐 (Sync Queue)
            </h2>
            <p className="text-sm text-gray-600">
              음영 구역(Offline)에서 작업하여 아직 서버로 전송되지 못한 데이터입니다. 네트워크 연결 후 수동 동기화를 진행해주세요.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1.5 rounded-full flex items-center">
              동기화 실패 2건
            </span>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-gray-800 break-words">도서 입고 (ISBN: 9791192931448)</span>
              <span className="text-sm text-gray-500 mt-1">작업 일시: 2026-07-13 11:24</span>
              <span className="text-xs text-red-500 mt-1">에러: Network Error - 서버에 도달할 수 없습니다.</span>
            </div>
            <button className="flex-shrink-0 flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200 whitespace-nowrap">
              <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
              재시도
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-gray-800 break-words">결함 등록 (ISBN: 9788966260959)</span>
              <span className="text-sm text-gray-500 mt-1">작업 일시: 2026-07-13 11:20</span>
              <span className="text-xs text-red-500 mt-1">에러: Network Error - 연결 시간이 초과되었습니다.</span>
            </div>
            <button className="flex-shrink-0 flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200 whitespace-nowrap">
              <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
              재시도
            </button>
          </div>
        </div>

        <button className="w-full bg-gray-900 text-white font-bold py-3.5 px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center text-base sm:text-lg break-keep shadow-sm">
          <RefreshCw className="w-5 h-5 mr-2 flex-shrink-0" />
          전체 수동 재시도 (Sync All)
        </button>
      </div>
    </div>
  );
}
