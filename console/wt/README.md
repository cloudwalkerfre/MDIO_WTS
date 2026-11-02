# app

- name: console
- version: 0.1.0
- author: cloudwalkerfre
- repo: https://github.com/cloudwalkerfre/MDIO_WTS
- tag: devview
- desc:
    > # 控制台
    > exec 命令执行框 + 结果；devview footer 同款。
    > 打开：`?wt=<uid>`

## 说明

- appview：`## app - appview: CONSOLE_APP`（devview footer 槽按该身份解析）
- app 件：`/app/app.md`，导出 `Store` + 默认组件
- 两种呈现：独立 appview = 全高；footer 模式（`props.footer === true`）= 默认只露输入行，有结果后经 `props.onRequestHeight` 请求高度（壳负责拖拽）
- 每 wt 的 session：该 wt 的 `/var/console.md`（单行 JSON：cmd / out(≤4000 字符) / ok / ms）；挂载恢复、每次执行后回写；文件不存在先 `mk -f`
- 执行：`env.exec`（页面 tools；管线日志里是 `EXEC→/EXEC←`）；session 读写：`env.client.exec`（不写日志）
- 键盘：Enter 执行 · ↑/↓ 历史 · Esc 清输入 · Ctrl/Cmd+L 清屏（同时清 session）
- 验证：`?wt=<uid>` 进 appview，中心渲染 console；首次输入任意 mdio exec 命令回车
