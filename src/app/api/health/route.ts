// 컨테이너 헬스체크 전용 엔드포인트. k8s의 liveness/readiness probe가 찌른다.
//
// 백엔드·DB 같은 의존성은 확인하지 않는다. 의존성이 아플 때 이 파드까지 실패로
// 판정되면 멀쩡한 프론트엔드가 재시작 루프에 빠져 장애가 번진다 — 여기서 답하는 것은
// "이 프로세스가 요청을 처리할 수 있는가"뿐이다.

// 빌드 시점에 정적 응답으로 굳지 않게 한다. 살아 있는 프로세스가 답해야 의미가 있다.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
