# syntax=docker/dockerfile:1

# FrankenGuard: single image, two stages. The builder compiles the
# TypeScript server and the React client; the runtime stage keeps
# only production dependencies and the built output. The SQLite
# database lives on a volume at /app/data so sandboxes and the
# audit chain survive container restarts.

FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/frankenguard.db
COPY package.json package-lock.json ./
# Native deps (better-sqlite3) are built once in the builder stage, which has the
# toolchain. Reinstalling here would depend on prebuild downloads succeeding and
# leave no fallback when they do not (slim has no Python/compiler for node-gyp).
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server/api/main.js"]
