'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import TabNavigation, { TabType } from './components/TabNavigation';
import DashboardTab from './components/DashboardTab';
import HistoryDataGrid from './components/HistoryDataGrid';
import DigitalIdTab from './components/DigitalIdTab';
import OfflineSyncTab from './components/OfflineSyncTab';
import SecuritySettingsTab from './components/SecuritySettingsTab';
import KPICharts from './components/KPICharts';

export default function MyPage() {
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <User className="mr-3 w-6 h-6 text-indigo-600" />
          마이페이지 (My Workspace)
        </h1>
      </div>

      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'DASHBOARD' && <DashboardTab />}
        {activeTab === 'HISTORY' && <HistoryDataGrid />}
        {activeTab === 'DIGITAL_ID' && <DigitalIdTab />}
        {activeTab === 'OFFLINE_SYNC' && <OfflineSyncTab />}
        {activeTab === 'SECURITY' && <SecuritySettingsTab />}
        {activeTab === 'KPI' && <KPICharts />}
      </div>
    </div>
  );
}
