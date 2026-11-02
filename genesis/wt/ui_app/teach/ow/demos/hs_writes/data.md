# OW_WR_DATA

## 实现

```jsx@node
/** hs-writes（最新 57.8K 版）：文件、序列、英文标签、配色与布局参数照原页搬。
 *  新增的 hook 两步（挂 hook / 改键名）也在 STEPS 里。 */

export const INITIAL = [
  "# Notes",
  "A document is a tree of blocks; every block is a node,",
  "and a node has faces.",
  "## List",
  "- status: active",
  "- owner: asigen",
  "### Steps",
  "1. first step",
  "## Quote",
  "> Read is not write.",
  "> > Nested quote stays inside.",
  "## Code",
  "```python",
  "import mdio",
  "```",
  "## Table",
  "| key | value |",
  "| --- | --- |",
  "| mode | live |",
  "<!-- internal note -->",
];

export const STEPS = [
  { bar: "取 h1 标题", kind: "read", selector: "Notes", pj: "tag", face: "tag", hl: [{ line: 1, start: 2, end: 7 }] },
  { bar: "取整节正文", kind: "read", selector: "Notes", pj: "content", face: "content", hl: [{ line: 2, to: 20 }] },
  { bar: "取 p 文本", kind: "read", selector: "Notes._p", pj: "content", face: "content", hl: [{ line: 2, to: 3 }] },
  { bar: "取 blt 键名", kind: "read", selector: "Notes.List._b", pj: "tag", face: "tag", hl: [{ line: 5, start: 2, end: 8 }, { line: 6, start: 2, end: 7 }] },
  { bar: "挂 hook", kind: "hook", cb: "$ Notes.Quote._bq._bq -pj content", ghostCb: "$ Notes.Quote._bq._bq -pj content", target: "notes.md::Notes.List:owner", face: "tag", hl: [], targetHl: { line: 6, start: 2, end: 8 } },
  { bar: "改键名", kind: "write", selector: 'Notes.List.*[b.t=="owner"]', pj: "t", face: "tag", payload: "author", op: "/>", edit: { kind: "replace", line: 6, text: "- author: asigen", cols: [2, 7] }, hookFire: true, hookHl: { line: 11, start: 4, end: 30 }, hl: [{ line: 6, start: 2, end: 8 }] },
  { bar: "改值", kind: "write", selector: 'Notes.List.*[b.t=="author"]', pj: "ct", face: "content", payload: "alison", op: "/>", edit: { kind: "replace", line: 6, text: "- author: alison", cols: [10, 16] }, hl: [{ line: 6, start: 10, end: 16 }] },
  { bar: "删owner", kind: "write", selector: 'Notes.List.*[b.t=="author"]', pj: null, face: "raw", payload: null, op: "->", edit: { kind: "delete", line: 6 }, hl: [] },
  { bar: "加回行", kind: "write", selector: 'Notes.List.*[b.t=="status"]', pj: "r", face: "raw", payload: "- owner: asigen", op: "+>", edit: { kind: "insert", line: 6, text: "- owner: asigen" }, hl: [{ line: 6, start: 0, end: 15 }] },
  { bar: "取 tb 原文", kind: "read", selector: 'Notes._h2[.tag="Table"]._tb', pj: "raw", face: "raw", hl: [{ line: 17, to: 19 }] },
  { bar: "取 ol 项文本", kind: "read", selector: "Notes.List.Steps._ol", pj: "content", face: "content", hl: [{ line: 8, start: 3, end: 13 }] },
  { bar: "取 bq 正文", kind: "read", selector: "Notes.Quote._bq", pj: "content", face: "content", hl: [{ line: 10, start: 2, to: 11 }] },
  { bar: "取 code 语言", kind: "read", selector: "Notes.Code._c", pj: "tag", face: "tag", hl: [{ line: 13, start: 3, end: 9 }] },
  { bar: "取 python 内容", kind: "read", selector: "Notes.Code._c:python", pj: "content", face: "content", hl: [{ line: 14, start: 0, end: 11 }] },
  { bar: "取前两个 h2", kind: "read", selector: "Notes._h2[0:2]", pj: "tag", face: "tag", hl: [{ line: 4, start: 3, end: 7 }, { line: 9, start: 3, end: 8 }] },
  { bar: "递归取 h2 标题", kind: "read", selector: "..*.[h2]", pj: "tag", face: "tag", hl: [4, 9, 12, 16].map((line) => ({ line, start: 3, end: line === 9 || line === 16 ? 8 : 7 })) },
  { bar: "正则筛 h2", kind: "read", selector: '..*.[h2.tag.re("^[^e]*$")]', pj: "tag", face: "tag", hl: [{ line: 4, start: 3, end: 7 }] },
];

