import { apiClient } from '@/lib/api-client';
import { VisionEvaluationRequest, VisionEvaluationResponse, PrintStickerRequest, HistoryLog } from '@/features/inbound/types';

const BASE_URL = '/api/v1/inbound';

export const inboundService = {
  evaluateVisionGrade: async (data: VisionEvaluationRequest): Promise<VisionEvaluationResponse> => {
    // const formData = new FormData();
    // formData.append('image', data.imageFile);
    // if (data.isbn) formData.append('isbn', data.isbn);
    
    // const response = await apiClient.post<VisionEvaluationResponse>(`${BASE_URL}/evaluate`, formData, {
    //   headers: { 'Content-Type': 'multipart/form-data' }
    // });
    // return response.data;

    return new Promise(resolve => setTimeout(() => {
      resolve({
        lpn: `LPN-${new Date().getTime().toString().slice(-6)}-A100`,
        grade: 'S',
        gradeName: 'S등급 (최상)',
        confidence: 98.5,
        analysisDetails: '스크래치 없음, 변색 없음, 모서리 손상 없음'
      });
    }, 1500));
  },

  printLPNSticker: async (data: PrintStickerRequest): Promise<boolean> => {
    // await apiClient.post(`${BASE_URL}/print`, data);
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
  },

  getHistoryLogs: async (): Promise<HistoryLog[]> => {
    // const response = await apiClient.get<HistoryLog[]>(`${BASE_URL}/history`);
    // return response.data;
    
    return Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      lpn: `LPN-260713-A${700 + i}`,
      isbn: ['9788966263158', '9788966260959', '9791192931448', '9788980782970'][i % 4],
      title: ['클린 아키텍처', '토비의 스프링', '오브젝트', '도메인 주도 설계'][i % 4],
      status: ['S등급', 'A등급', 'B등급', '반려', 'S등급'][i % 5],
      date: `2026-07-13 10:${(15 + i).toString().padStart(2, '0')}`,
      aiConfidence: `${90 + (i % 10)}%`,
      reviewer: i % 7 === 0 ? '현장 관리자 (HITL)' : 'AI 자동'
    }));
  }
};
