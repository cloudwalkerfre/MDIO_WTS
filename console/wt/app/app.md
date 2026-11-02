# app

```jsx@app
import { createElement as h, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { types, getEnv } from "mobx-state-tree";

// console —— console（exec 命令执行框 + 结果），只做这件事。
//
// 两种呈现：
//   · 独立 appview（缺省）：全高；输出区滚动，输入条贴底。
//   · footer 模式（props.footer === true）：默认只露一行输入；产生第一条结果后经
//     props.onRequestHeight(240) 请壳把 footer 抬到可读高度（壳的顶边拖拽继续可调）；
//     清空结果后再请求收回 COLLAPSED_HEIGHT。
//
// 每 wt 的 session：该 wt 的 /var/console.md（单行 JSON：cmd / out(截断) / ok / ms）。
// 挂载时恢复，每次执行后回写；文件不存在时先 mk -f。执行走 env.exec（页面 tools，
// 管线日志里是 EXEC→/EXEC←）；session 读写走 env.client.exec（不污染管线日志）。
const MAX_ENTRIES = 60;
const OUT_CAP = 4000;
const SESSION_PATH = "/var/console.md";
const FOOT_HEIGHT = 240;
const COLLAPSED_HEIGHT = 30;

const CSS = [
  ".c-root{height:100%;display:flex;flex-direction:column;min-height:0;background:var(--c-bg);color:var(--c-fg);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;--c-bg:#ffffff;--c-fg:#1f2328;--c-muted:#6e7781;--c-border:#d0d7de;--c-cmd:#0969da;--c-ok:#1a7f37;--c-err:#cf222e;}",
  ":host(.dark) .c-root{--c-bg:#161b22;--c-fg:#c9d1d9;--c-muted:#8b949e;--c-border:#30363d;--c-cmd:#79c0ff;--c-ok:#3fb950;--c-err:#ff7b72;}",
  ".c-out{flex:1 1 auto;min-height:0;overflow:auto;padding:6px 10px 2px;}",
  ".c-out::-webkit-scrollbar{width:10px;height:10px}",
  ".c-out::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:8px;border:2px solid transparent;background-clip:content-box}",
  ".c-out::-webkit-scrollbar-track,.c-out::-webkit-scrollbar-corner{background:transparent}",
  ".c-entry{padding:3px 0 6px;border-bottom:1px solid var(--c-border)}",
  ".c-entry:last-child{border-bottom:0}",
  ".c-cmd{white-space:pre-wrap;word-break:break-all;color:var(--c-cmd)}",
  ".c-cmd .p{margin-right:4px;opacity:.85}",
  ".c-text{white-space:pre-wrap;word-break:break-all;margin:2px 0 0;color:var(--c-fg);font-family:inherit;font-size:12px}",
  ".c-entry.is-err .c-text{color:var(--c-err)}",
  ".c-meta{color:var(--c-muted);font-size:10px;margin-top:2px}",
  ".c-entry.is-err .c-meta{color:var(--c-err)}",
  ".c-empty{color:var(--c-muted);padding:8px 0}",
  ".c-bar{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:4px 10px;border-top:1px solid var(--c-border);background:var(--c-bg)}",
  ".c-prompt{color:var(--c-ok);font-weight:600}",
  ".c-in{flex:1 1 auto;min-width:0;background:transparent;border:0;outline:0;color:var(--c-fg);font-family:inherit;font-size:12px;padding:2px 0}",
  ".c-in::placeholder{color:var(--c-muted)}",
  ".c-busy{color:var(--c-muted);font-size:10px;white-space:nowrap}",
  ".c-foot.collapsed .c-out{display:none}",
  ".c-foot.collapsed .c-bar{height:100%;border-top:0}",
].join("");

export const Store = types.model("ConsoleStore", {});

function now() {
  return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
}

/** mdio DSL 双引号字符串转义（反斜杠先、再引号）。 */
function dslString(s) {
  return "\"" + String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
}

function looksError(out) {
  return /(^|\n)\s*-?\s*mdio_error\b/.test(String(out || ""));
}

/** 一条 session 落盘时要保真的字段（输出截断，防止单条过大）。 */
function slim(e) {
  return { cmd: String(e.cmd || ""), out: String(e.out == null ? "" : e.out).slice(0, OUT_CAP), ok: !!e.ok, ms: Number(e.ms) || 0 };
}

const Entry = observer(function Entry({ e }) {
  return h("div", { className: "c-entry" + (e.ok ? "" : " is-err") },
    h("div", { className: "c-cmd" }, h("span", { className: "p" }, ">"), e.cmd),
    h("pre", { className: "c-text" }, String(e.out || "").replace(/\n+$/, "") || "(no output)"),
    h("div", { className: "c-meta" }, (e.ok ? "ok" : "✗") + " · " + (Number(e.ms) || 0) + "ms"));
});

export default observer(function ExpConsoleApp({ app, footer, onRequestHeight }) {
  const env = (app && getEnv(app)) || {};
  const client = env.client || null;
  const clientRef = useRef(null);
  clientRef.current = client;
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const outRef = useRef(null);
  const stickRef = useRef(true);
  const idxRef = useRef(-1);
  const draftBefore = useRef("");
  const idRef = useRef(1);
  const loadedRef = useRef(false);
  const wantedH = useRef(null);
  const isFoot = !!footer;

  /** 不写管线日志的 exec（session 读写专用）。 */
  const quietExec = async (code) => {
    const c = clientRef.current;
    if (!c) throw new Error("console: client 未就绪");
    return await c.exec(code);
  };
  /** 执行命令：优先页面 tools 的 exec（EXEC→/EXEC← 进管线日志），没有则退回 client.exec。 */
  const runExec = async (code) => {
    if (typeof env.exec === "function") return await env.exec(code);
    const c = clientRef.current;
    if (!c) throw new Error("console: client 未就绪");
    return await c.exec(code);
  };
  const saveSession = async (list) => {
    const body = dslString(JSON.stringify(list.map(slim))) + " | /> " + SESSION_PATH;
    try {
      const r = await quietExec(body);
      if (typeof r === "string" && r.indexOf("mdio_error") >= 0) throw new Error(r);
    } catch (e) {
      try {
        await quietExec("mk -f " + SESSION_PATH);
        await quietExec(body);
      } catch (e2) { /* session 落盘失败不影响 console 使用 */ }
    }
  };
  const loadSession = async () => {
    if (!clientRef.current) return;
    try {
      const raw = String(await quietExec("$ " + SESSION_PATH) || "").trim();
      if (raw.charAt(0) !== "[") return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const list = arr.filter((x) => x && typeof x.cmd === "string").slice(-MAX_ENTRIES).map((x) => ({
        id: idRef.current++,
        cmd: String(x.cmd),
        out: String(x.out == null ? "" : x.out),
        ok: x.ok !== false && !looksError(x.out),
        ms: Number(x.ms) || 0,
      }));
      setEntries(list);
    } catch (e) { /* 无 session/解析失败 ⇒ 空 console */ }
  };

  useEffect(() => {
    if (loadedRef.current || !client) return undefined;
    loadedRef.current = true;
    void loadSession();
    return undefined;
  }, [client]);

  // footer 模式：无结果 = 只露输入行；有结果 = 请壳抬到可读高度。
  useEffect(() => {
    if (!isFoot || typeof onRequestHeight !== "function") return;
    const want = entries.length > 0 ? FOOT_HEIGHT : COLLAPSED_HEIGHT;
    if (wantedH.current === want) return;
    wantedH.current = want;
    try { onRequestHeight(want); } catch (e) { /* 壳没接就忽略 */ }
  }, [entries.length, isFoot, onRequestHeight]);

  // 在底部才跟随新输出。
  useEffect(() => {
    const el = outRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, busy]);

  const pushEntry = (entry) => {
    setEntries((prev) => {
      const next = prev.concat([entry]).slice(-MAX_ENTRIES);
      void saveSession(next);
      return next;
    });
  };

  const clear = () => {
    setEntries([]);
    idxRef.current = -1;
    void saveSession([]);
  };

  const cmdHistory = useMemo(() => {
    const out = [];
    for (const e of entries) if (out[out.length - 1] !== e.cmd) out.push(e.cmd);
    return out;
  }, [entries]);

  const recall = (dir) => {
    const arr = cmdHistory;
    if (!arr.length) return;
    if (dir < 0) {
      if (idxRef.current === -1) { draftBefore.current = draft; idxRef.current = arr.length - 1; }
      else if (idxRef.current > 0) idxRef.current -= 1;
      setDraft(arr[idxRef.current]);
    } else {
      if (idxRef.current === -1) return;
      if (idxRef.current < arr.length - 1) { idxRef.current += 1; setDraft(arr[idxRef.current]); }
      else { idxRef.current = -1; setDraft(draftBefore.current); }
    }
  };

  const run = async () => {
    if (busyRef.current) return;
    const code = String(draft || "").trim();
    if (!code) return;
    busyRef.current = true;
    setBusy(true);
    setDraft("");
    idxRef.current = -1;
    const t0 = now();
    let entry;
    try {
      const raw = await runExec(code);
      const out = String(raw == null ? "" : raw);
      entry = { id: idRef.current++, cmd: code, out, ok: !looksError(out), ms: Math.round(now() - t0) };
    } catch (e) {
      entry = { id: idRef.current++, cmd: code, out: String((e && e.message) || e), ok: false, ms: Math.round(now() - t0) };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    pushEntry(entry);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); void run(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); recall(-1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); recall(1); return; }
    if (e.key === "Escape") { setDraft(""); idxRef.current = -1; return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) { e.preventDefault(); clear(); return; }
    idxRef.current = -1;
  };

  const showBody = !isFoot || entries.length > 0;
  return h("div", { className: "c-root" + (isFoot ? " c-foot" : "") + (isFoot && !showBody ? " collapsed" : "") },
    h("style", null, CSS),
    showBody ? h("div", {
      className: "c-out", ref: outRef,
      onScroll: (e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8; },
    }, entries.length > 0 ? entries.map((e) => h(Entry, { key: e.id, e })) : h("div", { className: "c-empty" }, ">")) : null,
    h("div", { className: "c-bar" },
      h("span", { className: "c-prompt" }, ">"),
      h("input", {
        className: "c-in",
        value: draft,
        placeholder: "mdio exec，回车执行",
        spellCheck: false,
        autoComplete: "off",
        onChange: (e) => setDraft(e.target.value),
        onKeyDown,
      }),
      busy ? h("span", { className: "c-busy" }, "执行中…") : null));
});

```
