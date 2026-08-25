import { apiClient } from '@/shared/api/api-client';
import { PrintStickerRequest, HistoryLog } from '@/features/inbound/types';

// AI 검수 요청(POST /api/v1/inbound/evaluate)은 app/inbound/page.tsx의 evaluateMutation이
// 단독으로 수행한다. 여기에 별도 진입점을 두면 큐 상태가 실제 요청과 어긋난다.
export const inboundService = {
  generateLpn: async (isbn: string, workerId?: string) => {
    // 백엔드 연동: ISBN을 보내고 LPN 번호 및 도서 정보 수신
    try {
      const response = await apiClient.post('/api/v1/inventory/lpn', {
        isbn,
        worker_id: workerId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate LPN:', error);
      throw error;
    }
  },

  printLPNSticker: async (_data: PrintStickerRequest): Promise<boolean> => {
    // await apiClient.post('/api/v1/inbound/print', data);
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
  },

  getHistoryLogs: async (): Promise<HistoryLog[]> => {
    // const response = await apiClient.get<HistoryLog[]>('/api/v1/inbound/history');
    // return response.data;
    
    interface LocalEvalRow {
      lpn?: string; job_id?: string; isbn?: string; title?: string; author?: string;
      category?: string; publisher?: string; grade?: string; score?: number;
      reasonCode?: string; message?: string; timestamp?: string | number;
    }
    let localData: LocalEvalRow[] = [];
    try {
      localData = JSON.parse(localStorage.getItem('local_evaluations') || '[]');
    } catch {}

    // 중복된 LPN이 있으면 가장 최신(뒤에 있는) 데이터만 남기기
    const uniqueLocalDataMap = new Map();
    localData.forEach((item) => {
      uniqueLocalDataMap.set(item.lpn?.trim(), item);
    });
    const uniqueLocalData = Array.from(uniqueLocalDataMap.values());
    
    const realLogs: HistoryLog[] = uniqueLocalData.reverse().map((item: LocalEvalRow, idx: number) => {
      // Map 'S', 'A', 'B', 'normal' to display statuses
      let displayStatus = 'S등급'; // 기본값
      const gradeStr = String(item.grade || '').toUpperCase();
      let reasonCode = item.reasonCode || 'PERFECT_CONDITION';
      let score = item.score !== undefined ? item.score : 98;
      
      if (gradeStr.includes('MINT') || gradeStr === 'S') {
        displayStatus = 'S등급';
        if (item.score === undefined) {
          score = 98;
          reasonCode = '과거 기록 (상세 없음)';
        }
      }
      else if (gradeStr.includes('EXCELENT') || gradeStr.includes('EXCELLENT') || gradeStr === 'A') {
        displayStatus = 'A등급';
        if (item.score === undefined) {
          score = 85;
          reasonCode = '과거 기록 (상세 없음)';
        }
      }
      else if (gradeStr.includes('NORMAL') || gradeStr === 'B') {
        displayStatus = 'B등급';
        if (item.score === undefined) {
          score = 75;
          reasonCode = '과거 기록 (상세 없음)';
        }
      }
      else if (gradeStr.includes('DAMAGED') || gradeStr.includes('REJECT') || gradeStr.includes('반려')) {
        displayStatus = '반려';
        if (item.score === undefined) {
          score = 45;
          reasonCode = '과거 기록 (상세 없음)';
        }
      }
      else if (gradeStr.includes('ERROR') || gradeStr === 'ERROR' || gradeStr === 'N/A') {
        displayStatus = 'ERROR';
        score = 0;
        reasonCode = '시스템 에러';
      }
      
      return {
        id: `local_${idx}`,
        job_id: item.job_id,
        lpn: item.lpn || '',
        isbn: item.isbn || '스캔 도서',
        title: item.title || item.message || 'AI 실시간 판독 건',
        author: item.author || '-',
        category: item.category || '실시간 판독',
        publisher: item.publisher || '-',
        status: displayStatus,
        date: new Date(item.timestamp ?? Date.now()).toLocaleString(),
        aiConfidence: '99%',
        reviewer: 'AI 자동 (LangGraph)',
        ubciScore: score,
        reasonCode: reasonCode,
      };
    });
    
    const mockLogs = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      job_id: `JOB-${260713000 + i}`,
      lpn: `LPN-260713-A${700 + i}`,
      isbn: ['9788966263158', '9788966260959', '9791192931448', '9788980782970'][i % 4],
      title: ['클린 아키텍처', '토비의 스프링', '오브젝트', '도메인 주도 설계'][i % 4],
      author: ['로버트 C. 마틴', '이일민', '조영호', '에릭 에반스'][i % 4],
      category: ['컴퓨터/IT', '컴퓨터/IT', '컴퓨터/IT', '컴퓨터/IT'][i % 4],
      publisher: ['인사이트', '에이콘출판', '위키북스', '위키북스'][i % 4],
      status: ['S등급', 'A등급', 'B등급', '반려', 'S등급'][i % 5],
      date: `2026-07-13 10:${(15 + i).toString().padStart(2, '0')}`,
      aiConfidence: `${90 + (i % 10)}%`,
      reviewer: i % 7 === 0 ? '현장 관리자 (HITL)' : 'AI 자동',
      ubciScore: [98, 85, 75, 45, 99][i % 5],
      reasonCode: [
        'PERFECT_CONDITION', 
        'MINOR_SCRATCH', 
        'EDGE_DAMAGE', 
        'WATER_DAMAGE', 
        'PERFECT_CONDITION'
      ][i % 5]
    }));

    const deletedMocks = JSON.parse(localStorage.getItem('deleted_mocks') || '[]');
    const activeMockLogs = mockLogs.filter(mock => !deletedMocks.includes(mock.id));

    return [...realLogs, ...activeMockLogs];
  }
};
