# Third-party notices — MDIO_WTS

本仓库包含第三方**字体**与运行时**远程模块**。字体按 SIL OFL 1.1 分发：本文件与
`genesis/ui/OFL.txt` 必须随仓库/分发一起保留（OFL 条件 2）。

> 仓库自身内容（genesis / log / chat / monaco / DreamScript / console 的文档与代码）
> 尚未声明 LICENSE，待业主决定；本文件只覆盖第三方部分。

## 1. 自带字体：Courier Prime

字体文件（两处副本内容逐字节相同，sha256 相同）：

- `genesis/ui/CourierPrime-{Regular,Bold,Italic,BoldItalic}.ttf`
- `DreamScript/ui/CourierPrime-{Regular,Bold,Italic,BoldItalic}.ttf`

| 样式 | 字体内部版本 | SHA-256 | 版权声明 |
|---|---|---|---|
| Regular | 1.203 | `6cc9525b1334047445cba53f323e810331acfdf59f18f4008397d13137737b91` | Copyright (c) 2013 Quote-Unquote Apps；Reserved Font Name "Courier Prime" |
| Bold | 1.202 | `aa5a0a31d25dac006fe2d71fc6ff0feff250bc6de3b3c81b7e9d3a58e1329b52` | 同上 |
| Italic | 3.018 | `f1b9a5829789f7e56432a9f3bc7665ef4531dbba1c112639e48bef39621a006b` | Copyright 2015 The Courier Prime Project Authors |
| BoldItalic | 3.018 | `3355273f3ea6d6362658f9564f4e83d59e156cf1a182e3c1592b5c5943627dcc` | 同上 |

- **许可**：SIL Open Font License 1.1，全文见 `genesis/ui/OFL.txt`（`DreamScript/ui/OFL.txt` 为同文副本）。
- **上游**：
  - Google Fonts：<https://github.com/google/fonts/tree/main/ofl/courierprime>
  - 项目主页：<https://github.com/quoteunquoteapps/CourierPrime>
- **核验（2026-11-02）**：
  - Italic / BoldItalic 与 Google Fonts 当前发布**逐字节一致**；
  - Regular / Bold 是更早的官方版本（v1.20x），与主仓 `mdio_ui/demo/ui/` 中已被
    `THIRD_PARTY_NOTICES.md` 记录的副本**逐字节一致**（同源）；
  - 四个文件 sfnt 表目录为标准表集、无附加尾随数据（最大表尾 = 文件尾），
    内嵌 `name` 表含官方 copyright/license 字段。
- **合规边界**：当前以**未修改、未改名**的字体文件随 WTS 分发，符合 OFL 条件 2/3/5。
  旧版（v1.20x）声明了 Reserved Font Name "Courier Prime"：若将来做子集化、格式转换
  （ttf→woff2）等修改，必须**改名**后再分发；v3.018 的上游 OFL 头未声明 RFN，但仍须
  整包保留本许可。
- **已知不一致**：四款样式横跨两个上游版本（1.20x 与 3.018），字形/度量可能有差异。
  刷新到同一上游版本时需同步更新本表哈希。

## 2. 运行时远程模块（不在仓库内，但打开 WTS 页面时会加载）

| 位置 | 模块 | 风险评估 |
|---|---|---|
| `chat/wt/.mds/ui.md` | `https://esm.sh/@xyflow/react@12.8.2?...` | 版本已钉；仍属第三方远程代码 |
| `genesis/wt/.mds/ui.md` | `https://esm.sh/antd@6?...`、`https://esm.sh/@ant-design/icons@6?...` | **只钉大版本** ⇒ esm.sh 解析到最新 6.x，无锁定、无 SRI，存在漂移/供应链风险 |
| `genesis/wt/.mds/ui.md` | `http://127.0.0.1:8033/vdist2/antd-x3.js` | 本机开发服务器：分发必 404；且从 loopback 加载可执行 JS |
| `genesis/wt/ui_app/teach/antd_impl_collage.md` | `https://esm.sh/dayjs@1.11.13` | 版本已钉 |

分发版建议：`antd` / `@ant-design/icons` 钉到精确版本或自托管；移除 `ANT_X` 的
localhost 依赖；远程模块如保留，考虑 SRI 或随包自托管。

## 3. 资产面安全（网关 `/ui-assets`）

- 只服务 wt `ui/` 作用域内的白名单扩展名（`.ttf/.otf/.woff/.woff2/.js/.css/.json/.map/.svg/.txt/.wasm`），单文件上限 4 MiB；
- 拒绝点段、`..`、越界软链（实测 403）；未知 wt 404；非白名单扩展 415；
- 响应头带 `Cross-Origin-Resource-Policy: cross-origin`、`Cache-Control: no-cache`、ETag（sha256 前缀）；
- 网关当前只绑 `127.0.0.1`，且该资产路由**无认证中间件**（本机开发假设）。
  若用 `--host 0.0.0.0` 或 iroh/share 对外暴露，请先加访问控制。
