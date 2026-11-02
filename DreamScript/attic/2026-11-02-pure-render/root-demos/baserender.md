# BASIC_RENDER —— 标准 Markdown 渲染（**作为一个 app**）

- 说明: 它不特殊 —— 一个普通 app 文档：一块 `jsx@app` + 声明里一行。文档体由框架交付的 `renderNode()` 给出，它自己只决定“摆在哪、加不加壳”。
- 与 SCRIPT_APP 同层级：两者都是 app，没有谁更特殊（业主口径 2026-10-08）。

## app

```jsx@app
// 契约 { app }：工具从 env 取（getEnv(app).renderNode）；框架全包（入口件已是 observer）。
import { getEnv } from "mobx-state-tree";
export default function BasicRender({ app }) {
  const env = app ? (getEnv(app) || {}) : {};
  return (
    <div data-app="basic-render" className="basic-render">
      {typeof env.renderNode === "function" ? env.renderNode() : null}
    </div>
  );
}
```