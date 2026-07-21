"use client";

import React, { useEffect, useState, useRef } from "react";
import { adminAPI } from "@/lib/api";

type HitlJob = {
  id: string;
  book_id: string;
  image_urls: string[];
  status: string;
  agent_logs?: {
    defect_coordinates?: Array<{x: number, y: number, width: number, height: number}>;
  };
  created_at: string;
};

type OverridePayload = {
  ticketId: string;
  decision: string;
  targetGrade: string;
  primaryReasonCode: string;
  reasonComment: string;
  defectCoordinates: any[];
  reviewDurationMs: number;
};

export default function AdminHitlDashboard() {
  const [jobs, setJobs] = useState<HitlJob[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // 상태 관리: 각 row별 선택된 값들
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  
  // FDS 방어용 체류 시간 측정
  const pageEnterTime = useRef(Date.now());

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await adminAPI.getPendingHitlTasks();
      setJobs(data);
    } catch (err) {
      console.error(err);
      alert("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      // Initialize defaults if not set
      if (!decisions[id]) {
        setDecisions(prev => ({ ...prev, [id]: "APPROVE_DOWNGRADE" }));
        setGrades(prev => ({ ...prev, [id]: "B" }));
        setReasons(prev => ({ ...prev, [id]: "DMG_EXT_CRUSH" }));
      }
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === jobs.length) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(jobs.map(j => j.id));
      setSelectedIds(newSet);
      
      const d: any = { ...decisions }, g: any = { ...grades }, r: any = { ...reasons };
      jobs.forEach(j => {
        if (!d[j.id]) d[j.id] = "APPROVE_DOWNGRADE";
        if (!g[j.id]) g[j.id] = "B";
        if (!r[j.id]) r[j.id] = "DMG_EXT_CRUSH";
      });
      setDecisions(d);
      setGrades(g);
      setReasons(r);
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return alert("선택된 항목이 없습니다.");
    
    const items: OverridePayload[] = Array.from(selectedIds).map(id => {
      const duration = Date.now() - pageEnterTime.current; // FDS tracking
      return {
        ticketId: id,
        decision: decisions[id] || "APPROVE_DOWNGRADE",
        targetGrade: grades[id] || "B",
        primaryReasonCode: reasons[id] || "DMG_EXT_CRUSH",
        reasonComment: comments[id] || "",
        defectCoordinates: [], // Admin no longer draws boxes manually; they just confirm the AI's boxes
        reviewDurationMs: duration
      };
    });

    try {
      await adminAPI.submitHitlOverrides(items);
      alert("일괄 처리 성공!");
      setSelectedIds(new Set());
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert("일괄 처리 실패");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">HITL 수동 검수 대시보드</h1>
          <p className="text-gray-500 mt-2">AI 보류 건에 대해 관리자가 최종 등급과 사유를 결정합니다.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={fetchJobs} className="px-4 py-2 border rounded shadow-sm bg-white hover:bg-gray-50">새로고침</button>
          <button 
            onClick={handleSubmit} 
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
            disabled={selectedIds.size === 0}
          >
            선택 항목 일괄 승인 ({selectedIds.size})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">데이터를 불러오는 중...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">대기 중인 검수 건이 없습니다.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 border-b border-gray-200 text-sm">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={selectedIds.size === jobs.length} onChange={toggleAll} />
                </th>
                <th className="p-4 w-24">이미지</th>
                <th className="p-4 w-48">Job ID (도서)</th>
                <th className="p-4 w-32">처분(Decision)</th>
                <th className="p-4 w-24">목표 등급</th>
                <th className="p-4">사유 코드 (Reason)</th>
                <th className="p-4">메모</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {jobs.map(job => {
                const isSelected = selectedIds.has(job.id);
                return (
                  <tr key={job.id} className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleSelect(job.id)}
                      />
                    </td>
                    <td className="p-4">
                      {job.image_urls && job.image_urls.length > 0 ? (
                        <div className="relative w-24 h-32 rounded overflow-hidden shadow-sm border bg-gray-100">
                          <img src={job.image_urls[0]} alt="book" className="object-cover w-full h-full" />
                          {/* AI가 예측한 BBox 시각화 렌더링 (관리자 검증용) */}
                          {job.agent_logs?.defect_coordinates?.map((box, idx) => (
                            <div 
                              key={idx} 
                              className="absolute border-2 border-red-500 bg-red-500/20"
                              style={{
                                left: `${box.x}%`, 
                                top: `${box.y}%`, 
                                width: `${box.width}%`, 
                                height: `${box.height}%`
                              }}
                              title="Vision AI 검출 영역"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="w-24 h-32 rounded bg-gray-200 border flex items-center justify-center text-xs text-gray-400">No Img</div>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-xs">{job.id.slice(0, 8)}...<br/><span className="text-gray-400">{job.book_id.slice(0,8)}</span></td>
                    
                    <td className="p-4">
                      <select 
                        disabled={!isSelected}
                        className="w-full border p-2 rounded text-gray-700 disabled:bg-gray-100"
                        value={decisions[job.id] || "APPROVE_DOWNGRADE"}
                        onChange={e => setDecisions({...decisions, [job.id]: e.target.value})}
                      >
                        <option value="APPROVE_NORMAL">정상 승인</option>
                        <option value="APPROVE_DOWNGRADE">등급 하향</option>
                        <option value="REJECT_RETURN">출판사 반품</option>
                        <option value="RE_CHECK">재검수(재촬영)</option>
                      </select>
                    </td>
                    
                    <td className="p-4">
                      <select 
                        disabled={!isSelected || decisions[job.id] !== "APPROVE_DOWNGRADE"}
                        className="w-full border p-2 rounded text-gray-700 disabled:bg-gray-100"
                        value={grades[job.id] || "B"}
                        onChange={e => setGrades({...grades, [job.id]: e.target.value})}
                      >
                        <option value="S">S급</option>
                        <option value="A">A급</option>
                        <option value="B">B급</option>
                        <option value="C">C급</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <select 
                        disabled={!isSelected}
                        className="w-full border p-2 rounded text-gray-700 disabled:bg-gray-100"
                        value={reasons[job.id] || "DMG_EXT_CRUSH"}
                        onChange={e => setReasons({...reasons, [job.id]: e.target.value})}
                      >
                        <optgroup label="오탐 (정상)">
                          <option value="FP_SHADOW">그림자 오탐</option>
                          <option value="FP_GLARE">빛 반사 오탐</option>
                        </optgroup>
                        <optgroup label="외부 파손">
                          <option value="DMG_EXT_WET">침수/오염 (외부)</option>
                          <option value="DMG_EXT_CRUSH">모서리 찍힘</option>
                          <option value="DMG_EXT_TEAR">찢어짐</option>
                        </optgroup>
                        <optgroup label="내부 결함">
                          <option value="DMG_INT_STAIN">내부 낙서/오염</option>
                          <option value="DMG_INT_DISCOLOR">변색/황변</option>
                        </optgroup>
                      </select>
                    </td>

                    <td className="p-4">
                      <input 
                        type="text" 
                        disabled={!isSelected}
                        placeholder="사유 메모 (선택)"
                        className="w-full border p-2 rounded text-gray-700 disabled:bg-gray-100"
                        value={comments[job.id] || ""}
                        onChange={e => setComments({...comments, [job.id]: e.target.value})}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
