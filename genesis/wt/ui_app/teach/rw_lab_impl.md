# RW_LAB_IMPL

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { useEffect, useState } from "react";

const NL = String.fromCharCode(10);
// 读写实验台 = bfork `lab`（/home 绑定主 wt 的 /ui_app/teach/_lab）
const LAB_WT = "lab";
const LAB_RULE = "/ui_app/teach/_lab";
const LAB_DIR = "/ui_app/teach/_lab";
const DOC = "/home/rw.md";
const UID_RE = /uid:\s*([A-Za-z0-9_-]+)/;

const GROUPS = [
  {
    zh: "类型演示", en: "Type demos",
    rows: [
      { zh: "标题 → 取所有 h1 的 tag", en: "headings → tag of all h1", cmd: "$ /home/rw.md::..*[h1] -pj tag" },
      { zh: "引用 → 取引用原文（含 > 前缀）", en: "blockquote → raw (with the > prefix)", cmd: "$ /home/rw.md::..*[bq] -pj raw" },
      { zh: "有序列表 → 取列表原文", en: "ordered list → raw", cmd: "$ /home/rw.md::..*[ol] -pj raw" },
      { zh: "注释 → 取注释原文", en: "comment → raw", cmd: "$ /home/rw.md::..*[comment] -pj raw" },
      { zh: "段落 → 取段落 content", en: "paragraph → content", cmd: "$ /home/rw.md::说明.*[p] -pj ct" },
      { zh: "bullet → 取 bullet 原文", en: "bullet → raw", cmd: "$ /home/rw.md::..*[blt] -pj raw" },
      { zh: "代码块 → 取代码语言（tag）", en: "code block → tag (language)", cmd: "$ /home/rw.md::..*[codeblock] -pj tag" },
      { zh: "有序列表全写 → 取原文", en: "ordered list full form → raw", cmd: "$ /home/rw.md::..*[orderlist] -pj raw" },
      { zh: "表格 → 取单元格文本（content）", en: "table → cell text (content)", cmd: "$ /home/rw.md::..*[table] -pj ct" },
    ],
  },
  {
    zh: "同样 tag，不同 mark", en: "Same tag, different mark",
    rows: [
      { zh: "全取 raw → 三行都在（raw 不去重）", en: "all raw → three lines (no dedup)", cmd: '$ /home/rw.md::标记.*[b.tag=="同样tag"] -pj raw' },
      { zh: "只取 mark → 得到 - + *", en: "mark only → - + *", cmd: '$ /home/rw.md::标记.*[b.tag=="同样tag"] -pj m' },
      { zh: "按 mark 过滤 → 只留 + 行", en: "filter by mark → + line only", cmd: '$ /home/rw.md::标记.*[b.tag=="同样tag" && b.m=="+"] -pj raw' },
      { zh: "只取 tag → 去重后只剩 同样tag", en: "tag only → dedup to 同样tag", cmd: '$ /home/rw.md::标记.*[b.tag=="同样tag"] -pj tag' },
      { zh: "取 content → 三个值仍不同", en: "content → three values still differ", cmd: '$ /home/rw.md::标记.*[b.tag=="同样tag"] -pj ct' },
    ],
  },
  {
    zh: "路径类型标记 _nt", en: "Path type marker (_nt)",
    rows: [
      { zh: "项目下的直接标题 → 只取 h 类型", en: "direct headings under 项目 → h only", cmd: "$ /home/rw.md::项目._h -pj tag" },
      { zh: "项目下递归 bullet → 只取 b 类型", en: "recursive bullets under 项目 → b only", cmd: "$ /home/rw.md::项目.._b -pj raw" },
      { zh: "递归 bullet 中 tag=端口 → 直接取值", en: "tag=端口 among recursive bullets → value", cmd: "$ /home/rw.md::项目.._b:端口" },
      { zh: "递归 code → 只取 c 类型", en: "recursive code → c only", cmd: "$ /home/rw.md::..*_c -pj tag" },
    ],
  },
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
    title: "读写实验台",
    binding: "在 bfork `lab` 里运行：安全沙箱",
    sandbox: "沙箱文档",
    run: "运行", running: "运行中…", runAll: "全部运行",
    fallback: "lab wt 不可用 ⇒ 回退到主 wt 的 /ui_app/teach/_lab",
  },
  en: {
    title: "Read-write lab",
    binding: "runs in bfork `lab`: safe sandbox",
    sandbox: "sandbox doc",
    run: "Run", running: "Running…", runAll: "Run all",
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

export default observer(function ReadWriteLab({ node }) {
  const env = getEnv(node);
  const en = (typeof globalThis !== "undefined" && globalThis.__teachLang === "en");
  const t = en ? T.en : T.zh;
  const [wt, setWt] = useState({ uid: null, err: "" });
  const [outs, setOuts] = useState({});
  const [buses, setBuses] = useState({});
  const [allBusy, setAllBusy] = useState(false);

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
    for (const g of GROUPS) {
      for (const r of g.rows) {
        const key = r.cmd;
        try { next[key] = String(await run(r.cmd)); }
        catch (e) { next[key] = "ERR " + String((e && e.message) || e); }
      }
    }
    setOuts(next);
    setAllBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: "8px 0 2px", fontSize: 24, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-.02em", color: "var(--c-bone)" }}>{t.title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--c-bone)" }}>{t.sandbox} <code style={{ fontFamily: MONO, fontSize: 13 }}>{DOC}</code></span>
        <span style={{ fontSize: 13, color: "var(--c-slate)" }}>→ {LAB_DIR}/rw.md</span>
      </div>
      <div style={C.hint}>
        {t.binding}
        {wt.err ? <span style={{ color: "#e6a23c" }}>（{t.fallback}：{String(wt.err).slice(0, 80)}）</span> : null}
      </div>
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 12 })}>
        {GROUPS.map((g, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: gi ? "1px solid var(--ui-demo-bd)" : "none", paddingTop: gi ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-bone)" }}>{en ? g.en : g.zh}</div>
              {gi === 0 ? <button type="button" style={C.btn} onClick={runAll} disabled={allBusy}>{allBusy ? t.running : t.runAll}</button> : null}
            </div>
            {g.rows.map((r) => {
              const key = r.cmd;
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--c-slate)" }}>{en ? r.en : r.zh}</span>
                  <div style={Object.assign({}, C.code, C.bar)}>
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>{key}</span>
                    <button type="button" title={t.run} aria-label={t.run} style={Object.assign({}, C.iconBtn, buses[key] ? { opacity: .4, cursor: "default" } : null)} onClick={() => runOne(key, key)} disabled={!!buses[key]}>{buses[key] ? "…" : "▶"}</button>
                  </div>
                  {outs[key] ? <pre style={C.out}>{outs[key]}</pre> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
```
