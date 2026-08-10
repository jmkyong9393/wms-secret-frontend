/**
 * 입고 검수 작업 초안(Draft) 보존 — 화면 꺼짐·네트워크 단절 후 이어하기.
 *
 * [배경] 검수 화면의 진행 상태(step, LPN, 도서정보, 촬영분)는 전부 React state였다.
 * 모바일 브라우저는 화면이 꺼지거나 탭이 오래 백그라운드에 있으면 메모리 회수를 위해
 * 페이지를 폐기했다가 복귀 시 새로 로드한다. 그러면 state가 초기값으로 돌아가
 * **처음 화면(신품/중고 선택)으로 튕기고 작업이 통째로 날아간다** (조장 현장 실측).
 *
 * 단순한 불편이 아니라 데이터 정합성 문제다: LPN은 이미 서버에서 채번되어
 * PENDING_INSPECTION으로 DB에 등록되고 **실물에 라벨까지 붙은 상태**다. 여기서 처음부터
 * 다시 하면 같은 책에 새 LPN이 발급되고, 앞서 발급된 번호는 실물과 연결되지 않은 채
 * DB에 남는다(결번이 아니라 유령 행).
 *
 * [저장소 선택] localStorage가 아니라 IndexedDB를 쓴다. 촬영분이 Blob이라
 * JSON 직렬화가 불가능하고, base64로 바꾸면 3~4장에 수 MB라 localStorage 용량
 * 한계(약 5MB)에 바로 걸린다. IndexedDB는 Blob을 그대로 담는다.
 *
 * [보존 범위] LPN이 발급된 이후 단계(PRINT_STICKER·VISION_EVALUATION)만 저장한다.
 * 그 전(유형 선택·바코드 스캔)은 되돌릴 것이 없고, 애매한 중간 상태를 복원하면
 * 오히려 혼란스럽다.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'WMS_InboundDraft';
const STORE_NAME = 'draft';
const DB_VERSION = 1;
/** 초안은 한 번에 한 건만 유지한다 (작업자 1명이 책 1권을 다루는 단말 전제). */
const DRAFT_KEY = 'current';

/**
 * 초안 유효 시간. 이 시간을 넘긴 초안은 복원하지 않고 폐기한다.
 * 교대 근무를 감안해 넉넉히 잡되, 어제 작업이 오늘 되살아나는 것은 막는다.
 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface InspectionDraft {
  step: string;
  inboundType: string;
  isbn: string;
  currentLpn: string;
  bookInfo: unknown | null;
  /** 촬영 원본. 순서가 곧 image_index라 배열 순서를 그대로 보존해야 한다. */
  images: Blob[];
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * 초안 저장. 저장 실패가 검수 작업 자체를 막아서는 안 되므로 예외를 삼킨다
 * (사파리 프라이빗 모드처럼 IndexedDB가 막힌 환경에서도 촬영은 계속돼야 한다).
 */
export async function saveDraft(draft: Omit<InspectionDraft, 'savedAt'>): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { ...draft, savedAt: Date.now() }, DRAFT_KEY);
  } catch (e) {
    console.warn('[InspectionDraft] 초안 저장 실패 (작업은 계속 진행됩니다):', e);
  }
}

/** 초안 조회. 없거나 만료됐으면 null (만료분은 즉시 폐기한다). */
export async function loadDraft(): Promise<InspectionDraft | null> {
  try {
    const db = await getDb();
    const draft = (await db.get(STORE_NAME, DRAFT_KEY)) as InspectionDraft | undefined;
    if (!draft) return null;

    if (Date.now() - (draft.savedAt || 0) > MAX_AGE_MS) {
      await clearDraft();
      return null;
    }
    return draft;
  } catch (e) {
    console.warn('[InspectionDraft] 초안 조회 실패:', e);
    return null;
  }
}

/** 초안 폐기. AI 전송 완료·새 도서 시작·사용자의 명시적 폐기에서 호출한다. */
export async function clearDraft(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, DRAFT_KEY);
  } catch (e) {
    console.warn('[InspectionDraft] 초안 삭제 실패:', e);
  }
}
