# OW_ARROW_DATA

## 实现

```jsx@node
/** hs-arrow：SQL 文本、嵌套树/结果、BM25 三档、STATS/RESULT/PIVOT、BEATS 节拍与 QUERIES。
 *  全部照原页逐字搬；引擎只读这里。 */

export const SQL1 = `with doc as (
  select path from docs
  where name like 'demo_arrow_%'
),
stats as (
  select b.path, s.heading, s.header_node as node,
         count(*) as n
  from blocks b
  join sections s on s.path = b.path
   and s.section = b.section
  join doc on doc.path = b.path
  where b.node <> s.header_node
  group by b.path, s.heading, s.header_node
),
ranked as (
  select path, node, n,
         row_number() over (
           partition by path
           order by n desc, heading) as rn
  from stats
)
select path, node from ranked
where rn = 1 order by path limit 5`;

export const SQL2 = `with doc as (
  select path from docs
  where name like 'demo_arrow_%'
),
faces as (
  select p.path, p.node,
         max(case when p.pj = 'mark'
           then p.value end) as mark,
         max(case when p.pj = 'tag'
           then p.value end) as tag,
         max(case when p.pj = 'content'
           then p.value end) as content
  from pj p
  join doc on doc.path = p.path
  group by p.path, p.node
)
select path, node from faces
where mark = '-' and tag = 'todo'
order by path, node`;

export const SQL3 = `with bq_code as (
  select b.path, b.node as bq, c.node as code, c.tag as code_tag
  from nodes b
  join descendants d on d.path = b.path and d.ancestor = b.node
  join nodes c on c.path = d.path and c.node = d.descendant
  where b.type = 'bq' and c.type = 'code'
),
code_heads as (
  select bc.path, bc.bq, bc.code, bc.code_tag,
         count(*) filter (where h.level = 1) as under_h1,
         count(*) filter (where h.level = 2) as under_h2,
         string_agg(h.tag, ' > ' order by d2.depth desc)
           filter (where h.type = 'head') as head_path
  from bq_code bc
  join descendants d2 on d2.path = bc.path and d2.descendant = bc.code
  join nodes h on h.path = d2.path and h.node = d2.ancestor and h.type = 'head'
  group by bc.path, bc.bq, bc.code, bc.code_tag
)
select path, code as node
from code_heads
where bq in (
  select bq from code_heads group by path, bq
  having count(distinct code_tag) >= 2
     and count(*) filter (where under_h1 > 0) > 0
     and count(*) filter (where under_h2 > 0) > 0
)
order by path, node`;

export const SQL4 = `-- Q: ranking only, no scope
select path, node, round(score,2) as score
from search.hits('connection pool')
order by score desc;

-- S: scope only, no ranking
select s.path, s.header_node as node
from sections s
where s.heading like '%Root cause%'
order by s.path;

-- H: rank inside the scope
with h as (select * from search.hits('connection pool'))
select s.path, s.header_node as node, round(max(h.score),2) as score
from sections s
join search.blocks b on b.path = s.path and b.section = s.section
join h on h.path = b.path and h.node = b.node
where s.heading like '%Root cause%'
group by s.path, s.section, s.header_node
order by score desc;`;

export const NEST_MD = `# h_out

