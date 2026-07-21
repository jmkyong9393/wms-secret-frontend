export interface DashboardKPI {
  todayScans: number;
  scanGrowthRate: number;
  sGradeRate: number;
  discardCount: number;
  pendingPoCount: number;
}

export interface RecentLog {
  lpn: string;
  book: string;
  grade: string;
  time: string;
  status: 'COMPLETED' | 'DISCARDED';
}

export interface AIQualityReport {
  accuracy: number;
  accuracyGrowth: number;
  avgLatency: string;
  rescanRate: number;
  uptime: number;
  gradeDistribution: {
    S: number;
    A: number;
    B: number;
    C_D: number;
  };
}
