// board_posts.attachment_paths에는 CloudFront object_key만 저장된다 (src/lib/s3_helper.ts
// uploadImageToCloudFront()의 반환값과 동일한 형태). 화면에 그릴 때만 CDN 도메인을 붙인다.
export function boardAttachmentUrl(objectKey: string): string {
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) return objectKey;
  const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN || "https://cdn.wms-ai.com";
  return `${CDN_DOMAIN}/${objectKey}`;
}

// object_key는 "uploads/{timestamp}_{원본파일명}" 형태다 (uploadImageToCloudFront 참고).
// 문서 첨부 카드에 사람이 읽을 파일명만 보여주기 위해 접두부를 걷어낸다.
export function boardAttachmentDisplayName(objectKey: string): string {
  const base = objectKey.split("/").pop() ?? objectKey;
  return base.replace(/^\d+_/, "");
}
