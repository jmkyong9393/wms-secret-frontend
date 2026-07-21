'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { Camera } from 'lucide-react';

export default function RecentInspectionsClient() {
  const uploadQueue = useAtomValue(uploadQueueAtom);

  const recentTasks = useMemo(() => {
    return [...uploadQueue].reverse().slice(0, 5);
  }, [uploadQueue]);

  return (
    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">최근 AI 검수 기록</h3>
      {recentTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Camera className="w-10 h-10 mb-2 opacity-50" />
          <p>아직 진행된 검수 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-50">
              <div className="flex items-center space-x-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
  );
}
