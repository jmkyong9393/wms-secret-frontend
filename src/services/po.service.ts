import { apiClient } from '@/lib/api-client';
import { PurchaseOrder, ApprovePoRequest } from '@/types/po';

const BASE_URL = '/api/v1/po';

export const poService = {
  getSuggestedPOs: async (): Promise<PurchaseOrder[]> => {
    // const response = await apiClient.get<PurchaseOrder[]>(`${BASE_URL}/suggested`);
    // return response.data;

    return [
      { id: 'PO-20260713-001', book: '이것이 자바다', author: '신용권', qty: 50, urgency: 'HIGH', reason: '파손 폐기율 45% (재고 부족 경고)', status: 'WAITING' },
      { id: 'PO-20260713-002', book: '코스모스', author: '칼 세이건', qty: 30, urgency: 'MEDIUM', reason: '안전재고 도달 (3건)', status: 'WAITING' },
      { id: 'PO-20260713-003', book: '클린 코드', author: '로버트 C. 마틴', qty: 100, urgency: 'HIGH', reason: '전일 주문량 급증 (품절 예상)', status: 'WAITING' },
      { id: 'PO-20260713-004', book: '모던 자바스크립트 Deep Dive', author: '이웅모', qty: 20, urgency: 'LOW', reason: '정기 보충 발주', status: 'WAITING' },
    ];
  },

  approvePO: async (data: ApprovePoRequest): Promise<void> => {
    // await apiClient.post(`${BASE_URL}/approve`, data);
    return new Promise(resolve => setTimeout(resolve, 800));
  }
};
