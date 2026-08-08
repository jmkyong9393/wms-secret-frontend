'use client';

import { useParams } from 'next/navigation';
import { BoardPostFormView } from '@/features/board/components/BoardPostFormView';

export default function EditBoardPostPage() {
  const params = useParams();
  const postId = params?.postId as string;

  return <BoardPostFormView postId={postId} />;
}
