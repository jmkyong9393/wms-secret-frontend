# 프론트엔드 개발 가이드

이 리포의 계층 구조와 코드 규칙을 정리한 문서입니다. **기획이 아니라 현재 코드 기준**으로
씁니다 — 구현과 어긋난 서술을 발견하면 코드를 확인한 뒤 이 문서를 고쳐 주십시오.

---

## 1. 계층 구조 (Feature-Sliced Design)

화면이 커지면서 `components/`·`hooks/`·`lib/`에 모든 것이 뒤섞였고, "이 파일을 어디에 둘지"가
매번 판단의 문제가 됐습니다. FSD로 계층을 나누고 의존 방향을 한쪽으로 고정해 그 판단을
규칙으로 대체했습니다.

```
app  →  widgets  →  features  →  entities  →  shared
```

| 계층 | 무엇을 두는가 | 현재 슬라이스 |
| --- | --- | --- |
| `app/` | App Router 페이지. **라우팅과 조립만** 한다 | 역할별 라우트 |
| `widgets/` | 페이지를 이루는 독립 블록 | dashboard · inspection-table · inventory-table · layout |
| `features/` | 사용자 행위 단위 기능 | auth · board · employees · hitl · inbound · outbound · queue |
| `entities/` | 도메인 명사와 그 표현 | book · inspection · inventory · label · upload-task · user |
| `shared/` | 어디에도 종속되지 않는 공용물 | api · lib · ui · pwa |

### 지켜야 할 것

- **역방향 의존 금지.** `features`가 `widgets`를 부르지 않습니다.
- **수평 참조 금지.** feature끼리, widget끼리 직접 부르지 않습니다.
  둘이 같은 코드를 필요로 하면 **공용 자리로 내리는 것**이 정답입니다
  (도메인 개념이면 `entities`, 순수 도구면 `shared`).
- 예외: `entities` 간 합성은 허용합니다. 재고 항목이 도서를 품는 것은 도메인 사실입니다.

### 슬라이스 안은 어떻게 나누는가 (세그먼트)

계층과 달리 슬라이스 **내부** 구조는 린트가 검사하지 못합니다. 규칙을 글로 둘다.

| 세그먼트 | 담는 것 |
| --- | --- |
| `ui/` | 화면에 보이는 컴포넌트 |
| `model/` | 타입·상태·도메인 규칙 |
| `api/` | 서버 통신 |
| `lib/` | 순수 함수·훅 등 도구 |
| `config/` | 상수 |

파일이 **하나뿐이면 폴더 없이 `세그먼트명.ts`** 로 둡니다(`api.ts`). 둘 이상이
되면 그제야 폴더로 올립니다. 같은 역할을 어디는 `types/`, 어디는 `model/`로 두면
"이 파일이 어디 있지"를 매번 찾아야 합니다.

> **현황 (2026-08-26 실측)**: `entities/`는 위 규칙을 따르지만, `features/`와 `widgets/`는
> 예전 구조(`components/` `hooks/` `types/` `utils/`)가 남아 슬라이스마다 다릅니다 —
> `outbound`만 `lib/` `model/`을 쓰고, `queue`는 폴더가 없으며, `layout`은 루트에 파일이
> 흔어져 있습니다. **신규 코드는 위 규칙을 따르고**, 기존 슬라이스는 그 파일을
> 손대는 작업에서 같이 옮깁니다. 한번에 전부 옮기면 import 경로가 대량으로 바뀌어
> 진행 중인 작업과 충돌합니다.

### `app/`에는 라우트만 둔다

`app/`은 App Router가 경로로 읽는 자리입니다. `page.tsx`·`layout.tsx` 같은 규약 파일과
전역 조립(`providers.tsx`) 외에는 컴포넌트를 두지 않습니다. 여러 feature에 걸치는
조립 코드라면 `providers.tsx` 안으로 넣습니다.

경계는 `eslint-plugin-boundaries`가 검사합니다. 배럴 파일(`index.ts`)을 두지 않는 대신
**규칙 위반 import가 린트에서 걸립니다**. 설정은 `eslint.config.mjs`에 있습니다.

---

## 2. 상태와 데이터

### 서버 데이터는 TanStack Query가 소유한다

