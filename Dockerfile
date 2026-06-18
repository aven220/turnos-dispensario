# Turnos Dispensario — imagen de produccion (app + frontend embebido)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN cd backend && npx prisma generate
RUN npm run build

# ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 8741

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
