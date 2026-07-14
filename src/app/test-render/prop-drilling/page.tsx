'use client';

import { useState, useEffect, useRef } from 'react';

// --- 더미 데이터 및 타입 ---
interface DummyItem {
  id: number;
  status: 'PENDING' | 'APPROVED';
}

const generateInitialData = () => 
  Array.from({ length: 100 }, (_, i) => ({ id: i, status: 'PENDING' as const }));

// --- 하위 컴포넌트 ---
const Card = ({ item, onApprove }: { item: DummyItem, onApprove: (id: number) => void }) => {
  // 컴포넌트가 렌더링될 때마다 시간 기록 (오버헤드 발생)
  const renderTime = performance.now();
  
  return (
    <div style={{ border: '1px solid #ccc', padding: '8px', margin: '4px', background: item.status === 'APPROVED' ? '#d4edda' : '#fff' }}>
      <p>Item ID: {item.id} - Status: {item.status}</p>
      <button onClick={() => onApprove(item.id)}>Approve</button>
      <span style={{fontSize: '10px', color: 'gray'}}> Rendered at: {renderTime.toFixed(2)}ms</span>
    </div>
  );
};

// --- 상위 페이지 (Prop Drilling) ---
export default function PropDrillingTestPage() {
  const [data, setData] = useState<DummyItem[]>([]);
  const [renderStats, setRenderStats] = useState({ initial: 0, lastUpdate: 0 });
  const mountTime = useRef(performance.now());
  const updateStartTime = useRef(0);

  useEffect(() => {
    // 마운트 시 데이터 페치 흉내
    setData(generateInitialData());
    setRenderStats(prev => ({ ...prev, initial: performance.now() - mountTime.current }));
  }, []);

  const handleApprove = (id: number) => {
    updateStartTime.current = performance.now();
    // 데이터 불변성 유지를 위해 전체 배열을 새로 만듦 -> 100개 카드 전부 리렌더링 트리거
    setData(prev => prev.map(item => item.id === id ? { ...item, status: 'APPROVED' } : item));
  };

  // 렌더링 완료 후 업데이트 비용 측정
  useEffect(() => {
    if (updateStartTime.current > 0) {
      setRenderStats(prev => ({ ...prev, lastUpdate: performance.now() - updateStartTime.current }));
    }
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Case A: Prop Drilling Test</h1>
      <div style={{ background: '#f8f9fa', padding: '10px', marginBottom: '20px' }}>
        <p><strong>Initial Load Time:</strong> {renderStats.initial.toFixed(2)} ms</p>
        <p><strong>Re-render Cost (1 item click):</strong> <span style={{color: 'red', fontWeight: 'bold'}}>{renderStats.lastUpdate.toFixed(2)} ms</span></p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {data.map(item => (
          <Card key={item.id} item={item} onApprove={handleApprove} />
        ))}
      </div>
    </div>
  );
}