`useEffect`에서 `fetch` 후 `setState` 하는 형태를 쓰지 않습니다. 로딩·에러·갱신·중복 제거를
직접 관리하게 되고, 요청이 순서를 바꿔 도착할 때의 처리가 매번 달라집니다.

```ts
// 조회 조건이 곧 쿼리 키다. 조건이 바뀌면 이전 결과가 남지 않는다.
const { data } = useQuery({
  queryKey: ['inspections', scope, workerId],
  enabled: !!workerId,
  queryFn: () => /* ... */,
});
const items = data ?? EMPTY;   // 폴백은 모듈 상수로 — 렌더마다 새 배열이면 파생 계산이 매번 돈다
```

### 이펙트로 상태를 만들지 않는다

이펙트는 **외부 시스템과의 동기화**(구독·타이머·DOM·카메라)에만 씁니다.
외부 값에서 파생되는 값은 렌더 중에 계산합니다.

```ts
// 나쁨: 값이 한 박자 늦게 반영되고, 렌더가 두 번 돈다
useEffect(() => { setTotal(items.length * price); }, [items, price]);

// 좋음: 파생값은 그냥 계산한다
const total = items.length * price;
```

"바깥 값이 바뀌면 상태를 초기화"해야 할 때는 이펙트 대신 **렌더 중 상태 조정**을 씁니다.

```ts
const [prevId, setPrevId] = useState(selectedId);
if (selectedId !== prevId) {
  setPrevId(selectedId);
  setPageIndex(0);        // 이 렌더 안에서 정리된다
}
```

### 실시간 갱신은 두 계층이다

| 계층 | 역할 | 샤임 |
| --- | --- | --- |
| **폴링·재조회** (`staleTime`, `refetchOnMount`, `refetchInterval`) | 보장 | 늦어도 반드시 맞췔진다 |
| **SSE** (`shared/lib/realtimeEvents.ts`) | 최적화 | 빠르면 좋다 |

SSE가 죽어도 폴링이 덤니다. 그래서 **놓친 이벤트를 되감는 장치(Last-Event-ID
리플레이)를 두지 않습니다** — 재연결 시 `REALTIME_RECONNECTED`를 발행해
전체 재조회하는 것으로 충분합니다. 이벤트 → 무효화할 쿼리 키 매핑은
`app/providers.tsx`의 `INVALIDATES`에 모여 있습니다.

**연결은 전역으로 하나만 엽니다.** 화면마다 `new EventSource(...)`를 하지 마십시오 —
서버는 연결마다 Redis pubsub을 하나씩 만들고, 더 큰 문제는 그 화면을 보고 있을 때만
이벤트를 받는다는 점입니다. `subscribeRealtime()`을 쓰면 연결 하나를 나눠 씁니다.

#### SSE가 조용히 죽는 방식 세 가지 (2026-08-26 실측)

세 개 모두 화면은 멀줦하고 콘솔에도 아무 오류가 안 떴습니다. 다시 밟기 쉬워 기록합니다.

1. **응답이 gzip으로 압축되면 스트림이 버퍼에 갇힌다.** SSE는 `NEXT_PUBLIC_API_URL`이
   비어 있어 상대경로로 **Next rewrite를 경유**하는데(운영도 동일), 그 프록시가 압축을
   걸어 30바이트짜리 프레임이 브라우저까지 흐르지 못했습니다(`CONNECTED`조차 미도달).
   백엔드가 `Cache-Control: no-cache, no-transform`과 `X-Accel-Buffering: no`를 붙여 막습니다.
   **이 헤더를 지우지 마십시오.**
2. **오류 없이 끊긴다.** 중간 프록시가 백엔드 쪽만 끊으면 브라우저 소켓은 열린 채
   남아 `onerror`가 오지 않습니다. 서버가 25초마다 보내는 `HEARTBEAT`가 끊기는지를
   감시해 판별합니다. 하트비트는 **이벤트가 없는 유휴 구간에만** 나갑니다.
3. **브라우저의 자동 재연결을 믿으면 안 된다.** 백엔드를 재시작한 뒤 45초를 관찰해도
   되살아나지 않았습니다. 오류가 나면 상태와 무관하게 직접 닫고 백오프로 다시 엽니다.

