export interface InventoryItem {
  id: string; // LPN 바코드
  book: string; // 도서명
  isbn?: string; 
  grade: string; // S, A, B, C, D 등급
  zone: string; // 적치 위치
  date: string; // 입고 일자
}

export interface InventoryFilterDTO {
  searchTerm?: string;
  grade?: string[];
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export interface InventoryResponse {
  content: InventoryItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
