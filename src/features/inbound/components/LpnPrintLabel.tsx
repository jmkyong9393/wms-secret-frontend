import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface LpnLabelData {
  lpn_barcode: string;
  book: {
    title: string;
    author: string;
    isbn: string;
  };
  worker_id?: string;
}

interface LpnPrintLabelProps {
  data: LpnLabelData;
}

export const LpnPrintLabel: React.FC<LpnPrintLabelProps> = ({ data }) => {
  // 50x30mm 열전사 프린터 규격 (가로형)
  // 해상도나 픽셀 변환에 의존하지 않도록 mm 단위를 명시적으로 사용합니다.
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
    fontSize: '5pt',
    color: '#333',
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
          {/* LPN 바코드를 QR로 변환. 여백 0 */}
          <QRCodeSVG value={data.lpn_barcode} size={60} marginSize={0} />
        </div>
        <div style={textContainerStyle}>
          <div style={lpnTitleStyle}>{data.lpn_barcode}</div>
          <div style={bookTitleStyle}>{data.book.title}</div>
          <div style={isbnStyle}>ISBN: {data.book.isbn}</div>
          {data.worker_id && <div style={workerStyle}>Worker: {data.worker_id}</div>}
        </div>
      </div>
    </>
  );
};
