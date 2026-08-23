'use client';

import React, { useEffect } from 'react';
import { X, BookOpen, Barcode } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

interface BookCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: {
    title: string;
    author?: string;
    publisher?: string;
    isbn?: string;
    cover_image_url?: string;
    base_price?: number;
    lpn_barcode?: string;
  } | null;
}

export default function BookCoverModal({ isOpen, onClose, book }: BookCoverModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const highResCover = book.cover_image_url 
    ? book.cover_image_url.replace('/cover200/', '/cover500/').replace('/coversum/', '/cover500/') 
    : undefined;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 md:p-8 flex flex-col md:flex-row gap-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors z-10"
          title="닫기 (ESC)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Large Cover Image Preview */}
        <div className="relative w-full md:w-56 h-72 md:h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg shrink-0 flex items-center justify-center group">
          {highResCover ? (
            <img
              src={highResCover}
              alt={book.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400 p-4 text-center">
              <BookOpen className="w-12 h-12 stroke-1" />
              <span className="text-xs font-mono">표지 사진 없음</span>
            </div>
          )}
        </div>

        {/* Detailed Book Metadata Panel */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {book.lpn_barcode && (
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs px-2.5 py-0.5">
                  <Barcode className="w-3 h-3 mr-1 inline" />
                  {book.lpn_barcode}
                </Badge>
              )}
              {book.isbn && (
                <Badge variant="outline" className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  ISBN: {book.isbn}
                </Badge>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
              {book.title}
            </h2>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 font-medium pt-1">
              {book.author && <p>✍️ <strong className="text-slate-700 dark:text-slate-300">저자:</strong> {book.author}</p>}
              {book.publisher && <p>🏢 <strong className="text-slate-700 dark:text-slate-300">출판사:</strong> {book.publisher}</p>}
              {book.base_price ? (
                <p>🏷️ <strong className="text-slate-700 dark:text-slate-300">정가:</strong> {book.base_price.toLocaleString()}원</p>
              ) : null}
            </div>
          </div>

          {/* Additional Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono">NexWMS Aladin High-Res Cover Sync</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              className="text-xs font-bold px-4 cursor-pointer"
            >
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
