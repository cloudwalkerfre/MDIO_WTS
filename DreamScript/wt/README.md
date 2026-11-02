# app

- name: DreamScript
- version: 0.1.0
- author: cloudwalkerfre
- repo: https://github.com/cloudwalkerfre/MDIO_WTS
- tag: app
- desc:
    > # DreamScript
    > 把 md 里的剧本渲染成 Letter 纸面：纯渲染、只读，不做编辑/写回。
    > 打开：`?wt=<uid>`

## 说明

DreamScript 现在只做「看」：`/scripts/` 下的剧本 → 剧本集画廊 → 阅读页（Courier Prime 纸面排版）。
编辑、写回、导入导出等旧能力已移除；旧一代实现与重复稿归档在 `attic/`。

## 目录约定

| 位置 | 放什么 | 说明 |
|---|---|---|
| `scripts/` | 剧本作品（当前只保留一份：`剧本.md`） | 画廊按顶层 md 列出 |
| `render/` | 渲染实现：`jsx@script` 排版件 + `print@css` 版式 CSS | 零构建，住代码块 |
| `appscript.md` | 剧本集 app（画廊 + 阅读页，hash 路由） | appview = SCRIPT_APP |
| `attic/` | 旧一代实现、demo、研究文档与导出产物（PAPER 编辑器、M0 备份、剧本2.md、docs、observe、minasrc/routerapp、导出/ 等） | 不在 wt 文档根下，不影响运行 |
| `README.md` | 本树简介与打开方式 | 普通 md |

## 打开

- 开发面：`?wt=<uid>` → 画廊；点卡片进阅读页
- 深链：`?wt=<uid>&app=/scripts/剧本.md`

## 渲染策略

见 `/.mds/ui.md`：只声明 `std` + `SCRIPT`（排版件）+ `SCREEN`（版式 CSS）+ `SCRIPT_APP`（画廊/阅读 app）；
`match` 只有一条 `SCRIPT: /scripts/::..*[h1]`。纯渲染，无编辑交互。
