# 第三方示例 app

- 说明: 这就是「写一个 wt app」的全部 —— 一块 `jsx@app` + 声明里一行。
- 契约（2026-10-08 起）: `{ ui, exec, appRouter, wt, read, renderNode }`；**没有 `content`/`doc`/`go`**。

## app

```jsx@app
// ⚠️ 不 import React、不写 observer、不知道影子根/URL 组合 —— 框架全包（入口件已是 observer）。
export default function DemoApp({ ui, appRouter, wt, renderNode }) {
  const cur = String((ui && ui.mdPath) || '');
  const open = (p) => { wt.observe(p); appRouter.push('/doc/' + encodeURIComponent(p)); };   // 提需求 + 只写页内段（壳段归壳）
  return (
    <div data-demo="app" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, opacity: .6, letterSpacing: '.06em' }}>第三方示例 app</div>
      <div data-demo="doc" style={{ margin: '6px 0' }}>当前篇：{cur}</div>
      <button data-demo="go" onClick={() => open('/scripts/剧本M0备份.md')}>换到 M0 稿</button>
      <div style={{ marginTop: 12 }}>{renderNode()}</div>
    </div>
  );
}
```