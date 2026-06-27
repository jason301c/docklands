#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/release/preflight.sh [options] [git-ref]

Runs the local release preflight before tagging and publishing. Covers the
non-mutating local gates plus production image build/push dry-runs. Heavy
install/deploy verification lives in `bun run verify` (the verify harness) and
runs in CI on amd64; pass --image to also run a sandbox verify here.

Options:
  --allow-dirty   Permit tracked local changes while running preflight.
  --image IMAGE   Also run `bun run verify:deploy` against IMAGE (sandbox).
  -h, --help      Show this help text.

Environment:
  DOCKLANDS_RELEASE_REF                     Ref label for output.
  DOCKLANDS_RELEASE_PREFLIGHT_ALLOW_DIRTY   Same as --allow-dirty.
  DOCKLANDS_RELEASE_PREFLIGHT_IMAGE         Same as --image IMAGE.
USAGE
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$ROOT_DIR"

allow_dirty=${DOCKLANDS_RELEASE_PREFLIGHT_ALLOW_DIRTY:-}
verify_image=${DOCKLANDS_RELEASE_PREFLIGHT_IMAGE:-}
git_ref=${DOCKLANDS_RELEASE_REF:-$(git rev-parse --abbrev-ref HEAD)}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--allow-dirty)
			allow_dirty=1
			shift
			;;
		--image)
			if [ -z "${2:-}" ]; then
				echo "--image requires an image reference" >&2
				exit 1
			fi
			verify_image=$2
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
if [ -n "$verify_image" ]; then
	echo "  verify image: $verify_image"
else
	echo "  verify image: (skipped; pass --image IMAGE to include a sandbox verify)"
fi

run bash -n \
	tools/release/preflight.sh \
	tools/release/tag-release.sh \
	tools/docker/build.sh \
	tools/docker/push.sh \
	tools/verify/verify.sh \
	tools/verify/lib.sh \
	tools/replica/replica.sh

# install.sh is POSIX sh (it runs via `curl … | sh`), so check it with sh.
run sh -n install.sh

run node tools/release/check-metadata.mjs

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

if [ -n "$verify_image" ]; then
	run bun run verify:deploy -- --image "$verify_image"
fi

echo
echo "Docklands release preflight passed."
echo "Next: 'bun run verify' on amd64 (CI), then 'bun run release:tag --push $git_ref' and 'bun run release:publish'."
