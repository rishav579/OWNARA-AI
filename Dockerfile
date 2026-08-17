# ─────────────────────────────────────────────────────────────────────────────
# OWNARA — Multi-Stage Production Dockerfile (Railway / Cloud Deployment)
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_PHASE=true
ENV NODE_ENV=production
RUN npx prisma generate
RUN npx next build

# Stage 3: Production Runner (Web Service)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PATH="/app/node_modules/.bin:$PATH"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy compiled worker, source tree and dependencies for both web and background worker
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN ls -la /app/scripts && test -f /app/scripts/worker.ts
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Compatibility symlink: ensures both `node server.js` and `node .next/standalone/server.js` work
RUN mkdir -p /app/.next/standalone && ln -sf /app/server.js /app/.next/standalone/server.js

USER nextjs

EXPOSE 3000

# Default entrypoint starts the Web service
CMD ["node", "server.js"]
