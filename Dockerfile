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

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts"]
