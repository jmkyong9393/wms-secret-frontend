# 📦 B2B WMS AI Platform (Frontend Repository)

본 저장소는 물류센터(WMS) 인바운드/아웃바운드 프로세스를 제어하고 AI 검수 결과를 모니터링하는 **B2B WMS AI Platform**의 공식 프론트엔드 레포지토리입니다.

## 🚀 Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling & UI:** Tailwind CSS, shadcn/ui, Base UI, Lucide-react
- **State Management:** Jotai (Atomic 패턴 전역 상태 및 Queue 관리)
- **Data Fetching:** TanStack Query (비동기 폴링 및 캐싱)
- **Edge Pre-processing:** WebRTC (커스텀 카메라 UI), WASM OpenCV.js

## 📡 Key Architecture (Frontend)

### 1. Edge AI 전처리 및 낙관적 UI (Optimistic UI)
- **WebRTC & OpenCV.js:** 기기 기본 카메라 앱 의존성을 탈피하고 웹 내장 커스텀 뷰파인더를 제공하며, WASM OpenCV.js를 활용해 브라우저 단에서 이미지 흔들림(Blur)을 즉시 판독하여 서버 전송 전 불량 데이터를 차단(Drop)합니다.
- **Optimistic Queueing:** 촬영 직후 즉시 Jotai `uploadQueueAtom`에 임시 적재하여 작업자가 로딩 스피너 대기 없이 곧바로 다음 도서를 연속 촬영할 수 있게 합니다.

### 2. 클라이언트 사이드 압축 및 S3 Direct Upload
- 백엔드 병목을 막기 위해 브라우저 단에서 10MB 고화질 원본을 500KB 이하로 압축(`canvas.toBlob`)합니다.
- 백엔드로부터 AWS S3 Pre-signed URL을 발급받아, **브라우저에서 직접 S3 버킷으로 바이너리를 PUT 업로드**하여 메인 서버의 트래픽을 완벽히 우회합니다.

### 3. TanStack Query 기반 비동기 Polling 처리
- 백엔드(Celery)가 반환한 `job_id`를 기반으로 TanStack Query를 활용한 3초 주기 폴링(Polling) 또는 SSE 통신을 수행해, 검수 완료 시 하단 UI 뱃지만 부드럽게 업데이트합니다.

---

## 📂 Repository Structure & Documentations

프론트엔드 개발팀은 작업 시작 전 반드시 `docs` 폴더 내의 기획 문서들을 숙지하시기 바랍니다.

- 📄 [B2B_WMS_AI_Platform_기획서_ver1.4.2.0.md](docs/B2B_WMS_AI_Platform_기획서_ver1.4.2.0.md): 전체 시스템 구조 및 기능 명세서
- 📊 [B2B_WMS_AI_Platform_워크플로우_ver1.4.2.0.md](docs/B2B_WMS_AI_Platform_워크플로우_ver1.4.2.0.md): UI 렌더링 시퀀스 및 데이터 흐름도

---

## 🔒 Copyright & Authorship
- **Project Manager & Chief Architect:** 장문경
- 본 레포지토리의 핵심 아키텍처(S3-JSON Decoupling, UI/UX Workflow 등)의 설계 기획 및 IP는 장문경 PM에게 귀속되어 있으며, 본 레포지토리 내의 구조는 추후 논문 및 포트폴리오로 활용될 예정입니다. 참여 팀원 여러분의 구현 기여 내역은 명확히 기록되며 우수 기여 시 공동 기여자(Acknowledgement) 혜택이 주어집니다.
