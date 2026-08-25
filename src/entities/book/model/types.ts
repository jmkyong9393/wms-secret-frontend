/** 도서 표시용 읽기 모델 (재고·검수 그리드 공용). */
export interface StockBook {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  base_price: number;
  cover_image_url?: string;
}
