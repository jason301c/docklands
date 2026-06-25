#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/docker/push.sh [options] [production|canary]

Builds and pushes the Docklands Docker image.

Options:
  --allow-dirty             Permit tracked local changes. Use only for development pushes.
  --dry-run                 Print the docker buildx command without running it.
  --skip-release-tag-check  Skip production release tag verification. Only valid
                            with --dry-run before the release tag exists.
  -h, --help                Show this help text.

Environment:
  IMAGE_NAME                             Image repository. Default: jason301c/docklands
  DOCKLANDS_DOCKER_ALLOW_DIRTY           Same as --allow-dirty.
  DOCKLANDS_DOCKER_DRY_RUN               Same as --dry-run.
  DOCKLANDS_DOCKER_REMOTE                Git remote used for tag verification.
                                        Default: origin
  DOCKLANDS_DOCKER_SKIP_RELEASE_TAG_CHECK
                                        Same as --skip-release-tag-check.
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
remote=${DOCKLANDS_DOCKER_REMOTE:-origin}
skip_release_tag_check=${DOCKLANDS_DOCKER_SKIP_RELEASE_TAG_CHECK:-}

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
		--skip-release-tag-check)
			skip_release_tag_check=1
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

if [ -n "$skip_release_tag_check" ] && [ -z "$dry_run" ]; then
	echo "--skip-release-tag-check is only allowed with --dry-run." >&2
	exit 1
fi

validate_release_version() {
	local version=$1
	if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "Production Docker image version must be plain semver, e.g. 0.1.0. Got: $version" >&2
		exit 1
	fi
}

verify_release_tag() {
	local release_tag=$1
	local head_sha local_tag_sha remote_tag_sha

	head_sha=$(git rev-parse HEAD)
	if ! git show-ref --verify --quiet "refs/tags/$release_tag"; then
		echo "Release tag '$release_tag' does not exist locally." >&2
		echo "Run 'bun run release:tag --push <ref>' after smoke gates pass before publishing Docker images." >&2
		exit 1
	fi

	local_tag_sha=$(git rev-list -n 1 "$release_tag")
	if [ "$local_tag_sha" != "$head_sha" ]; then
		echo "Release tag '$release_tag' does not point at the current commit." >&2
		echo "tag:  $local_tag_sha" >&2
		echo "HEAD: $head_sha" >&2
		exit 1
	fi

	echo "Verifying release tag '$release_tag' is pushed to '$remote'..."
	remote_tag_sha=$(git ls-remote --exit-code "$remote" "refs/tags/$release_tag^{}" 2>/dev/null | awk 'NR == 1 { print $1 }') || remote_tag_sha=""
	if [ -z "$remote_tag_sha" ]; then
		echo "Release tag '$release_tag' is not present on '$remote'." >&2
		echo "Run 'bun run release:tag --push <ref>' before publishing Docker images." >&2
		exit 1
	fi
	if [ "$remote_tag_sha" != "$head_sha" ]; then
		echo "Remote release tag '$release_tag' does not point at the current commit." >&2
		echo "remote tag: $remote_tag_sha" >&2
		echo "HEAD:       $head_sha" >&2
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

if [ -z "$allow_dirty" ]; then
	untracked_files=$(git ls-files --others --exclude-standard)
	if [ -n "$untracked_files" ]; then
		echo "Untracked files are present. Commit, remove, or ignore them before pushing Docker images." >&2
		echo "$untracked_files" >&2
		echo "Use --allow-dirty only for development pushes that are not release evidence." >&2
		exit 1
	fi
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
	if [ -n "$skip_release_tag_check" ]; then
		echo "Skipping release tag verification for dry-run."
	else
		verify_release_tag "$TAG"
	fi
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
