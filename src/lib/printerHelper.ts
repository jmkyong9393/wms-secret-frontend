// [미사용/확장예정] WebUSB 라벨 프린터 직결. 백엔드 ZPL 경로의 폴백으로 쓸 수 있다.
// VENDOR_ID는 예시값이므로 실제 장비 확인 후 교체해야 한다.
/**
 * WebUSB API Wrapper for Xprinter XP-423B (Thermal Label Printer)
 * 이 헬퍼 클래스는 브라우저의 WebUSB API를 통해 로컬에 USB로 연결된 Xprinter와 직접 통신합니다.
 */
export class PrinterHelper {
  private device: USBDevice | null = null;
  // Xprinter의 전형적인 USB Vendor ID (사용 환경에 따라 실제 모델의 Vendor ID 확인 후 수정 필요)
  private readonly VENDOR_ID = 0x0483; // 예시 Vendor ID (STMicroelectronics, Xprinter에서 자주 사용)
  
  async connect(): Promise<boolean> {
    try {
      // 1. 장치 권한 요청 (브라우저 상단 팝업 뜸)
      this.device = await navigator.usb.requestDevice({
        filters: [{ vendorId: this.VENDOR_ID }]
      });

      // 2. 장치 연결 및 인터페이스 확보
      await this.device.open();
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      // 대부분의 프린터는 인터페이스 0을 사용
      await this.device.claimInterface(0); 
      return true;
    } catch (error) {
      console.error("WebUSB 연동 실패:", error);
      return false;
    }
  }

  async printLpnTag(lpnCode: string, bookTitle: string = "도서"): Promise<void> {
    if (!this.device) {
      console.error("프린터가 연결되어 있지 않습니다.");
      return;
    }

    // TSPL 명령어 구성 (감열식 프린터 범용 언어)
    // - SIZE 40 mm, 30 mm (라벨 사이즈 예시)
    // - TEXT 도서명
    // - BARCODE LPN 바코드 인쇄
    const tsplCommand = `
SIZE 40 mm, 30 mm
GAP 2 mm, 0 mm
CLS
TEXT 10,10,"TSS24.BF2",0,1,1,"${bookTitle}"
BARCODE 10,50,"128",80,1,0,2,2,"${lpnCode}"
PRINT 1,1
`;
    // 문자열을 UTF-8 바이트 배열로 인코딩
    const encoder = new TextEncoder();
    const data = encoder.encode(tsplCommand);

    try {
      // Endpoint는 장치마다 다름. 보통 bulk transfer out endpoint는 1번 또는 2번.
      // 실제 장치의 USB descriptor를 보고 endpointNumber(예: 1)를 찾아야 함.
      const endpointNumber = 1; 
      await this.device.transferOut(endpointNumber, data);
      console.log(`LPN 라벨 [${lpnCode}] 출력 명령 전송 완료`);
    } catch (error) {
      console.error("TSPL 데이터 전송 실패:", error);
    }
  }

  async disconnect() {
    if (this.device) {
      try {
        await this.device.close();
        console.log("프린터 연결 해제됨");
      } catch (error) {
        console.error("연결 해제 오류:", error);
      }
    }
  }
}
