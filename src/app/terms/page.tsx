'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeft, ShieldCheck, Lock, EyeOff, Server, AlertOctagon, CheckCircle2, ShieldAlert, KeyRound } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-sans text-gray-900 bg-gray-50/50 min-h-screen">
      {/* Header Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 대시보드로 돌아가기
        </Link>
        <Badge variant="outline" className="font-mono text-xs font-bold text-gray-700 bg-gray-100 border-gray-300">
          NEXUS GOV COMPLIANCE TERMS
        </Badge>
      </div>

      {/* Main Card */}
      <Card className="border-gray-200 shadow-md bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">Nexus 서비스 이용약관</CardTitle>
              <p className="text-xs text-gray-500 font-mono mt-1">
                Nexus : 멀티 에이전트 AI 기반 B2B 스마트 물류(WMS) 관제 플랫폼 (대표자: 장문경 / 팀: AI_05조)
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8 text-sm leading-relaxed text-gray-700 font-sans">
          {/* Preamble Summary */}
          <section className="bg-blue-50/60 p-5 rounded-xl border border-blue-100 space-y-2">
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" /> 정부 규제 준수 가이드 준수 서문
            </h3>
            <p className="text-gray-700 leading-relaxed font-medium">
              본 약관은 Nexus 팀(대표자: 장문경 / AI_05조)이 개발·운영하는 서비스에 대하여 「빅 프로젝트 정부 규제 준수 가이드(개인정보보호, 시큐어코딩, UI/UX)」, 「개인정보의 안전성 확보조치 기준(제5조, 제7조, 제29조)」, 「ISMS-P 인증기준 2.6.3」 및 「KISA 소프트웨어 개발보안 가이드(49개 보안약점 방어)」를 준수하여 성실히 작성되었습니다.
            </p>
          </section>

          {/* Chapter 1 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">제1장 총칙</h3>
            
            <div className="space-y-2">
              <h4 className="font-black text-gray-900">제1조 (목적)</h4>
              <p className="text-gray-700 font-medium text-xs">
                본 약관은 Nexus 멀티 에이전트 AI 기반 B2B 스마트 물류(WMS) 관제 플랫폼의 이용 조건 및 기술적·관리적 보안 지침 준수 사항을 규정합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-gray-900">제2조 (용어의 정의)</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-700 font-medium">
                <li><strong>"개인정보 표시제한(ISMS-P 2.6.3)"</strong>: 성명, 전화번호, 이메일, IP 등 식별 가능 개인정보를 조작 마스킹하여 유출을 차단하는 보호 조치입니다.</li>
                <li><strong>"일방향 암호화 (SHA-256 / Bcrypt)"</strong>: 입력된 비밀번호를 복호화 불가능한 해시값으로 변환하여 안전하게 보관하는 기술 기법입니다.</li>
                <li><strong>"시큐어 코딩 (Secure Coding)"</strong>: SQL Injection, XSS, CSRF, 파일 업로드 취약점 등 보안 약점을 개발 단계에서 근본 제거하는 안전 코딩 지침입니다.</li>
              </ul>
            </div>
          </section>

          {/* Chapter 2: Core WMS Rules */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">제2장 핵심 WMS 물류 & AI 검수 파이프라인 규정</h3>

            <div className="space-y-2">
              <h4 className="font-black text-gray-900">제3조 (LPN 선부착 후검수 및 50×30mm 열전사 출력)</h4>
              <p className="text-gray-700 font-medium text-xs">
                모든 입고물은 50×30mm 열전사 롤 스티커 라벨(`LPN-YYMMDD-XXXX`)을 선부착 후 AI 뷰파인더 5-Agent 검수를 진행합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-gray-900">제4조 (MINT Fast Track 및 HITL 오버라이드)</h4>
              <p className="text-gray-700 font-medium text-xs">
                MINT 등급(UBCI ≥ 95) 건은 HITL 수동 검수를 건너뛰고 Fast Track 셀(`A-01-01`)로 자동 직행하며, 판독 모호건은 관리자가 HITL 수동 심의 및 등급 조정을 수행합니다.
              </p>
            </div>
          </section>

          {/* Chapter 3: Government Security Standards (PDF exact match) */}
          <section className="space-y-5 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" /> 제3장 정부 규제 가이드 기반 보안 및 기술적 조치
            </h3>

            {/* Rule 5 */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" /> 제5조 (접근통제 및 비밀번호 안전성 관리 — 개인정보 보호법 제5조/제7조)
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-700 font-medium">
                <li><strong>비밀번호 작성 규칙:</strong> 영문, 숫자, 특수문자 중 2종류 이상 최소 10자리 이상 (또는 3종류 이상 최소 8자리 이상)의 복잡도 적용.</li>
                <li><strong>계정 잠금 정책:</strong> 비밀번호 5회 이상 연속 입력 실패 시 계정 접속을 자동 잠금 처리하며 유효기간을 관리합니다.</li>
                <li><strong>비밀번호 일방향 암호화:</strong> 저장 시 복호화 불가능한 SHA-256 / Bcrypt 일방향 암호화를 의무 적용합니다.</li>
                <li><strong>통신구간 암호화:</strong> 전송 구간 SSL/TLS(HTTPS) 프로토콜을 탑재하여 통신 암호화를 수행합니다.</li>
              </ul>
            </div>

            {/* Rule 6 */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-blue-600" /> 제6조 (개인정보 표시제한 마스킹 기준 — ISMS-P 2.6.3)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <thead className="bg-gray-100 font-black text-gray-800">
                    <tr>
                      <th className="p-2.5 border-b border-r">식별 항목</th>
                      <th className="p-2.5 border-b border-r">마스킹 규칙</th>
                      <th className="p-2.5 border-b">적용 예시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    <tr>
                      <td className="p-2.5 border-r font-bold">성명 (Name)</td>
                      <td className="p-2.5 border-r">가운데 글자 마스킹</td>
                      <td className="p-2.5 font-mono text-blue-700 font-bold">장*경 / 홍*동 / 선**녀</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border-r font-bold">휴대전화번호</td>
                      <td className="p-2.5 border-r">중간 4자리 마스킹</td>
                      <td className="p-2.5 font-mono text-blue-700 font-bold">010-****-5050</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border-r font-bold">이메일 주소</td>
                      <td className="p-2.5 border-r">ID 앞 2자 제외 마스킹</td>
                      <td className="p-2.5 font-mono text-blue-700 font-bold">KT******@kt.com</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border-r font-bold">접속 IP 주소</td>
                      <td className="p-2.5 border-r">3번째 옥텟 마스킹 (17~24비트)</td>
                      <td className="p-2.5 font-mono text-blue-700 font-bold">123.123.***.123</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rule 7 */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" /> 제7조 (소프트웨어 개발보안 — KISA 시큐어코딩 5대 지침)
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-700 font-medium">
                <li><strong>위험한 형식 파일 업로드 통제:</strong> 화이트리스트 방식의 확장자 검증(`.jpg`, `.png`), 파일 크기(최대 10MB) 및 개수 제한을 적용하여 웹쉘 업로드를 원천 차단합니다.</li>
                <li><strong>신뢰되지 않은 URL 리다이렉트 제한:</strong> 외부 URL 자동 연결을 금지하고 허용된 화이트리스트 도메인만 접근하도록 통제합니다.</li>
                <li><strong>크로스사이트 요청 위조 (CSRF) 방어:</strong> 세션별 CSRF 토큰 발급 및 검증, Cookie SameSite/HttpOnly/Secure 설정을 의무화합니다.</li>
                <li><strong>HTTP 응답분할 예방:</strong> 헤더 내 개행문자(`\r`, `\n`)를 무조건 제거하여 CRLF 인젝션 공격을 예방합니다.</li>
                <li><strong>관리자 권한 직접 접속 통제:</strong> 클라이언트 쿠키에만 의존하지 않고 서버 단 세션/JWT 토큰 검증으로 관리자 페이지 무단 우회를 방지합니다.</li>
              </ul>
            </div>
          </section>

          {/* Chapter 4 */}
          <section className="space-y-3 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 border-b pb-2">제4장 기타 및 부칙</h3>
            <div className="bg-gray-100 p-4 rounded-xl border border-gray-300 text-xs font-mono font-bold text-gray-700 space-y-1">
              <p>부칙 (시행일)</p>
              <p>본 이용약관은 2026년 7월 27일부터 적용되며 시행됩니다.</p>
              <p className="text-gray-500">운영 총괄: Nexus AI_05조 (대표자: 장문경)</p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
