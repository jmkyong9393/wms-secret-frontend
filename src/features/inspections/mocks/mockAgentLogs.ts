import type { MockInspectionRecord } from '@/features/inspections/types/inspection';

// 검수 처리 내역 화면에서 사용할 임시 데이터
export const mockInspectionRecords: MockInspectionRecord[] = [
  {
    id: 'insp_001',
    bookTitle: '싯다르타',
    finalGrade: 'MINT',
    isFastTrack: true,
    steps: [
      {
        stepOrder: 1,
        agentName: 'Vision',
        executionStatus: 'COMPLETED',
        resultSummary: '표지/내지 전 영역 스캔 결과 결함 미발견 (BBox 0건)',
        reasoning: '촬영된 이미지 전 영역에서 찢김, 얼룩, 낙서 등 훼손 패턴이 탐지되지 않음',
      },
      {
        stepOrder: 2,
        agentName: 'Policy',
        executionStatus: 'SKIPPED',
        resultSummary: 'MINT Fast-track으로 생략 (텍스트 기반 감점 연산 불필요)',
      },
      {
        stepOrder: 3,
        agentName: 'Critic',
        executionStatus: 'SKIPPED',
        resultSummary: 'MINT Fast-track으로 생략 (교차 검증 불필요)',
      },
      {
        stepOrder: 4,
        agentName: 'Report',
        executionStatus: 'COMPLETED',
        resultSummary: 'Auto-refund 승인 및 UBCI 디지털 품질 보증서 발급',
      },
    ],
  },
  {
    id: 'insp_002',
    bookTitle: '프로젝트 헤일메리',
    finalGrade: 'GOOD',
    isFastTrack: false,
    steps: [
      {
        stepOrder: 1,
        agentName: 'Vision',
        executionStatus: 'COMPLETED',
        resultSummary: '표지 모서리 찍힘 1건, 내지 얼룩 1건 탐지 (BBox 2건)',
        reasoning: '표지 우측 하단 모서리 마모 및 68페이지 얼룩 자국 확인',
      },
      {
        stepOrder: 2,
        agentName: 'Policy',
        executionStatus: 'COMPLETED',
        resultSummary: 'UBCI 감점 12점 산출 (표지 손상 -7점, 내지 얼룩 -5점)',
        reasoning: '내부 매입 표준 정책 기준 상대 비율 및 페이지 단위 감점 규칙 적용',
      },
      {
        stepOrder: 3,
        agentName: 'Critic',
        executionStatus: 'COMPLETED',
        resultSummary: 'Vision/Policy 판정 교차 검증 완료, 환각 소견 없음',
        reasoning: '탐지된 결함 위치와 감점 근거가 일치함을 확인',
        reasonCode: 'DEFECT_CONFIRMED',
      },
      {
        stepOrder: 4,
        agentName: 'Report',
        executionStatus: 'COMPLETED',
        resultSummary: 'GOOD 등급 판정, 감가 매입 처리 및 사유서 작성',
      },
    ],
  },
  {
    id: 'insp_003',
    bookTitle: '신경끄기의 기술',
    finalGrade: 'EXCELLENT',
    isFastTrack: false,
    steps: [
      {
        stepOrder: 1,
        agentName: 'Vision',
        executionStatus: 'COMPLETED',
        resultSummary: '표지 하단 경미한 마모 1건 탐지 (BBox 1건)',
        reasoning: '표지 하단 모서리에 경미한 눌림 자국 확인, 내지는 결함 없음',
      },
      {
        stepOrder: 2,
        agentName: 'Policy',
        executionStatus: 'COMPLETED',
        resultSummary: 'UBCI 감점 4점 산출 (표지 마모 -4점)',
        reasoning: '경미한 외관 마모로 최소 감점 규칙 적용',
      },
      {
        stepOrder: 3,
        agentName: 'Critic',
        executionStatus: 'COMPLETED',
        resultSummary: 'Vision/Policy 판정 교차 검증 완료, 환각 소견 없음',
        reasoning: '탐지된 결함 위치와 감점 근거가 일치함을 확인',
        reasonCode: 'DEFECT_CONFIRMED',
      },
      {
        stepOrder: 4,
        agentName: 'Report',
        executionStatus: 'COMPLETED',
        resultSummary: 'EXCELLENT 등급 판정, 정상 재고 편입 및 사유서 작성',
      },
    ],
  },
  {
    id: 'insp_004',
    bookTitle: '사피엔스',
    finalGrade: 'FAIR',
    isFastTrack: false,
    steps: [
      {
        stepOrder: 1,
        agentName: 'Vision',
        executionStatus: 'COMPLETED',
        resultSummary: '내지 다수 페이지 찢김 및 낙서 5건 탐지 (BBox 5건)',
        reasoning: '내지 전반에 걸쳐 반복적인 찢김과 필기 낙서 흔적 확인',
      },
      {
        stepOrder: 2,
        agentName: 'Policy',
        executionStatus: 'COMPLETED',
        resultSummary: 'UBCI 감점 58점 산출 (내지 손상 다수로 매입 기준 미달)',
        reasoning: '페이지 단위 감점 누적 결과 매입 가능 등급 하한 미달',
      },
      {
        stepOrder: 3,
        agentName: 'Critic',
        executionStatus: 'COMPLETED',
        resultSummary: 'Vision/Policy 판정 교차 검증 완료, 환각 소견 없음',
        reasoning: '탐지된 결함 개수와 감점 근거가 일치함을 확인',
        reasonCode: 'PURCHASE_REJECTED',
      },
      {
        stepOrder: 4,
        agentName: 'Report',
        executionStatus: 'COMPLETED',
        resultSummary: 'FAIR 등급 판정, 매입 불가(반송) 처리 및 거절 사유서 작성',
      },
    ],
  },
];