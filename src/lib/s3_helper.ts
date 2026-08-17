import { API_BASE_URL, apiClient } from '@/lib/api-client';
import axios from 'axios';

// 백엔드 API URL은 api-client에서 중앙 관리 (NEXT_PUBLIC_API_URL 환경변수 기반)
const UPLOAD_COOKIE_URL = `${API_BASE_URL}/api/v1/uploads/authorize`;

/**
 * 캡처한 이미지를 CloudFront Edge Network를 통해 S3에 다이렉트 업로드합니다.
 * @param fileBlob 캡처된 이미지 Blob 데이터 (압축 완료된 상태)
 * @param filename 업로드할 원본 파일명 (예: 'lpn_12345.jpg')
 * @param category 백엔드 화이트리스트 선택 - 'image'(기본, 도서 검수 사진 전용) |
 *                 'board'(게시판 첨부, 이미지+문서 허용). 기존 호출부(입고 검수 등)는
 *                 인자를 생략하면 그대로 'image' 화이트리스트를 쓴다.
 *                 **'board'는 더 이상 쓰지 않는다 — 게시판 첨부는 uploadBoardAttachment()로 옮겼다.**
 * @returns 업로드 완료된 S3 Object Key (DB 저장용)
 */
export async function uploadImageToCloudFront(
  fileBlob: Blob,
  filename: string,
  category: 'image' | 'board' = 'image'
): Promise<string> {
  try {
    // 1. 백엔드로부터 CloudFront Signed Cookie 발급
    await axios.get(UPLOAD_COOKIE_URL, {
      params: { file_name: filename, category },
      withCredentials: true // Set-Cookie 헤더를 로컬 브라우저에 저장하도록 허용
    });

    // 2. 발급받은 URL(Edge)로 바이너리 다이렉트 업로드 (PUT)
    // CloudFront 배포 도메인을 사용해야 함
    const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN || 'https://cdn.wms-ai.com';
    const object_key = `uploads/${Date.now()}_${filename}`;
    const url = `${CDN_DOMAIN}/${object_key}`;

    // 로컬 Mocking 테스트: 환경변수 체크
    if (process.env.NEXT_PUBLIC_MOCK_UPLOAD === 'true') {
      console.log("[Mock] CloudFront Signed Cookie 발급 성공. URL:", url);
      console.log(`[Mock] ${url} 로 이미지 다이렉트 업로드 완료 (크기: ${fileBlob.size} bytes)`);
      return object_key;
    }

    // 2. 발급받은 URL(Edge)로 바이너리 다이렉트 업로드 (PUT)
    await axios.put(url, fileBlob, {
      headers: {
        // 문서 파일(.hwp 등)은 브라우저가 type을 빈 문자열로 보고하는 경우가 많다 -
        // 이때 image/jpeg로 잘못 단정하지 않도록 카테고리별 기본값을 분리한다.
        'Content-Type': fileBlob.type || (category === 'board' ? 'application/octet-stream' : 'image/jpeg'),
      },
      // CloudFront Signed Cookie를 브라우저가 전송하도록 강제
      withCredentials: true
    });

    return object_key;
  } catch (error) {
    console.error("CloudFront Direct Upload Failed", error);
    throw new Error("Edge Network를 통한 이미지 업로드에 실패했습니다.");
  }
}

// ==========================================
// 게시판 첨부 — Presigned POST + 격리 검사 3단 업로드
// ==========================================
//
// 종전에는 CloudFront 서명 쿠키로 cdn.wms-ai.com에 PUT 했으나 그 도메인이 존재하지 않아
// 업로드가 항상 실패했다. 또한 5MB 제한이 프론트에만 있어 개발자도구로 우회할 수 있었다.
//
// 현재 흐름:
//   ① presign : 서버가 크기·타입·키 접두사를 **서명에 박아** Presigned POST를 발급한다.
//   ② upload  : 브라우저 → S3 직행. 파일 바이트가 API 서버를 거치지 않는다.
//   ③ verify  : 서버가 격리본의 실제 바이트를 검사하고 통과분만 정상 구역으로 옮긴다.