export const BAR_EN = {
  "取 h1 标题": "Get h1 title",
  "取整节正文": "Get section body",
  "取 p 文本": "Get paragraph",
  "取 blt 键名": "Get bullet keys",
  "挂 hook": "Attach hook",
  "改键名": "Rename key",
  "改值": "Change value",
  "删owner": "Delete owner",
  "加回行": "Add it back",
  "取 tb 原文": "Get table raw",
  "取 ol 项文本": "Get list items",
  "取 bq 正文": "Get quote text",
  "取 code 语言": "Get code language",
  "取 python 内容": "Get Python body",
  "取前两个 h2": "Get first two h2",
  "递归取 h2 标题": "Recursive h2 titles",
  "正则筛 h2": "Filter h2 by regex",
};

export const CONFIG = {
  sequence: { dwellMs: 1000, lang: "en" },
  transition: { durationMs: 750, animateUntil: 0.85 },
  palette: {
    face: { raw: "#93c5fd", container: "#67e8f9", mark: "#fbbf24", tag: "#c4b5fd", content: "#34d399" },
    cmd: { payload: "#e8eef7", bar: "rgba(203,213,225,.5)", op: "#fbbf24", path: "#e8eef7", prompt: "rgba(52,211,153,.85)" },
    reel: { centre: "#ffffff", rest: "#c3ccd8", hover: "#eef3f9" },
    wash: 0.14,
    frame: { edge: 0.55, corner: 0.9 },
  },
  editor: {
    maxFontSize: 20,
    minFontSize: 10,
    lineGap: 1.5,
    tabHeight: 26,
    contentPadX: 30,
    contentPadY: 18,
    gutterPad: 18,
    textInset: 24,
    surface: "rgba(255,255,255,0.03)",
    gutterTint: "rgba(255,255,255,0.016)",
    border: "rgba(255,255,255,.045)",
    tabRule: "rgba(255,255,255,.055)",
    tabText: "rgba(203,213,225,.62)",
    tabDot: "rgba(52,211,153,.8)",
    text: "rgba(232,238,247,0.92)",
    number: "rgba(148,163,184,0.36)",
    rule: "rgba(255,255,255,0.075)",
  },
};

export const LIGHT = {
  face: { raw: "#475569", container: "#0e7490", mark: "#b45309", tag: "#6d28d9", content: "#047857" },
  cmd: { payload: "#15181d", bar: "rgba(15,23,42,.35)", op: "#b45309", path: "#15181d", prompt: "rgba(14,116,144,.85)" },
  reel: { centre: "#0f1218", rest: "#5b6675", hover: "#14171c" },
  wash: 0.18,
  frame: { edge: 0.5, corner: 0.9 },
  editor: {
    surface: "rgba(15,23,42,0.03)",
    gutterTint: "rgba(15,23,42,0.02)",
    border: "rgba(15,23,42,0.10)",
    tabRule: "rgba(15,23,42,0.08)",
    tabText: "rgba(71,85,105,.72)",
    tabDot: "#0e7490",
    text: "#15181d",
    number: "rgba(100,116,139,0.5)",
    rule: "rgba(15,23,42,0.10)",
  },
};

export const HOOK_CB = { kind: "read", selector: "Notes.Quote._bq._bq", pj: "content", face: "content" };

/** 轮盘标签：zh 用 STEPS.bar，en 查 BAR_EN（lang 由 options 覆盖 CONFIG.sequence.lang）。 */
export function labelOf(step) {
  return (CONFIG.sequence.lang === "en" && BAR_EN[step.bar]) || step.bar;
}

/** 每一步停下时的文件状态：读步沿用上一版，写步在上一版上动一处。 */
export function applyEdit(lines, edit) {
  const next = lines.slice();
  if (edit.kind === "replace") next[edit.line - 1] = edit.text;
  else if (edit.kind === "insert") next.splice(edit.line - 1, 0, edit.text);
  else if (edit.kind === "delete") next.splice(edit.line - 1, 1);
  if (edit.append) next.push(edit.append);
  return next;
}

export function buildDocs() {
  const docs = [INITIAL];
  for (const step of STEPS) {
    docs.push(step.kind === "write" ? applyEdit(docs[docs.length - 1], step.edit) : docs[docs.length - 1]);
  }
  return docs;
}

export const LABELS = { zh: {}, en: BAR_EN };
```
