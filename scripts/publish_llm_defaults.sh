#!/usr/bin/env bash
# 发布 MDIO_WTS 时，把默认 wt 系统文件以“骨架”提交（保留结构，去掉 secret 与历史）：
#   genesis/wt/.mds/llm.md          —— AGENTS 定义；his 用占位，不含 wt_uid / 会话路径
#   genesis/wt/.mds/llm_config.md   —— PROVIDERS / LLM_CONFIG 结构；密钥只写 env:NAME
# 本脚本只改 git 索引里的 blob，工作区的真实配置保持不变。
#
# 用法: scripts/publish_llm_defaults.sh ["commit message"] [--push]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

MSG="chore(genesis): refresh default LLM files as skeletons"
PUSH=0
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=1 ;;
    -*) ;;
    *) MSG="$arg" ;;
  esac
done

TMP="$(mktemp -d "${TMPDIR:-/tmp}/mdio-wts.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/llm.md" <<'MD'
# AGENTS

## dev
- m: DEEPSEEK_V4F
- sysp: 你是 mdio 开发助手。先读 /DEMO/guide_app.md，按它的规则在 mdio 里写 app。写之前先读现状，写完读回验证。
- tool: True
- his: HIS
- retry: 1
- provider: deepseek
- backend: anyllm
MD

cat > "$TMP/llm_config.md" <<'MD'
# PROVIDERS

## deepseek
- base_url: https://api.deepseek.com
- api_key: env:DEEPSEEK_API_KEY
- timeout: 180

# LLM_CONFIG

## DEFAULT
- provider: deepseek
- model: deepseek-flash
- reasoning_effort: max
- extra_body: {"thinking": {"type": "enabled"}}

## DEEPSEEK_V4F
- provider: deepseek
- model: deepseek-flash
- reasoning_effort: auto
MD

stage_skeleton() {
  path="$1"
  src="$2"
  blob="$(git hash-object -w -- "$src")"
  git update-index --add --cacheinfo "100644,$blob,$path"
}

stage_skeleton genesis/wt/.mds/llm.md "$TMP/llm.md"
stage_skeleton genesis/wt/.mds/llm_config.md "$TMP/llm_config.md"

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
