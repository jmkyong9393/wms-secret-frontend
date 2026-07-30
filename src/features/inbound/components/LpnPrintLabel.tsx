import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface LpnLabelData {
  lpn_barcode: string;
  book: {
    title: string;
    author?: string;
    isbn: string;
  };
  grade?: string;
  ubci_score?: number;
  zone?: string;
  worker_id?: string;
}

interface LpnPrintLabelProps {
  data: LpnLabelData;
}

export const LpnPrintLabel: React.FC<LpnPrintLabelProps> = ({ data }) => {
  // 선부착(Label First, Inspect Later) 규격: DB 적치 전 라벨이므로 Location(Zone)은 제외하고 LPN/ISBN/도서명/작업자 정보만 QR에 유기적 인코딩
  // Real working QR code payload for smartphone camera scanning -> opens digital certificate
  const qrPayload = `http://localhost:3000/certificate/${data.lpn_barcode}`;

  // 50x30mm 열전사 프린터 규격 (가로형)
  const containerStyle: React.CSSProperties = {
    width: '50mm',
    height: '30mm',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2mm',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    color: 'black',
    fontFamily: 'sans-serif',
    pageBreakAfter: 'always',
    margin: 0,
    overflow: 'hidden',
  };

  const qrContainerStyle: React.CSSProperties = {
    flex: '0 0 16mm',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const textContainerStyle: React.CSSProperties = {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: '2mm',
    overflow: 'hidden',
  };

  const lpnTitleStyle: React.CSSProperties = {
    fontSize: '9.5pt',
    fontWeight: 'bold',
    marginBottom: '1mm',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    fontFamily: 'monospace'
  };

  const bookTitleStyle: React.CSSProperties = {
    fontSize: '7.5pt',
    fontWeight: 'bold',
    marginBottom: '0.5mm',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const isbnStyle: React.CSSProperties = {
    fontSize: '6.5pt',
    marginBottom: '0.5mm',
    fontFamily: 'monospace'
  };

  const workerStyle: React.CSSProperties = {
    fontSize: '6pt',
    color: '#222',
    fontWeight: 'bold'
  };

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body * {
              visibility: hidden;
            }
            #lpn-print-section, #lpn-print-section * {
              visibility: visible;
            }
            #lpn-print-section {
              position: absolute;
              left: 0;
              top: 0;
            }
          }
        `}
      </style>
      <div id="lpn-print-section" style={containerStyle}>
        <div style={qrContainerStyle}>
          {/* 동적 인코딩 50x30mm QR 코드 */}
          <QRCodeSVG value={qrPayload} size={62} marginSize={0} />
        </div>
        <div style={textContainerStyle}>
          <div style={lpnTitleStyle}>{data.lpn_barcode}</div>
          <div style={bookTitleStyle}>{data.book.title}</div>
          <div style={isbnStyle}>ISBN: {data.book.isbn}</div>
          <div style={workerStyle}>
            작업자: {data.worker_id || 'WM2607001 (장문경)'}
          </div>
        </div>
      </div>
    </>
  );
};