export interface BoardUploadOptions {
  /** 0~100. ②단계(실제 전송) 진행률만 반영한다. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** ③ verify는 서버가 S3에서 파일을 받아 검사하므로 기본 10초로는 모자랄 수 있다. */
const VERIFY_TIMEOUT_MS = 30000;

/** S3 오류 XML의 <Code>를 사용자가 이해할 문장으로 옮긴다. */
function s3ErrorMessage(status: number, responseText: string): string {
  const code = /<Code>([^<]+)<\/Code>/.exec(responseText ?? '')?.[1];
  switch (code) {
    case 'EntityTooLarge':
      return '파일이 허용 크기(5MB)를 초과했습니다.';
    case 'EntityTooSmall':
      return '빈 파일은 업로드할 수 없습니다.';
    case 'AccessDenied':
      return '업로드 정책에 맞지 않는 파일입니다. 크기와 형식을 확인해 주세요.';
    case 'ExpiredToken':
    case 'RequestTimeout':
      return '업로드 자격이 만료되었습니다. 다시 시도해 주세요.';
    default:
      return `스토리지 업로드에 실패했습니다 (HTTP ${status}${code ? ` ${code}` : ''}).`;
  }
}

function uploadToS3WithProgress(
  uploadUrl: string,
  fields: Record<string, string>,
  file: File,
  opts: BoardUploadOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    // S3 Presigned POST는 **file이 마지막 필드**여야 한다. 순서가 어긋나면 서명 검증 이전에
    // 거부된다.
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    // S3에는 우리 인증 쿠키를 보내지 않는다 (교차 오리진이고 서명만으로 인가된다).
    xhr.withCredentials = false;

    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress!(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      // 정책 위반은 서버까지 가지 않고 S3가 여기서 끊는다. 사유는 응답 XML의 <Code>에 있다
      // (실측: 5MB 초과 400 EntityTooLarge · 0바이트 400 EntityTooSmall · 서명 조작 403).
      reject(new Error(s3ErrorMessage(xhr.status, xhr.responseText)));
    };
    // S3가 응답 대신 연결을 끊는 경우도 있어 같은 사유로 안내한다.
    xhr.onerror = () => reject(new Error('업로드 중 연결이 끊겼습니다. 파일 크기와 네트워크를 확인해 주세요.'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    if (opts.signal) {
      if (opts.signal.aborted) { xhr.abort(); return; }
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

/**
 * 게시판 첨부를 업로드하고 검사를 통과한 정상 구역 object_key를 돌려준다.
 * 검사에 걸린 파일은 서버가 격리 구역에서 즉시 삭제하므로 반환값이 없다.
 */
export async function uploadBoardAttachment(
  file: File,
  opts: BoardUploadOptions = {}
): Promise<string> {
  const presign = await apiClient.post('/api/v1/uploads/attachment/presign', null, {
    params: { file_name: file.name, file_type: file.type || 'application/octet-stream' },
    signal: opts.signal,
  });
  const { upload_url, fields, object_key } = presign.data as {
    upload_url: string;
    fields: Record<string, string>;
    object_key: string;
  };

  opts.onProgress?.(0);
  await uploadToS3WithProgress(upload_url, fields, file, opts);
  opts.onProgress?.(100);

  const verified = await apiClient.post('/api/v1/uploads/attachment/verify', null, {
    params: { object_key },
    timeout: VERIFY_TIMEOUT_MS,
    signal: opts.signal,
  });
  return (verified.data as { object_key: string }).object_key;
}

/** 서버가 내려준 거부 사유를 그대로 보여준다 (어떤 검사에 걸렸는지 사용자가 알아야 한다). */
export function boardUploadErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) return detail;
    if (error.code === 'ECONNABORTED') return '검사 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof Error && error.message) return error.message;
  return '첨부파일 업로드에 실패했습니다.';
}
