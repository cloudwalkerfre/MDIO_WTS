# SWAP_B

## 实现

```jsx@node
import { useMemo, useState } from "react";

const PICK = [["Wildcard"], ["TYPECHECK", "bullet"]];
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function rowsOf(read, node) {
  const r = read.apply([node], PICK);
  return (r && !r.gate ? r.hits : []).map((b) => ({
    k: String(read.textOf(b) || ""),
    v: String(read.contentValueOf(b) ?? ""),
  })).filter((r) => r.k.indexOf("jsx@") !== 0);
}
async function swapTo(exec, doc, sec, targetLine) {
  const cur = String(await exec("$ /.mds/ui.md"));
  if (cur.indexOf("mdio_error") >= 0) throw new Error("read .mds/ui.md failed");
  const re = new RegExp("- UI_SWAP_[AB]: " + esc(doc) + "::" + esc(sec));
  const next = cur.replace(re, targetLine);
  if (next === cur) throw new Error("no replaceable match line in declaration");
  await exec('"""' + next + '""" | /> /.mds/ui.md:: -pj r');
}

export default function SwapB({ node, snap, read, exec }) {
  const en = typeof window !== "undefined" && window.__teachLang === "en";
  const doc = "/ui_app/teach/ui_demos" + (en ? ".en" : "") + ".md";
  const sec = "UI_DEMOS." + (en ? "Demos" : "演示") + ".swap";
  const TARGET = "- UI_SWAP_A: " + doc + "::" + sec;
  const L = en
    ? { pill: "Version B · big number + card · match: SWAP_B", title: "One section · two renderings",
        busy: "switching… (reloading declaration)", go: "Switch back to A (edit ## match)",
        editing: "editing declaration…", done: "declaration changed → hot-reloaded back to A", fail: "failed: ",
        foot: "declaration subscription attached · rows in this section: ", last: " · last switch " }
    : { pill: "B 版 · 大数字 + 卡片 · match: SWAP_B", title: "同一节 · 两套渲染",
        busy: "切换中…（声明重载）", go: "切回 A 版（改 ## match 声明）",
        editing: "正在改声明 …", done: "已改声明 → 热重载回 A 版", fail: "失败：",
        foot: "声明订阅已挂 · 本节数据 ", last: " · 上次切换 " };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // 上一轮切换的耗时（跨重挂：声明重载会换掉整个组件，用 globalThis 传递）
  const [lastMs] = useState(() => {
    const at = globalThis.__uiSwapAt;
    return at ? Math.round(performance.now() - at) : 0;
  });
  const rows = useMemo(() => rowsOf(read, node), [snap]);
  const num = (rows.find((r) => r.k === "数据" || r.k === "Data") || {}).v || "";
  const rest = rows.filter((r) => r.k !== "数据" && r.k !== "Data");
  const go = async () => {
    globalThis.__uiSwapAt = performance.now();
    setBusy(true); setMsg(L.editing);
    try { await swapTo(exec, doc, sec, TARGET); setMsg(L.done); }
    catch (e) { setMsg(L.fail + String((e && e.message) || e).slice(0, 80)); }
    setBusy(false);
  };
  return (
    <div data-swap="b" style={{ padding: "8px 2px 6px" }}>
      <div style={{ border: "1px solid rgba(245,158,11,.45)", background: "var(--ui-demo-bg)", borderRadius: 20, padding: "24px 26px" }}>
        <div style={{ display: "inline-block", marginBottom: 10, borderRadius: 999, padding: "2px 10px", fontSize: 11, letterSpacing: ".06em", background: "#f59e0b", color: "#fff" }}>{L.pill}</div>
        <div style={{ marginBottom: 6, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 40, lineHeight: 1, color: "var(--c-bone)" }}>{String(num)}</div>
        <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 650, lineHeight: 1.3, color: "var(--c-bone)" }}>{L.title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rest.map((r, i) => (
            <div key={i} style={{ border: "1px solid var(--ui-demo-bd)", borderRadius: 12, padding: "9px 12px", fontSize: 13, lineHeight: 1.6, color: "var(--c-ash)" }}>
              <span style={{ display: "block", marginBottom: 2, fontSize: 11, color: "var(--c-slate)" }}>{r.k || "·"}</span>
              {r.v}
            </div>
          ))}
        </div>
        <button style={{ marginTop: 16, cursor: "pointer", border: "1px solid #f59e0b", borderRadius: 10, background: "transparent", color: "#f59e0b", padding: "7px 15px", fontSize: 13, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={go}>
          {busy ? L.busy : L.go}
        </button>
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "var(--c-slate)" }}>{msg || (L.foot + rows.length)}{lastMs ? L.last + lastMs + " ms" : ""}</div>
      </div>
    </div>
  );
}
```
