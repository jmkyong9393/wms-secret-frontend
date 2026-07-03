'use client';

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import CameraScanner from '@/components/camera/CameraScanner';

export default function InboundPage() {
  const [uploadQueue, setUploadQueue] = useAtom(uploadQueueAtom);

  // Mock API: 큐에 있는 항목들을 비동기로 처리 (낙관적 UI 시뮬레이션)
  useEffect(() => {
    const pendingTasks = uploadQueue.filter(task => task.status === 'PENDING');
    
    pendingTasks.forEach(task => {
      // 1. 상태를 UPLOADING으로 변경
      setUploadQueue(prev => 
        prev.map(t => t.id === task.id ? { ...t, status: 'UPLOADING' } : t)
      );

      // 2. 가상의 3초 네트워크 지연 (백엔드 LangGraph 처리 시간 모방)
      setTimeout(() => {
        setUploadQueue(prev => 
          prev.map(t => t.id === task.id ? { ...t, status: 'COMPLETED' } : t)
        );
      }, 3000);
    });
  }, [uploadQueue, setUploadQueue]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">반품 도서 검수 (Inbound)</h1>
        <p className="text-sm text-gray-500">가이드라인에 맞춰 도서를 촬영해주세요.</p>
      </div>

      {/* 카메라 스캐너 컴포넌트 */}
      <CameraScanner />

      {/* 낙관적 UI: 업로드 대기열 현황판 */}
      <div className="w-full max-w-md mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
          <span>작업 진행 현황</span>
          <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs">
            대기 {uploadQueue.filter(t => t.status !== 'COMPLETED').length}건
          </span>
        </h3>
        
        {uploadQueue.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">아직 촬영된 도서가 없습니다.</p>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
            {[...uploadQueue].reverse().map(task => (
              <div key={task.id} className="flex items-center space-x-3 text-sm">
                <img 
                  src={task.previewUrl} 
                  alt="preview" 
                  className="w-10 h-10 object-cover rounded-md border border-gray-200"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {task.status === 'COMPLETED' ? '검수 완료' : 'AI 분석 중...'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {task.id.replace('local_', 'REQ-')}
                  </div>
                </div>
                <div className="flex items-center">
                  {task.status === 'COMPLETED' ? (
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
