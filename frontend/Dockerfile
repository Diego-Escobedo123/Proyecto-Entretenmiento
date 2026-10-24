# Imagen del frontend de Mosaic: compila con Vite y sirve los estáticos con nginx.

# --- Etapa 1: build ---
# Node real + Bun. vue-tsc necesita Node: en la imagen oven/bun, `node` es un
# alias de Bun y vue-tsc no reconoce los .vue (TS2307 en cada import).
FROM node:24-slim AS build

# Misma versión de Bun que `packageManager` en package.json.
COPY --from=oven/bun:1.4.0 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Primero las dependencias: se cachean mientras package.json y bun.lock no cambien.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Vite mete las VITE_* en el JS al compilar: se pasan con --build-arg, no al
# levantar el contenedor. Son públicas (terminan en el navegador), no secretos.
ARG VITE_API_URL=http://localhost:3000
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
ENV VITE_API_URL=$VITE_API_URL \
  VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
  VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
  VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

RUN bun run build

# --- Etapa 2: servir ---
# Sólo nginx y el build: ni Bun ni node_modules llegan a la imagen final.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