- bq_in_blt:
  > # h_i1
  >
  > ~~~python
  > print("inside bq")
  > ~~~
  > ## h_i2
  > ~~~rust
  > fn main() {}
  > ~~~`;

export const NEST_ROWS = [
  { n: 2, depth: 0, type: "bq" },
  { n: 3, depth: 1, type: "head", level: 1, tag: "h_i1" },
  { n: 4, depth: 2, type: "code", tag: "python" },
  { n: 5, depth: 2, type: "head", level: 2, tag: "h_i2" },
  { n: 6, depth: 3, type: "code", tag: "rust" },
];

export const NEST_RESULTS = [
  { node: 4, lang: "python", code: 'print("inside bq")' },
  { node: 6, lang: "rust", code: "fn main() {}" },
];

export const BM25_DOCS = [
  { name: "incident_a.md", sections: [
    { n: 1, title: "Root cause", selS: true, selH: true, scoreH: "9.65", bullets: [
      { n: 2, key: "pool", text: "connection pool exhausted under load", q: true, selH: true, score: "9.65", rank: 1 },
    ] },
    { n: 4, title: "Action", bullets: [{ n: 5, key: "rollback", text: "redeploy previous build" }] },
  ] },
  { name: "incident_b.md", sections: [
    { n: 1, title: "Root cause", selS: true, bullets: [
      { n: 2, key: "config", text: "timeout value was too small" },
      { n: 3, key: "impact", text: "retries storm" },
    ] },
    { n: 4, title: "Action", bullets: [{ n: 5, key: "patch", text: "increase retry budget" }] },
  ] },
  { name: "guide_pool.md", sections: [
    { n: 1, title: "Sizing", bullets: [{ n: 2, key: "rule", text: "size pool to worker count", q: true, score: "8.68", rank: 3 }] },
    { n: 3, title: "Pitfalls", bullets: [{ n: 4, key: "leak", text: "unclosed conns exhaust pool", q: true, score: "9.14", rank: 2 }] },
  ] },
];

export const STATS = [
  { path: "demo_arrow_a_20261030", heading: "Todo", n: 3, rn: 1 },
  { path: "demo_arrow_a_20261030", heading: "Decision", n: 1, rn: 2 },
  { path: "demo_arrow_b_20261030", heading: "Plan", n: 2, rn: 1 },
  { path: "demo_arrow_b_20261030", heading: "Background", n: 1, rn: 2 },
  { path: "demo_arrow_c_20261030", heading: "Links", n: 2, rn: 1 },
  { path: "demo_arrow_d_20261030", heading: "Today", n: 3, rn: 1 },
  { path: "demo_arrow_d_20261030", heading: "Tomorrow", n: 1, rn: 2 },
  { path: "demo_arrow_e_20261030", heading: "Usage", n: 1, rn: 1 },
];

export const RESULT1 = [
  { doc: "demo_arrow_a_20261030.md", hd: "## Todo", body: "record demo / fix tag bug / light theme", n: 3 },
  { doc: "demo_arrow_b_20261030.md", hd: "## Plan", body: "hook first / then arrow", n: 2 },
  { doc: "demo_arrow_c_20261030.md", hd: "## Links", body: "Project A / Notes B", n: 2 },
  { doc: "demo_arrow_d_20261030.md", hd: "## Today", body: "fixed bug / re-recorded / wrote page", n: 3 },
  { doc: "demo_arrow_e_20261030.md", hd: "## Usage", body: "code block · python", n: 1 },
];

export const PIVOT = [
  { path: "demo_arrow_a_20261030.md", node: "2", mark: "-", tag: "todo", content: "record demo" },
  { path: "demo_arrow_a_20261030.md", node: "3", mark: "-", tag: "todo", content: "fix tag bug" },
  { path: "demo_arrow_a_20261030.md", node: "4", mark: "-", tag: "todo", content: "light theme" },
  { path: "demo_arrow_a_20261030.md", node: "6", mark: "-", tag: "decision", content: "light theme only" },
  { path: "demo_arrow_d_20261030.md", node: "2", mark: "-", tag: "todo", content: "fixed bug" },
  { path: "demo_arrow_d_20261030.md", node: "3", mark: "-", tag: "todo", content: "re-recorded" },
  { path: "demo_arrow_d_20261030.md", node: "4", mark: "-", tag: "todo", content: "wrote page" },
  { path: "demo_arrow_d_20261030.md", node: "6", mark: "-", tag: "plan", content: "ship" },
];

export const RESULT2 = [
  { doc: "demo_arrow_a_20261030.md", node: 2, hd: "todo:", body: "record demo" },
  { doc: "demo_arrow_a_20261030.md", node: 3, hd: "todo:", body: "fix tag bug" },
  { doc: "demo_arrow_a_20261030.md", node: 4, hd: "todo:", body: "light theme" },
  { doc: "demo_arrow_d_20261030.md", node: 2, hd: "todo:", body: "fixed bug" },
  { doc: "demo_arrow_d_20261030.md", node: 3, hd: "todo:", body: "re-recorded" },
  { doc: "demo_arrow_d_20261030.md", node: 4, hd: "todo:", body: "wrote page" },
];

export const BEATS = [
  { ms: 15600, state: { layer: "model", sql: 0, win: false, hl: [], hlc: "#34d399" } },
  { ms: 10500, steps: [
    { at: 0, layer: "nestMd", sql: 3, win: false, hl: [], hlc: "#34d399" },
    { at: 2500, layer: "nest", sql: 3, win: false, hl: [1, 2, 3, 4, 5, 6, 7], hlc: "#34d399" },
    { at: 5000, layer: "nest", sql: 3, win: false, hl: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], hlc: "#c4b5fd" },
    { at: 7500, layer: "nestResult", sql: 3, win: false, hl: [19, 20, 21, 22, 23, 24, 25, 26, 27], hlc: "#fbbf24" },
  ] },
  { ms: 7800, steps: [
    { at: 0, layer: "stats", sql: 1, win: false, hl: [5, 6, 7, 8, 9, 10, 11, 12, 13], hlc: "#34d399" },
    { at: 3000, layer: "stats", sql: 1, win: true, hl: [15, 16, 17, 18, 19, 20, 23], hlc: "#fbbf24" },
    { at: 5200, layer: "result", sql: 1, win: true, hl: [22, 23], hlc: "#34d399" },
  ] },
  { ms: 5800, steps: [
    { at: 0, layer: "pivot", sql: 2, win: false, hl: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hlc: "#c4b5fd" },
    { at: 3000, layer: "result2", sql: 2, win: false, hl: [17, 18, 19], hlc: "#c4b5fd" },
  ] },
  { ms: 9600, steps: [
    { at: 0, layer: "bm25", sql: 4, win: false, mode: "q", hl: [1, 2, 3, 4], hlc: "#fbbf24" },
    { at: 3000, layer: "bm25", sql: 4, win: false, mode: "s", hl: [6, 7, 8, 9, 10], hlc: "#34d399" },
    { at: 6000, layer: "bm25", sql: 4, win: false, mode: "h", hl: [12, 13, 14, 15, 16, 17, 18, 19], hlc: "#c4b5fd" },
  ] },
];

export const QUERIES = [
  { at: 5600, label: "按 mark 列", color: "#fbbf24", target: "nodes", rows: [1, 5], pjRows: [],
    html: '<span class="p">arrow -duckdb</span> "<span class="kw">select</span> node <span class="kw">from</span> nodes <span class="kw">where</span> mark = <span class="str">\'##\'</span>"' },
  { at: 8100, label: "按 tag 列", color: "#c4b5fd", target: "nodes", rows: [2, 3, 4], pjRows: [],
    html: '<span class="p">arrow -duckdb</span> "<span class="kw">select</span> node <span class="kw">from</span> nodes <span class="kw">where</span> tag = <span class="str">\'todo\'</span>"' },
  { at: 10600, label: "同一个结果 · 走 pj", color: "#c4b5fd", target: "pj", rows: [2, 3, 4], pjRows: [3],
    html: '<span class="p">arrow -duckdb</span> "<span class="kw">select</span> node <span class="kw">from</span> <span class="id">pj</span> <span class="kw">where</span> <span class="id">pj</span> = <span class="str">\'tag\'</span> <span class="kw">and</span> value = <span class="str">\'todo\'</span>"' },
  { at: 13100, label: "按关系 · edges", color: "#34d399", target: "nodes", rows: [2, 3, 4], pjRows: [],
    html: '<span class="p">arrow -duckdb</span> "<span class="kw">select</span> child <span class="kw">as</span> node <span class="kw">from</span> edges <span class="kw">where</span> parent = <span class="num">1</span>"' },
];

export const STEP_LABELS = {
  zh: { 1: ["MD 原文", "嵌套树", "descendants", "结果"], 2: ["结构查询", "window 排名", "结果"], 3: ["pj 透视", "结果"], 4: ["内容近似 Q", "结构近似 S", "合成 S⋈Q"] },
  en: { 1: ["raw md", "nested tree", "descendants", "result"], 2: ["structure", "window rank", "result"], 3: ["pj pivot", "result"], 4: ["content approx Q", "structure approx S", "hybrid S⋈Q"] },
};

export const QUERY_LABELS = {
  zh: ["按 mark 列", "按 tag 列", "同一个结果 · 走 pj", "按关系 · edges"],
  en: ["by mark", "by tag", "same result via pj", "by edges"],
};

export const Q_COLOR_MAP = { "#fbbf24": "#b45309", "#c4b5fd": "#6d28d9", "#34d399": "#047857" };

export function stepsOf(def) { return def.steps || [def.state]; }
```
