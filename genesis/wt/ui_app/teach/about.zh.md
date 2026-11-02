# 关于MDIO

MDIO 是一个 Markdown 环境。它想为 LLM 构建一个更好的母语环境。

## 项目地址

GitHub: [cloudwalkerfre/MDIO](https://github.com/cloudwalkerfre/MDIO)

## 快速开始

```bash
# 1. 安装
uv tool install mdio-py

# 2. 加载 UI 应用
mdio load https://github.com/cloudwalkerfre/MDIO_WTS

# 3. 启动 Web
mdio web
```

只启动网关：

```bash
mdio serve
```

查看状态：

```bash
mdio status
```

## 平台支持

macOS · Linux · Windows WSL2

## 加载工作树

MDIO 的 VFS 构建在 OpenDAL 之上，支持多工作树、本地目录 / 远程 GitHub 仓库，以及 iroh 共享与挂载：

```bash
# 本地工作树
mdio load /path/to/project

# GitHub 仓库：默认下载到 $MDIO_HOME/<repo>
mdio load https://github.com/owner/repo

# 指定分支 / tag / commit
mdio load https://github.com/owner/repo --ref main

# 列出工作树
mdio load https://github.com/owner/repo --list

# 加载指定工作树
mdio load https://github.com/owner/repo --wt chat

# 只解析，不下载也不注册
mdio load https://github.com/owner/repo --dry-run
```

## 远程挂载

```bash
mdio mount --ticket iroh://xxx --wt <wt_uid>
mdio share --wt <wt_uid>
mdio unmount --path /share/remote
```

## MCP

`mdio mcp` 会把 stdio 自动转发到网关；客户端支持 Streamable HTTP 时也可以直接连接：

```text
http://127.0.0.1:8011/mcp
```

## 配置

配置文件是 `$MDIO_HOME/.env`。关键环境变量：`MDIO_GATEWAY_HOST`、`MDIO_GATEWAY_PORT`、`MDIO_WORKSPACE_ROOT`、`MDIO_PERSIST`。默认不持久化；设置 `MDIO_PERSIST=1` 启用 WAL 与 checkpoint。

---

## 许可证

MIT。
