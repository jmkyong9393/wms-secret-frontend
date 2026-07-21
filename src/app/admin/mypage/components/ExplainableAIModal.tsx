'use client';

import { FileText, X, AlertCircle } from 'lucide-react';

interface ExplainableAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  logId: string | null;
}

// 임시 모의 데이터
const mockHistory = [
  { id: '1', title: '클린 아키텍처', status: 'MINT', reason: '스크래치 및 훼손 전혀 없음. 완벽한 새 상품 상태.' },
  { id: '2', title: '토비의 스프링', status: 'HITL_PENDING', reason: '측면 약한 변색 및 15페이지 접힘 자국 발견.' },
  { id: '3', title: '오브젝트', status: 'REJECT', reason: 'Vision AI: 후면 바코드 오염 감지. Policy Agent: 매입 불가 규정 위반. Critic Agent: 검증 완료 및 반려 확정.' },
];

export default function ExplainableAIModal({ isOpen, onClose, logId }: ExplainableAIModalProps) {
  if (!isOpen || !logId) return null;

  const report = mockHistory.find(h => h.id === logId) || mockHistory[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-600" />
            AI 검수 상세 리포트
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{report.title}</h3>
              <p className="text-sm text-gray-500 mt-1">작업 번호: {logId}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-md text-sm font-bold ${
              report.status === 'MINT' ? 'bg-emerald-100 text-emerald-700' : 
              report.status === 'REJECT' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              최종 등급: {report.status}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-5 rounded-lg">
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 text-indigo-500" />
              AI 에이전트 판정 사유 (Explainable AI)
            </h4>
            <p className="text-gray-700 leading-relaxed text-sm">
              {report.reason}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
