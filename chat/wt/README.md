# app

- name: chat
- version: 0.1.0
- author: cloudwalkerfre
- repo: https://github.com/cloudwalkerfre/MDIO_WTS
- tag: app
- desc:
    > # 对话
    > mdio 里的 chat app（产品面 = 全屏对话）。
    > 打开：`?wt=<uid>`

## 说明

- 会话层在 genesis 的 `@LLM dev`（管理面恒 genesis，his 落 `/.mds/llm.md::AGENTS.dev.HIS`）；本树只带 app 实现，不带上历史会话。
- 实现文档在 `/app/`：core / session / his / settings / app / composer；`app/app.md` 同时放 `jsx@app` 与 `css@app`（宿主 appDocOf 约束）；APP 用 `@app/COMPOSER` 引用局部分件。
- 样式按 Dimension 参考：dusk canvas + frosted glass + pill + hairline + violet wash。
