'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import StatCard from './StatCard';

export default function QueueStatsClient() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  
  const { pendingCount, completedCount, failedCount } = useMemo(() => {
    return {
      pendingCount: uploadQueue.filter(t => t.status === 'UPLOADING' || t.status === 'ANALYZING').length,
      completedCount: uploadQueue.filter(t => t.status === 'COMPLETED').length,
      failedCount: uploadQueue.filter(t => t.status === 'FAILED').length,
    };
  }, [uploadQueue]);

  return (
    <>
      <StatCard
        icon={CheckCircle}
        label="AI 검수 완료 (세션)"
        value={completedCount}
        unit="권"
        colorClass="bg-indigo-50 text-indigo-600"
      />
      <StatCard
        icon={AlertTriangle}
        label="대기 중인 검수 (Queue)"
        value={pendingCount}
        unit="건"
        colorClass="bg-yellow-50 text-yellow-600"
      />
      {/* 실패 건은 완료로 묻히면 재촬영 대상을 놓친다 */}
      <StatCard
        icon={XCircle}
        label="검수 실패 (재전송 필요)"
        value={failedCount}
        unit="건"
        colorClass="bg-red-50 text-red-600"
      />
    </>
  );
}
