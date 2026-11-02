# UI_DEMOS

## 演示

同一份数据可以由声明换一套渲染；字段列表则直接从活树读取，「追加一行」会真实写回 md。两个 demo 都住在本页的 mods 里，不是独立 wt。

### swap

- 标题: 同一份数据 · 两套渲染
- 数据: 42
- 说明: 切的是 `.mds/ui.md` 的 `## match` 一行（SWAP_A ↔ SWAP_B），声明热重载，无需刷新

### field

- 表: 用户表
- 主键: id · bigint
- 索引: idx_email（唯一）
- 索引: idx_created_at
- 说明: 同名 tag 多行 ⇒ 收成数组；「追加一行」会真实写进本节 md
- 索引: 123
