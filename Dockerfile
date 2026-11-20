FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Keystore is mounted at runtime — never baked into the image
VOLUME ["/run/secrets"]

# GET /health answers 503 while the oracle cannot vote (no node quorum, epoch
# mismatch, failed vote), so the container shows unhealthy instead of silent.
ENV HEALTH_PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- "http://127.0.0.1:${HEALTH_PORT}/health" >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts"]
