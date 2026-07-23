'use client';

import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { uploadQueueAtom } from '@/stores/atoms';
import { inboundService } from '@/features/inbound/api';

export function useBackgroundUploader() {
  const [queue, setQueue] = useAtom(uploadQueueAtom);
  const isProcessing = useRef(false);

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing.current) return;
      
      const pendingTask = queue.find(task => task.status === 'PENDING');
      if (!pendingTask) return;

      isProcessing.current = true;

      // Update status to UPLOADING
      setQueue(prev => prev.map(t => 
        t.id === pendingTask.id ? { ...t, status: 'UPLOADING' } : t
      ));

      try {
        // Convert Blob to File (mock name)
        const file = new File([pendingTask.blob], "scan_$(pendingTask.id).jpg", { type: 'image/jpeg' });
        
        // Use the inbound API to evaluate
        await inboundService.evaluateVisionGrade({
          imageFile: file,
          isbn: pendingTask.isbn
        });

        // Update status to COMPLETED
        setQueue(prev => prev.map(t => 
          t.id === pendingTask.id ? { ...t, status: 'COMPLETED' } : t
        ));
      } catch (error) {
        console.error('Failed to upload task:', pendingTask.id, error);
        // Update status to FAILED
        setQueue(prev => prev.map(t => 
          t.id === pendingTask.id ? { ...t, status: 'FAILED' } : t
        ));
      } finally {
        isProcessing.current = false;
      }
    };

    processQueue();
  }, [queue, setQueue]);
}
