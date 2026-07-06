/**
 * Web Bluetooth API Wrapper for Thermal LPN Printer
 * 
 * 정전기 필름 감열식 프린터를 블루투스로 연결하여 LPN(License Plate Number)
 * 바코드 및 텍스트를 전송하는 유틸리티입니다.
 */

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Generic Thermal Printer UUIDs (Modify based on actual hardware)
  private readonly SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'; 
  private readonly CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

  /**
   * 브라우저의 블루투스 페어링 모달을 띄워 프린터 장치를 찾고 연결합니다.
   */
  async connect(): Promise<boolean> {
    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API is not supported in this browser.");
      }

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID]
      });

      if (!this.device.gatt) {
        throw new Error("Device does not support GATT.");
      }

      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);
      
      console.log(`[Bluetooth] Connected to ${this.device.name}`);
      return true;
    } catch (error) {
      console.error("[Bluetooth] Connection failed:", error);
      return false;
    }
  }

  /**
   * ZPL/TSPL 형식의 바코드 명령어를 블루투스 프린터로 전송합니다.
   */
  async printLpnTag(lpnCode: string): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Printer is not connected.");
    }

    // TSPL format example for typical thermal printers
    const commands = `
SIZE 40 mm, 30 mm
GAP 2 mm, 0 mm
CLS
TEXT 10,10,"4",0,1,1,"WMS LPN TAG"
BARCODE 10,50,"128",80,1,0,2,2,"${lpnCode}"
PRINT 1,1
`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(commands);

    // Write chunked data if necessary
    await this.characteristic.writeValue(data);
    console.log(`[Bluetooth] LPN Tag Printed: ${lpnCode}`);
  }

  /**
   * 장치 연결을 해제합니다.
   */
  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
      console.log("[Bluetooth] Disconnected.");
    }
  }
}
