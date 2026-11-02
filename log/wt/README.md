# app

- name: log
- version: 0.1.0
- author: cloudwalkerfre
- repo: https://github.com/cloudwalkerfre/MDIO_WTS
- tag: devview
- desc:
    > # 日志面板
    > MDIO 管线日志的独立 app；devview 右栏 log 同款。
    > 打开：`?wt=<uid>`

## 说明

- 自己声明 appview：`## app - appview: LOG_APP`（devview 右槽按该身份默认解析）
- app 件在 `/app/app.md`，导出 `Store` + 默认组件
- 数据源：`ui_core/logBus`（服务层；2026-10-30 已从 ui_devview 迁入）
- 验证目标：`?wt=<uid>` 进 appview，中心 appview 渲染日志面板