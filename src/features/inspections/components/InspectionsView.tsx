import AgentLogAccordion from '@/features/inspections/components/AgentLogAccordion';
import InspectionBadges from '@/features/inspections/components/InspectionBadges';
import { mockInspectionRecords } from '@/features/inspections/mocks/mockAgentLogs';

export default function InspectionsView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 페이지 제목과 설명 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">검수 처리 내역</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI Agent 검수 결과와 단계별 추론 근거를 확인할 수 있습니다.
        </p>
      </div>

      {/* 임시 검수 데이터를 하나씩 카드 형태로 표시 */}
      <div className="space-y-4">
        {mockInspectionRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
          >
            {/* 책 정보와 최종 등급 표시 */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {record.bookTitle}
                </p>
                <p className="text-xs text-gray-400">{record.id}</p>
              </div>
              <InspectionBadges isFastTrack={record.isFastTrack} finalGrade={record.finalGrade} />
            </div>
            {/* AI 에이전트별 처리 과정과 판단 근거 */}
            <AgentLogAccordion record={record} />
          </div>
        ))}
      </div>
    </div>
  );
}