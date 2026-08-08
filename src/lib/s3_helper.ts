import { API_BASE_URL } from '@/lib/api-client';
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
 * @returns 업로드 완료된 S3 Object Key (DB 저장용)
 */
export async function uploadImageToCloudFront(
  fileBlob: Blob,
  filename: string,
  category: 'image' | 'board' = 'image'
): Promise<string> {
  try {
    // 1. 백엔드로부터 CloudFront Signed Cookie 발급
    const response = await axios.get(UPLOAD_COOKIE_URL, {
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
