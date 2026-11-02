# SWAP_A

## 实现

```jsx@node
import { Fragment, useMemo, useState } from "react";

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

export default function SwapA({ node, snap, read, exec }) {
  const en = typeof window !== "undefined" && window.__teachLang === "en";
  const doc = "/ui_app/teach/ui_demos" + (en ? ".en" : "") + ".md";
  const sec = "UI_DEMOS." + (en ? "Demos" : "演示") + ".swap";
  const TARGET = "- UI_SWAP_B: " + doc + "::" + sec;
  const L = en
    ? { pill: "Version A · number card · match: SWAP_A", title: "One section · two renderings",
        busy: "switching… (reloading declaration)", go: "Switch to B (edit ## match)",
        editing: "editing declaration…", done: "declaration changed → hot-reloaded to B", fail: "failed: ",
        foot: "{node,snap,read,exec} contract · ", rows: " rows in this section", last: " · last switch " }
    : { pill: "A 版 · 数值卡 · match: SWAP_A", title: "同一节 · 两套渲染",
        busy: "切换中…（声明重载）", go: "切到 B 版（改 ## match 声明）",
        editing: "正在改声明 …", done: "已改声明 → 热重载成 B 版", fail: "失败：",
        foot: "{node,snap,read,exec} 契约 · 本节数据 ", rows: " 行", last: " · 上次切换 " };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // 上一轮切换的耗时（跨重挂：声明重载会换掉整个组件，用 globalThis 传递）
  const [lastMs] = useState(() => {
    const at = globalThis.__uiSwapAt;
    return at ? Math.round(performance.now() - at) : 0;
  });
  const rows = useMemo(() => rowsOf(read, node), [snap]);
  const go = async () => {
    globalThis.__uiSwapAt = performance.now();
    setBusy(true); setMsg(L.editing);
    try { await swapTo(exec, doc, sec, TARGET); setMsg(L.done); }
    catch (e) { setMsg(L.fail + String((e && e.message) || e).slice(0, 80)); }
    setBusy(false);
  };
  return (
    <div data-swap="a" style={{ padding: "8px 2px 6px" }}>
      <div style={{ border: "1px solid var(--ui-demo-bd)", background: "var(--ui-demo-bg)", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ display: "inline-block", marginBottom: 12, borderRadius: 999, padding: "2px 10px", fontSize: 11, letterSpacing: ".06em", background: "rgba(59,130,246,.16)", color: "#3b82f6" }}>{L.pill}</div>
        <h3 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 650, lineHeight: 1.3, color: "var(--c-bone)" }}>{L.title}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "132px minmax(0,1fr)", columnGap: 14, rowGap: 9, fontSize: 13.5, lineHeight: 1.6, color: "var(--c-ash)" }}>
          {rows.map((r, i) => (
            <Fragment key={i}>
              <div style={{ color: "var(--c-slate)" }}>{(r.k || "·") + ":"}</div>
              <div>{r.v}</div>
            </Fragment>
          ))}
        </div>
        <button style={{ marginTop: 16, cursor: "pointer", border: 0, borderRadius: 10, background: "#3b82f6", color: "#fff", padding: "7px 15px", fontSize: 13, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={go}>
          {busy ? L.busy : L.go}
        </button>
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "var(--c-slate)" }}>{msg || (L.foot + rows.length + L.rows)}{lastMs ? L.last + lastMs + " ms" : ""}</div>
      </div>
    </div>
  );
}
```
