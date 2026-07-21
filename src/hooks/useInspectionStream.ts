import { useEffect, useState, useRef } from 'react';

// SSE를 통해 수신하는 작업 상태 인터페이스
export interface InspectionStatus {
  job_id: string;
  status: 'PENDING' | 'VISION_PROCESSING' | 'POLICY_PROCESSING' | 'CRITIC_PROCESSING' | 'REPORT_GENERATION' | 'COMPLETED' | 'FAILED';
  progress: number; // 0 ~ 100
  message: string;
  result_data?: any;
}

export function useInspectionStream(jobId: string | null) {
  const [status, setStatus] = useState<InspectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      setError(null);
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    // 브라우저 탭당 SSE 커넥션 수(통상 최대 6개)를 고려해, 연결을 관리합니다.
    const url = `${API_URL}/returns/inspections/${jobId}/stream`;
    
    // withCredentials 옵션을 주어 세션(토큰) 쿠키를 백엔드에 전송
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: InspectionStatus = JSON.parse(event.data);
        setStatus(data);

        // 완료 또는 실패 상태일 경우 SSE 연결 강제 종료 (리소스 반환)
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          eventSource.close();
        }
      } catch (err) {
        console.error('SSE Message parsing error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setError('서버와의 실시간 연결이 끊어졌습니다.');
      eventSource.close();
    };

    return () => {
      // 컴포넌트 언마운트 시 SSE 연결 정리
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId]);

  return { status, error };
}
