// 첨부파일 업로드 제한 - "빅 프로젝트 정부 규제 준수 가이드"(개인정보보호·시큐어코딩)의
// "위험한 형식 파일 업로드" 대응 권고(화이트리스트, 크기/개수 제한, 파일명 무작위화)를 따른다.
// 확장자 화이트리스트는 백엔드 app/domains/uploads/router.py의 BOARD_ALLOWED_EXTENSIONS와
// 반드시 동일해야 한다 - 여기서만 넓혀 봐야 서버 /uploads/authorize?category=board에서
// 400으로 막히므로, 클라이언트 검증은 서버 화이트리스트를 그대로 미러링해 사용자에게 더
// 빨리 알려주는 역할만 한다 (실제 방어선은 서버).
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".hwp", ".txt",
];
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_DOCUMENT_EXTENSIONS,
];

// 이미지 MIME은 브라우저가 실제 콘텐츠를 스니핑해 채우므로 위조 탐지에 쓸 수 있다
// (예: malware.exe를 photo.jpg로 리네임해도 file.type은 실제 바이너리를 반영).
// 문서 포맷, 특히 .hwp는 브라우저가 빈 문자열을 보고하는 경우가 흔해 MIME 교차검증이
// 신뢰할 수 없다 - 문서는 확장자 화이트리스트 + 서버 재검증에 맡기고 MIME 체크는
// 이미지 확장자에만 적용한다.
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENT_COUNT = 5;

export function isImageAttachment(fileNameOrPath: string): boolean {
  const ext = fileNameOrPath.slice(fileNameOrPath.lastIndexOf(".")).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
}

export function validateAttachmentFile(
  file: File,
  currentCount: number
): { ok: true } | { ok: false; message: string } {
  if (currentCount >= MAX_ATTACHMENT_COUNT) {
    return { ok: false, message: `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 가능합니다.` };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      message: `파일 크기는 ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB를 초과할 수 없습니다.`,
    };
  }
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      message: `허용되지 않는 파일 형식입니다. 허용 확장자: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`,
    };
  }
  if (
    ALLOWED_IMAGE_EXTENSIONS.includes(ext) &&
    file.type &&
    !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)
  ) {
    return { ok: false, message: "확장자와 실제 파일 형식이 일치하지 않습니다." };
  }
  return { ok: true };
}

/**
 * 업로드 파일명을 S3 키로 쓰기 안전한 형태로 정규화한다 (경로 구분자 제거, 허용 문자 외
 * 치환). 백엔드 uploads/router.py의 sanitize_upload_filename()과 동일한 규칙이다.
 *
 * [미사용/확장예정] 게시판 첨부는 서버가 presign 단계에서 normalize_filename() +
 * sanitize_upload_filename()으로 직접 정규화하므로 더 이상 호출하지 않는다 (BiDi 제어문자
 * 같은 위장은 서버만 잡는다). 검수 사진 등 다른 업로드 경로에서 재사용할 수 있어 남긴다.
 */
export function sanitizeAttachmentFilename(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "upload";
  const trimmed = base.replace(/^\.+/, "") || "upload";
  const dotIndex = trimmed.lastIndexOf(".");
  const stem = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const ext = dotIndex > 0 ? trimmed.slice(dotIndex).toLowerCase() : "";
  const safeStem = stem.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "upload";
  return `${safeStem}${ext}`;
}
