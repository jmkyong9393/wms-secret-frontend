import { describe, it, expect } from 'vitest';
import { isJwtUsable } from './jwt';

const mk = (payload: object) =>
  `x.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;

describe('isJwtUsable', () => {
  it('만료 전 토큰은 유효', () => {
    expect(isJwtUsable(mk({ exp: Math.floor(Date.now() / 1000) + 600 }))).toBe(true);
  });
  it('만료된 토큰은 무효', () => {
    expect(isJwtUsable(mk({ exp: Math.floor(Date.now() / 1000) - 60 }))).toBe(false);
  });
  it('exp 없는 페이로드는 무효', () => {
    expect(isJwtUsable(mk({ sub: 'WM2608001' }))).toBe(false);
  });
  it('3분절이 아닌 문자열은 무효', () => {
    expect(isJwtUsable('not-a-jwt')).toBe(false);
  });
  it('base64가 아닌 페이로드는 무효', () => {
    expect(isJwtUsable('a.###.c')).toBe(false);
  });
  it('빈 값·undefined는 무효', () => {
    expect(isJwtUsable('')).toBe(false);
    expect(isJwtUsable(undefined)).toBe(false);
  });
});
