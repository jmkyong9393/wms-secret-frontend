# 📦 B2B WMS AI Platform (Frontend Repository)

본 저장소는 물류센터(WMS) 인바운드/아웃바운드 프로세스를 제어하고 AI 검수 결과를 모니터링하는 **B2B WMS AI Platform**의 공식 프론트엔드 레포지토리입니다.

## 🚀 Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context API / Zustand (협의 후 결정)
- **Data Fetching:** SWR / React Query

## 📡 Key Architecture (Frontend)

### 1. S3 Direct Upload (Pre-signed URL) 연동
- 본 시스템의 가장 중요한 병목 방지 기술입니다. 모바일 기기(웹/앱)에서 중고 서적을 촬영한 5~10MB의 원본 이미지는 백엔드 서버를 거치지 않습니다.
- 프론트엔드에서 백엔드(`POST /api/upload/url`)를 호출하여 AWS S3 Pre-signed URL을 발급받은 뒤, **브라우저에서 직접 S3로 바이너리를 PUT 업로드**합니다.

### 2. 비동기 Polling 처리 (DB Queue)
- 백엔드가 `Celery 큐` 기반의 비동기 큐로 동작하므로, 검수 요청 시 `202 Accepted` 응답과 함께 `job_id`를 반환받습니다.
- 프론트엔드는 해당 `job_id`를 기반으로 백엔드 폴링(Polling) 또는 SSE/WebSocket을 통해 최종 검수 리포트를 화면에 렌더링해야 합니다.

### 3. 워크플로우 및 하드웨어 제어
- **[FE PC/Admin 박준희]** 전담으로 블루투스 감열지 프린터를 연동하여 정전기 필름(포스트잇 재질) 기반 LPN 라벨을 발급하고, 전반적인 UI/UX 워크플로우를 제어 및 모니터링합니다.

---

## 📂 Repository Structure & Documentations

프론트엔드 개발팀은 작업 시작 전 반드시 `docs` 폴더 내의 기획 문서들을 숙지하시기 바랍니다.

- 📄 [B2B_WMS_AI_Platform_기획서_ver1.4.2.0.md](docs/B2B_WMS_AI_Platform_기획서_ver1.4.2.0.md): 전체 시스템 구조 및 기능 명세서
- 📊 [B2B_WMS_AI_Platform_워크플로우_ver1.4.2.0.md](docs/B2B_WMS_AI_Platform_워크플로우_ver1.4.2.0.md): UI 렌더링 시퀀스 및 데이터 흐름도

---

## 🔒 Copyright & Authorship
- **Project Manager & Chief Architect:** 장문경
- 본 레포지토리의 핵심 아키텍처(S3-JSON Decoupling, UI/UX Workflow 등)의 설계 기획 및 IP는 장문경 PM에게 귀속되어 있으며, 본 레포지토리 내의 구조는 추후 논문 및 포트폴리오로 활용될 예정입니다. 참여 팀원 여러분의 구현 기여 내역은 명확히 기록되며 우수 기여 시 공동 기여자(Acknowledgement) 혜택이 주어집니다.
