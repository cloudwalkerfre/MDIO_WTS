# MDIO WTS

MDIO 的示例工作树仓库：`genesis` 是根树（本目录），另有 5 个 app 工作树——
`log`（日志面板）· `chat`（对话）· `monaco`（文件树 + 编辑器）· `DreamScript`（剧本，纯渲染）· `console`（exec 控制台）。

## 打开

- genesis 首页（app 库）：`?wt=genesis`
- 某个 app：`?wt=<uid>`（uid 见 `/.mds/worktrees.md`，或首页卡片点进去）
- 工作树注册与安装清单：仓库根 `install.md`

## 目录

| 路径 | 放什么 |
|---|---|
| `wt/ui_app/` | genesis 首页、教学页与各演示件的源码 |
| `wt/.mds/ui.md` | genesis 的 mods / match / appview 声明 |
| `ui/` | genesis 的 UI 资产（Courier Prime 字体 + OFL 许可） |

各 app 的具体说明见它们自己 wt 根下的 `README.md`。
