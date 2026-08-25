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
촬영 순서(표지·책등·뒷면)와 누락 여부를 컴포넌트가 강제하고, 원본은 브라우저에서
압축·ROI 크롭한 뒤 검수 요청에 함께 실어 보냅니다. 흔들림은 라플라시안 분산으로 판정하되
**차단하지 않고 확인만 요청합니다** — 지표가 피사체 질감에 민감해 하드 차단으로 두면
선명한 사진도 통과하지 못하는 상황이 실제로 발생했습니다.

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
`src/shared/api/s3_helper.ts`가 일원화합니다.

## 디렉터리 구조 — FSD 6계층

화면이 커지면서 `components/`·`hooks/`·`lib/`에 기능이 뒤섞여 "이 파일을 어디에 둘지"가
매번 논쟁이 됐습니다. Feature-Sliced Design으로 계층을 나누고, **의존 방향을 위에서
아래로만 허용**해 그 논쟁을 규칙으로 대체했습니다.

```
src/
├─ app/         # App Router 페이지 — 라우팅과 조립만 (43 files)
├─ widgets/     # 페이지를 구성하는 독립 블록 (13)
│                 dashboard · inspection-table · inventory-table · layout
├─ features/    # 사용자 행위 단위 기능 (106)
│                 auth · board · employees · hitl · inbound · outbound · queue
├─ entities/    # 도메인 명사와 그 표현 (18)
│                 book · inspection · inventory · label · upload-task · user
├─ shared/      # 어디에도 종속되지 않는 공용물 (36)
│                 api(HTTP·S3) · lib(훅·유틸) · ui(디자인 시스템) · pwa
└─ middleware.ts  # 인증 · 역할 라우팅 가드
```

**의존 방향**: `app → widgets → features → entities → shared` (역방향·수평 참조 금지)

- 슬라이스끼리 가로로 부르지 않습니다. 두 기능이 같은 코드를 필요로 하면
  공용 자리(`entities` 또는 `shared`)로 내리는 것이 정답입니다.
- 배럴 파일(`index.ts`) 대신 **`eslint-plugin-boundaries`가 경계를 검사**합니다.
  규칙을 어긴 import는 린트 단계에서 걸립니다.

## 코드 규칙

- **이펙트로 상태를 만들지 않습니다.** 서버 데이터는 TanStack Query가, 외부 값에서
  파생되는 값은 렌더 중 계산이나 "렌더 중 상태 조정" 패턴이 담당합니다.
  이펙트는 외부 시스템과의 동기화(구독·타이머·DOM)에만 씁니다.
- `localStorage`처럼 서버에 없는 값은 `useSyncExternalStore`로 읽어 하이드레이션
  불일치를 만들지 않습니다 (`shared/lib/clientStore.ts`).
- CI에서 **ESLint 경고 0건**을 통과해야 병합됩니다 (`react-hooks` 규칙 포함).

## 실행

```bash
npm ci
npm run dev        # http://localhost:3000
npm run lint       # ESLint (경고 0건 기준)
npm run test:run   # Vitest 1회 실행 (watch 없이)
npm run build
```

Node 24 기준입니다(`.nvmrc`). 테스트 환경인 jsdom 30이 Node 22 미만을 지원하지 않습니다.

백엔드 API·S3 연동 값은 `.env.local`에 설정합니다(저장소에 커밋하지 않습니다).
로컬 백엔드는 `wms-secret-backend`의 docker compose 구성을 사용합니다.

## 문서

- [`docs/FRONTEND_GUIDE.md`](docs/FRONTEND_GUIDE.md) — 계층 구조와 개발 규칙
- [`docs/README.md`](docs/README.md) — 기술 문서 정본(아키텍처·API 스키마·보안)의 위치 안내

시스템 아키텍처·API 스키마·AI 파이프라인 문서는 이 리포 밖에서 관리합니다.

## Copyright & Authorship

- **Project Manager & Chief Architect:** 장문경
- 핵심 아키텍처(역할 기반 단일 진입점, 오프라인 우선 동기화, S3 직접 업로드 흐름 등)의
  설계와 IP는 장문경 PM에게 귀속되며, 논문 및 포트폴리오로 활용될 예정입니다.
  참여 기여 내역은 커밋 이력으로 기록됩니다.
