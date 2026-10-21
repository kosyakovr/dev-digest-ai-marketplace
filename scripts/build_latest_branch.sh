#!/usr/bin/env bash
# build_latest_branch.sh — build the next commit of branch `latest` from a main commit
# (docs/specs/release-channels.md, R4, R5).
#
#   bash scripts/build_latest_branch.sh [<main-commit>]    # default: HEAD
#
# The commit's tree is <main-commit>'s tree with .claude-plugin/marketplace.json
# replaced by the generated latest catalog. Its parents are the current `latest`
# (origin/latest or latest, when one exists, so the branch only moves forward)
# and <main-commit>. When the tree equals the current `latest`, no commit is made.
#
# The result is checked in a temporary worktree with check_marketplace.py and
# `claude plugin validate --strict` before anything is printed. Stdout is the
# commit to publish and nothing else; on a failed check the script exits 1 and
# prints no commit, so CI leaves `latest` where it was. It never pushes; CI runs
# `git push origin <commit>:refs/heads/latest`.

set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
main=$(git -C "$root" rev-parse --verify "${1:-HEAD}^{commit}")
tmp=$(mktemp -d "${TMPDIR:-/tmp}/latest-branch.XXXXXX")
cleanup() {
  git -C "$root" worktree remove --force "$tmp/main" 2>/dev/null || true
  git -C "$root" worktree remove --force "$tmp/latest" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

# Generate from the main commit's own tree and scripts, not from whatever is checked out.
git -C "$root" worktree add --detach --quiet "$tmp/main" "$main"
python3 "$tmp/main/scripts/generate_latest_catalog.py" > "$tmp/marketplace.json"

blob=$(git -C "$root" hash-object -w "$tmp/marketplace.json")
GIT_INDEX_FILE="$tmp/index" git -C "$root" read-tree "$main"
GIT_INDEX_FILE="$tmp/index" git -C "$root" update-index --add --cacheinfo "100644,$blob,.claude-plugin/marketplace.json"
tree=$(GIT_INDEX_FILE="$tmp/index" git -C "$root" write-tree)

previous=""
for ref in origin/latest latest; do
  previous=$(git -C "$root" rev-parse --verify --quiet "$ref^{commit}") && break
done
if [ -n "$previous" ] && [ "$(git -C "$root" rev-parse "$previous^{tree}")" = "$tree" ]; then
  echo "latest is already up to date at ${previous:0:12}" >&2
  echo "$previous"
  exit 0
fi
parents=(-p "$main")
[ -z "$previous" ] || parents=(-p "$previous" -p "$main")
commit=$(git -C "$root" commit-tree "$tree" "${parents[@]}" -m "latest: catalog generated from main ${main:0:12}")

git -C "$root" worktree add --detach --quiet "$tmp/latest" "$commit"
python3 "$tmp/latest/scripts/check_marketplace.py" >&2
claude plugin validate "$tmp/latest" --strict >&2
echo "built ${commit:0:12} from main ${main:0:12}" >&2
echo "$commit"
