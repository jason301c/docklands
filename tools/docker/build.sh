#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/docker/build.sh [options] [production|canary]

Builds the Docklands Docker image locally.

Options:
  --dry-run     Print the docker buildx command without running it.
  -h, --help    Show this help text.

Environment:
  IMAGE_NAME                 Image repository. Default: jason301c/docklands
  DOCKLANDS_DOCKER_DRY_RUN  Same as --dry-run.
USAGE
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
APP_DIR="$ROOT_DIR/apps/docklands"

BUILD_TYPE=production
build_type_set=0
IMAGE_NAME=${IMAGE_NAME:-jason301c/docklands}
dry_run=${DOCKLANDS_DOCKER_DRY_RUN:-}

while [ "$#" -gt 0 ]; do
	case "$1" in
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
		echo "Unknown Docker build type: $BUILD_TYPE" >&2
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

# Image tag format: production builds tag the image with the package version
# verbatim (e.g. "0.1.0"), so apps/docklands/package.json#version MUST be a
# plain semver string with no "v" prefix. Canary builds use the fixed "canary"
# tag.
if [ "$BUILD_TYPE" = "canary" ]; then
	TAG="canary"
else
	VERSION=$(node -p "require('$APP_DIR/package.json').version")
	validate_release_version "$VERSION"
	TAG="$VERSION"
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

run docker buildx build \
	--platform linux/amd64,linux/arm64 \
	--pull \
	--rm \
	-t "${IMAGE_NAME}:${TAG}" \
	-f "$APP_DIR/Dockerfile" \
	"$ROOT_DIR"
