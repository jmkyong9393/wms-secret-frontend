'use client';

import { useParams } from 'next/navigation';
import { BoardDetailView } from '@/features/board/components/BoardDetailView';

export default function BoardPostPage() {
  const params = useParams();
  const postId = params?.postId as string;

  return <BoardDetailView postId={postId} />;
}
