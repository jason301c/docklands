# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14 AS bun-source

FROM node:24.4.0-slim AS base
COPY --from=bun-source /usr/local/bin/bun /usr/local/bin/bun
ENV BUN_INSTALL_CACHE_DIR="/root/.bun/install/cache"

FROM base AS deps-base
RUN --mount=type=cache,id=bun-global,target=/root/.bun/install/cache bun install -g node-gyp@13.0.0
ENV PATH="/root/.bun/bin:$PATH"
ENV npm_config_node_gyp="/root/.bun/bin/node-gyp"
ENV NODE_GYP_FORCE_PYTHON="/usr/bin/python3"

FROM deps-base AS build
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++ git python3-pip pkg-config libsecret-1-dev && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock bunfig.toml ./
COPY apps/docklands/package.json ./apps/docklands/package.json

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production \
    DATABASE_URL=postgres://docklands_build:docklands_build@127.0.0.1:5432/docklands_build \
    BETTER_AUTH_SECRET=docklands-build-secret-000000000000000000
RUN bun --filter docklands build

FROM deps-base AS prod-deps
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++ git pkg-config libsecret-1-dev && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock bunfig.toml ./
COPY apps/docklands/package.json ./apps/docklands/package.json

ENV NODE_ENV=production
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile --production

FROM base AS docklands
WORKDIR /app

# Set production
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y curl unzip zip apache2-utils iproute2 rsync git-lfs && git lfs install && rm -rf /var/lib/apt/lists/*

# postgresql-client (v17, from the PGDG apt repo) provides pg_dump/pg_restore for
# the pre-migration backup (migrate-db) and the web-server backup/restore. v17 is
# >= the bundled postgres:16 and dumps older/equal servers; an older client can't
# dump a newer server, which is why we pull it from PGDG rather than Debian.
RUN apt-get update && apt-get install -y curl ca-certificates gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y postgresql-client-17 && rm -rf /var/lib/apt/lists/*

# Copy only the necessary files
COPY --from=prod-deps /usr/src/app/package.json ./package.json
COPY --from=prod-deps /usr/src/app/bun.lock ./bun.lock
COPY --from=prod-deps /usr/src/app/bunfig.toml ./bunfig.toml
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=prod-deps /usr/src/app/apps/docklands/package.json ./apps/docklands/package.json
COPY --from=prod-deps /usr/src/app/apps/docklands/node_modules ./apps/docklands/node_modules
COPY --from=build /usr/src/app/apps/docklands/.next ./apps/docklands/.next
COPY --from=build /usr/src/app/apps/docklands/dist ./apps/docklands/dist
COPY --from=build /usr/src/app/apps/docklands/next.config.mjs ./apps/docklands/next.config.mjs
COPY --from=build /usr/src/app/apps/docklands/public ./apps/docklands/public
COPY --from=build /usr/src/app/apps/docklands/templates ./apps/docklands/templates
COPY --from=build /usr/src/app/apps/docklands/drizzle ./apps/docklands/drizzle


# Install docker
RUN curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh --version 28.5.2 && rm get-docker.sh && curl https://rclone.org/install.sh | bash

# Install Nixpacks and tsx
# | VERBOSE=1 VERSION=1.21.0 bash

ARG NIXPACKS_VERSION=1.41.0
RUN curl -sSL https://nixpacks.com/install.sh -o install.sh \
    && chmod +x install.sh \
    && ./install.sh \
    && ln -sf /app/apps/docklands/node_modules/.bin/tsx /usr/local/bin/tsx

# Install Railpack
ARG RAILPACK_VERSION=0.15.4
RUN curl -sSL https://railpack.com/install.sh | bash

# Install buildpacks
COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fs http://localhost:3000/api/ready || exit 1

WORKDIR /app/apps/docklands

CMD ["sh", "-c", "bun run wait-for-postgres && exec bun run start"]
