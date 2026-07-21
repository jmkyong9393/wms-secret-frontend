'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import StatCard from './StatCard';

export default function QueueStatsClient() {
  const uploadQueue = useAtomValue(uploadQueueAtom);
  
  const { pendingCount, completedCount } = useMemo(() => {
    return {
      pendingCount: uploadQueue.filter(t => t.status !== 'COMPLETED').length,
      completedCount: uploadQueue.filter(t => t.status === 'COMPLETED').length,
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
    </>
  );
}
