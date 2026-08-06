'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ArrowLeft, Lock, EyeOff, FileCheck, Server, KeyRound } from 'lucide-react';
import { PRIVACY_OFFICER } from '@/lib/contact';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-sans text-gray-900 bg-gray-50/50 min-h-screen">
      {/* Header Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 대시보드로 돌아가기
        </Link>
        <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border-blue-200">
          GOV & ISMS-P PRIVACY POLICY
        </Badge>
      </div>

      {/* Main Card */}
      <Card className="border-gray-200 shadow-md bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">개인정보 처리방침</CardTitle>
              <p className="text-xs text-gray-500 font-mono mt-1">
                Nexus : 멀티 에이전트 AI 기반 B2B 스마트 물류(WMS) 관제 플랫폼 (대표자: 장문경 / 팀: AI_05조)
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8 text-sm leading-relaxed text-gray-700 font-sans">
          {/* Preamble */}
          <section className="bg-blue-50/60 p-5 rounded-xl border border-blue-100 space-y-2">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" /> 서문 및 안전성 확보 조치 법률 준수
            </h3>
            <p className="text-gray-700 leading-relaxed font-medium">
              Nexus 팀(대표자: 장문경 / AI_05조)은 「개인정보 보호법」, 「개인정보의 안전성 확보조치 기준(제5조, 제7조, 제29조)」, 「ISMS-P 인증기준 2.6.3」 및 「정부 규제 준수 가이드」를 준수하여 사용자의 개인정보와 물류 관제 데이터를 안전하게 처리하고 원활한 서비스를 제공합니다.
            </p>
          </section>

          {/* Section 1 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">1. 개인정보 수집 목적, 항목 및 보유기간</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 font-black text-gray-800">
                  <tr>
                    <th className="p-3 border-b border-r">수집 구분</th>
                    <th className="p-3 border-b border-r">처리 항목</th>
                    <th className="p-3 border-b border-r">처리 목적</th>
                    <th className="p-3 border-b">보유 기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  <tr>
                    <td className="p-3 border-r font-bold text-gray-900">작업자 계정 정보</td>
                    <td className="p-3 border-r">사번(Employee ID), 일방향 암호화 비밀번호, 권한 등급</td>
                    <td className="p-3 border-r font-medium">시스템 로그인 및 물류 검수 권한 검증</td>
                    <td className="p-3 font-mono">계정 삭제 시까지</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-r font-bold text-gray-900">물류 검수 감사 데이터</td>
                    <td className="p-3 border-r">LPN 바코드, AI 5-Agent BBox 판독 이미지, UBCI 점수, 8대 reason_code</td>
                    <td className="p-3 border-r font-medium">AI 품질 검수 이력 추적 및 HITL 오버라이드 감사 로그 보관</td>
                    <td className="p-3 font-mono">영구 보관 (물류 관제 이력)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: Safety Measures & ISMS-P 2.6.3 Masking */}
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-indigo-600" /> 2. 개인정보 안전성 확보조치 기준 및 ISMS-P 2.6.3 표시제한
            </h3>

            <div className="space-y-2 text-xs text-gray-700 font-medium">
              <p><strong>가. 비밀번호 일방향 암호화 (제7조 제1항):</strong> 비밀번호 복호화가 불가능하도록 SHA-256 / Bcrypt 일방향 암호화를 의무 적용합니다.</p>
              <p><strong>나. 비밀번호 작성규칙 및 5회 잠금 (제5조 제5항·제6항):</strong> 영문, 숫자, 특수문자 조합 최소 10자리 이상 규칙 적용 및 5회 연속 로그인 실패 시 계정이 자동 잠금됩니다.</p>
              <p><strong>다. 통신구간 암호화 (제7조 제2항):</strong> 웹과 서버 간 데이터 전송 시 SSL/TLS 암호화 프로토콜(HTTPS)을 의무 적용합니다.</p>
              <p><strong>라. ISMS-P 2.6.3 표시제한(마스킹):</strong> 화면 조회를 통한 유출 차단을 위해 성명(`장*경`), 전화번호(`010-****-5050`), 이메일(`jmky****@naver.com`), IP주소(`123.123.***.123`)로 마스킹 표시합니다.</p>
            </div>
          </section>

          {/* Section 3: KISA Secure Coding */}
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-600" /> 3. 소프트웨어 개발보안 (KISA 시큐어코딩) 준수
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-700 font-medium">
              <li>파일 업로드 시 화이트리스트 확장자 검증, 최대 10MB 크기 및 파일 개수 제한 적용.</li>
              <li>CSRF 토큰 검증, XSS 차단 및 신뢰되지 않은 URL 주소로의 리다이렉트 자동 접속 통제.</li>
              <li>클라이언트 쿠키 단독 판정을 배제하고 서버 단 세션/JWT 기반으로 관리자 권한을 엄격 검증.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">4. 개인정보 보호책임자 및 문의처</h3>
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-xs space-y-1.5 font-sans">
              <p className="font-bold text-gray-900 text-sm">Nexus WMS 총괄 관리팀</p>
              <p><strong>대표자:</strong> 장문경 (Lead Architect & Project Owner)</p>
              <p><strong>소속:</strong> KT AIVLE School 빅프로젝트 AI_05조</p>
              <p className="text-gray-700 font-mono pt-1">
                <strong>개인정보 보호책임자:</strong> {PRIVACY_OFFICER.name} ({PRIVACY_OFFICER.role}) · <a href={`mailto:${PRIVACY_OFFICER.email}`} className="text-blue-600 underline font-bold">{PRIVACY_OFFICER.email}</a>
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
