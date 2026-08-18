# 🎨 B2B WMS AI Platform - Frontend Architecture & Solo Developer Guide

본 문서는 솔로 트랙(1인 체제)으로 개발 중인 프론트엔드 파트의 통일된 규칙, 아키텍처 구조, 코딩 컨벤션을 명시한 가이드입니다.

---

## 🛠️ 1. 프론트엔드 핵심 기술 스택 (Core Tech Stack)

본 프로젝트는 물류 현장의 열악한 네트워크와 디바이스 환경을 극복하기 위해 아래의 기술 스택을 엄격하게 사용합니다.

- **Framework:** Next.js (SSR/CSR 하이브리드 라우팅 적용)
- **UI Components:** shadcn/ui & Base UI (Tailwind CSS v4 기반 컴포넌트 시스템 및 Lucide-react)
- **State Management:** Jotai (Atomic 패턴을 활용한 가벼운 전역 상태 및 큐 관리)
- **Data Fetching:** TanStack Query (비동기 서버 상태, 캐싱 및 폴링 관리)
- **Hardware Integration (MVP):** Web Bluetooth API (로컬 라벨 프린터 통신)
- **Edge AI & 최적화:** 
  - ZXing 기반 바코드 디코딩 (`@zxing/browser`)
  - WebRTC 기반 커스텀 카메라 UI (기본 카메라 앱 의존성 탈피)
  - WASM OpenCV.js (브라우저 단독 흔들림/Blur 전처리 필터링)
  - Client-side 이미지 압축 및 낙관적 UI(Optimistic UI) 큐 적재 후 CloudFront Edge 백그라운드 업로드

---

## 📁 2. 디렉토리 구조 (Feature-driven Architecture)

우리 프로젝트는 역할과 책임(SRP)을 분리하여, 코드가 커져도 유지보수가 쉽도록 설계되었습니다. 기능 추가 시 아래의 폴더 용도에 맞게 파일을 생성해 주세요.

```text
src/
├── app/                  # 📍 라우팅 및 페이지 엔트리포인트
│   ├── (auth)/           # - 로그인, 회원가입 등 인증 관련 라우트 그룹
│   ├── dashboard/        # - 대시보드 페이지 라우트
│   ├── layout.tsx        # - 최상위 레이아웃
│   └── page.tsx          # - 메인(홈) 페이지
│
├── components/           # 🧩 UI 컴포넌트 모음 (가장 많이 작업하게 될 폴더)
│   ├── common/           # - Button, Input, Modal 등 전역 재사용 컴포넌트
│   ├── layout/           # - Header, Sidebar, Footer 등 틀(Layout) 컴포넌트
│   └── camera/           # - 바코드 스캔 및 WebRTC 사진 촬영 특화 컴포넌트
│
├── hooks/                # 🪝 커스텀 React 훅
│   └── useCamera.ts      # - WebRTC 카메라 스트림 제어 훅
│
├── lib/                  # 🛠️ 범용 유틸리티 함수
│   └── s3_helper.ts      # - CloudFront Signed Cookie 및 다이렉트 업로드 유틸
│
├── services/             # 🌐 API 호출 함수 (네트워크 계층)
│   └── api.ts            # - axios 인스턴스 설정 및 Fetch 로직
│
├── stores/               # 📦 전역 상태 관리 (Jotai Atoms)
│   └── atoms.ts          # - 큐(Queue) 및 토큰 등 상태 관리
│
└── types/                # 🏷️ TypeScript 공통 인터페이스 및 타입 선언
    └── index.ts          # - DTO, 모델 인터페이스
```

---

## 💡 3. 개발 핵심 행동 가이드 (Do's & Don'ts)

솔로 개발 체제일수록 아키텍처 원칙을 엄격하게 지켜야 기술 부채가 누적되지 않습니다.

### 🔴 1. `app/` 폴더에는 **오직 페이지(라우팅)** 로직만 위치!
- UI 덩어리들은 무조건 `src/components/` 로 분리한 뒤, `page.tsx`에서는 이를 **Import 해서 조립(Assemble)**만 하는 형태로 작성해야 합니다.

### 🟡 2. API Fetching은 `services/`에서 전담!
- 컴포넌트 내부에 `fetch()`나 `axios.get()`을 직접 하드코딩하지 않습니다.
- API 호출 코드는 `src/services/` 폴더에 모아두고, 컴포넌트에서는 만들어진 함수를 불러와서 TanStack Query와 연동하세요.

### 🟢 3. 상대경로(`../../`) 대신 절대경로(`@/`)를 사용!
- ❌ Bad: `import Button from '../../components/common/Button'`
- ✅ Good: `import Button from '@/components/common/Button'`

---

## 📸 4. 물류 입고(Inbound) 핵심 워크플로우

현장 작업의 딜레이를 없애기 위해, 다음과 같은 매끄러운(Seamless) 4단계 UX 파이프라인을 구축합니다.

### 4-1. 순차적 UX 흐름
1. **ISBN 스캔 (바코드 렌즈):** WebRTC 비디오 스트림 위에서 `@zxing/browser`로 도서의 ISBN 바코드를 스캔하여 서버로 도서 정보를 요청합니다.
2. **LPN 생성 및 출력 (Bluetooth):** 서버에서 도서 정보를 응답하면 LPN 바코드를 생성하고, Web Bluetooth API를 통해 TSPL 명령어로 즉석 라벨 프린트를 요청합니다.
3. **사진 촬영 전환 (카메라 렌즈):** 스트림을 끄지 않고 즉시 훼손 상태 캡처 뷰(BBox 오버레이)로 전환하여 작업자가 책의 상태를 캡처합니다.
4. **Edge Network 다이렉트 업로드:** 
   - 촬영 직후 Jotai 전역 큐(`uploadQueueAtom`)에 PENDING 상태로 적재하고 화면은 즉시 다음 작업(ISBN 스캔)으로 복귀시킵니다 (Optimistic UI).
   - 백그라운드에서는 FastAPI 서버로부터 발급받은 **CloudFront Signed Cookie**를 활용해, 5~10MB 고화질 이미지를 AWS Edge Network로 즉시 PUT 업로드합니다 (백엔드 서버 부하 Zero).
