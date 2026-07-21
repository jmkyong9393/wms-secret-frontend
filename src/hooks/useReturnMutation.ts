import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface InspectionPayload {
  book_id: string; // ISBN
  location_id?: string; // LPN
  image_urls: string[]; // S3 업로드 URL 배열
}

export function useReturnMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InspectionPayload) => api.triggerInspection(payload),
    // Optimistic Update 시작
    onMutate: async (newInspection) => {
      // 1. 기존에 진행 중이던(또는 캐싱된) 'inspections' 쿼리 취소 방지
      await queryClient.cancelQueries({ queryKey: ['inspections'] });

      // 2. 롤백을 위해 이전 스냅샷 저장
      const previousInspections = queryClient.getQueryData(['inspections']);

      // 3. 임시(Optimistic) 데이터로 화면 즉시 갱신
      queryClient.setQueryData(['inspections'], (old: any) => {
        const tempItem = {
          job_id: `temp-${Date.now()}`,
          status: 'PENDING',
          progress: 0,
          book_id: newInspection.book_id,
          message: 'AI 검수 접수됨...',
          created_at: new Date().toISOString(),
        };
        return old ? [tempItem, ...old] : [tempItem];
      });

      // 4. 에러 발생 시 롤백에 사용할 컨텍스트 반환
      return { previousInspections };
    },
    // 에러 발생 시 롤백
    onError: (err, newInspection, context) => {
      if (context?.previousInspections) {
        queryClient.setQueryData(['inspections'], context.previousInspections);
      }
      console.error('검수 요청 실패:', err);
    },
    // 성공이든 실패든 완료 후 쿼리 재요청(동기화)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}
