"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// 루트 레이아웃에서 터진 렌더 오류는 error.tsx가 잡지 못한다. 이 파일만이 마지막 경계이며,
// 여기서 Sentry로 넘기지 않으면 화면만 깨지고 기록이 남지 않는다.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
