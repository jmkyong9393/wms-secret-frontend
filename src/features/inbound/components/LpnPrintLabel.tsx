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
  // 검수자/관리자/출고담당자가 QR 스캔 시 즉시 파싱할 수 있는 스마트 JSON 바코드 구조체
  const qrPayload = JSON.stringify({
    lpn: data.lpn_barcode,
    isbn: data.book.isbn,
    title: data.book.title,
    grade: data.grade || 'PENDING',
    score: data.ubci_score || 95,
    zone: data.zone || 'Zone A-1-1',
    worker: data.worker_id || 'WM2607001'
  });

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
    fontSize: '9pt',
    fontWeight: 'bold',
    marginBottom: '1mm',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  const bookTitleStyle: React.CSSProperties = {
    fontSize: '7pt',
    fontWeight: 'bold',
    marginBottom: '0.5mm',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const isbnStyle: React.CSSProperties = {
    fontSize: '6pt',
    marginBottom: '0.5mm',
  };

  const workerStyle: React.CSSProperties = {
    fontSize: '5.5pt',
    color: '#333',
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
          {/* LPN / 도서 / 등급 / 랙 정보가 일체화된 스마트 JSON QR 코드 */}
          <QRCodeSVG value={qrPayload} size={60} marginSize={0} />
        </div>
        <div style={textContainerStyle}>
          <div style={lpnTitleStyle}>{data.lpn_barcode}</div>
          <div style={bookTitleStyle}>{data.book.title}</div>
          <div style={isbnStyle}>ISBN: {data.book.isbn}</div>
          <div style={workerStyle}>
            {data.zone ? `📍 ${data.zone}` : '📍 Zone A-1-1'} {data.grade ? `| 🏷️ ${data.grade}` : ''}
          </div>
        </div>
      </div>
    </>
  );
};
