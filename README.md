# Nexus — AI Smart WMS Platform (Frontend)

입고부터 출고까지를 단일 파이프라인으로 처리하는 **AI 기반 B2B 물류(WMS) 자동화 플랫폼**의
프론트엔드 레포지토리입니다. 현장 작업자용 모바일 PWA와 관리자용 PC 관제 화면을
하나의 진입점에서 역할에 따라 분기해 제공합니다.

- **Live**: https://nexus-wms.p-e.kr

## Tech Stack

| 영역 | 사용 기술 |
| --- | --- |
| Framework | Next.js (App Router) · TypeScript |
| UI | Tailwind CSS v4 · shadcn/ui · Base UI · lucide-react · recharts |
| 상태 관리 | Jotai — 알림·인증·작업 단위 Atom 분리로 타겟 리렌더링 |
| 데이터 | TanStack Query(캐싱·폴링) · SSE(1회용 티켓 인증) · axios 공통 클라이언트 |
| 현장 기능 | @zxing(바코드/QR 스캔) · browser-image-compression · idb(IndexedDB) · qrcode.react |
| 관측 | Sentry (Errors · Logs · Metrics · Replay · Profiling) |
| 테스트 | Vitest · Testing Library |

## 핵심 설계

### 1. 단일 진입점 · 역할 기반 라우팅
하나의 URL로 접속해도 로그인 사용자의 역할(Worker/Admin/Customer)에 따라
미들웨어와 화면 가드의 이중 검증을 거쳐 해당 화면만 제공합니다.
같은 데이터라도 역할별 엔드포인트·DTO만 호출해 노출 범위를 통제합니다.

### 2. 현장 제약 기반 촬영 UX
장갑 착용·저조도·저사양 태블릿을 전제로 Tap Area와 대비를 설계했습니다.
촬영 순서(표지·책등·뒷면)와 누락 여부를 컴포넌트가 강제하고, 원본을 브라우저에서
압축한 뒤 **presigned POST로 S3에 직접 업로드**해 API 서버 병목을 우회합니다.

### 3. 오프라인 우선(Offline-first) 동기화
통신 음영 지역에서 작업을 IndexedDB에 저장하고, 연결이 복구되면 대기 작업을
자동 재전송합니다. 작업자는 네트워크 상태와 무관하게 연속 촬영을 이어갑니다.

### 4. 실시간 상태 전파
검수 요청은 202로 즉시 접수되고, 진행 상태·판정 결과는 SSE로 수신해 필요한
컴포넌트만 갱신합니다. EventSource가 커스텀 헤더를 지원하지 않는 제약은
로그인 후 발급받는 1회용 sse-ticket으로 보완했습니다.

### 5. 첨부 파일 3단 업로드 (게시판)
`presign → S3 격리 구역 POST → 서버 검증(verify)` 순서로 업로드합니다.
서버가 실제 바이트를 검사해 통과한 파일만 정상 구역으로 승격되며, 열람 URL은
소유권 검증을 거쳐 일괄 발급됩니다. 업로드 진행률·오류 문구는
`src/lib/s3_helper.ts`가 일원화합니다.

## 디렉터리 구조

```
src/
├─ app/            # App Router 페이지 (역할별 라우트)
├─ features/       # 도메인 기능 모듈
│   ├─ auth        # 로그인 · 역할 가드
│   ├─ inbound     # 입고 접수 · LPN 발급 · 촬영
│   ├─ inspection  # AI 검수 결과 · 판정 상세
│   ├─ hitl        # 관리자 결재 (결함 박스 보정)
│   ├─ stock       # 재고 현황 · 로케이션
│   ├─ outbound    # 피킹 스캔 · 3D 패킹 · 송장
│   ├─ dashboard   # 관제 지표 · 주간 인사이트
│   ├─ board       # 게시판 · 첨부 업로드
│   ├─ employees   # 직원 · 권한 관리
│   └─ queue       # 오프라인 작업 큐
├─ components/     # 공통 UI 컴포넌트
├─ hooks/ lib/ stores/   # 공통 훅 · API 클라이언트 · Jotai 스토어
└─ middleware.ts   # 인증 · 역할 라우팅 가드
```

## 실행

```bash
npm ci
npm run dev        # http://localhost:3000
npm run test       # Vitest
npm run build
```

백엔드 API·S3 연동 값은 `.env.local`에 설정합니다(저장소에 커밋하지 않습니다).
로컬 백엔드는 `wms-secret-backend`의 docker compose 구성을 사용합니다.

## 문서

- `FRONTEND_GUIDE.md` — 화면·컴포넌트 상세 가이드
- `docs/` — 기획서 · 워크플로우 · 용어집 · 협업 가이드
- 첨부 업로드 보안 상세: `개인개발가이드/93_첨부파일_보안_업로드_아키텍처.md`

## Copyright & Authorship

- **Project Manager & Chief Architect:** 장문경
- 핵심 아키텍처(역할 기반 단일 진입점, 오프라인 우선 동기화, S3 직접 업로드 흐름 등)의
  설계와 IP는 장문경 PM에게 귀속되며, 논문 및 포트폴리오로 활용될 예정입니다.
  참여 기여 내역은 커밋 이력으로 기록됩니다.
