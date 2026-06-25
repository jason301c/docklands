#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/release/preflight.sh [options] [git-ref]

Runs the local v0.1.0 release preflight before pushing and dispatching remote
smoke workflows. By default this covers the non-mutating local gates,
production image build/push dry-runs, and a dry run of the smoke dispatcher.

Options:
  --allow-dirty          Permit tracked local changes while running preflight.
  --docker-image IMAGE   Also run the production image deploy smoke for IMAGE.
  -h, --help             Show this help text.

Environment:
  DOCKLANDS_RELEASE_REF                     Ref passed to dispatcher dry-run.
  DOCKLANDS_RELEASE_PREFLIGHT_ALLOW_DIRTY   Same as --allow-dirty.
  DOCKLANDS_RELEASE_PREFLIGHT_DOCKER_IMAGE  Same as --docker-image IMAGE.
USAGE
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$ROOT_DIR"

allow_dirty=${DOCKLANDS_RELEASE_PREFLIGHT_ALLOW_DIRTY:-}
docker_image=${DOCKLANDS_RELEASE_PREFLIGHT_DOCKER_IMAGE:-}
git_ref=${DOCKLANDS_RELEASE_REF:-$(git rev-parse --abbrev-ref HEAD)}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--allow-dirty)
			allow_dirty=1
			shift
			;;
		--docker-image)
			if [ -z "${2:-}" ]; then
				echo "--docker-image requires an image reference" >&2
				exit 1
			fi
			docker_image=$2
			shift 2
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
			git_ref=$1
			shift
			;;
	esac
done

if [ -z "$git_ref" ] || [ "$git_ref" = "HEAD" ]; then
	echo "Pass an explicit branch or tag ref; refusing to preflight a detached HEAD." >&2
	exit 1
fi

if [ -z "$allow_dirty" ] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
	echo "Tracked files are dirty. Commit or discard tracked changes before release preflight." >&2
	echo "Use --allow-dirty only for development checks that are not release evidence." >&2
	exit 1
fi

run() {
	printf '\n==> '
	printf '%q ' "$@"
	printf '\n'
	"$@"
}

echo "Docklands release preflight"
echo "  ref:          $git_ref"
if [ -n "$docker_image" ]; then
	echo "  docker image: $docker_image"
else
	echo "  docker image: (skipped; pass --docker-image IMAGE to include image deploy smoke)"
fi

run bash -n \
	tools/release/preflight.sh \
	tools/release/dispatch-smoke-workflows.sh \
	tools/release/host-operator-smoke.sh \
	tools/release/tag-release.sh \
	tools/docker/build.sh \
	tools/docker/push.sh \
	tools/docker/smoke-image.sh \
	tools/docker/smoke-operator.sh \
	tools/docker/smoke-deploy.sh

run bun run release:check-metadata

tag_dry_run_args=(--dry-run --skip-fetch)
if [ -n "$allow_dirty" ]; then
	tag_dry_run_args=(--allow-dirty "${tag_dry_run_args[@]}")
fi
run tools/release/tag-release.sh "${tag_dry_run_args[@]}" "$git_ref"

docker_push_dry_run_args=(--dry-run --skip-release-tag-check production)
if [ -n "$allow_dirty" ]; then
	docker_push_dry_run_args=(--allow-dirty "${docker_push_dry_run_args[@]}")
fi

run tools/docker/build.sh --dry-run production
run tools/docker/push.sh "${docker_push_dry_run_args[@]}"

run bun install --frozen-lockfile --offline
run bun run format-and-lint
run bun run typecheck
run bun run test:ci
run bun run check:baseui
run bun run check:openapi
run bun run build
run bun run docs:typecheck
run bun run docs:build
run bun run site:lint
run bun run site:typecheck
run bun run site:build

if [ -n "$docker_image" ]; then
	run bun run docker:smoke:deploy "$docker_image"
fi

run env \
	DOCKLANDS_RELEASE_SMOKE_ALLOW_DIRTY="$allow_dirty" \
	DOCKLANDS_RELEASE_SMOKE_DRY_RUN=1 \
	DOCKLANDS_RELEASE_SMOKE_SKIP_FETCH=1 \
	tools/release/dispatch-smoke-workflows.sh "$git_ref"

echo
echo "Docklands release preflight passed."
