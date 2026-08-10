import { atom } from "jotai";

// === 전역 상태 (Global State) ===

// 1. 테마 상태 (Dark/Light Mode)
export const themeAtom = atom<"light" | "dark">("light");

// 2. 사이드바 열림/닫힘 상태
export const isSidebarOpenAtom = atom<boolean>(true);

// 3. 사용자 정보 (간단한 예시)
export const userAtom = atom<{ name: string; role: string } | null>(null);

// === 도메인 상태 (Domain State - WMS 전용) ===

// 1. 현재 선택된 검수 도서 ID
export const selectedBookIdAtom = atom<string | null>(null);

// 2. AI가 찾아낸 BBox 좌표 리스트 상태 (실시간 조작용)
export interface BBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}
export const bookDefectBoxesAtom = atom<BBox[]>([]);

// 3. AI 검수 요청 큐 (Queue)
//
// 한 건 = POST /api/v1/inbound/evaluate 요청 하나(= LPN 하나, 이미지 N장).
// 상태 전이는 /inbound 페이지의 evaluateMutation이 실제 요청·SSE 진행률을 그대로 반영하며,
// 이 atom을 갱신하는 곳은 그 한 군데뿐이다.
//   UPLOADING(전송 중) → ANALYZING(job 접수, SSE 수신 중) → COMPLETED / FAILED
export type UploadTaskStatus = 'UPLOADING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export interface UploadTask {
  id: string; // 전송 직후엔 임시 ID, 서버 응답 후 job_id로 교체
  lpn: string;
  title: string;
  previewUrl: string; // 대표 썸네일 (첫 번째 촬영 컷)
  status: UploadTaskStatus;
  progress: number; // SSE가 보고하는 0~100
  message?: string;
  grade?: string;
  timestamp: number;
}
export const uploadQueueAtom = atom<UploadTask[]>([]);

// 진행 중(전송·분석) 건수. Header와 대시보드가 같은 기준을 공유하도록 파생 atom으로 제공.
export const inFlightUploadCountAtom = atom((get) =>
  get(uploadQueueAtom).filter((t) => t.status === 'UPLOADING' || t.status === 'ANALYZING').length
);
