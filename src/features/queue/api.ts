import { apiClient } from '@/shared/api/api-client';
export interface InventoryFilterDTO {
  page?: number;
  size?: number;
  zone?: string;
  grade?: string;
}

export interface InventoryResponse {
  content: any[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

const BASE_URL = '/api/v1/inventory';

export const inventoryService = {
  getInventoryList: async (params: InventoryFilterDTO): Promise<InventoryResponse> => {
    // const response = await apiClient.get<InventoryResponse>(BASE_URL, { params });
    // return response.data;

    return {
      content: [
        { id: 'LPN-260713-A721', book: '클린 아키텍처', grade: 'S등급 (최상)', zone: 'A-Zone (S등급 보관구역)', date: '2026-07-13' },
        { id: 'LPN-260713-A720', book: '리팩터링 2판', grade: 'A등급 (상)', zone: 'A-Zone (A등급 보관구역)', date: '2026-07-13' },
        { id: 'LPN-260713-A718', book: '오브젝트', grade: 'S등급 (최상)', zone: 'A-Zone (S등급 보관구역)', date: '2026-07-13' },
        { id: 'LPN-260712-B041', book: '이것이 자바다', grade: 'B등급 (중)', zone: 'B-Zone (중고도서)', date: '2026-07-12' },
        { id: 'LPN-260711-C102', book: '도메인 주도 설계', grade: 'S등급 (최상)', zone: 'A-Zone (S등급 보관구역)', date: '2026-07-11' },
        { id: 'LPN-260711-C101', book: '코스모스', grade: 'C등급 (파손)', zone: 'Discard-Zone (폐기장)', date: '2026-07-11' },
      ],
      totalElements: 6,
      totalPages: 1,
      size: 10,
      number: 0,
    };
  }
};
