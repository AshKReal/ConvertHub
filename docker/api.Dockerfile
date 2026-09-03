# Спека 016. Образ apps/api. `node:22-bookworm-slim`, не Alpine: prebuilt-
# бинарники sharp (libvips) и argon2 собраны под glibc. Python в рантайме
# обязателен — движок PDF→DOCX (005) зовёт `python` дочерним процессом
# (pdf-to-docx.engine.ts), скрипт лежит в apps/api/python/.
#
# WORKDIR рантайма — /app: код завязан на process.cwd() (python/pdf_to_docx.py,
# package.json#prisma.schema = src/prisma/schema.prisma).

# ---------- deps: полная установка по локу (нужны dev-зависимости для сборки)
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /app

# Только манифесты — слой с зависимостями кешируется, пока лок не менялся.
# tsconfig.base.json нужен build-стадии: packages/shared/tsconfig.json его
# extends'ит, без него tsc падает на дефолтном lib=ES5.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build: shared → prisma generate → nest build → prod-срез
FROM deps AS build
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @convert-hub/shared build \
    && pnpm --filter api exec prisma generate \
    && pnpm --filter api build
# pnpm deploy — плоский hoisted node_modules только с прод-зависимостями
# (@convert-hub/shared инжектится реальной папкой). --legacy: алгоритм pnpm 9,
# не требует inject-workspace-packages в конфиге.
RUN pnpm --filter api --prod --legacy deploy /app/pruned

# ---------- runtime
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && ln -sf /usr/bin/python3 /usr/local/bin/python \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Python-зависимости движка PDF→DOCX (--break-system-packages: PEP 668 на
# bookworm; образ одноразовый, venv тут лишний слой).
COPY apps/api/python ./python
RUN pip3 install --no-cache-dir --break-system-packages -r python/requirements.txt

COPY --from=build /app/pruned/node_modules ./node_modules
COPY --from=build /app/pruned/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src/prisma ./src/prisma
COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

# Клиент Prisma генерируется под фактический node_modules этого образа.
RUN node node_modules/prisma/build/index.js generate

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
