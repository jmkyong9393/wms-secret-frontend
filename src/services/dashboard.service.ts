import { apiClient } from '@/lib/api-client';
import { DashboardKPI, RecentLog, AIQualityReport } from '@/types/dashboard';

// 추후 백엔드 API 규칙에 따라 URL 수정 가능 (임시로 /api/v1 사용)
const BASE_URL = '/api/v1/dashboard';

export const dashboardService = {
  getKPIs: async (): Promise<DashboardKPI> => {
    // 실제 API 호출 (백엔드 미완성 시 임시 주석 처리 또는 msw 사용)
    // const response = await apiClient.get<DashboardKPI>(`${BASE_URL}/kpi`);
    // return response.data;
    
    // Mock Data
    return {
      todayScans: 1284,
      scanGrowthRate: 12,
      sGradeRate: 82.5,
      discardCount: 42,
      pendingPoCount: 5,
    };
  },

  getRecentLogs: async (): Promise<RecentLog[]> => {
    // const response = await apiClient.get<RecentLog[]>(`${BASE_URL}/recent-logs`);
    // return response.data;

    return [
      { lpn: 'LPN-260713-A721', book: '클린 아키텍처', grade: 'S등급 (최상)', time: '방금 전', status: 'COMPLETED' },
      { lpn: 'LPN-260713-A720', book: '리팩터링 2판', grade: 'A등급 (상)', time: '3분 전', status: 'COMPLETED' },
      { lpn: 'LPN-260713-A719', book: '이것이 자바다', grade: 'C등급 (파손)', time: '12분 전', status: 'DISCARDED' },
      { lpn: 'LPN-260713-A718', book: '오브젝트', grade: 'S등급 (최상)', time: '15분 전', status: 'COMPLETED' },
    ];
  },

  getAIQualityReport: async (): Promise<AIQualityReport> => {
    // const response = await apiClient.get<AIQualityReport>(`${BASE_URL}/ai-quality`);
    // return response.data;

    return {
      accuracy: 98.2,
      accuracyGrowth: 1.5,
      avgLatency: '1.8s',
      rescanRate: 1.4,
      uptime: 99.9,
      gradeDistribution: {
        S: 65,
        A: 20,
        B: 10,
        C_D: 5,
      }
    };
  }
};
