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
  // QR 진입점은 /lpn/[lpn] — 직원은 내부 상세, 그 외에는 고객 보증서로 자동 전환된다.
  // origin을 붙이는 이유: localhost 하드코딩이면 스캔한 기기의 localhost로 열려 실패한다.
  const qrPayload = `${typeof window !== 'undefined' ? window.location.origin : ''}/lpn/${data.lpn_barcode}`;

  // 50x31mm 열전사 프린터 규격 (가로형)
  const containerStyle: React.CSSProperties = {
    width: '50mm',
    height: '31mm',
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

  // 5줄(LPN·등급·도서명·ISBN·작업자)이 되든 4줄(등급 미확정)이 되든 잘려도 깨지지
  // 않도록 전 행에 동일한 말줄임(ellipsis) 규칙을 준다 - 내용 길이가 들쭉날쭉해도
  // 라벨 폭 안에서 항상 한 줄로 가지런히 정렬된다.
  const rowBase: React.CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const lpnTitleStyle: React.CSSProperties = {
    ...rowBase,
    fontSize: '9.5pt',
    fontWeight: 'bold',
    marginBottom: '0.8mm',
    fontFamily: 'monospace',
  };

  const bookTitleStyle: React.CSSProperties = {
    ...rowBase,
    fontSize: '7.5pt',
    fontWeight: 'bold',
    marginBottom: '0.5mm',
  };

  const isbnStyle: React.CSSProperties = {
    ...rowBase,
    fontSize: '6.5pt',
    marginBottom: '0.5mm',
    fontFamily: 'monospace',
  };

  const workerStyle: React.CSSProperties = {
    ...rowBase,
    fontSize: '6pt',
    color: '#222',
    fontWeight: 'bold',
  };

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              size: 50mm 31mm;
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
          {/* 동적 인코딩 50x31mm QR 코드 */}
          <QRCodeSVG value={qrPayload} size={62} marginSize={0} />
        </div>
        <div style={textContainerStyle}>
          <div style={lpnTitleStyle}>{data.lpn_barcode}</div>
          <div style={bookTitleStyle}>{data.book.title}</div>
          <div style={isbnStyle}>ISBN: {data.book.isbn}</div>
          <div style={workerStyle}>
            작업자: {data.worker_id || 'WM2608001 (장문경)'}
          </div>
        </div>
      </div>
    </>
  );
};
