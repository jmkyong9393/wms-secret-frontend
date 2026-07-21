import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import MainLayout from "@/components/layout/MainLayout";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { A2HSBanner } from "@/components/a2hs-banner";
import { GlobalErrorBoundary } from "@/components/error/GlobalErrorBoundary";
import ReactQueryProvider from "@/lib/react-query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WMS AI Platform",
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
          <ReactQueryProvider>
            <Providers>
              {children}
            </Providers>
          </ReactQueryProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
