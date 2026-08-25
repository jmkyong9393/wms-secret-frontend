import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/api/api-client";

// board_posts.attachment_paths에는 첨부 전용 버킷의 object_key만 저장된다
// ("attachments/{uuid}_{원본파일명}", src/lib/s3_helper.ts uploadBoardAttachment() 반환값).
//
// 그 버킷은 퍼블릭 접근이 차단돼 있어 주소를 조립해서는 열 수 없다. 열람할 때마다
// 서버에서 만료 10분짜리 Presigned GET URL을 발급받는다.

/** 서버 만료(10분)보다 짧게 잡아 화면에 만료된 URL이 남지 않게 한다. */
const URL_STALE_MS = 8 * 60 * 1000;

/**
 * 첨부 키 목록에 대한 열람 URL을 **한 번의 요청**으로 받아 온다.
 * 키마다 따로 부르면 첨부 5개짜리 게시글에서 왕복이 5배가 된다.
 */
export function useBoardAttachmentUrls(objectKeys: string[]) {
  // 정렬·중복 제거해 키 순서만 다른 재조회를 막는다 (react-query 캐시 적중률).
  const keys = useMemo(
    () => Array.from(new Set(objectKeys.filter((k) => k && !isAbsoluteUrl(k)))).sort(),
    [objectKeys]
  );

  const { data } = useQuery({
    queryKey: ["board-attachment-urls", keys],
    queryFn: async () => {
      const res = await apiClient.post("/api/v1/uploads/attachment/download-urls", {
        object_keys: keys,
      });
      return (res.data as { urls: Record<string, string> }).urls;
    },
    enabled: keys.length > 0,
    staleTime: URL_STALE_MS,
    gcTime: URL_STALE_MS,
    refetchOnWindowFocus: false,
  });

  return useMemo(
    () => (objectKey: string) => resolveUrl(objectKey, data),
    [data]
  );
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function resolveUrl(objectKey: string, urls?: Record<string, string>): string {
  if (isAbsoluteUrl(objectKey)) return objectKey;
  return urls?.[objectKey] ?? "";
}

// object_key는 "attachments/{uuid}_{원본파일명}" 형태다. 화면에는 사람이 읽을 파일명만
// 보여주므로 uuid 접두부를 걷어낸다. 옛 게시글의 "uploads/{timestamp}_{파일명}" 형태도
// 함께 처리한다.
const KEY_PREFIX_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)_/i;

export function boardAttachmentDisplayName(objectKey: string): string {
  const base = objectKey.split("/").pop() ?? objectKey;
  return base.replace(KEY_PREFIX_PATTERN, "");
}
