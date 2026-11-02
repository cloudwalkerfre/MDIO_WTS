# app

- name: monaco
- version: 0.1.0
- author: cloudwalkerfre
- repo: https://github.com/cloudwalkerfre/MDIO_WTS
- tag: devview
- desc:
    > # Monaco
    > 文件树 + Monaco + CRDT 的独立 wt app；devview 左槽同款。
    > 打开：`?wt=<uid>`

## 说明

- 这个 wt 自己声明 appview：`## app - appview: MONACO_APP`（devview 左槽按该身份默认解析）
- app 件在 `/app/app.md`，导出 `Store` + 默认组件
- 验证目标：`?wt=<uid>` 进入 appview，中心 appview 渲染本 app