주기를 25초보다 늘리지 못하는 이유는 ALB·nginx의 기본 유휴 타임아웃이 60초이기
때문입니다. 그보다 길면 프록시가 먼저 끊고, 그 재연결 공백마다 이벤트가 사라집니다.

### 브라우저 저장소는 useSyncExternalStore로 읽는다

`localStorage`를 렌더에서 직접 읽으면 서버 HTML과 첫 클라이언트 렌더가 어긋나
하이드레이션 오류가 납니다(사번이 화면에 찍히는 곳에서 실제로 발생했습니다).
`shared/lib/clientStore.ts`의 `useIsHydrated`·`useLocalStorageItem`을 쓰십시오.

Jotai는 알림·인증·업로드 큐처럼 **화면을 가로지르는 상태**에만 씁니다.

---

## 3. 현장 기능

| 기능 | 구현 | 파일 |
| --- | --- | --- |
| 바코드·QR 스캔 | `@zxing/browser` + 브라우저 내장 `BarcodeDetector` 병행. 같은 코드가 두 번 읽혀야 채택한다(광학 오독 방어) | `features/inbound/hooks/useBarcodeScanEngine.ts` |
| 카메라 | `getUserMedia` 직접 제어. 바코드 모드는 FHD·줌 2x로 따로 켠다 | `shared/lib/useCamera.ts` |
| 흔들림 판정 | 라플라시안 분산. **차단하지 않고 확인만 요청**한다 | `shared/lib/image-processor.ts` |
| 라벨 인쇄 | **Web USB** + TSPL 명령 (Bluetooth 아님) | `shared/api/printerHelper.ts` |
| 오프라인 큐 | IndexedDB 적재 후 온라인 복귀 시 재전송 | `features/queue`, `shared/pwa` |

### 이미지 전송 경로가 둘이라는 점에 주의

- **검수 촬영**: 압축·크롭한 이미지를 **base64로 인코딩해 검수 요청 본문에 함께** 보냅니다.
  S3 직접 업로드가 아닙니다.
- **게시판 첨부**: `presign → S3로 직접 POST → 서버 verify` 3단입니다. 파일 바이트가 API
  서버를 거치지 않고, 서버가 격리본을 검사해 통과분만 정상 구역으로 옮깁니다.
  (`uploadBoardAttachment` in `shared/api/s3_helper.ts`)

> `uploadImageToCloudFront`는 오프라인 큐 복구 경로에서만 호출되며, CDN 도메인 기본값과
> `NEXT_PUBLIC_MOCK_UPLOAD` 분기가 남아 있는 **미검증 경로**입니다. 새 코드에서 쓰지 마십시오.

---

## 4. 반응형

현장 태블릿과 PC 관제를 같은 화면으로 처리합니다. 좁은 폭에서 표가 무너지지 않도록
다음을 지킵니다.

- 한글 줄바꿈은 `word-break: keep-all`로 어절 단위를 유지합니다. 글자 단위로 꺾이면
  읽기 어려운 정도가 아니라 레이아웃이 흔들립니다.
- 테이블은 좁은 폭에서 **카드 리스트로 전환**합니다(`md` 경계). 가로 스크롤로 밀어내면
  현장에서 뒤쪽 열에 접근하지 못합니다.
- 작업 버튼은 라벨 있는 버튼과 아이콘 전용 버튼을 **줄로 나눠** 배치합니다.
  `flex-wrap`에 맡기면 폭에 따라 줄마다 성격이 섞입니다.

---

## 5. 품질 게이트

병합 전 CI(`pr-check.yml`)가 다음을 모두 통과해야 합니다.

```bash
npm run lint       # ESLint — 경고 0건 기준 (react-hooks 규칙 포함)
npm run test:run   # Vitest
npm run build
```

Node 24 기준입니다(`.nvmrc`). 테스트 환경인 jsdom 30이 Node 22 미만을 지원하지 않습니다.

`react-hooks` 규칙은 경고가 아니라 **오류로 취급**합니다. 이펙트 안의 동기 `setState`,
렌더 중 부작용, 의존성 불일치가 여기서 걸립니다. 우회하지 말고 위 2절의 패턴으로 바꾸십시오.
