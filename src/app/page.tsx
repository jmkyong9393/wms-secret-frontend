'use client';

import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  const pendingCount = uploadQueue.filter(t => t.status !== 'COMPLETED').length;
  const completedCount = uploadQueue.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">물류 센터 통합 대시보드</h2>
          <p className="text-sm text-gray-500 mt-1">실시간 AI 검수 현황 및 재고 요약</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">누적 입고량 (오늘)</p>
            <h3 className="text-2xl font-bold text-gray-800">1,284 <span className="text-sm font-normal text-gray-500">권</span></h3>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">AI 검수 완료 (세션)</p>
            <h3 className="text-2xl font-bold text-gray-800">{completedCount} <span className="text-sm font-normal text-gray-500">권</span></h3>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">대기 중인 검수 (Queue)</p>
            <h3 className="text-2xl font-bold text-gray-800">{pendingCount} <span className="text-sm font-normal text-gray-500">건</span></h3>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">자동 발주 생성 (PO)</p>
            <h3 className="text-2xl font-bold text-gray-800">12 <span className="text-sm font-normal text-gray-500">건</span></h3>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">최근 AI 검수 기록</h3>
          {uploadQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <p>아직 진행된 검수 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...uploadQueue].reverse().slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50">
                  <div className="flex items-center space-x-4">
                    <img src={task.previewUrl} alt="book" className="w-12 h-12 object-cover rounded-md border border-gray-200" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{task.id.replace('local_', 'REQ-')}</p>
                      <p className="text-xs text-gray-500">UBCI 판독 대기 중</p>
                    </div>
                  </div>
                  <div>
                    {task.status === 'COMPLETED' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">검수 완료</span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full flex items-center">
                        <span className="w-2 h-2 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin mr-2" />
                        분석 중
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: System Status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">시스템 상태</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Celery Worker Load</span>
                <span className="font-semibold text-gray-800">24%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '24%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">PostgreSQL DB IO</span>
                <span className="font-semibold text-gray-800">45%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 leading-relaxed">
                현재 모든 파이프라인이 정상 작동 중입니다. 오토스케일링(HPA) 여유 리소스가 충분합니다.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
