'use client';

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  src?: string;
  title: string;
  author?: string;
  isbn?: string;
  className?: string;
  aspectRatio?: string;
  onClick?: () => void;
}

export default function BookCover({
  src,
  title,
  author = '',
  isbn = '',
  className = 'w-12 h-16',
  onClick,
}: BookCoverProps) {
  const [imageError, setImageError] = useState(false);

  // Determine elegant gradient colors based on ISBN or title hash
  const getGradientClass = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'from-blue-600 via-indigo-700 to-slate-900 text-white',
      'from-emerald-600 via-teal-700 to-slate-900 text-white',
      'from-purple-600 via-violet-700 to-slate-900 text-white',
      'from-amber-600 via-orange-700 to-slate-900 text-white',
      'from-rose-600 via-pink-700 to-slate-900 text-white',
      'from-cyan-600 via-blue-700 to-slate-900 text-white',
    ];
    return gradients[Math.abs(hash) % gradients.length];
  };

  const gradientClass = getGradientClass(isbn || title || 'default');

  // REAL Cover Image URL Dynamic Binding Priority (Pure ISBN & src matching, zero hardcoding)
  const finalSrc = src && src.trim().length > 0 ? src : undefined;

  if (finalSrc && !imageError) {
    return (
      <div 
        onClick={onClick}
        className={`relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 group ${className}`}
        title={`${title} - 클릭하여 크게 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 서명 URL·외부 CDN·blob 원본은 next/image 서버 최적화를 태울 수 없다 */}
        <img
          src={finalSrc}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Guaranteed 100% Local Smart SVG Book Cover Component (Zero External Dependency)
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg border border-slate-700/40 shadow-sm shrink-0 flex flex-col justify-between p-1.5 bg-gradient-to-br cursor-pointer transition-transform duration-200 hover:scale-105 ${gradientClass} ${className}`}
      title={`${title} - ${author} (클릭하여 크게 보기)`}
    >
      {/* Decorative Book Spine Lines */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20"></div>
      
      <div className="pl-1 z-10 space-y-0.5">
        <div className="flex items-center gap-1 opacity-80">
          <BookOpen className="w-2.5 h-2.5 shrink-0" />
          <span className="text-[8px] font-mono uppercase tracking-tighter truncate">BOOK</span>
        </div>
        <p className="font-extrabold text-[10px] leading-tight line-clamp-2 drop-shadow-xs">
          {title}
        </p>
      </div>

      <div className="pl-1 z-10">
        <p className="text-[7.5px] opacity-75 font-medium truncate leading-none">
          {author.split('|')[0]}
        </p>
      </div>
    </div>
  );
}
