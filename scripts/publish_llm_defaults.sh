#!/usr/bin/env bash
# 发布 MDIO_WTS 时，把默认 wt 系统文件以“空模板”提交：
#   genesis/wt/.mds/llm.md
#   genesis/wt/.mds/llm_config.md
# 这两个文件是本机运行态（agent 的 HIS、provider 密钥等），不应把真实内容带进仓库。
# 本脚本只改 git 索引里的 blob，工作区的真实配置保持不变。
#
# 用法: scripts/publish_llm_defaults.sh ["commit message"] [--push]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

MSG="${1:-chore(genesis): refresh default LLM files as empty templates}"
PUSH=0
for arg in "$@"; do
  [ "$arg" = "--push" ] && PUSH=1
done
if [ "$MSG" = "--push" ]; then
  MSG="chore(genesis): refresh default LLM files as empty templates"
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/mdio-wts.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

printf '# AGENTS\n' > "$TMP/llm.md"
printf '# PROVIDERS\n\n# LLM_CONFIG\n' > "$TMP/llm_config.md"

stage_empty() {
  path="$1"
  src="$2"
  blob="$(git hash-object -w -- "$src")"
  git update-index --add --cacheinfo "100644,$blob,$path"
}

stage_empty genesis/wt/.mds/llm.md "$TMP/llm.md"
stage_empty genesis/wt/.mds/llm_config.md "$TMP/llm_config.md"

git add -- .gitignore scripts/publish_llm_defaults.sh 2>/dev/null || true
git commit -m "$MSG"

if [ "$PUSH" = 1 ]; then
  git push origin HEAD
fi

echo "--- 本次提交里这两个文件的仓库版本 ---"
git show "HEAD:genesis/wt/.mds/llm.md"
echo
git show "HEAD:genesis/wt/.mds/llm_config.md"
echo "--- 工作区仍保留真实配置，git status ---"
git status --short
