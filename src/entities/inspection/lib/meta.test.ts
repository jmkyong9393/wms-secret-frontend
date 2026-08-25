import { describe, it, expect } from 'vitest';
import { gradeMeta } from './meta';

describe('gradeMeta', () => {
  it("NORMAL을 GOOD으로 표시하지 않는다 ('NORMAL'에 'A'가 들어 있어 생겼던 오분류)", () => {
    expect(gradeMeta('NORMAL', 84).display).toBe('NORMAL');
    expect(gradeMeta('NORMAL', 100).display).toBe('NORMAL');
  });

  it('확정 등급이 점수보다 우선한다 (HITL 결재 결과가 정답)', () => {
    // 결함 전건이 오탐으로 지목돼 점수는 100이지만 관리자가 NORMAL로 확정한 경우
    expect(gradeMeta('NORMAL', 100).display).toBe('NORMAL');
    expect(gradeMeta('REJECT', 90).display).toBe('REJECT');
  });

  it('별칭 등급을 표준 등급으로 매핑한다', () => {
    expect(gradeMeta('S', 0).display).toBe('MINT');
    expect(gradeMeta('A', 0).display).toBe('GOOD');
    expect(gradeMeta('B', 0).display).toBe('NORMAL');
    expect(gradeMeta('mint', 0).display).toBe('MINT');
  });

  it('등급이 비었거나 체계 밖이면 점수 경계로 폴백한다', () => {
    expect(gradeMeta('', 96).display).toBe('MINT');
    expect(gradeMeta('', 85).display).toBe('GOOD');
    expect(gradeMeta('', 84).display).toBe('NORMAL');
    expect(gradeMeta('', 64).display).toBe('REJECT');
    expect(gradeMeta('NEW_FASTTRACK', 100).display).toBe('MINT');
  });

  it('모든 등급에 배지 클래스가 있다', () => {
    for (const g of ['MINT', 'GOOD', 'NORMAL', 'REJECT']) {
      expect(gradeMeta(g, null).badge).toBeTruthy();
    }
  });
});
