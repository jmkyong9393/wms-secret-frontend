/** 출고 패킹 박스 규격 카탈로그 (도서슬림 8종 + 일반택배 8종). */
export interface BoxOption {
  id: string;
  name: string;
  specs: string;
  desc: string;
  eff: number;
  maxWeight_kg: number;
}

export const BOOK_SLIM_BOX_OPTIONS: BoxOption[] = [
  { id: "BOOK-S1", name: "도서슬림 소형 1호", specs: "250x150x50mm", desc: "단권 소형 슬림", eff: 98.2, maxWeight_kg: 2.0 },
  { id: "BOOK-S2", name: "도서슬림 소형 2호", specs: "250x150x60mm", desc: "소형 도서 2권 밀착", eff: 94.5, maxWeight_kg: 3.0 },
  { id: "BOOK-M1", name: "도서슬림 중형 1호", specs: "300x200x70mm", desc: "중형 일반서 묶음", eff: 81.0, maxWeight_kg: 4.0 },
  { id: "BOOK-M2", name: "도서슬림 중형 2호", specs: "300x200x90mm", desc: "중형 전공서 묶음", eff: 63.0, maxWeight_kg: 5.0 },
  { id: "BOOK-L1", name: "도서슬림 대형 1호", specs: "350x250x100mm", desc: "대형 수험서 묶음", eff: 78.5, maxWeight_kg: 7.0 },
  { id: "BOOK-L2", name: "도서슬림 대형 2호", specs: "350x250x140mm", desc: "대형 3D 패킹 묶음", eff: 72.0, maxWeight_kg: 8.5 },
  { id: "BOOK-XL1", name: "도서슬림 특대형 1호", specs: "400x300x160mm", desc: "B2B 교보 대량 묶음", eff: 68.4, maxWeight_kg: 10.0 },
  { id: "BOOK-XL2", name: "도서슬림 특대형 2호", specs: "400x300x200mm", desc: "B2B 대량 직송 팩", eff: 61.2, maxWeight_kg: 12.0 },
];

export const STANDARD_COURIER_BOX_OPTIONS: BoxOption[] = [
  { id: "STD-01", name: "일반택배 1호 (소형)", specs: "220x190x90mm", desc: "표준 소형 팩", eff: 63.0, maxWeight_kg: 5.0 },
  { id: "STD-02", name: "일반택배 2호 (중소형)", specs: "270x180x150mm", desc: "표준 중형 팩", eff: 48.0, maxWeight_kg: 7.0 },
  { id: "STD-03", name: "일반택배 3호 (중형)", specs: "340x250x210mm", desc: "우체국 3호 규격", eff: 42.0, maxWeight_kg: 10.0 },
  { id: "STD-04", name: "일반택배 4호 (대형)", specs: "410x310x280mm", desc: "우체국 4호 대형", eff: 38.5, maxWeight_kg: 15.0 },
  { id: "STD-05", name: "일반택배 5호 (특대형 1호)", specs: "480x380x340mm", desc: "우체국 5호급 대용량", eff: 35.0, maxWeight_kg: 20.0 },
  { id: "STD-06", name: "일반택배 6호 (특대형 2호)", specs: "530x410x400mm", desc: "지점 보급용 마스터", eff: 31.2, maxWeight_kg: 25.0 },
  { id: "STD-07", name: "일반택배 7호 (초대형 점포용)", specs: "600x450x450mm", desc: "B2B 점포 직송 초대형", eff: 28.4, maxWeight_kg: 30.0 },
  { id: "STD-08", name: "일반택배 8호 (마스터 카톤)", specs: "650x500x500mm", desc: "B2B 팔레트 마스터 카톤", eff: 25.0, maxWeight_kg: 35.0 },
];

export const BOX_OPTIONS: BoxOption[] = [...BOOK_SLIM_BOX_OPTIONS, ...STANDARD_COURIER_BOX_OPTIONS];
