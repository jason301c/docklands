#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/docklands"

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}

BUILDER=$(docker buildx create --use)

if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
    echo PUSHING CANARY
        docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:${TAG}" -f "$APP_DIR/Dockerfile" --push "$ROOT_DIR"
else
    echo  "PUSHING PRODUCTION"
    VERSION=$(node -p "require('$APP_DIR/package.json').version")
    docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:latest" -t "${IMAGE_NAME}:${VERSION}" -f "$APP_DIR/Dockerfile" --push "$ROOT_DIR"
fi

docker buildx rm $BUILDER
