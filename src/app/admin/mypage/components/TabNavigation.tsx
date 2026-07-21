'use client';

/**
 * 마이페이지 내에서 사용할 탭 종류를 정의하는 타입입니다.
 */
export type TabType = 'DASHBOARD' | 'HISTORY' | 'DIGITAL_ID' | 'OFFLINE_SYNC' | 'SECURITY' | 'KPI';

interface TabNavigationProps {
  activeTab: TabType; // 현재 선택된 탭 상태
  setActiveTab: (tab: TabType) => void; // 탭 상태를 변경하는 함수
}

/**
 * 마이페이지의 6가지 메인 메뉴(탭) 사이를 전환할 수 있는 네비게이션 컴포넌트입니다.
 * 모바일 환경을 고려하여 좌우 스크롤(overflow-x-auto) 및 상단 고정(sticky) 스타일이 적용되어 있습니다.
 * 
 * @component
 */
export default function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  const tabs = [
    { id: 'DASHBOARD', label: '작업 대시보드' },
    { id: 'HISTORY', label: '작업 내역' },
    { id: 'DIGITAL_ID', label: '디지털 사원증' },
    { id: 'OFFLINE_SYNC', label: '오프라인 동기화 큐' },
    { id: 'SECURITY', label: '보안/설정' },
    { id: 'KPI', label: '성과 통계' },
  ] as const;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 mb-6 w-full overflow-x-auto no-scrollbar pt-2">
      <nav className="-mb-px flex space-x-6 sm:space-x-8 min-w-max px-1" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
