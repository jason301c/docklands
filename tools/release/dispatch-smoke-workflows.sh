#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/release/dispatch-smoke-workflows.sh [git-ref]

Dispatches the two manual v0.1.0 release smoke workflows for the same pushed ref:
  - .github/workflows/release-smoke.yml
  - .github/workflows/host-operator-smoke.yml

Environment:
  DOCKLANDS_RELEASE_GIT_URL       Git URL used by the real-deploy smoke fixture.
                                  Default: https://github.com/jason301c/docklands.git
  DOCKLANDS_RELEASE_REMOTE        Git remote used to verify the branch is pushed.
                                  Default: origin
  DOCKLANDS_RELEASE_REPO          GitHub repo slug for gh, e.g. owner/repo.
                                  Default: parsed from the selected remote URL
  DOCKLANDS_RELEASE_SMOKE_DRY_RUN Print the gh commands without dispatching.
  DOCKLANDS_RELEASE_SMOKE_SKIP_FETCH
                                  Skip the remote branch freshness check.
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
	usage
	exit 0
fi

if ! command -v git >/dev/null 2>&1; then
	echo "git is required" >&2
	exit 1
fi

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

git_ref=${1:-${DOCKLANDS_RELEASE_REF:-$(git rev-parse --abbrev-ref HEAD)}}
git_url=${DOCKLANDS_RELEASE_GIT_URL:-https://github.com/jason301c/docklands.git}
remote=${DOCKLANDS_RELEASE_REMOTE:-origin}
dry_run=${DOCKLANDS_RELEASE_SMOKE_DRY_RUN:-}
skip_fetch=${DOCKLANDS_RELEASE_SMOKE_SKIP_FETCH:-}

if [ -z "$git_ref" ] || [ "$git_ref" = "HEAD" ]; then
	echo "Pass an explicit branch or tag ref; refusing to dispatch a detached HEAD." >&2
	exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
	echo "GitHub CLI (gh) is required to dispatch release smoke workflows." >&2
	exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "Tracked files are dirty. Commit or discard tracked changes before dispatching release smoke workflows." >&2
	exit 1
fi

if ! git rev-parse --verify "$git_ref^{commit}" >/dev/null 2>&1; then
	echo "Ref '$git_ref' does not resolve to a local commit." >&2
	exit 1
fi

parse_github_repo() {
	local url=$1
	case "$url" in
		https://github.com/*/*.git)
			url=${url#https://github.com/}
			printf '%s\n' "${url%.git}"
			;;
		https://github.com/*/*)
			printf '%s\n' "${url#https://github.com/}"
			;;
		git@github.com:*/*.git)
			url=${url#git@github.com:}
			printf '%s\n' "${url%.git}"
			;;
		git@github.com:*/*)
			printf '%s\n' "${url#git@github.com:}"
			;;
		*)
			return 1
			;;
	esac
}

github_repo=${DOCKLANDS_RELEASE_REPO:-}
if [ -z "$github_repo" ]; then
	remote_url=$(git remote get-url "$remote" 2>/dev/null || true)
	if [ -z "$remote_url" ] || ! github_repo=$(parse_github_repo "$remote_url"); then
		echo "Could not infer GitHub repo from remote '$remote'. Set DOCKLANDS_RELEASE_REPO=owner/repo." >&2
		exit 1
	fi
fi

if git show-ref --verify --quiet "refs/heads/$git_ref" && [ -z "$skip_fetch" ]; then
	echo "Verifying local branch '$git_ref' is pushed to '$remote'..."
	git fetch --quiet "$remote" "$git_ref"
	local_sha=$(git rev-parse "$git_ref")
	remote_sha=$(git rev-parse FETCH_HEAD)
	if [ "$local_sha" != "$remote_sha" ]; then
		echo "Local '$git_ref' is not the same commit as '$remote/$git_ref'." >&2
		echo "Push the branch before dispatching release smoke workflows." >&2
		echo "local:  $local_sha" >&2
		echo "remote: $remote_sha" >&2
		exit 1
	fi
fi

run_cmd() {
	printf '+'
	printf ' %q' "$@"
	printf '\n'
	if [ -z "$dry_run" ]; then
		"$@"
	fi
}

echo "Dispatching release smoke workflows"
echo "  repo:    $github_repo"
echo "  ref:     $git_ref"
echo "  git url: $git_url"

run_cmd gh workflow run release-smoke.yml \
	--repo "$github_repo" \
	--ref "$git_ref" \
	-f "git_ref=$git_ref" \
	-f "git_url=$git_url"

run_cmd gh workflow run host-operator-smoke.yml \
	--repo "$github_repo" \
	--ref "$git_ref" \
	-f "git_ref=$git_ref"

if [ -n "$dry_run" ]; then
	echo "Dry run complete; no workflows were dispatched."
else
	echo "Dispatched both release smoke workflows. Use 'gh run list --repo $github_repo' to watch them."
fi
