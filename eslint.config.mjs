import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// FSD 계층 경계 강제. 공개 API 배럴(index.ts) 대신 이 린터가 경계를 지킨다 (49번 §8 확정안).
// 의존 방향은 위→아래만 허용: app → widgets → features → entities → shared.
const fsdBoundaries = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: {} },
    // 슬라이스(폴더) 단위 요소 - 슬라이스 내부 import는 의존성으로 취급되지 않는다.
    "boundaries/elements": [
      { type: "app", pattern: "src/app" },
      { type: "widgets", pattern: "src/widgets/*", capture: ["widget"] },
      { type: "features", pattern: "src/features/*", capture: ["feature"] },
      { type: "entities", pattern: "src/entities/*", capture: ["entity"] },
      { type: "shared", pattern: "src/shared" },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        policies: [
          { from: { element: { type: "app" } }, allow: { to: { element: { types: { anyOf: ["app", "widgets", "features", "entities", "shared"] } } } } },
          // widget 간 수평 참조는 default disallow에 걸린다 (allow 목록에 widgets 없음)
          { from: { element: { type: "widgets" } }, allow: { to: { element: { types: { anyOf: ["features", "entities", "shared"] } } } } },
          // cross-feature import 금지 - 공용물은 entities/shared로 강등이 정답
          { from: { element: { type: "features" } }, allow: { to: { element: { types: { anyOf: ["entities", "shared"] } } } } },
          // 엔티티 간 명사 합성(재고 항목이 도서를 품는 등)은 도메인 사실이므로 허용
          { from: { element: { type: "entities" } }, allow: { to: { element: { types: { anyOf: ["entities", "shared"] } } } } },
          { from: { element: { type: "shared" } }, allow: { to: { element: { type: "shared" } } } },
        ],
      },
    ],
  },
};

// 의도된 미사용(시그니처 유지용 _접두 인자, 전송 제외용 rest 분해)은 위반으로 치지 않는다.
const unusedVarsPolicy = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  fsdBoundaries,
  unusedVarsPolicy,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
