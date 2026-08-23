"use client";

import { useRef, useState } from "react";
import { X, Paperclip, FileText } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { CurrentUser } from "@/entities/user/model/types";
import type { BoardCategory } from "@/features/board/types/board";
import { canWriteCategory } from "@/features/board/utils/permissions";
import { CATEGORY_LABEL } from "@/features/board/components/categoryLabels";
import { boardAttachmentDisplayName, useBoardAttachmentUrls } from "@/features/board/utils/attachmentUrl";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  isImageAttachment,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachmentFile,
} from "@/features/board/utils/attachmentValidation";
import { boardUploadErrorMessage, uploadBoardAttachment } from "@/shared/api/s3_helper";

export interface BoardPostFormValues {
  category: BoardCategory;
  title: string;
  content: string;
  attachmentPaths: string[];
}

interface BoardPostFormProps {
  currentUser: CurrentUser | null;
  initialValues?: BoardPostFormValues;
  isSubmitting: boolean;
  onSubmit: (values: BoardPostFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

const ALL_CATEGORIES: BoardCategory[] = ["NOTICE", "MANUAL", "GENERAL"];

export function BoardPostForm({
  currentUser,
  initialValues,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel,
}: BoardPostFormProps) {
  const writableCategories = ALL_CATEGORIES.filter((c) => canWriteCategory(currentUser, c));

  const [category, setCategory] = useState<BoardCategory>(
    initialValues?.category ?? writableCategories[0] ?? "GENERAL"
  );
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>(
    initialValues?.attachmentPaths ?? []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentUrl = useBoardAttachmentUrls(attachmentPaths);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file, attachmentPaths.length);
    if (!validation.ok) {
      alert(validation.message);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsUploading(true);
      setUploadPercent(0);
      // 파일명 정규화는 서버가 다시 수행한다 (BiDi 제어문자·이중 확장자까지). 여기서는
      // 원본 파일명을 그대로 넘겨 서버가 판단할 근거를 남긴다.
      const objectKey = await uploadBoardAttachment(file, {
        onProgress: setUploadPercent,
      });
      setAttachmentPaths((prev) => [...prev, objectKey]);
    } catch (error) {
      // 어떤 검사에 걸렸는지 서버 사유를 그대로 보여준다.
      alert(boardUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachmentPaths((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSubmit({ category, title: title.trim(), content: content.trim(), attachmentPaths });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">카테고리</label>
        <Select value={category} onValueChange={(v) => setCategory(v as BoardCategory)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue>{CATEGORY_LABEL[category]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {writableCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">제목</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          maxLength={255}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">내용</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="min-h-48"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">
          첨부파일 ({attachmentPaths.length}/{MAX_ATTACHMENT_COUNT}, 파일당 최대{" "}
          {MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB, {ALLOWED_ATTACHMENT_EXTENSIONS.join("/")})
        </label>
        <div className="flex flex-wrap gap-2">
          {attachmentPaths.map((path, idx) =>
            isImageAttachment(path) ? (
              <div
                key={path}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <img
                  src={attachmentUrl(path)}
                  alt={`첨부 ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                key={path}
                className="relative w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 px-1 bg-gray-50 dark:bg-gray-800/60"
                title={boardAttachmentDisplayName(path)}
              >
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-full">
                  {boardAttachmentDisplayName(path)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || attachmentPaths.length >= MAX_ATTACHMENT_COUNT}
            className="w-16 h-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors disabled:opacity-40 disabled:hover:text-gray-400 disabled:hover:border-gray-300"
          >
            <Paperclip className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">
              {isUploading ? (uploadPercent >= 100 ? "검사 중" : `${uploadPercent}%`) : "첨부"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !content.trim()}>
          {isSubmitting ? "저장 중..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
