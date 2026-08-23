import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import MainLayout from "@/widgets/layout/MainLayout";
import { ServiceWorkerRegistration } from "@/shared/pwa/ServiceWorkerRegistration";
import { A2HSBanner } from "@/shared/pwa/a2hs-banner";
import { GlobalErrorBoundary } from "@/shared/ui/GlobalErrorBoundary";
import { SessionAutoLogout } from "@/features/auth/components/SessionAutoLogout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus - WMS AI Platform",
  description: "AI-powered B2B Warehouse Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <GlobalErrorBoundary>
          <ServiceWorkerRegistration />
          <A2HSBanner />
            <Providers>
              {/* 탭 생존 마커는 반드시 **모든 페이지**에서 설정되어야 한다.
                  종전에는 MainLayout/WorkerMobileShell(인증 셸) 안에만 있어서 로그인
                  화면에서는 마커가 세팅되지 않았고, 로그인 직후 첫 인증 페이지 진입이
                  "마커 없는데 사용자 정보는 있음" = 새 탭으로 오판되어 즉시 로그아웃됐다.
                  자세한 배경은 SessionAutoLogout 주석 참고. */}
              <SessionAutoLogout />
              {children}
            </Providers>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
