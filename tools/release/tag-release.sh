#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: tools/release/tag-release.sh [options] [git-ref]

Creates the annotated Docklands release tag for the selected pushed ref. The tag
name is always derived from apps/docklands/package.json.

Options:
  --allow-dirty Permit tracked local changes. Use only for development dry-runs.
  --dry-run     Print the git commands without creating or pushing the tag.
  --push        Push the created tag to the selected remote.
  --skip-fetch  Skip the remote branch freshness check.
  -h, --help    Show this help text.

Environment:
  DOCKLANDS_RELEASE_REF              Ref to tag. Default: current branch.
  DOCKLANDS_RELEASE_REMOTE           Remote used for branch/tag checks.
                                      Default: origin
  DOCKLANDS_RELEASE_TAG_ALLOW_DIRTY  Same as --allow-dirty.
  DOCKLANDS_RELEASE_TAG_DRY_RUN      Same as --dry-run.
  DOCKLANDS_RELEASE_TAG_MESSAGE      Annotated tag message.
                                      Default: Docklands <version>
  DOCKLANDS_RELEASE_TAG_PUSH         Same as --push.
  DOCKLANDS_RELEASE_TAG_SKIP_FETCH   Same as --skip-fetch.
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
remote=${DOCKLANDS_RELEASE_REMOTE:-origin}
allow_dirty=${DOCKLANDS_RELEASE_TAG_ALLOW_DIRTY:-}
dry_run=${DOCKLANDS_RELEASE_TAG_DRY_RUN:-}
push_tag=${DOCKLANDS_RELEASE_TAG_PUSH:-}
skip_fetch=${DOCKLANDS_RELEASE_TAG_SKIP_FETCH:-}
tag_message=${DOCKLANDS_RELEASE_TAG_MESSAGE:-}

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
		--push)
			push_tag=1
			shift
			;;
		--skip-fetch)
			skip_fetch=1
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

if [ -z "$git_ref" ] || [ "$git_ref" = "HEAD" ]; then
	echo "Pass an explicit branch or tag ref; refusing to tag a detached HEAD." >&2
	exit 1
fi

if [ -z "$allow_dirty" ] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
	echo "Tracked files are dirty. Commit or discard tracked changes before tagging a release." >&2
	echo "Use --allow-dirty only for development dry-runs that are not release evidence." >&2
	exit 1
fi

if ! git rev-parse --verify "$git_ref^{commit}" >/dev/null 2>&1; then
	echo "Ref '$git_ref' does not resolve to a local commit." >&2
	exit 1
fi
target_sha=$(git rev-parse "$git_ref^{commit}")

run_cmd() {
	printf '+'
	printf ' %q' "$@"
	printf '\n'
	if [ -z "$dry_run" ]; then
		"$@"
	fi
}

version=$(node -p "require('./apps/docklands/package.json').version")
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Release tag version must be plain semver, e.g. 0.1.0. Got: $version" >&2
	exit 1
fi
tag_name=$version
tag_message=${tag_message:-Docklands $version}

printf '+ node tools/release/check-metadata.mjs\n'
node tools/release/check-metadata.mjs

if git show-ref --verify --quiet "refs/tags/$tag_name"; then
	existing_sha=$(git rev-list -n 1 "$tag_name")
	echo "Release tag '$tag_name' already exists at $existing_sha. Refusing to retag." >&2
	exit 1
fi

if git show-ref --verify --quiet "refs/heads/$git_ref" && [ -z "$skip_fetch" ]; then
	echo "Verifying local branch '$git_ref' is pushed to '$remote'..."
	git fetch --quiet "$remote" "$git_ref"
	local_sha=$(git rev-parse "$git_ref")
	remote_sha=$(git rev-parse FETCH_HEAD)
	if [ "$local_sha" != "$remote_sha" ]; then
		echo "Local '$git_ref' is not the same commit as '$remote/$git_ref'." >&2
		echo "Push the branch before tagging the release." >&2
		echo "local:  $local_sha" >&2
		echo "remote: $remote_sha" >&2
		exit 1
	fi
fi

echo "Tagging Docklands release"
echo "  ref:     $git_ref"
echo "  commit:  $target_sha"
echo "  tag:     $tag_name"
echo "  remote:  $remote"

run_cmd git tag -a "$tag_name" "$target_sha" -m "$tag_message"

if [ -n "$push_tag" ]; then
	run_cmd git push "$remote" "refs/tags/$tag_name"
elif [ -n "$dry_run" ]; then
	echo "Dry run complete; no tag was created or pushed."
else
	echo "Created local tag '$tag_name'. Push it with: git push $remote refs/tags/$tag_name"
fi
