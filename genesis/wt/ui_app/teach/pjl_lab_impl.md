# PJL_LAB_IMPL

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { useEffect, useState } from "react";

const NL = String.fromCharCode(10);
// 实验台 = bfork worktree（绑定主 wt 的实验目录）：
//   lab 的 /home → 主 wt /ui_app/teach/_lab（bind），所以主 wt 里看到的就是实验结果。
const LAB_WT = "lab";
const LAB_RULE = "/ui_app/teach/_lab";
const LAB_DIR = "/ui_app/teach/_lab";
const DOC = "/home/pjl.md";
const SEL = DOC + '::项目.配置.*[b.t=="端口"]';
const UID_RE = /uid:\s*([A-Za-z0-9_-]+)/;
const SAMPLE = [
  "# 项目", "",
  "这是投影实验用的示例文档：各种 block 节点都在这里，free playground 可以随便查。", "",
  "## 配置", "",
  "- 端口: 8080", "- 名称: demo", "- 开关: on", "  - 超时: 30s", "  - 重试: 3", "",
  "> 备注: 本地配置优先", "",
  "1. 启动: 先读配置", "2. 校验: 再看类型", "",
  "| 键 | 值 |", "| --- | --- |", "| 端口 | 8080 |", "| 名称 | demo |", "",
  "```python", "PORT = 8080", 'NAME = "demo"', "```", "",
  "<!-- 内部备注：不要发布 -->", "",
  "### 任务", "",
  "- 待办: 写文档", "- 已完成: 读文档", "- 进行中: 调样式", "",
  "> 记录一: 第一版", "> 记录二: 第二版", "",
  "## 日志", "",
  "- LAST: none", "- COUNT: 0", ""
].join(NL);
const FACES = [
  { code: "raw", label: "raw" },
  { code: "ct",  label: "content" },
  { code: "ctn", label: "container" },
  { code: "m",   label: "mark" },
  { code: "tag", label: "tag" },
];

