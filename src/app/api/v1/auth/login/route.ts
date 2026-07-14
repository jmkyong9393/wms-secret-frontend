import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 모의 계정 1: 관리자
    if (username === 'admin' && password === '1234') {
      return NextResponse.json({
        token: 'mock-jwt-token-master-777',
        user: { id: 'usr_01', username: 'admin', role: 'MASTER' }
      });
    }

    // 모의 계정 2: 작업자
    if (username === 'worker' && password === '1234') {
      return NextResponse.json({
        token: 'mock-jwt-token-worker-888',
        user: { id: 'usr_02', username: 'worker', role: 'WORKER' }
      });
    }

    // 로그인 실패
    return NextResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }
}
