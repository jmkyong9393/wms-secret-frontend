# Stage 1: Dependencies 설치 (캐시 레이어 극대화)
FROM node:20-alpine AS deps
# alpine 환경에서 자주 필요한 libc 호환 라이브러리 추가
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Next.js 애플리케이션 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# NEXT_PUBLIC_ 변수는 빌드 시점에 번들로 구워진다. 런타임 environment로는 반영되지 않으므로
# Sentry DSN도 빌드 인자로 받아야 한다. 값이 비면 Sentry는 초기화를 건너뛴다.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# [2026-08-09 추가] next.config.ts의 rewrites()가 반환하는 프록시 대상은 standalone
# 빌드 시 .next/routes-manifest.json에 문자열로 고정(bake)된다 - 컨테이너 런타임에
# environment:로 BACKEND_ORIGIN을 줘도 이미 굳어진 값이라 반영되지 않는다. 빌드
# 인자로 받아야 한다.
ARG BACKEND_ORIGIN
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN

# next.config.ts 의 output: 'standalone' 설정에 의해 프로덕션용 파일만 추려짐
RUN npm run build

# Stage 3: 초경량 Runtime 환경 구성
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# 불필요한 Next.js 텔레메트리 비활성화로 자원 절약
ENV NEXT_TELEMETRY_DISABLED=1

# 보안 강화를 위한 Non-root 시스템 유저 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 정적 에셋 복사
COPY --from=builder /app/public ./public

# Standalone 모드로 추출된 최소한의 파일만 복사 (용량 80% 이상 절감)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Non-root 권한 전환
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js Standalone 결과물인 server.js 로 구동
CMD ["node", "server.js"]
