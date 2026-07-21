import type { BookGrade } from '../types/inspection';

// 도서 등급별 배지 색상
export const GRADE_BADGE_STYLE: Record<BookGrade, string> = {
  MINT: 'bg-blue-100 text-blue-700',
  EXCELLENT: 'bg-indigo-100 text-indigo-700',
  GOOD: 'bg-green-100 text-green-700',
  FAIR: 'bg-yellow-100 text-yellow-700',
  SCRAP: 'bg-red-100 text-red-700',
};