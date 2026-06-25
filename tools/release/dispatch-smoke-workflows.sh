#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/release/dispatch-smoke-workflows.sh [options] [git-ref]

Dispatches the two manual v0.1.0 release smoke workflows for the same pushed ref:
  - .github/workflows/release-smoke.yml
  - .github/workflows/host-operator-smoke.yml

Options:
  --wait                Wait for the newly dispatched runs to finish successfully.
  --poll-seconds N      Poll interval used with --wait. Default: 15.
  --timeout-seconds N   Timeout per wait phase used with --wait. Default: 7200.
  -h, --help            Show this help text.

Environment:
  DOCKLANDS_RELEASE_GIT_URL       Git URL used by the real-deploy smoke fixture.
                                  Default: https://github.com/jason301c/docklands.git
  DOCKLANDS_RELEASE_REMOTE        Git remote used to verify the branch is pushed.
                                  Default: origin
  DOCKLANDS_RELEASE_REPO          GitHub repo slug for gh, e.g. owner/repo.
                                  Default: parsed from the selected remote URL
  DOCKLANDS_RELEASE_SMOKE_ALLOW_DIRTY
                                  Permit tracked local changes. Use only for
                                  development dry-runs, not release dispatch.
  DOCKLANDS_RELEASE_SMOKE_DRY_RUN Print the gh commands without dispatching.
  DOCKLANDS_RELEASE_SMOKE_SKIP_FETCH
                                  Skip the remote branch freshness check.
  DOCKLANDS_RELEASE_SMOKE_WAIT    Same as --wait.
  DOCKLANDS_RELEASE_SMOKE_POLL_SECONDS
                                  Same as --poll-seconds N.
  DOCKLANDS_RELEASE_SMOKE_TIMEOUT_SECONDS
                                  Same as --timeout-seconds N.
USAGE
}

if ! command -v git >/dev/null 2>&1; then
	echo "git is required" >&2
	exit 1
fi

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

env_git_ref=${DOCKLANDS_RELEASE_REF:-}
git_ref=""
git_url=${DOCKLANDS_RELEASE_GIT_URL:-https://github.com/jason301c/docklands.git}
remote=${DOCKLANDS_RELEASE_REMOTE:-origin}
dry_run=${DOCKLANDS_RELEASE_SMOKE_DRY_RUN:-}
skip_fetch=${DOCKLANDS_RELEASE_SMOKE_SKIP_FETCH:-}
allow_dirty=${DOCKLANDS_RELEASE_SMOKE_ALLOW_DIRTY:-}
wait_for_completion=${DOCKLANDS_RELEASE_SMOKE_WAIT:-}
poll_seconds=${DOCKLANDS_RELEASE_SMOKE_POLL_SECONDS:-15}
timeout_seconds=${DOCKLANDS_RELEASE_SMOKE_TIMEOUT_SECONDS:-7200}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--wait)
			wait_for_completion=1
			shift
			;;
		--poll-seconds)
			if [ -z "${2:-}" ]; then
				echo "--poll-seconds requires a positive integer" >&2
				exit 1
			fi
			poll_seconds=$2
			shift 2
			;;
		--timeout-seconds)
			if [ -z "${2:-}" ]; then
				echo "--timeout-seconds requires a positive integer" >&2
				exit 1
			fi
			timeout_seconds=$2
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
			if [ -n "$git_ref" ]; then
				echo "Only one git ref may be supplied." >&2
				exit 1
			fi
			git_ref=$1
			shift
			;;
	esac
done

git_ref=${git_ref:-${env_git_ref:-$(git rev-parse --abbrev-ref HEAD)}}

case "$poll_seconds" in
	"" | *[!0-9]* | 0)
		echo "Poll seconds must be a positive integer." >&2
		exit 1
		;;
esac

case "$timeout_seconds" in
	"" | *[!0-9]* | 0)
		echo "Timeout seconds must be a positive integer." >&2
		exit 1
		;;
esac

if [ -z "$git_ref" ] || [ "$git_ref" = "HEAD" ]; then
	echo "Pass an explicit branch or tag ref; refusing to dispatch a detached HEAD." >&2
	exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
	echo "GitHub CLI (gh) is required to dispatch release smoke workflows." >&2
	exit 1
fi

