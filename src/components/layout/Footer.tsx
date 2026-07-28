'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 pt-6 pb-8 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-sans text-xs space-y-2 text-center md:text-left transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 font-bold">
        <Link 
          href="/privacy" 
          className="text-gray-900 dark:text-white font-black hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4 transition-colors"
        >
          개인정보 처리방침
        </Link>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <Link 
          href="/terms" 
          className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          이용약관
        </Link>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <Link 
          href="/opensource" 
          className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          오픈소스라이선스
        </Link>
      </div>

      <div className="text-gray-400 dark:text-gray-500 leading-relaxed font-sans text-[11px] md:text-xs pt-1">
        <p>
          <strong className="text-gray-700 dark:text-gray-300 font-bold">Nexus</strong> : 멀티 에이전트 AI 기반 B2B 스마트 물류(WMS) 관제 플랫폼 &nbsp;|&nbsp; 대표자: 장문경 &nbsp;|&nbsp; 팀: AI_05조 &nbsp;|&nbsp; 문의: <a href="mailto:jmkyong2002@naver.com" className="hover:underline font-bold text-gray-500 dark:text-gray-400">jmkyong2002@naver.com</a>
        </p>
        <p className="mt-0.5 text-gray-400 dark:text-gray-500 font-mono">
          © 2026 Nexus AI_05조. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
