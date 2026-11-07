# Imagen de la API de Mosaic (Bun + Hono + Prisma).
# Misma versión de Bun que `packageManager` en package.json.
FROM oven/bun:1.4.0

WORKDIR /app

# Prisma necesita OpenSSL para conectarse a PostgreSQL (sobre todo con SSL: Neon, RDS).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Primero las dependencias: se cachean mientras package.json y bun.lock no cambien.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

# Después el código.
COPY tsconfig.json ./
COPY src ./src

# Sin privilegios de root (el usuario `bun` viene en la imagen base).
USER bun

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Aplica las migraciones pendientes antes de levantar la API, así una base
# nueva en la nube queda con todas las tablas.
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/index.ts"]
