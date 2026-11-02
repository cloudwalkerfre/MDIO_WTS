# About MDIO

MDIO is a Markdown environment. It aims to build a better mother-tongue environment for LLMs.

## Project

GitHub: [cloudwalkerfre/MDIO](https://github.com/cloudwalkerfre/MDIO)

## Quick start

```bash
# 1. Install
uv tool install mdio-py

# 2. Load UI apps
mdio load https://github.com/cloudwalkerfre/MDIO_WTS

# 3. Start the web UI
mdio web
```

Start only the gateway:

```bash
mdio serve
```

Check status:

```bash
mdio status
```

## Platform support

macOS · Linux · Windows WSL2

## Loading worktrees

The MDIO VFS is built on OpenDAL, supporting multiple worktrees, local directories, remote GitHub repositories, and iroh share/mount:

```bash
# Local worktree
mdio load /path/to/project

# GitHub repository: downloaded to $MDIO_HOME/<repo> by default
mdio load https://github.com/owner/repo

# Branch / tag / commit
mdio load https://github.com/owner/repo --ref main

# List worktrees
mdio load https://github.com/owner/repo --list

# Load a selected worktree
mdio load https://github.com/owner/repo --wt chat

# Parse only; do not download or register
mdio load https://github.com/owner/repo --dry-run
```

## Remote mounting

```bash
mdio mount --ticket iroh://xxx --wt <wt_uid>
mdio share --wt <wt_uid>
mdio unmount --path /share/remote
```

## MCP

`mdio mcp` forwards stdio to the gateway automatically. If the client supports Streamable HTTP, you can also connect directly:

```text
http://127.0.0.1:8011/mcp
```

## Configuration

Config file: `$MDIO_HOME/.env`. Key variables: `MDIO_GATEWAY_HOST`, `MDIO_GATEWAY_PORT`, `MDIO_WORKSPACE_ROOT`, `MDIO_PERSIST`. Persistence is off by default; set `MDIO_PERSIST=1` to enable WAL and checkpointing.

---

## License

MIT.
