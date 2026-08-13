import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PickingBarcodeScanner from './PickingBarcodeScanner';

/**
 * 카메라 광학은 CI/개발 환경에서 검증할 수 없다. 대신 **크래시 없이 마운트되는지**와
 * 카메라를 못 얻었을 때 화면이 죽지 않고 안내로 떨어지는지를 확인한다.
 * (실제 스캔 성공률은 실기기 검증 항목 — 44번 문서 §11 참조)
 */
describe('PickingBarcodeScanner', () => {
  beforeEach(() => {
    // jsdom에는 getUserMedia가 없다. 거부 상황을 명시적으로 만든다.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('no camera')) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('카메라를 못 얻어도 크래시하지 않고 안내 문구를 보여준다', async () => {
    render(<PickingBarcodeScanner onDetected={() => {}} />);

    // 조준 안내는 카메라 상태와 무관하게 항상 떠야 한다
    expect(
      screen.getByText(/사각형에 꽉 채워주세요/),
    ).toBeInTheDocument();

    // 카메라 실패는 에러 문구로 흡수된다 (흰 화면/예외 아님)
    await waitFor(() => {
      expect(screen.getByText(/카메라 접근 권한이 없거나/)).toBeInTheDocument();
    });
  });

  it('paused면 검증 중 상태를 표시한다', () => {
    render(<PickingBarcodeScanner onDetected={() => {}} paused />);
    expect(screen.getByText(/검증 중/)).toBeInTheDocument();
  });

  it('언마운트 시 정리 과정에서 예외가 나지 않는다', () => {
    const { unmount } = render(<PickingBarcodeScanner onDetected={() => {}} />);
    expect(() => unmount()).not.toThrow();
  });
});
