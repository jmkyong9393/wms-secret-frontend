'use client';

/**
 * BBox 편집분의 UBCI 점수를 결재 전에 미리 계산한다.
 *
 * 서버의 Policy Agent는 LLM을 쓰지 않는 결정론적 산식이라 호출 비용이 없다. 그래도
 * 드래그 한 번에 요청이 쏟아지지 않도록 디바운스하고, 응답이 순서를 바꿔 도착해도
 * 최신 편집 결과만 반영되도록 요청 세대(generation)를 검사한다.
 */

import { useEffect, useRef, useState } from 'react';
import { adminAPI, type HitlScorePreview } from '@/shared/api/api';
import type { BBoxEdits } from '../components/HitlImageModal';

const DEBOUNCE_MS = 350;

export function toPreviewPayload(edits: BBoxEdits) {
  return {
    excludedDefectIndexes: edits.excluded,
    adoptedCandidateIndexes: edits.adopted,
    editedBboxes: Object.entries(edits.edited).map(([index, b]) => ({
      index: Number(index),
      xmin: b.xmin,
      ymin: b.ymin,
      xmax: b.xmax,
      ymax: b.ymax,
    })),
    addedBboxes: edits.added.map((a) => ({
      type: a.type,
      xmin: a.xmin,
      ymin: a.ymin,
      xmax: a.xmax,
      ymax: a.ymax,
      imageIndex: a.imageIndex,
    })),
  };
}

export function useScorePreview(jobId: string | undefined, edits: BBoxEdits | undefined, enabled: boolean) {
  const [preview, setPreview] = useState<HitlScorePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  // 편집 내용을 문자열로 접어 의존성으로 쓴다. 객체 참조로 걸면 리렌더마다 재요청된다.
  const key = edits ? JSON.stringify(toPreviewPayload(edits)) : '';

  useEffect(() => {
    if (!enabled || !jobId || !edits) {
      setPreview(null);
      setError(null);
      return;
    }
    const gen = ++genRef.current;
    setLoading(true);
    const timer = setTimeout(() => {
      adminAPI
        .previewHitlScore(jobId, toPreviewPayload(edits))
        .then((res) => {
          if (gen !== genRef.current) return; // 늦게 온 이전 요청 무시
          setPreview(res);
          setError(null);
        })
        .catch((e: unknown) => {
          if (gen !== genRef.current) return;
          setPreview(null);
          setError(e instanceof Error ? e.message : '점수 미리보기를 불러오지 못했습니다.');
        })
        .finally(() => {
          if (gen === genRef.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, key, enabled]);

  return { preview, loading, error };
}
