import { describe, it, expect } from "vitest";
import { isRequiredFieldFilled, doPasswordsMatch } from "./validation";

describe("isRequiredFieldFilled", () => {
  it("공백만 있는 입력은 미입력으로 판정한다", () => {
    expect(isRequiredFieldFilled("   ")).toBe(false);
    expect(isRequiredFieldFilled("")).toBe(false);
  });

  it("실제 값이 있으면 입력으로 판정한다", () => {
    expect(isRequiredFieldFilled("WM2608001")).toBe(true);
    expect(isRequiredFieldFilled("  a  ")).toBe(true);
  });
});

describe("doPasswordsMatch", () => {
  it("두 비밀번호가 같으면 true", () => {
    expect(doPasswordsMatch("nexus1234!", "nexus1234!")).toBe(true);
  });

  it("빈 문자열끼리는 일치로 보지 않는다", () => {
    expect(doPasswordsMatch("", "")).toBe(false);
  });

  it("다르면 false", () => {
    expect(doPasswordsMatch("nexus1234!", "nexus1234@")).toBe(false);
  });
});
