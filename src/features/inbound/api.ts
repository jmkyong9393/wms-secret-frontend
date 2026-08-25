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

// ── 검수 제출 (온라인 전송 · 오프라인 재전송 공용) ─────────────────────────
//
// 온라인 경로와 재전송 경로가 **같은 함수**를 쓴다. 경로를 나누면 한쪽만 낡아
// 조용히 죽는다 (종전 CloudFront 업로드 경로가 그렇게 됐다).

import { API_BASE_URL } from '@/shared/api/api-client';

export interface EvaluationSubmission {
  lpn: string;
  images: Blob[];
  bookMetadata?: unknown;
  workerId?: string | null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * AI 검수를 요청한다.
 *
 * 네트워크 단계에서 실패하면 fetch가 TypeError로 reject한다 — 그 경우에만
 * 재전송이 안전하다(서버에 닿지 않았으므로). 서버가 응답한 4xx/5xx는 Error로 바꿔
 * 던지며, 이건 재전송 대상이 아니다.
 */
export async function submitEvaluation(input: EvaluationSubmission) {
  const images = await Promise.all(input.images.map(blobToDataUrl));
  const res = await fetch(`${API_BASE_URL}/api/v1/inbound/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lpn: input.lpn,
      images,
      book_metadata: input.bookMetadata,
      worker_id: input.workerId ?? null,
    }),
  });
  if (!res.ok) throw new Error(`Evaluation failed (HTTP ${res.status})`);
  return res.json();
}

/**
 * 해당 LPN이 이미 검수됐는지 확인한다 (재전송 중복 방지용).
 *
 * 검수 전 LPN은 `PENDING_INSPECTION`으로 등록돼 있다. 그 상태가 아니면 이미
 * 판정이 끝났다는 뜻이므로 재전송하면 같은 책이 두 번 검수된다.
 */
export async function isLpnAlreadyInspected(lpn: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/v1/inventory/${encodeURIComponent(lpn)}`);
  if (res.status === 404) return false;          // 아직 없음 → 보내야 한다
  if (!res.ok) throw new Error(`LPN 조회 실패 (HTTP ${res.status})`);
  const data = await res.json();
  const status = data?.item_status ?? data?.status;
  return typeof status === 'string' && status !== 'PENDING_INSPECTION';
}
