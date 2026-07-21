import { atom } from "jotai";

// 낙관적 UI를 위한 백그라운드 업로드 큐 (Queue)
export interface UploadTask {
  id: string; // 로컬 고유 ID (uuid 등)
  blob: Blob;
  previewUrl: string;
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  isbn?: string;
  lpn?: string;
}

export const uploadQueueAtom = atom<UploadTask[]>([]);

// 완료되지 않은 업로드 작업 개수
// 전역 Header 등 외부에서 원본 배열 구조를 몰라도 개수만 구독할 수 있도록 제공
export const pendingUploadCountAtom = atom((get) =>
  get(uploadQueueAtom).filter((task) => task.status !== 'COMPLETED').length
);
