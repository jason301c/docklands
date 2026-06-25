#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/docklands"

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}

# Image tag format: production builds tag the image with the package version
# verbatim (e.g. "0.1.0"), so apps/docklands/package.json#version MUST be a
# plain semver string with no "v" prefix. Canary builds use the fixed "canary"
# tag.
if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
else
    VERSION=$(node -p "require('$APP_DIR/package.json').version")
    # Strip an accidental leading "v" so the tag stays clean semver.
    TAG="${VERSION#v}"
fi

BUILDER=$(docker buildx create --use)

docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "${IMAGE_NAME}:${TAG}" -f "$APP_DIR/Dockerfile" "$ROOT_DIR"

docker buildx rm $BUILDER
