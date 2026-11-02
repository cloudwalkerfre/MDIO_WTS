# app

```jsx@app
import { createElement as h, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { types, getEnv } from "mobx-state-tree";
import { createMonaSession, MONA, MODE_MONACO } from "@app/SESSION";
import { log as busLog } from "ui_core/logBus";

// monaco v1 —— 独立 wt app（appview 表现）：
//  · 数据面 = 当前页面 wt（文件树 / client / CRDT 全走页面 env）；
//  · 当前档 = **app 自持，默认软跟随壳**：没手动选档时，壳指针变 ⇒ 编辑器跟随；
//    用户点树选了别的档 ⇒ 标记 pinned，壳后续怎么变都不抢（再点回壳当前档即恢复跟随）。
//    树点击**不再**把壳指针推过去（不反向改 appview）。
const MOUNTS_PREFIX = "/.mds/mounts/";
// 日志双写：窗口数组（测试用）+ **ui_core/logBus**（devview 日志面板的数据源）。
const log = (...a) => {
  const text = a.map((x) => String(x)).join(" ").slice(0, 240);
  try { (window.__expMonacoLog || (window.__expMonacoLog = [])).push(text); } catch (e) { /* ignore */ }
  try { busLog(text); } catch (e) { /* ignore */ }
  try { (console.log)("[monaco]", text); } catch (e) { /* ignore */ }
};

let monacoP = null;
function loadMonaco() {
  if (!monacoP) {
    monacoP = import("ui_base/monaco").then((mod) => {
      try { mod.installMonacoEnvironment(); } catch (e) { /* 幂等 */ }
      return mod.monaco;
    });
  }
  return monacoP;
}

const ICONS = [
  [/\.md$/i, "MD", "#60a5fa"],
  [/\.py$/i, "PY", "#facc15"],
  [/\.(js|jsx|ts|tsx|mjs)$/i, "JS", "#fbbf24"],
  [/\.(json|ya?ml|toml)$/i, "{ }", "#a78bfa"],
  [/\.(css|scss|less)$/i, "#", "#34d399"],
];
function iconOf(name) {
  const n = String(name || "");
  const ext = n.slice(n.lastIndexOf("."));
  for (const [re, label, color] of ICONS) if (re.test(ext)) return { label, color };
  return { label: "—", color: "#71717a" };
}
function buildTree(entries) {
  const root = { name: "", path: "", dirs: new Map(), files: [] };
  for (const e of entries || []) {
    const p = String((e && e.path) || "");
    if (!p) continue;
    const parts = p.split("/").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = parts[i];
      const key = cur.path + "/" + seg;
      if (!cur.dirs.has(seg)) cur.dirs.set(seg, { name: seg, path: key, dirs: new Map(), files: [] });
      cur = cur.dirs.get(seg);
    }
    cur.files.push({ name: parts[parts.length - 1], path: p, entry: e });
  }
  return root;
}
function countFiles(node) { let n = node.files.length; for (const d of node.dirs.values()) n += countFiles(d); return n; }
function collectDirs(node, acc) { for (const d of node.dirs.values()) { acc.push(d.path); collectDirs(d, acc); } return acc; }
function flatten(node, level, expanded, filter, out) {
  const f = String(filter || "").toLowerCase();
  const hit = (name, path) => !f || name.toLowerCase().includes(f) || path.toLowerCase().includes(f);
  const folders = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = node.files.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const d of folders) {
    const kids = [];
    flatten(d, level + 1, expanded, filter, kids);
    const selfHit = hit(d.name, d.path);
    if (f && kids.length === 0 && !selfHit) continue;
    const isOpen = f ? true : expanded.has(d.path);
    out.push({ type: "dir", name: d.name, path: d.path, level, isOpen, count: countFiles(d) });
    if (isOpen) out.push(...kids);
  }
  for (const file of files) if (hit(file.name, file.path)) out.push({ type: "file", name: file.name, path: file.path, level, entry: file.entry });
  return out;
}

export const Store = types
  .model("ExpMonacoStore", {
    treeW: types.optional(types.number, 260),
    /** app 自己的当前档路径（自持；初始=壳当前渲染档）。 */
    docPath: types.optional(types.maybeNull(types.string), null),
    /** 用户手动选过档 ⇒ 不再被壳指针抢走（软跟随的闸门）。 */
    pinned: types.optional(types.boolean, false),
  })
  .views((self) => ({
    get mainRoot() {
      const env = getEnv(self) || {};
      return typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
    },
    get dev() { const r = this.mainRoot; return (r && r.dev) || null; },
    get files() {
      const r = this.mainRoot;
      const w = (r && r.wts && r.wts.wt) || null;
      const raw = (w && w.files) || [];
      return raw.filter((f) => f && String(f.path || "").indexOf(MOUNTS_PREFIX) !== 0);
    },
    get wtUid() {
      const env = getEnv(self) || {};
      const c = env.client;
      const w = c && typeof c.wt === "function" ? c.wt() : null;
      return w ? String(w.uid || "") : "";
    },
    /** 壳的当前渲染档：只用于 app 首次初始化（不参与后续绑定）。 */
    get shellDocId() { const d = this.dev; return d && d.openDocId != null ? Number(d.openDocId) : null; },
    /** 壳的当前渲染档**路径**（DevStore.entry）：未 pinned 时软跟随它（新写出的文档也认）。 */
    get shellDocPath() { const d = this.dev; const e = d && d.entry; return e && e.path ? String(e.path) : null; },
    /** app 自己的当前档 → docId（编辑器/CRDT 会话用）。 */
    get docId() {
      const p = self.docPath;
      if (!p) return null;
      const f = this.files.find((x) => x && String(x.path) === p);
      return f && f.id != null ? Number(f.id) : null;
    },
  }))
  .actions((self) => ({
    setTreeW(v) { self.treeW = Number(v) || self.treeW; },
    setDocPath(p) { self.docPath = p || null; },
    setPinned(v) { self.pinned = !!v; },
  }));

const TREE_CSS = [
  ".fm-root{height:100%;display:flex;flex-direction:column;min-height:0;font-family:ui-monospace,Menlo,monospace;font-size:12px}",
  ".fm-root.dark{background:#161b22;color:#c9d1d9}",
  ".fm-root.light{background:#ffffff;color:#1f2328}",
  ".fm-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid #30363d;font-size:11px}",
  ".fm-root.light .fm-head{border-color:#d0d7de}",
  ".fm-head b{font-size:12px}",
  ".fm-sub{opacity:.55}", ".fm-doc{opacity:.85}", ".fm-flex{flex:1 1 auto}", ".fm-note{opacity:.4;font-size:10px}",
  ".fm-body{flex:1 1 auto;display:flex;min-height:0}",
  ".ft-tree{flex:0 0 auto;min-width:0;display:flex;flex-direction:column;min-height:0;border-right:1px solid #30363d;background:transparent}",
  ".fm-root.light .ft-tree{border-color:#d0d7de}",
  ".ft-filter{padding:6px 8px 4px;flex-shrink:0}",
  ".ft-filter input{width:100%;box-sizing:border-box;background:#21262d;border:1px solid #30363d;border-radius:4px;padding:3px 7px;color:#c9d1d9;font-size:11px;font-family:inherit}",
  ".ft-filter input::placeholder{color:#656d76}",
  ".fm-root.light .ft-filter input{background:#f6f8fa;border-color:#d0d7de;color:#1f2328}",
  ".ft-head{padding:0 8px 4px;font-size:10px;color:#656d76;flex-shrink:0}",
  ".ft-body{flex:1;overflow:auto;min-height:0;padding:0 4px 6px}",
  ".ft-row{display:flex;align-items:center;height:28px;padding-right:8px;border-radius:3px;cursor:pointer;user-select:none;font-size:12px;color:#8b949e;white-space:nowrap}",
  ".ft-row:hover{background:rgba(255,255,255,.06)}",
  ".ft-row.on{background:rgba(22,119,255,.16);color:#7ab8ff}",
  ".fm-root.light .ft-row{color:#57606a}", ".fm-root.light .ft-row:hover{background:rgba(0,0,0,.05)}",
  ".fm-root.light .ft-row.on{background:rgba(22,119,255,.10);color:#1677ff}",
  ".ft-dir .caret{width:16px;flex-shrink:0;text-align:center;color:#656d76;font-size:10px}",
  ".ft-dir .cnt{margin-left:auto;font-size:10px;color:#656d76}",
  ".ft-file .ext{width:16px;flex-shrink:0;text-align:center;font-size:9px;font-weight:600;margin-right:4px}",
  ".ft-nm{overflow:hidden;text-overflow:ellipsis}",
  ".ft-empty{padding:16px;text-align:center;color:#656d76;font-size:11px}",
  // ── 滚动条（抄 ui_std/basic_render 的 fileview 发丝感：12px · thumb 8px 圆角 · 字面色，暗/亮两套）──
  ".ft-body::-webkit-scrollbar{width:12px;height:12px}",
  ".ft-body::-webkit-scrollbar-thumb{background-color:#c3c2bc;border-radius:8px;border:3px solid transparent;background-clip:content-box;min-height:40px}",
  ".ft-body::-webkit-scrollbar-thumb:hover{background-color:#a5a49d}",
  ".fm-root.dark .ft-body::-webkit-scrollbar-thumb{background-color:#4e4840}",
  ".fm-root.dark .ft-body::-webkit-scrollbar-thumb:hover{background-color:#675f52}",
  ".ft-body::-webkit-scrollbar-track,.ft-body::-webkit-scrollbar-corner{background:transparent}",
  ".fm-split{flex:0 0 4px;cursor:col-resize;background:transparent;position:relative}",
  ".fm-split::after{content:\"\";position:absolute;inset:0 1px;background:#30363d}",
  ".fm-split:hover::after{background:#1677ff}",
  ".fm-root.light .fm-split::after{background:#d0d7de}",
  ".fm-editor{flex:1 1 auto;min-width:0;position:relative;display:flex;flex-direction:column}",
].join("");

const Tree = observer(function Tree({ app }) {
  const files = (app && app.files) || [];
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(() => new Set(["", "/app"]));
  const tree = useMemo(() => buildTree(files), [files]);
  const rows = useMemo(() => flatten(tree, 0, expanded, filter, []), [tree, expanded, filter]);
  const total = rows.filter((r) => r.type === "file").length;
  // 当前档自动展开祖先目录（否则选中行在折叠目录里不可见）
  useEffect(() => {
    const p = app && app.docPath;
    if (!p) return;
    const parts = String(p).split("/").filter(Boolean);
    const dirs = [];
    let cur = "";
    for (let i = 0; i < parts.length - 1; i += 1) { cur += "/" + parts[i]; dirs.push(cur); }
    if (!dirs.length) return;
    setExpanded((prev) => {
      let changed = false; const next = new Set(prev);
      for (const d of dirs) if (!next.has(d)) { next.add(d); changed = true; }
      return changed ? next : prev;
    });
  }, [app && app.docPath]);
  const toggle = (path, alt) => setExpanded((prev) => {
    const next = new Set(prev);
    const node = (function find(n) { if (n.path === path) return n; for (const d of n.dirs.values()) { const r = find(d); if (r) return r; } return null; })(tree);
    const paths = alt && node ? collectDirs(node, [node.path]) : [path];
    const anyClosed = paths.some((p) => !next.has(p));
    for (const p of paths) { if (anyClosed) next.add(p); else next.delete(p); }
    return next;
  });
  const open = (entry) => {
    if (!entry) return;
    const p = String(entry.path);
    log("mono: tree open " + p);
    app.setDocPath(p);
    // 手动选档 = pin：之后壳的当前档怎么变都不抢（点回壳当前档则解除 pin，恢复软跟随）。
    app.setPinned(p !== app.shellDocPath);
  };
  return h("div", { className: "ft-tree", style: { width: app.treeW } },
    h("div", { className: "ft-filter" }, h("input", { value: filter, onChange: (e) => setFilter(e.target.value), placeholder: "Filter..." })),
    h("div", { className: "ft-head", title: "当前 wt 作用域内的文档" }, total + " items"),
    h("div", { className: "ft-body" },
      rows.length === 0 && filter ? h("div", { className: "ft-empty" }, "No matches") : null,
      rows.map((r) => r.type === "dir"
        ? h("div", { key: "d" + r.path, className: "ft-row ft-dir", style: { paddingLeft: r.level * 14 + 4 }, onClick: (e) => toggle(r.path, e.altKey), title: r.path },
            h("span", { className: "caret" }, r.isOpen ? "▾" : "▸"),
            h("span", { className: "ft-nm" }, r.name),
            h("span", { className: "cnt" }, r.count))
        : h("div", { key: "f" + r.path, className: "ft-row ft-file" + (app.docPath === r.path ? " on" : ""), style: { paddingLeft: r.level * 14 + 20 }, title: r.path, "data-path": r.path, onClick: () => open(r.entry) },
            h("span", { className: "ext", style: { color: iconOf(r.name).color } }, iconOf(r.name).label),
            h("span", { className: "ft-nm" }, r.name)))));
});

const Editor = observer(function Editor({ app }) {
  const hostRef = useRef(null);
  const monacoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const env = app ? (getEnv(app) || {}) : {};
  const client = env.client;
  const dev = app ? app.dev : null;
  const dark = !!(dev && dev.dark);
  const docId = app ? app.docId : null;
  const docPath = app ? app.docPath : null;

  useEffect(() => {
    let live = true;
    loadMonaco().then((mn) => {
      if (!live || !hostRef.current) return;
      monacoRef.current = mn;
      setReady(true);
    }).catch((e) => { if (live) setErr(String((e && e.message) || e)); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!monacoRef.current) return;
    try { monacoRef.current.editor.setTheme(dark ? "vs-dark" : "vs"); } catch (e) { /* ignore */ }
  }, [dark, ready]);

  useEffect(() => {
    if (!ready || !client || docId == null || !hostRef.current) return undefined;
    const mn = monacoRef.current;
    const host = hostRef.current;
    const ed = mn.editor.create(host, {
      value: "", language: "markdown", theme: dark ? "vs-dark" : "vs", automaticLayout: false,
      minimap: { enabled: false }, fontSize: 12, wordWrap: "on", scrollBeyondLastLine: false,
      contextmenu: false, fixedOverflowWidgets: true, padding: { top: 6 },
    });
    const relayout = () => { try { ed.layout({ width: host.clientWidth || 320, height: host.clientHeight || 240 }); } catch (e) { /* ignore */ } };
    relayout();
    const ro = new ResizeObserver(relayout);
    ro.observe(host);
    try { host.setAttribute("data-mdio-mona", "1"); } catch (e) { /* ignore */ }
    const onSopEdit = (ev) => {
      try {
        const d = (ev && ev.detail) || {};
        const m = ed.getModel();
        if (!m || m.isDisposed() || d.text == null) return;
        const ln = Math.max(1, Number(d.line) || 1);
        m.pushEditOperations([], [{
          range: new mn.Range(ln, Math.max(1, Number(d.from) || 1), ln, Math.max(1, Number(d.to) || 1)),
          text: String(d.text),
        }], () => null);
        log("SOP edit L" + ln + " model=" + JSON.stringify(String(m.getLineContent(ln)).slice(0, 40)));
      } catch (e) { log("SOP fail " + String((e && e.message) || e)); }
    };
    host.addEventListener("mdio-sop-edit", onSopEdit);
    const peerId = client.peerId;
    const sess = createMonaSession(peerId, docId, ed, mn, client, (m) => log(m));
    try { client.registerProvider(peerId, docId, sess, MONA.OpenDoc, MODE_MONACO); } catch (e) { log("registerProvider fail " + String((e && e.message) || e)); }
    log("open doc=" + docId + " " + docPath);
    return () => {
      try { host.removeEventListener("mdio-sop-edit", onSopEdit); } catch (e) { /* ignore */ }
      try { ro.disconnect(); } catch (e) { /* ignore */ }
      try { client.closeSession(docId, sess); } catch (e) { /* ignore */ }
      try { const m = ed.getModel(); if (m) m.dispose(); } catch (e) { /* ignore */ }
      try { ed.dispose(); } catch (e) { /* ignore */ }
      log("close doc=" + docId);
    };
  }, [ready, client, docId]);

  return h("div", { className: "fm-editor" },
    err ? h("div", { style: { padding: "6px 10px", color: "#ff7b72", fontSize: 11, borderBottom: "1px solid #30363d" } }, err) : null,
    h("div", { ref: hostRef, style: { flex: "1 1 auto", minHeight: 0 } }));
});

export default observer(function ExpMonacoApp({ app }) {
  const env = app ? (getEnv(app) || {}) : {};
  const r = env.getMainRoot ? env.getMainRoot() : null;
  const dark = !!(r && r.dev && r.dev.dark);
  const files = (app && app.files) || [];
  const wtUid = app ? app.wtUid : "";
  const shellDocId = app ? app.shellDocId : null;
  const shellDocPath = app ? app.shellDocPath : null;
  const initRef = useRef({ wt: null, inited: false });
  useEffect(() => {
    if (!app) return;
    const st = initRef.current;
    if (st.wt !== wtUid) { st.wt = wtUid; st.inited = false; app.setDocPath(null); app.setPinned(false); }
    if (st.inited) return;
    const list = files || [];
    if (!list.length) return;
    const byId = shellDocId != null ? list.find((f) => f && Number(f.id) === Number(shellDocId)) : null;
    const docs = list.filter((f) => f && /\.md$/i.test(String(f.path || "")));
    const pick = shellDocPath || (byId && byId.path) || (docs.find((f) => String(f.path) === "/README.md") || docs.slice().sort((a, b) => String(a.path).localeCompare(String(b.path)))[0] || {}).path;
    if (pick) { app.setDocPath(String(pick)); st.inited = true; }
  }, [app, wtUid, files.length, shellDocId, shellDocPath]);
  // 壳的当前档变了 ⇒ **未手动选档时**才跟随（pinned 的档不被抢；用户自主选择优先）。
  // 用路径（DevStore.entry）而不是 docId：新建文档的 id 可能还没进 files，路径一定能对上。
  useEffect(() => {
    if (!app || !shellDocPath || app.pinned) return;
    if (app.docPath !== shellDocPath) { log("mono: follow shell doc " + shellDocPath); app.setDocPath(shellDocPath); }
  }, [app, shellDocPath, app && app.pinned]);
  return h("div", { className: "fm-root " + (dark ? "dark" : "light") },
    h("style", null, TREE_CSS),
    h("div", { className: "fm-head" },
      h("b", null, "monaco"),
      h("span", { className: "fm-sub" }, "wt " + wtUid),
      h("span", { className: "fm-doc" }, app && app.docPath ? app.docPath : "(no doc)"),
      h("span", { className: "fm-flex" }),
      h("span", { className: "fm-note" }, app && app.pinned ? "当前档 = 手动选择（不被壳抢）" : "当前档 = 软跟随壳（点树可固定）")),
    h("div", { className: "fm-body" },
      h(Tree, { app }),
      h("div", { className: "fm-split", title: "拖动调整树宽", onPointerDown: (e) => {
        e.preventDefault();
        const startX = e.clientX; const startW = app.treeW;
        const move = (ev) => { app.setTreeW(Math.max(180, Math.min(520, startW + (ev.clientX - startX)))); };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      } }),
      h(Editor, { app })));
});

```