// 选择器示例：每条都在 lab wt 上真跑（跟五面同一套地址语法）
const EXAMPLES = [
  { zh: "整篇文档", en: "whole doc", cmd: "$ /home/pjl.md" },
  { zh: "按标题选节", en: "section by heading", cmd: "$ /home/pjl.md::项目.配置 -pj tag" },
  { zh: "取整节内容", en: "whole section content", cmd: "$ /home/pjl.md::项目.配置" },
  { zh: "按 tag 选块（五面之一）", en: "block by tag (one face)", cmd: '$ /home/pjl.md::项目.配置.*[b.t=="端口"] -pj ct' },
  { zh: "同一块的 tag 面", en: "same block, tag face", cmd: '$ /home/pjl.md::项目.配置.*[b.t=="端口"] -pj tag' },
  { zh: "嵌套子项", en: "nested child", cmd: '$ /home/pjl.md::项目.配置.开关.*[b.t=="超时"] -pj ct' },
  { zh: "取 blockquote", en: "blockquote", cmd: "$ /home/pjl.md::项目.配置.*[bq] -pj raw" },
  { zh: "取有序列表", en: "ordered list", cmd: "$ /home/pjl.md::项目.配置.*[ol] -pj raw" },
  { zh: "取表格", en: "table", cmd: "$ /home/pjl.md::项目.配置.*[tb] -pj raw" },
  { zh: "取代码块", en: "code block", cmd: "$ /home/pjl.md::项目.配置.*[code] -pj raw" },
  { zh: "取注释", en: "comment", cmd: "$ /home/pjl.md::..*[comment] -pj raw" },
  { zh: "序号切片 [0:2]", en: "slice [0:2]", cmd: "$ /home/pjl.md::项目.配置.*[bl][0:2] -pj ct" },
  { zh: "正则过滤 tag", en: "regex on tag", cmd: '$ /home/pjl.md::项目.配置.*[b.t.re("^(端|名)")] -pj ct' },
  { zh: "接管道 test", en: "pipeline test", cmd: '$ /home/pjl.md::项目.配置.*[b.t=="端口"] -pj ct | test -gt 5000' },
];

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const C = {
  card: { border: "1px solid var(--ui-demo-bd)", background: "var(--ui-demo-bg)", borderRadius: 14, padding: "16px 18px" },
  label: { fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-slate)" },
  code: { fontSize: 12.5, lineHeight: 1.6, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  btn: { appearance: "none", border: "1px solid var(--ui-demo-bd)", background: "transparent", color: "var(--c-bone)", fontFamily: MONO, fontSize: 12, borderRadius: 9, padding: "5px 12px", cursor: "pointer", flex: "0 0 auto" },
  iconBtn: { appearance: "none", border: 0, background: "transparent", color: "var(--c-bone)", cursor: "pointer", flex: "0 0 auto", width: 24, height: 24, display: "inline-grid", placeItems: "center", borderRadius: 7, fontSize: 11, lineHeight: 1, padding: 0, opacity: .8 },
  bar: { display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 4px 10px" },
  out: { margin: 0, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--c-ash)", background: "rgba(127,127,127,.08)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "8px 12px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 180, overflow: "auto" },
  input: { flex: "1 1 auto", minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "7px 11px", outline: "none" },
  hint: { fontSize: 12, lineHeight: 1.7, color: "var(--c-slate)" },
};

const T = {
  zh: {
    title: "投影实验台",
    binding: "在 bfork `lab` 里运行：安全沙箱",
    docLabel: "沙箱文档",
    others: "同一实验目录还有（后面页面复用）：",
    desc: {
      raw: "整块原文，包含 `- 端口: ` 前缀",
      ct: "只取值",
      ctn: "保留 mark + tag",
      m: "只取结构符号",
      tag: "只取键名",
    },
    run: "运行", running: "运行中…", free: "自由实验",
    exTitle: "选择器示例（点运行 = 实际执行）", runAll: "全部运行", runningAll: "运行中…",
    placeholder: "输入选择器或管道（在 lab wt 里跑）…",
    reset: "重置沙箱", resetDone: "沙箱已重置（覆盖 pjl.md）",
    whole: "读整节",
    loading: "（读取沙箱文档中…）",
    fallback: "lab wt 不可用 ⇒ 回退到主 wt 的 /ui_app/teach/_lab",
  },
  en: {
    title: "Projection lab",
    binding: "runs in bfork `lab`: safe sandbox",
    docLabel: "sandbox doc",
    others: "also in the same lab dir (reused by later pages):",
    desc: {
      raw: "whole block text, including the `- port: ` prefix",
      ct: "value only",
      ctn: "keep mark + tag",
      m: "structural symbols only",
      tag: "identifier only",
    },
    run: "Run", running: "Running…", free: "Free playground",
    exTitle: "Selector examples (Run = real exec)", runAll: "Run all", runningAll: "Running…",
    placeholder: "type a selector or pipeline (runs in the lab wt)…",
    reset: "Reset sandbox", resetDone: "sandbox reset (overwrote pjl.md)",
    whole: "whole section",
    loading: "(reading sandbox doc…)",
    fallback: "lab wt unavailable ⇒ falling back to the main wt /ui_app/teach/_lab",
  },
};

/** 确保 bfork `lab` 存在，返回它的 uid（lab 命令用 wt_uid 定向）。
 *  建 bfork 会把 gateway 的 current wt 临时切过去，建完立刻切回 genesis。 */
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

export default observer(function ProjectionLab({ node }) {
  const env = getEnv(node);
  const en = (typeof globalThis !== "undefined" && globalThis.__teachLang === "en");
  const t = en ? T.en : T.zh;
  const [wt, setWt] = useState({ uid: null, err: "" });
  const [outs, setOuts] = useState({});
  const [buses, setBuses] = useState({});
  const [q, setQ] = useState("$ " + SEL + " -pj raw");
  const [qOut, setQOut] = useState("");
  const [qBusy, setQBusy] = useState(false);
  const [src, setSrc] = useState("");

  // 读沙箱文档全文（页内预览用；绑定后就是主 wt 那篇）
  const readDoc = async (uid) => {
    try {
      const res = uid ? await env.client.exec("$ " + DOC, { wt_uid: uid }) : await env.exec("$ " + LAB_DIR + "/pjl.md");
      return String(res == null ? "" : res);
    } catch (e) { return ""; }
  };

  useEffect(() => {
    let alive = true;
    ensureLabWt(env).then((uid) => {
      if (!alive) return;
      setWt({ uid: uid, err: "" });
      readDoc(uid).then((s) => { if (alive) setSrc(s); });
    }).catch((e) => { if (alive) setWt({ uid: null, err: String((e && e.message) || e) }); });
    return () => { alive = false; };
  }, []);

  // 所有实验命令都发到 lab wt；lab wt 不可用时回退主 wt（路径 /home/ → /ui_app/teach/_lab/）
  const run = async (code) => {
    if (wt.uid) return env.client.exec(code, { wt_uid: wt.uid });
    return env.exec(String(code).split("/home/").join(LAB_DIR + "/"));
  };

  const runFace = async (code) => {
    setBuses((b) => Object.assign({}, b, { [code]: true }));
    try {
      const res = await run("$ " + SEL + " -pj " + code);
      setOuts((o) => Object.assign({}, o, { [code]: String(res == null ? "" : res) }));
    } catch (e) {
      setOuts((o) => Object.assign({}, o, { [code]: "ERR " + String((e && e.message) || e) }));
    }
    setBuses((b) => Object.assign({}, b, { [code]: false }));
  };
  // 选择器示例：逐条真跑
  const [exOuts, setExOuts] = useState({});
  const [exBusy, setExBusy] = useState({});
  const [allBusy, setAllBusy] = useState(false);
  const runEx = async (i) => {
    setExBusy((b) => Object.assign({}, b, { [i]: true }));
    try {
      const res = await run(EXAMPLES[i].cmd);
      setExOuts((o) => Object.assign({}, o, { [i]: String(res == null ? "" : res) }));
    } catch (e) {
      setExOuts((o) => Object.assign({}, o, { [i]: "ERR " + String((e && e.message) || e) }));
    }
    setExBusy((b) => Object.assign({}, b, { [i]: false }));
  };
  const runAll = async () => {
    setAllBusy(true);
    const next = {};
    for (let i = 0; i < EXAMPLES.length; i++) {
      try { next[i] = String(await run(EXAMPLES[i].cmd)); }
      catch (e) { next[i] = "ERR " + String((e && e.message) || e); }
    }
    setExOuts(next);
    setAllBusy(false);
  };
  const runQ = async () => {
    if (!q.trim()) return;
    setQBusy(true);
    try {
      const res = await run(q);
      setQOut(String(res == null ? "" : res));
    } catch (e) {
      setQOut("ERR " + String((e && e.message) || e));
    }
    setQBusy(false);
  };
  // 重置 = 覆盖（pjl.md 不存在时先 mk -f 新建）
  const reset = async () => {
    setQBusy(true);
    let msg = "";
    try {
      let out = String(await run('"""' + SAMPLE + '"""' + " | /> " + DOC + ":: -pj r"));
      if (out.indexOf("mdio_error") >= 0) {
        await run('mk -f "' + DOC + '"');
        out = String(await run('"""' + SAMPLE + '"""' + " | /> " + DOC + ":: -pj r"));
      }
      msg = out.indexOf("mdio_error") >= 0 ? out : t.resetDone;
      setOuts({});
      const s = await readDoc(wt.uid);
      setSrc(s);
    } catch (e) {
      msg = "ERR " + String((e && e.message) || e);
    }
    setQOut(msg);
    setQBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: "8px 0 2px", fontSize: 24, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-.02em", color: "var(--c-bone)" }}>{t.title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--c-bone)" }}>{t.docLabel} <code style={{ fontFamily: MONO, fontSize: 13 }}>{DOC}</code></span>
        <span style={{ fontSize: 13, color: "var(--c-slate)" }}>→ {LAB_DIR}/pjl.md</span>
      </div>
      <div style={C.hint}>
        {t.binding}
        {wt.err ? <span style={{ color: "#e6a23c" }}>（{t.fallback}：{String(wt.err).slice(0, 80)}）</span> : null}
      </div>
      <pre style={Object.assign({}, C.code, { margin: 0, maxHeight: 300, overflow: "auto", whiteSpace: "pre-wrap" })}>{src || (t.loading)}</pre>
      <div style={C.hint}>{t.others} <code style={{ fontFamily: MONO, fontSize: 12 }}>{LAB_DIR}/select.md</code> · <code style={{ fontFamily: MONO, fontSize: 12 }}>{LAB_DIR}/pipe.md</code></div>
      {FACES.map((f) => (
        <div key={f.code} style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 8 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={Object.assign({}, C.label, { color: "var(--c-bone)", fontSize: 13, textTransform: "none", letterSpacing: 0 })}>{f.label}</span>
            <span style={{ fontSize: 12.5, color: "var(--c-slate)" }}>{t.desc[f.code]}</span>
          </div>
          <div style={Object.assign({}, C.code, C.bar)}>
            <span style={{ flex: "1 1 auto", minWidth: 0 }}>{"$ " + SEL + " -pj " + f.code}</span>
            <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, buses[f.code] ? { opacity: .4, cursor: "default" } : null)} onClick={() => runFace(f.code)} disabled={!!buses[f.code]}>{buses[f.code] ? "…" : "▶"}</button>
          </div>
          {outs[f.code] ? <pre style={C.out}>{outs[f.code]}</pre> : null}
        </div>
      ))}
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 10 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-bone)" }}>{t.exTitle}</div>
          <button type="button" style={C.btn} onClick={runAll} disabled={allBusy}>{allBusy ? t.runningAll : t.runAll}</button>
        </div>
        {EXAMPLES.map((ex, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: i ? "1px solid var(--ui-demo-bd)" : "none", paddingTop: i ? 10 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: "var(--c-slate)" }}>{en ? ex.en : ex.zh}</span>
              <div style={Object.assign({}, C.code, C.bar)}>
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>{ex.cmd}</span>
                <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, exBusy[i] ? { opacity: .4, cursor: "default" } : null)} onClick={() => runEx(i)} disabled={!!exBusy[i]}>{exBusy[i] ? "…" : "▶"}</button>
              </div>
            </div>
            {exOuts[i] ? <pre style={C.out}>{exOuts[i]}</pre> : null}
          </div>
        ))}
      </div>
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 10 })}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-bone)" }}>{t.free}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={Object.assign({}, C.code, C.bar, { flex: "1 1 460px", minWidth: 0 })}>
            <input style={{ flex: "1 1 auto", minWidth: 0, background: "transparent", border: 0, outline: "none", color: "var(--c-bone)", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, padding: 0 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runQ(); }} placeholder={t.placeholder} />
            <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, qBusy ? { opacity: .4, cursor: "default" } : null)} onClick={runQ} disabled={qBusy}>{qBusy ? "…" : "▶"}</button>
          </div>
          <button type="button" style={C.btn} onClick={reset} disabled={qBusy}>{t.reset}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FACES.map((f) => (
            <button key={f.code} type="button" style={C.btn} onClick={() => setQ("$ " + SEL + " -pj " + f.code)}>{f.code}</button>
          ))}
          <button type="button" style={C.btn} onClick={() => setQ("$ " + DOC + "::项目.配置")}>{t.whole}</button>
        </div>
        {qOut ? <pre style={C.out}>{qOut}</pre> : null}
      </div>
    </div>
  );
});
```
