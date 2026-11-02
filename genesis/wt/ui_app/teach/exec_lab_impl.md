# EXEC_LAB_IMPL

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { useEffect, useState } from "react";

const NL = String.fromCharCode(10);
// 通用实验台：命令直接来自被认领那节的 bullet（tag = 说明，content = 命令）。
// 运行在 bfork `lab` 里（/home 绑定主 wt 的 /ui_app/teach/_lab；/tmp 是 lab 自己的本地路径）。
const LAB_WT = "lab";
const LAB_RULE = "/ui_app/teach/_lab";
const LAB_DIR = "/ui_app/teach/_lab";
const UID_RE = /uid:\s*([A-Za-z0-9_-]+)/;

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const C = {
  card: { border: "1px solid var(--ui-demo-bd)", background: "var(--ui-demo-bg)", borderRadius: 14, padding: "16px 18px" },
  code: { fontSize: 12.5, lineHeight: 1.6, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bar: { display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 4px 10px" },
  btn: { appearance: "none", border: "1px solid var(--ui-demo-bd)", background: "transparent", color: "var(--c-bone)", fontFamily: MONO, fontSize: 12, borderRadius: 9, padding: "5px 12px", cursor: "pointer", flex: "0 0 auto" },
  iconBtn: { appearance: "none", border: 0, background: "transparent", color: "var(--c-bone)", cursor: "pointer", flex: "0 0 auto", width: 24, height: 24, display: "inline-grid", placeItems: "center", borderRadius: 7, fontSize: 11, lineHeight: 1, padding: 0, opacity: .8 },
  out: { margin: 0, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--c-ash)", background: "rgba(127,127,127,.08)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "8px 12px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 220, overflow: "auto" },
  hint: { fontSize: 12, lineHeight: 1.7, color: "var(--c-slate)" },
};

const T = {
  zh: {
    binding: "在 bfork `lab` 里运行：安全沙箱（/home 绑定主 wt 的 /ui_app/teach/_lab）",
    run: "运行", running: "运行中…", runAll: "全部运行",
    reset: "重置沙箱", resetDone: "沙箱已重置",
    fallback: "lab wt 不可用 ⇒ 回退到主 wt 的 /ui_app/teach/_lab",
  },
  en: {
    binding: "runs in bfork `lab`: safe sandbox (/home is bound to /ui_app/teach/_lab in the main wt)",
    run: "Run", running: "Running…", runAll: "Run all",
    reset: "Reset sandbox", resetDone: "sandbox reset",
    fallback: "lab wt unavailable ⇒ falling back to the main wt /ui_app/teach/_lab",
  },
};

/** 确保 bfork `lab` 存在，返回 uid；建 bfork 会把 current wt 临时切过去，建完切回 genesis。 */
function ensureLabWt(env) {
  if (globalThis.__labWtUid) return Promise.resolve(globalThis.__labWtUid);
  if (!globalThis.__labWtP) {
    globalThis.__labWtP = (async () => {
      let uid = null;
      try {
        const show = String(await env.exec('worktree show "' + LAB_WT + '"'));
        const m = show.match(UID_RE);
        if (m) uid = m[1];
      } catch (e) { /* 未建过 ⇒ 下面新建 */ }
      if (!uid) {
        const created = String(await env.exec('worktree bfork "' + LAB_WT + '" --rule "' + LAB_RULE + '"'));
        if (created.indexOf("mdio_error") >= 0) throw new Error(created.slice(0, 140));
        try { await env.exec('worktree use "genesis"'); } catch (e) { /* 切回失败不挡 */ }
        const show = String(await env.exec('worktree show "' + LAB_WT + '"'));
        const m = show.match(UID_RE);
        if (!m) throw new Error("lab wt 没拿到 uid：" + show.slice(0, 140));
        uid = m[1];
      }
      globalThis.__labWtUid = uid;
      return uid;
    })().catch((e) => { globalThis.__labWtP = null; throw e; });
  }
  return globalThis.__labWtP;
}

/** 输出渲染：`-rows` 的 {columns, rows} 自动摊成表格，其余照旧 pre。 */
function OutView({ raw }) {
  let j = null;
  try { j = JSON.parse(String(raw)); } catch (e) { j = null; }
  if (j && Array.isArray(j.columns) && Array.isArray(j.rows)) {
    const cols = j.columns.map(String);
    const shown = j.rows.slice(0, 40);
    const th = { textAlign: "left", padding: "5px 10px", borderBottom: "1px solid var(--ui-demo-bd)", color: "var(--c-slate)", fontWeight: 500, whiteSpace: "nowrap" };
    const td = { textAlign: "left", padding: "5px 10px", borderBottom: "1px solid rgba(127,127,127,.12)", color: "var(--c-ash)", verticalAlign: "top", wordBreak: "break-word" };
    return (
      <div style={Object.assign({}, C.out, { padding: 0, maxHeight: 300 })}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: MONO, fontSize: 12, lineHeight: 1.5 }}>
          <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {shown.map((r, ri) => (
              <tr key={ri}>{cols.map((c, ci) => <td key={ci} style={td}>{String(r[ci] == null ? "" : r[ci])}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {j.rows.length > shown.length ? <div style={{ padding: "4px 10px", fontSize: 11, color: "var(--c-slate)" }}>… {j.rows.length - shown.length} more rows</div> : null}
      </div>
    );
  }
  return <pre style={C.out}>{String(raw)}</pre>;
}

export default observer(function ExecLab({ node, read }) {
  const env = getEnv(node);
  const lang = (typeof globalThis !== "undefined" && globalThis.__teachLang === "en") ? "en" : "zh";
  const t = T[lang];
  const [wt, setWt] = useState({ uid: null, err: "" });
  const [outs, setOuts] = useState({});
  const [buses, setBuses] = useState({});
  const [allBusy, setAllBusy] = useState(false);
  const [note, setNote] = useState("");

  // 节里的 bullet：label=说明、content=命令；label 为 note 的只做提示，reset 的只在重置时执行
  const parsed = (() => {
    try {
      const sec = node && node.nt ? node : null;
      const kids = sec ? read.kidsOf([sec]) : [];
      const all = kids.filter((n) => n && n.nt === "b").map((b) => ({
        label: String(read.textOf(b) || ""),
        cmd: String(read.contentValueOf(b) || "").trim(),
      })).filter((r) => r.cmd);
      return {
        rows: all.filter((r) => r.label !== "note" && r.label !== "reset" && r.label !== "resethost"),
        resetCmds: all.filter((r) => r.label === "reset" || r.label === "resethost").map((r) => ({ cmd: r.cmd, host: r.label === "resethost" })),
        note: (all.find((r) => r.label === "note") || {}).cmd || "",
      };
    } catch (e) { return { rows: [], resetCmds: [], note: "" }; }
  })();
  const rows = parsed.rows;

  // 重置：删掉命令里出现过的 /tmp 临时文件 + 执行 reset / resethost 命令（后者在网关主上下文跑）+ 清空所有输出
  const tempPaths = (() => {
    const set = new Set();
    for (const r of rows.concat(parsed.resetCmds)) {
      const m = String(r.cmd).match(/\/tmp\/[A-Za-z0-9._\-\/]+/g) || [];
      for (const p of m) set.add(p.replace(/[.,;:]+$/, ""));
    }
    return Array.from(set);
  })();
  const reset = async () => {
    setAllBusy(true);
    let n = 0;
    for (const p of tempPaths) {
      try { await run('rm -f "' + p + '"'); n += 1; } catch (e) { /* 不存在也无所谓 */ }
    }
    for (const r of parsed.resetCmds) {
      try { await (r.host ? env.exec(r.cmd) : run(r.cmd)); n += 1; } catch (e) { /* 重置命令失败不挡 */ }
    }
    setOuts({});
    setNote(t.resetDone + (n ? "（" + n + " cleanup）" : ""));
    setAllBusy(false);
  };
  const title = (() => { try { return String(read.textOf(node) || ""); } catch (e) { return ""; } })();

  useEffect(() => {
    let alive = true;
    ensureLabWt(env).then((uid) => { if (alive) setWt({ uid: uid, err: "" }); })
      .catch((e) => { if (alive) setWt({ uid: null, err: String((e && e.message) || e) }); });
    return () => { alive = false; };
  }, []);

  const run = async (code) => {
    if (wt.uid) return env.client.exec(code, { wt_uid: wt.uid });
    return env.exec(String(code).split("/home/").join(LAB_DIR + "/"));
  };

  const runOne = async (i, cmd) => {
    setBuses((b) => Object.assign({}, b, { [i]: true }));
    try {
      const res = await run(cmd);
      setOuts((o) => Object.assign({}, o, { [i]: String(res == null ? "" : res) }));
    } catch (e) {
      setOuts((o) => Object.assign({}, o, { [i]: "ERR " + String((e && e.message) || e) }));
    }
    setBuses((b) => Object.assign({}, b, { [i]: false }));
  };
  const runAll = async () => {
    setAllBusy(true);
    const next = {};
    for (let i = 0; i < rows.length; i++) {
      try { next[i] = String(await run(rows[i].cmd)); }
      catch (e) { next[i] = "ERR " + String((e && e.message) || e); }
    }
    setOuts(next);
    setAllBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {title ? <h2 style={{ margin: "8px 0 2px", fontSize: 24, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-.02em", color: "var(--c-bone)" }}>{title}</h2> : null}
      <div style={C.hint}>
        {parsed.note || t.binding}
        {wt.err ? <span style={{ color: "#e6a23c" }}>（{t.fallback}：{String(wt.err).slice(0, 80)}）</span> : null}
      </div>
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 12 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button type="button" style={C.btn} onClick={reset} disabled={allBusy}>{t.reset}</button>
            {note ? <span style={{ fontSize: 12, color: "var(--c-slate)" }}>{note}</span> : null}
          </div>
          <button type="button" style={C.btn} onClick={runAll} disabled={allBusy}>{allBusy ? t.running : t.runAll}</button>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {r.label ? <span style={{ fontSize: 12, color: "var(--c-slate)" }}>{r.label}</span> : null}
            <div style={Object.assign({}, C.code, C.bar)}>
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>{r.cmd}</span>
              <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, buses[i] ? { opacity: .4, cursor: "default" } : null)} onClick={() => runOne(i, r.cmd)} disabled={!!buses[i]}>{buses[i] ? "…" : "▶"}</button>
            </div>
            {outs[i] ? <OutView raw={outs[i]} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
});
```
