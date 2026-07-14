'use client';

import { useState, useEffect, useRef, memo } from 'react';

// --- 모의 API 통신 ---
const mockFetchItem = async (id: number) => {
  return { id, status: 'PENDING' as const };
};

const mockUpdateItem = async (id: number) => {
  return { id, status: 'APPROVED' as const };
};

// --- 하위 컴포넌트 (독립적 페칭 및 상태 관리) ---
// React.memo를 씌워서 ID가 바뀌지 않으면 상위 렌더링에 영향받지 않게 방어
const ColocatedCard = memo(({ id, reportRender }: { id: number, reportRender: (cost: number) => void }) => {
  const [data, setData] = useState<{ id: number, status: 'PENDING' | 'APPROVED'} | null>(null);
  const renderTime = performance.now();
  const updateStartTime = useRef(0);

  useEffect(() => {
    // 마운트 시 자신이 필요한 데이터 스스로 Fetch
    mockFetchItem(id).then(setData);
  }, [id]);

  const handleApprove = async () => {
    updateStartTime.current = performance.now();
    // 스스로 통신 후 상태 업데이트
    const updated = await mockUpdateItem(id);
    setData(updated);
  };

  useEffect(() => {
    if (updateStartTime.current > 0) {
      reportRender(performance.now() - updateStartTime.current);
      updateStartTime.current = 0; // 측정 후 초기화
    }
  });

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ border: '1px solid #ccc', padding: '8px', margin: '4px', background: data.status === 'APPROVED' ? '#d4edda' : '#fff' }}>
      <p>Item ID: {data.id} - Status: {data.status}</p>
      <button onClick={handleApprove}>Approve</button>
      <span style={{fontSize: '10px', color: 'gray'}}> Rendered at: {renderTime.toFixed(2)}ms</span>
    </div>
  );
});

ColocatedCard.displayName = 'ColocatedCard';

// --- 상위 페이지 (Colocated) ---
export default function ColocatedTestPage() {
  const [ids, setIds] = useState<number[]>([]);
  const [renderStats, setRenderStats] = useState({ initial: 0, lastUpdate: 0 });
  const mountTime = useRef(performance.now());

  useEffect(() => {
    // 최상단은 'ID 배열'만 Fetch
    const fetchedIds = Array.from({ length: 100 }, (_, i) => i);
    setIds(fetchedIds);
    setRenderStats(prev => ({ ...prev, initial: performance.now() - mountTime.current }));
  }, []);

  const handleReportRender = (cost: number) => {
    setRenderStats(prev => ({ ...prev, lastUpdate: cost }));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Case B: Colocated Fetching Test</h1>
      <div style={{ background: '#f8f9fa', padding: '10px', marginBottom: '20px' }}>
        <p><strong>Initial Load Time:</strong> {renderStats.initial.toFixed(2)} ms</p>
        <p><strong>Re-render Cost (1 item click):</strong> <span style={{color: 'blue', fontWeight: 'bold'}}>{renderStats.lastUpdate.toFixed(2)} ms</span></p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {ids.map(id => (
          <ColocatedCard key={id} id={id} reportRender={handleReportRender} />
        ))}
      </div>
    </div>
  );
}
