import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

// 사용자 권한 타입 정의
export type Role = 'MASTER' | 'ADMIN' | 'WORKER' | 'GUEST' | 'PENDING';

export interface User {
  id: string;
  employee_id: string;
  name: string;
  role: Role;
  email?: string;
  phone_number?: string;
  address?: string;
  status?: string;
}

// 전역 인증 상태 Atom (로그인된 인증 세션 정보 보관)
export const userAtom = atomWithStorage<User | null>(
  'auth-user',
  null,
  createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : (null as any)))
);

// 파생 Atom: 로그인 여부 판별
export const isAuthenticatedAtom = atom((get) => get(userAtom) !== null);

// 파생 Atom: 관리자(MASTER) 여부 판별
export const isMasterAtom = atom((get) => {
  const user = get(userAtom) as User | null;
  return user?.role === 'MASTER';
});
