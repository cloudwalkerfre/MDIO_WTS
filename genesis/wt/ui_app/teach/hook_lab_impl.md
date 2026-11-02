# HOOK_LAB_IMPL

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { useEffect, useState } from "react";

const NL = String.fromCharCode(10);
// hook 实验台 = bfork `lab`（/home 绑定主 wt 的 /ui_app/teach/_lab；/tmp 是 lab 自己的本地路径）
const LAB_WT = "lab";
const LAB_RULE = "/ui_app/teach/_lab";
const LAB_DIR = "/ui_app/teach/_lab";
const DOC = "/home/hook.md";
const LOG = "/tmp/hook_log.md";
const TARGET = DOC + "::H.状态:端口";
const UID_RE = /uid:\s*([A-Za-z0-9_-]+)/;
const SAMPLE = ["# H", "", "## 状态", "", "- 端口: 8080", "- 环境: dev", "", "## 日志", "", "- LAST: none"].join(NL) + NL;

const CB = '-cb \'"端口变了" | +> ' + LOG + "::'";

const STEPS = [
  { zh: "① 准备日志文件", en: "① create log file", cmd: "mk -f " + LOG },
  { zh: "② 注册一次性 hook", en: "② register one-shot hook", cmd: "hook -target " + TARGET + " " + CB },
  { zh: "③ 触发写（改端口）", en: "③ trigger write (change port)", cmd: '"9090" | /> ' + TARGET },
  { zh: "④ 等回调后读日志", en: "④ read log after callback", cmd: "$ " + LOG },
  { zh: "⑤ 注册持久 hook（-is_always）", en: "⑤ register persistent hook (-is_always)", cmd: "hook -target " + TARGET + " " + CB + " -is_always" },
  { zh: "⑥ 清理这个文档的 hook", en: "⑥ clear hooks of this doc", cmd: "hook -deldoc " + DOC },
];

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const C = {
  card: { border: "1px solid var(--ui-demo-bd)", background: "var(--ui-demo-bg)", borderRadius: 14, padding: "16px 18px" },
  code: { fontSize: 12.5, lineHeight: 1.6, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bar: { display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 4px 10px" },
  btn: { appearance: "none", border: "1px solid var(--ui-demo-bd)", background: "transparent", color: "var(--c-bone)", fontFamily: MONO, fontSize: 12, borderRadius: 9, padding: "5px 12px", cursor: "pointer", flex: "0 0 auto" },
  iconBtn: { appearance: "none", border: 0, background: "transparent", color: "var(--c-bone)", cursor: "pointer", flex: "0 0 auto", width: 24, height: 24, display: "inline-grid", placeItems: "center", borderRadius: 7, fontSize: 11, lineHeight: 1, padding: 0, opacity: .8 },
  out: { margin: 0, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--c-ash)", background: "rgba(127,127,127,.08)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "8px 12px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" },
  hint: { fontSize: 12, lineHeight: 1.7, color: "var(--c-slate)" },
};

const T = {
  zh: {
    title: "hook 实验台",
    binding: "在 bfork `lab` 里运行：安全沙箱（hook 的回调写在 lab 自己的 /tmp，不碰主 wt）",
    sandbox: "沙箱文档",
    log: "日志文件",
    note: "回调是异步的：③ 触发后要稍等一下，④ 才能读到日志；「跑完整流程」会自动等。",
    run: "运行", running: "运行中…", flow: "跑完整流程", reset: "重置沙箱", resetDone: "沙箱已重置（端口 8080、hook 清空）",
    fallback: "lab wt 不可用 ⇒ 回退到主 wt 的 /ui_app/teach/_lab",
  },
  en: {
    title: "Hook lab",
    binding: "runs in bfork `lab`: safe sandbox (hook callbacks write into the lab's own /tmp, never the main wt)",
    sandbox: "sandbox doc",
    log: "log file",
    note: "Callbacks are asynchronous: after ③ wait a moment before ④ reads the log; “Run the full flow” waits automatically.",
    run: "Run", running: "Running…", flow: "Run the full flow", reset: "Reset sandbox", resetDone: "sandbox reset (port 8080, hooks cleared)",
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

export default observer(function HookLab({ node }) {
  const env = getEnv(node);
  const en = (typeof globalThis !== "undefined" && globalThis.__teachLang === "en");
  const t = en ? T.en : T.zh;
  const [wt, setWt] = useState({ uid: null, err: "" });
  const [outs, setOuts] = useState({});
  const [buses, setBuses] = useState({});
  const [flowOut, setFlowOut] = useState("");
  const [flowBusy, setFlowBusy] = useState(false);

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

  const runStep = async (cmd) => {
    setBuses((b) => Object.assign({}, b, { [cmd]: true }));
    try {
      const res = await run(cmd);
      setOuts((o) => Object.assign({}, o, { [cmd]: String(res == null ? "" : res) }));
    } catch (e) {
      setOuts((o) => Object.assign({}, o, { [cmd]: "ERR " + String((e && e.message) || e) }));
    }
    setBuses((b) => Object.assign({}, b, { [cmd]: false }));
  };

  const resetSandbox = async () => {
    try { await run("hook -deldoc " + DOC); } catch (e) { /* 没 hook 也无所谓 */ }
    try { await run("rm -f " + LOG); } catch (e) { /* 没日志也无所谓 */ }
    await run('"""' + SAMPLE + '""" | /> ' + DOC + ":: -pj r");
    setOuts({});
    setFlowOut(t.resetDone);
  };

  const runFlow = async () => {
    setFlowBusy(true);
    const lines = [];
    const step = async (label, cmd, wait) => {
      try {
        const r = await run(cmd);
        lines.push(label + " → " + String(r == null ? "" : r).trim().slice(0, 120));
      } catch (e) {
        lines.push(label + " → ERR " + String((e && e.message) || e).slice(0, 80));
      }
      if (wait) await new Promise((ok) => setTimeout(ok, wait));
    };
    await resetSandbox();
    await step("①", "mk -f " + LOG, 0);
    await step("②", STEPS[1].cmd, 0);
    await step("③", STEPS[2].cmd, 0);
    await new Promise((ok) => setTimeout(ok, 700));
    await step("④", "$ " + LOG, 0);
    await step("⑥", STEPS[5].cmd, 0);
    await resetSandbox();
    setFlowOut(lines.join(NL));
    setFlowBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: "8px 0 2px", fontSize: 24, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-.02em", color: "var(--c-bone)" }}>{t.title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--c-bone)" }}>{t.sandbox} <code style={{ fontFamily: MONO, fontSize: 13 }}>{DOC}</code></span>
        <span style={{ fontSize: 13, color: "var(--c-slate)" }}>→ {LAB_DIR}/hook.md</span>
        <span style={{ fontSize: 13, color: "var(--c-slate)" }}>{t.log} <code style={{ fontFamily: MONO, fontSize: 13 }}>{LOG}</code></span>
      </div>
      <div style={C.hint}>
        {t.binding}
        {wt.err ? <span style={{ color: "#e6a23c" }}>（{t.fallback}：{String(wt.err).slice(0, 80)}）</span> : null}
      </div>
      <div style={C.hint}>{t.note}</div>
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 12 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={C.btn} onClick={runFlow} disabled={flowBusy}>{flowBusy ? t.running : "▶ " + t.flow}</button>
          <button type="button" style={C.btn} onClick={() => { resetSandbox().catch(() => null); }} disabled={flowBusy}>{t.reset}</button>
        </div>
        {STEPS.map((s) => (
          <div key={s.cmd} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--c-slate)" }}>{en ? s.en : s.zh}</span>
            <div style={Object.assign({}, C.code, C.bar)}>
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>{s.cmd}</span>
              <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, buses[s.cmd] ? { opacity: .4, cursor: "default" } : null)} onClick={() => runStep(s.cmd)} disabled={!!buses[s.cmd]}>{buses[s.cmd] ? "…" : "▶"}</button>
            </div>
            {outs[s.cmd] ? <pre style={C.out}>{outs[s.cmd]}</pre> : null}
          </div>
        ))}
        {flowOut ? <pre style={C.out}>{flowOut}</pre> : null}
      </div>
    </div>
  );
});
```
