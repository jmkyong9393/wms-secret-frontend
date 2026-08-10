'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, ArrowLeft } from 'lucide-react';

export default function OpenSourceLicensePage() {
  const licenses = [
    {
      name: 'Next.js ( 14.x / 15.x )',
      url: 'https://github.com/vercel/next.js',
      license: 'MIT License',
    },
    {
      name: 'React / React-DOM ( 18.x / 19.x )',
      url: 'https://github.com/facebook/react',
      license: 'MIT License',
    },
    {
      name: 'Tailwind CSS ( 4.x )',
      url: 'https://github.com/tailwindlabs/tailwindcss',
      license: 'MIT License',
    },
    {
      name: 'Lucide React Icons',
      url: 'https://github.com/lucide-icons/lucide',
      license: 'ISC License',
    },
    {
      name: 'QRCode.react',
      url: 'https://github.com/zpao/qrcode.react',
      license: 'ISC License',
    },
    {
      name: 'Jotai State Management',
      url: 'https://github.com/pmndrs/jotai',
      license: 'MIT License',
    },
    {
      name: 'shadcn/ui & Radix UI Primitives',
      url: 'https://github.com/shadcn-ui/ui',
      license: 'MIT License',
    },
    {
      name: 'ANTLR 3 Tool / Runtime ( 3.5.2 )',
      url: 'http://github.com/antlr/antlr4',
      license: 'BSD 3-Clause "New" or "Revised" License',
    },
    {
      name: 'Apache-Jakarta Commons Codec / Digester ( 1.8 )',
      url: 'http://jakarta.apache.org/commons/codec/',
      license: 'Apache License 2.0',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-sans text-gray-900 bg-gray-50/50 min-h-dvh">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 대시보드로 돌아가기
        </Link>
        <Badge variant="outline" className="font-mono text-xs font-bold text-gray-700 bg-gray-100 border-gray-300">
          OPEN SOURCE NOTICE
        </Badge>
      </div>

      <Card className="border-gray-200 shadow-md bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-gray-100 bg-black text-white">
          <div className="flex items-center gap-3">
            <Code2 className="w-8 h-8 text-blue-400 shrink-0" />
            <div>
              <CardTitle className="text-2xl font-mono font-bold tracking-tight text-white">Open Source S/W License Notice</CardTitle>
              <p className="text-xs text-gray-400 font-mono mt-1">Copyright (c) 2026, KT corp. All Rights Reserved.</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-6 text-sm font-mono text-gray-800">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
            <p>This product contains the following Open Source Software with licenses and notices below.</p>
            <p>For any questions, please contact to <a href="mailto:osscenter@kt.com" className="text-blue-600 font-bold underline">osscenter@kt.com</a></p>
          </div>

          <div className="space-y-4 pt-2">
            {licenses.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                <p className="font-black text-gray-900 text-sm">{item.name}</p>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline block mt-0.5">
                  {item.url}
                </a>
                <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                  License: <strong className="text-gray-700">{item.license}</strong>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
