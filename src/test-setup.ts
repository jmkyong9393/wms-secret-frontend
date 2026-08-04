import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";

// 여러 테스트 파일 동시 렌더링 시 waitFor/findBy* 기본 타임아웃(1000ms)을
// 넘겨 간헐 실패하는 경우가 있어 여유를 둔다.
configure({ asyncUtilTimeout: 5000 });
