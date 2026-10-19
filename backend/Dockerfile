# Imagen de la API de Mosaic (Bun + Hono + Prisma).
FROM oven/bun:1

WORKDIR /app

# Prisma necesita OpenSSL para conectarse a PostgreSQL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Primero las dependencias (se cachean si no cambian).
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install
RUN bunx prisma generate

# Después el código.
COPY tsconfig.json ./
COPY src ./src

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "src/index.ts"]