if [ -z "$allow_dirty" ] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
	echo "Tracked files are dirty. Commit or discard tracked changes before dispatching release smoke workflows." >&2
	exit 1
fi

if ! git rev-parse --verify "$git_ref^{commit}" >/dev/null 2>&1; then
	echo "Ref '$git_ref' does not resolve to a local commit." >&2
	exit 1
fi
target_sha=$(git rev-parse "$git_ref^{commit}")

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

workflow_run_ids() {
	local workflow=$1
	gh run list \
		--repo "$github_repo" \
		--workflow "$workflow" \
		--limit 100 \
		--json databaseId \
		--jq '.[].databaseId'
}

is_known_run_id() {
	local run_id=$1
	local known_ids=$2
	local known_id

	while IFS= read -r known_id; do
		if [ "$known_id" = "$run_id" ]; then
			return 0
		fi
	done <<< "$known_ids"

	return 1
}

find_new_workflow_run() {
	local workflow=$1
	local known_ids=$2
	local deadline=$((SECONDS + timeout_seconds))
	local runs run_id event head_sha status conclusion url

	echo "Waiting for a new $workflow workflow_dispatch run for $target_sha..." >&2
	while true; do
		runs=$(gh run list \
			--repo "$github_repo" \
			--workflow "$workflow" \
			--limit 30 \
			--json databaseId,event,headSha,status,conclusion,url \
			--jq '.[] | [.databaseId, .event, .headSha, .status, (.conclusion // ""), .url] | @tsv')

		while IFS=$'\t' read -r run_id event head_sha status conclusion url; do
			if [ -z "$run_id" ] || [ "$event" != "workflow_dispatch" ] || [ "$head_sha" != "$target_sha" ]; then
				continue
			fi
			if is_known_run_id "$run_id" "$known_ids"; then
				continue
			fi

			echo "Found $workflow run $run_id ($status): $url" >&2
			printf '%s\n' "$run_id"
			return 0
		done <<< "$runs"

		if [ "$SECONDS" -ge "$deadline" ]; then
			echo "Timed out waiting for a new $workflow run for $target_sha." >&2
			return 1
		fi

		sleep "$poll_seconds"
	done
}

wait_for_workflow_run() {
	local workflow=$1
	local run_id=$2
	local deadline=$((SECONDS + timeout_seconds))
	local run status conclusion url

	echo "Waiting for $workflow run $run_id to complete..."
	while true; do
		run=$(gh run view "$run_id" \
			--repo "$github_repo" \
			--json status,conclusion,url \
			--jq '[.status, (.conclusion // ""), .url] | @tsv')
		IFS=$'\t' read -r status conclusion url <<< "$run"

		echo "  $workflow run $run_id: $status${conclusion:+/$conclusion}"
		if [ "$status" = "completed" ]; then
			if [ "$conclusion" = "success" ]; then
				echo "$workflow run $run_id passed: $url"
				return 0
			fi

			echo "$workflow run $run_id finished with conclusion '$conclusion': $url" >&2
			return 1
		fi

		if [ "$SECONDS" -ge "$deadline" ]; then
			echo "Timed out waiting for $workflow run $run_id: $url" >&2
			return 1
		fi

		sleep "$poll_seconds"
	done
}

release_smoke_known_ids=""
host_smoke_known_ids=""
if [ -n "$wait_for_completion" ] && [ -z "$dry_run" ]; then
	echo "Recording existing workflow runs before dispatch..."
	release_smoke_known_ids=$(workflow_run_ids release-smoke.yml)
	host_smoke_known_ids=$(workflow_run_ids host-operator-smoke.yml)
fi

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
elif [ -n "$wait_for_completion" ]; then
	release_smoke_run_id=$(find_new_workflow_run release-smoke.yml "$release_smoke_known_ids")
	host_smoke_run_id=$(find_new_workflow_run host-operator-smoke.yml "$host_smoke_known_ids")

	wait_for_workflow_run release-smoke.yml "$release_smoke_run_id"
	wait_for_workflow_run host-operator-smoke.yml "$host_smoke_run_id"

	echo "Both release smoke workflows completed successfully."
else
	echo "Dispatched both release smoke workflows."
	echo "Use 'bun run release:smoke:dispatch --wait $git_ref' on a clean tree when you want the command to verify both runs."
fi
