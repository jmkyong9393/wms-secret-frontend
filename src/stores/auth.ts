import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// 사용자 권한 타입 정의
export type Role = 'MASTER' | 'WORKER' | 'GUEST' | 'PENDING';

export interface User {
  id: string;
  employee_id: string;
  name: string;
  role: Role;
}

// 전역 인증 상태 Atom (localStorage 연동하여 새로고침 방어)
export const userAtom = atomWithStorage<User | null>('auth-user', null);

// 파생 Atom: 로그인 여부 판별
export const isAuthenticatedAtom = atom((get) => get(userAtom) !== null);

// 파생 Atom: 관리자(MASTER) 여부 판별
export const isMasterAtom = atom((get) => {
  const user = get(userAtom);
  return user?.role === 'MASTER';
});
