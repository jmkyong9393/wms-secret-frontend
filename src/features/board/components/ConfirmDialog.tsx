"use client";

import { useEffect } from "react";
import { Button } from "@/shared/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 게시글/댓글 삭제 등 되돌릴 수 없는 작업 실행 전 확인 팝업.
 * src/features/employees/components/ConfirmDialog.tsx와 동일 패턴.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-5 border border-transparent dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 dark:text-white">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "처리 중..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
