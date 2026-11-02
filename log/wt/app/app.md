# app

```jsx@app
import { createElement as h, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { observer } from "mobx-react-lite";
import { types, getEnv } from "mobx-state-tree";
import { log, logClear, logSubscribe, logSnapshot } from "ui_core/logBus";

// log v1 —— MDIO 管线日志 app：
//  · 标准行渲染：[time] TAG(按类着色) + 第一行；续行默认最多显示到第 3 行（超出折叠，点击展开）；
//  · 顶栏强制单行：[标题] [计数] [来源] [search...] … [清空] [底部] —— 宽度不足只截断文本，按钮不换行；
//  · devMode 只在 devview 槽里由壳传入 false 时隐藏（独立 appview 无此 prop ⇒ 正常渲染）。
const MAX_RENDER = 600;
const COLLAPSE_LINES = 3;

const TAGS = [
  [/^(FAILED|CONSOLE✗:|COMP✗:|AST-STALL:|decl ✗|claim ✗|EXEC✗)/, "#ff7b72"],
  [/^LONG-FRAME:/, "#ffa657"],
  [/^PERF:/, "#3fb950"],
  [/^INP:/, "#7ee787"],
  [/^MC_UP:/, "#d29922"],
  [/^MC_DN:/, "#58a6ff"],
  [/^boot:/, "#79c0ff"],
  [/^CLI→/, "#56d4dd"],
  [/^CLI←/, "#39a5a5"],
  [/^EXEC→/, "#bc8cff"],
  [/^EXEC←/, "#a371f7"],
  [/^MDIO_RESULT:/, "#39a5a5"],
  [/^MDIO_EXEC:/, "#bc8cff"],
  [/^AST F-snapshot/, "#e3b341"],
  [/^P_JSON:/, "#7ee787"],
  [/^CONSOLE>:/, "#e6edf3"],
  [/^CONSOLE</, "#79c0ff"],
  [/^(tree|treeEffect):/, "#ffa657"],
  [/^(send_gap|recv_to_render|patch_latency|incr):/, "#3fb950"],
  [/^(openFile|openDoc):/, "#e3b341"],
  [/^open doc:|^close doc:/, "#e3b341"],
  [/^css-mod:/, "#8b949e"],
  [/^(decl|claim|watch):/, "#d2a8ff"],
  [/^md-scope:/, "#a5d6ff"],
  [/^mono:/, "#58a6ff"],
  [/^panel /, "#8b949e"],
];

const CSS = [
  ".el-root{height:100%;display:flex;flex-direction:column;min-height:0;background:#161b22;color:#c9d1d9;font-family:ui-monospace,Menlo,monospace}",
  ".el-head{flex:0 0 auto;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #30363d;font-size:11px;min-height:28px;white-space:nowrap;overflow:hidden}",
  ".el-title{flex:0 0 auto;font-weight:600;font-size:12px;white-space:nowrap}",
  ".el-count{flex:0 0 auto;background:#30363d;border-radius:9px;padding:0 6px;font-size:10px}",
  ".el-sub{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b949e;font-size:10px}",
  ".el-flex{flex:1 1 auto;min-width:0}",
  ".el-search{flex:0 1 120px;min-width:52px;background:#21262d;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:10px;padding:1px 6px;font-family:inherit;height:20px;box-sizing:border-box}",
  ".el-search::placeholder{color:#656d76}",
  ".el-btn{flex:0 0 auto;white-space:nowrap;background:transparent;border:1px solid #30363d;color:#c9d1d9;border-radius:5px;font-size:10px;padding:1px 6px;cursor:pointer;height:20px;line-height:16px;box-sizing:border-box}",
  ".el-btn.warn{background:#3b2300}",
  ".el-body{flex:1 1 auto;min-height:0;overflow:auto;padding:2px 0}",
  ".el-body::-webkit-scrollbar{width:12px;height:12px}",
  ".el-body::-webkit-scrollbar-thumb{background-color:#4e4840;border-radius:8px;border:3px solid transparent;background-clip:content-box;min-height:40px}",
  ".el-body::-webkit-scrollbar-thumb:hover{background-color:#675f52}",
  ".el-body::-webkit-scrollbar-track,.el-body::-webkit-scrollbar-corner{background:transparent}",
  ".el-line{padding:2px 8px;font-size:11px;line-height:1.55;border-bottom:1px solid rgba(255,255,255,.03)}",
  ".el-line.is-more{cursor:pointer}",
  ".el-line.is-more:hover{background:rgba(255,255,255,.04)}",
  ".el-first{white-space:pre-wrap;word-break:break-all}",
  ".el-time{color:#8b949e}",
  ".el-tag{font-weight:600}",
  ".el-cont{white-space:pre-wrap;word-break:break-all;color:#b1b8c3}",
  ".el-more{color:#58a6ff;font-size:10px;opacity:.85}",
  ".el-empty{padding:16px;text-align:center;color:#656d76;font-size:11px}",
].join("");

function parseFirstLine(line) {
  const s = String(line || "");
  for (const [re, color] of TAGS) {
    const m = re.exec(s);
    if (m) { const tag = m[0]; return { tag, color, rest: s.slice(tag.length) }; }
  }
  return { tag: "", color: null, rest: s };
}

export const Store = types.model("ExpLogStore", {});

const LogLine = observer(function LogLine({ at, text, open, onToggle }) {
  const lines = useMemo(() => String(text || "").split("\n"), [text]);
  const first = useMemo(() => parseFirstLine(lines[0]), [lines]);
  const more = lines.length > COLLAPSE_LINES;
  const shown = more && !open ? lines.slice(0, COLLAPSE_LINES) : lines;
  return h("div", { className: "el-line" + (more ? " is-more" : ""), onClick: more ? onToggle : undefined, title: more ? (open ? "点击收起" : "点击展开全部 " + lines.length + " 行") : undefined },
    shown.map((ln, i) => i === 0
      ? h("div", { key: 0, className: "el-first" },
          h("span", { className: "el-time" }, "[" + at + "] "),
          first.tag ? h("span", { className: "el-tag", style: { color: first.color } }, first.tag) : null,
          h("span", null, first.rest))
      : h("div", { key: i, className: "el-cont" }, ln)),
    more ? h("div", { className: "el-more" }, open ? "收起（共 " + lines.length + " 行）" : "… 展开（共 " + lines.length + " 行）") : null);
});

export default observer(function ExpLogApp({ app, devMode }) {
  const store = useSyncExternalStore(logSubscribe, logSnapshot);
  const entries = store.entries || [];
  const [expanded, setExpanded] = useState(() => new Map());
  const [q, setQ] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const bodyRef = useRef(null);
  const env = getEnv(app) || {};
  const client = env.client;
  const wt = client && typeof client.wt === "function" ? client.wt() : null;
  const wtUid = wt ? String(wt.uid || "") : "";
  // devMode 只在 devview 槽里传（false = 壳的开发者模式关 ⇒ 面板不渲染）；独立 appview 无此 prop ⇒ 照常渲染。
  const hiddenByShell = devMode === false;

  useEffect(() => { log("boot: log ready（wt=" + wtUid + "）"); }, [wtUid]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return entries;
    return entries.filter((e) => String(e.text || "").toLowerCase().indexOf(k) >= 0);
  }, [entries, q]);
  const shown = filtered.slice(-MAX_RENDER);
  const jump = () => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; setAtBottom(true); };
  useEffect(() => {
    if (!atBottom || q) return undefined;
    const raf = requestAnimationFrame(() => jump());
    return () => cancelAnimationFrame(raf);
  }, [entries.length, atBottom, q]);
  const toggle = (k) => setExpanded((prev) => { const n = new Map(prev); n.set(k, !n.get(k)); return n; });
  if (hiddenByShell) return null;
  return h("div", { className: "el-root" },
    h("style", null, CSS),
    h("div", { className: "el-head" },
      h("span", { className: "el-title" }, "MDIO 管线日志"),
      h("span", { className: "el-count" }, q ? filtered.length + "/" + entries.length : String(entries.length)),
      h("span", { className: "el-sub" }, "log app · wt " + wtUid),
      h("input", { className: "el-search", value: q, placeholder: "search...", title: "按文本过滤日志", onChange: (e) => setQ(e.target.value) }),
      h("span", { className: "el-flex" }),
      h("button", { className: "el-btn", onClick: () => { logClear(); setExpanded(new Map()); }, title: "清空日志" }, "清空"),
      h("button", { className: "el-btn" + (!atBottom ? " warn" : ""), onClick: jump, title: "回到底部" }, "底部")),
    h("div", { ref: bodyRef, className: "el-body", onScroll: (e) => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8); } },
      shown.length === 0
        ? h("div", { className: "el-empty" }, q ? "no matches" : "(empty)")
        : shown.map((e) => h(LogLine, { key: e.at + e.text, at: e.at, text: e.text, open: expanded.get(e.at + e.text) === true, onToggle: () => toggle(e.at + e.text) }))));
});

```
