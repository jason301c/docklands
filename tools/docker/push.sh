#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/docker/push.sh [options] [production|canary]

Builds and pushes the Docklands Docker image.

Options:
  --allow-dirty  Permit tracked local changes. Use only for development pushes.
  --dry-run      Print the docker buildx command without running it.
  -h, --help     Show this help text.

Environment:
  IMAGE_NAME                   Image repository. Default: jason301c/docklands
  DOCKLANDS_DOCKER_ALLOW_DIRTY Same as --allow-dirty.
  DOCKLANDS_DOCKER_DRY_RUN     Same as --dry-run.
USAGE
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/docklands"

cd "$ROOT_DIR"

BUILD_TYPE=production
build_type_set=0
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}
allow_dirty=${DOCKLANDS_DOCKER_ALLOW_DIRTY:-}
dry_run=${DOCKLANDS_DOCKER_DRY_RUN:-}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--allow-dirty)
			allow_dirty=1
			shift
			;;
		--dry-run)
			dry_run=1
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		-*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 1
			;;
		*)
			if [ "$build_type_set" = "1" ]; then
				echo "Only one build type may be supplied." >&2
				exit 1
			fi
			BUILD_TYPE=$1
			build_type_set=1
			shift
			;;
	esac
done

case "$BUILD_TYPE" in
	production | canary)
		;;
	*)
		echo "Unknown Docker push type: $BUILD_TYPE" >&2
		usage >&2
		exit 1
		;;
esac

validate_release_version() {
	local version=$1
	if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "Production Docker image version must be plain semver, e.g. 0.1.0. Got: $version" >&2
		exit 1
	fi
}

run() {
	printf '+'
	printf ' %q' "$@"
	printf '\n'
	if [ -z "$dry_run" ]; then
		"$@"
	fi
}

if [ -z "$allow_dirty" ] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
	echo "Tracked files are dirty. Commit or discard tracked changes before pushing Docker images." >&2
	echo "Use --allow-dirty only for development pushes that are not release evidence." >&2
	exit 1
fi

# Image tag format: production pushes "<version>" and "latest", where <version>
# is apps/docklands/package.json#version verbatim (e.g. "0.1.0"). That version
# MUST be plain semver with no "v" prefix. Canary pushes the fixed "canary" tag.
if [ "$BUILD_TYPE" = "canary" ]; then
	TAG="canary"
	echo "Pushing canary image ${IMAGE_NAME}:${TAG}"
else
	VERSION=$(node -p "require('$APP_DIR/package.json').version")
	validate_release_version "$VERSION"
	TAG="$VERSION"
	echo "Pushing production image ${IMAGE_NAME}:latest and ${IMAGE_NAME}:${TAG}"
fi

BUILDER=""
cleanup() {
	if [ -n "$BUILDER" ]; then
		docker buildx rm "$BUILDER" >/dev/null 2>&1 || true
	fi
}
trap cleanup EXIT

if [ -z "$dry_run" ]; then
	BUILDER=$(docker buildx create --use)
fi

if [ "$BUILD_TYPE" = "canary" ]; then
	run docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--pull \
		--rm \
		-t "${IMAGE_NAME}:${TAG}" \
		-f "$APP_DIR/Dockerfile" \
		--push \
		"$ROOT_DIR"
else
	run docker buildx build \
		--platform linux/amd64,linux/arm64 \
		--pull \
		--rm \
		-t "${IMAGE_NAME}:latest" \
		-t "${IMAGE_NAME}:${TAG}" \
		-f "$APP_DIR/Dockerfile" \
		--push \
		"$ROOT_DIR"
fi
