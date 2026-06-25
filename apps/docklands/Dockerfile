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
COPY apps/docs/package.json ./apps/docs/package.json
COPY apps/site/package.json ./apps/site/package.json

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --filter docklands --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN bun --filter docklands build

FROM deps-base AS prod-deps
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++ git pkg-config libsecret-1-dev && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock bunfig.toml ./
COPY apps/docklands/package.json ./apps/docklands/package.json
COPY apps/docs/package.json ./apps/docs/package.json
COPY apps/site/package.json ./apps/site/package.json

ENV NODE_ENV=production
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --filter docklands --frozen-lockfile --production

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


ARG DOCKER_VERSION=28.5.2
ARG FILE_SYNC_RELEASE=1.74.3
RUN set -eux; \
    curl -fsSL https://get.docker.com -o get-docker.sh; \
    sh get-docker.sh --version "$DOCKER_VERSION"; \
    rm get-docker.sh; \
    docker --version | grep -F "$DOCKER_VERSION"; \
    case "$(dpkg --print-architecture)" in \
        amd64) rclone_arch="amd64" ;; \
        arm64) rclone_arch="arm64" ;; \
        armhf) rclone_arch="arm-v7" ;; \
        *) echo "Unsupported rclone architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    rclone_zip="rclone-v${FILE_SYNC_RELEASE}-linux-${rclone_arch}.zip"; \
    curl -fsSLO "https://downloads.rclone.org/v${FILE_SYNC_RELEASE}/${rclone_zip}"; \
    curl -fsSLO "https://downloads.rclone.org/v${FILE_SYNC_RELEASE}/SHA256SUMS"; \
    grep "  ${rclone_zip}$" SHA256SUMS | sha256sum -c -; \
    unzip -q "$rclone_zip"; \
    cp "rclone-v${FILE_SYNC_RELEASE}-linux-${rclone_arch}/rclone" /usr/local/bin/rclone; \
    chmod 755 /usr/local/bin/rclone; \
    rclone --version | head -n 1 | grep -F "rclone v${FILE_SYNC_RELEASE}"; \
    rm -rf "$rclone_zip" SHA256SUMS "rclone-v${FILE_SYNC_RELEASE}-linux-${rclone_arch}"

# Install Nixpacks and tsx
# | VERBOSE=1 VERSION=1.21.0 bash

ARG NIXPACKS_VERSION=1.41.0
RUN set -eux; \
    curl -fsSL https://nixpacks.com/install.sh -o install.sh \
    && chmod +x install.sh \
    && NIXPACKS_VERSION="$NIXPACKS_VERSION" ./install.sh --yes \
    && rm install.sh \
    && nixpacks --version | grep -F "$NIXPACKS_VERSION" \
    && ln -sf /app/apps/docklands/node_modules/.bin/tsx /usr/local/bin/tsx

# Install Railpack
ARG RAILPACK_VERSION=0.15.4
RUN set -eux; \
    curl -fsSL https://railpack.com/install.sh -o install.sh \
    && chmod +x install.sh \
    && RAILPACK_VERSION="$RAILPACK_VERSION" ./install.sh --yes \
    && rm install.sh \
    && railpack --version | grep -F "$RAILPACK_VERSION"

# Install buildpacks
ARG BUILDPACKS_VERSION=0.39.1
COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack
RUN pack --version | grep -F "$BUILDPACKS_VERSION"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fs http://localhost:3000/api/ready || exit 1

WORKDIR /app/apps/docklands

CMD ["sh", "-c", "bun run wait-for-postgres && exec bun run start"]
