# 实现

```jsx@mina
import { createElement as h } from "react";
import { matchOf } from 'ui_core/uiMd';
const text = (n, read) => { try { return String((read && read.contentValueOf ? read.contentValueOf(n) : (n && n.ct)) || ""); } catch (e) { return ""; } };
function walk(n, read, M) {
  if (!n || typeof n !== "object") return null;
  const hit = M ? M(n) : null;
  if (hit === "_HIDDEN") return null;
  if (hit === "RED") return h("b", { "data-mina": "red" }, text(n, read));
  const kids = n.ct && typeof n.ct !== "string" ? (Array.isArray(n.ct) ? n.ct : [n.ct]) : [];
  return h("div", { "data-mina": "def", "data-hit": String(hit || "null"), "data-nt": String(n.nt || ""), "data-lv": String(n.lv ?? "") }, text(n, read), kids.map((k) => walk(k, read, M)));
}
export default function Mina({ node, ui , read }) {
  const modMatch = (name) => { const t = ui ? ui.modMatchOf(name) : null; return t ? (n) => matchOf(n, t) : null; };
  const M = modMatch ? modMatch("MINA") : null; return h("div", { "data-mina": "app" }, walk(node, read, M));
}
```

```jsx@red
import { createElement as h } from "react";
export default function Red({ node }) {
  return h("b", { "data-mina": "red-mod" }, String((node && node.t) || ""));
}
```