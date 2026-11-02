# FE

## title

- value: MDIO

## LEARN

- about: 关于MDIO · /ui_app/teach/about.zh.md
- projection: 投影 · /ui_app/teach/projection.zh.md
- readwrite: 读写 · /ui_app/teach/readwrite.zh.md
- hook: hook · /ui_app/teach/hook.zh.md
- pipe: 管道与扩展 · /ui_app/teach/pipe.zh.md
- arrow: arrow · /ui_app/teach/arrow.zh.md
- plugin: 插件 · /ui_app/teach/plugin.zh.md
- wt: 工作树与快照 · /ui_app/teach/wt.zh.md
- ui: UI · /ui_app/teach/antd.md

## LEARN_EN

- about: About MDIO · /ui_app/teach/about.en.md
- projection: Projection · /ui_app/teach/projection.en.md
- readwrite: Read & write · /ui_app/teach/readwrite.en.md
- hook: Hooks · /ui_app/teach/hook.en.md
- pipe: Pipeline & extensions · /ui_app/teach/pipe.en.md
- arrow: arrow · /ui_app/teach/arrow.en.md
- plugin: Plugins · /ui_app/teach/plugin.en.md
- wt: Worktrees and snapshots · /ui_app/teach/wt.en.md
- ui: UI · /ui_app/teach/antd.md

## EMPTY

- 说明: 还没有应用

## app

```jsx@app
import { createElement as h, useEffect, useRef, useState } from "react";
import { types, getEnv, flow } from "mobx-state-tree";
import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import { modCompOf } from "ui_core/uiMd";
// README `# app` 元数据的解析**只有一份**：mdio_ui/devview 的引擎 AST 解析器（wtList 的 aboutFromAst）。
// 首页不再自写 AST 遍历 —— 规则（字段、tag 语义、desc 引用块）改一处、两处同时生效。
import { aboutFromAst } from "ui_devview/devkit/wtList";

/** 教学页语言：默认 zh；可用 localStorage 记住上次选择；否则按浏览器语言判断（中文 → zh，其余 → en）。 */
const TEACH_LANG_KEY = "mdio-teach-lang";
const detectTeachLang = () => {
  try {
    const saved = localStorage.getItem(TEACH_LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch (e) { /* localStorage 不可用则忽略 */ }
  try {
    const nav = navigator && (navigator.language || (navigator.languages && navigator.languages[0]));
    if (nav) return /^zh/i.test(String(nav)) ? "zh" : "en";
  } catch (e) { /* navigator 不可用则按默认 */ }
  return "zh";
};

/** README desc 的正文：去掉「打开：?wt=<uid>」这类操作提示（可能和正文同段，按子串去）。 */
const cleanAppDesc = (s) => String(s || "").split("\n").map((x) => x.trim())
  .filter(Boolean)
  .map((x) => x.replace(/\s*(?:打开|Open)\s*[：:]\s*\S*\?wt=\S*\s*$/i, "").trim())
  .filter(Boolean)
  .join(" ");

export const Store = types
  .model("GenesisStore", {})
  .volatile(() => ({
    cardsBox: observable.box([], { deep: false }),
    langBox: observable.box(detectTeachLang(), { deep: false }),
  }))
  .views((self) => {
    const env = () => { try { return getEnv(self) || {}; } catch (e) { return {}; } };
    const main = () => { const e = env(); return typeof e.getMainRoot === "function" ? e.getMainRoot() : null; };
    const wtOf = () => { const r = main(); return (r && r.wts && r.wts.wt) || null; };
    const docOf = (p) => { const wt = wtOf(); const id = wt && wt.byPath ? wt.byPath[p] : undefined; return id != null && wt.by ? wt.by.get(String(id)) : null; };
    const asArr = (v) => (Array.isArray(v) ? v : v && typeof v.length === "number" ? Array.prototype.slice.call(v) : []);
    // 行内块深度摊平：run 数组 / p 包 run / cd 代码 都要吃（实测含「·」的富值就是 run 数组）
    const inlineText = (n) => {
      if (typeof n === "string") return n;
      if (Array.isArray(n) || (n && typeof n.length === "number")) { let s = ""; for (const c of asArr(n)) s += inlineText(c); return s; }
      if (n && typeof n === "object") {
        if (typeof n.ct === "string") return n.ct;
        if (n.ct != null) return inlineText(n.ct);
        if (typeof n.cd === "string") return n.cd;
        if (typeof n.t === "string") return n.t;
      }
      return "";
    };
    const textOfB = (b) => {
      if (!b) return "";
      const leaf = Array.isArray(b.ct) ? b.ct[0] : null;
      if (leaf) { const v = inlineText(leaf); if (v) return v; }
      if (typeof b.ct === "string") return b.ct;
      return inlineText(b.ct);
    };
    // 富标题摊平：t 可能是 run 数组（实测 worktrees.md 的 h2 标题就是）
    const flatT = (v) => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) || (v && typeof v.length === "number")) { let s = ""; for (const c of asArr(v)) s += flatT(c); return s; }
      if (v && typeof v === "object") { if (typeof v.ct === "string") return v.ct; if (typeof v.t === "string") return v.t; }
      return "";
    };
    const bulletsOf = (sec) => {
      const out = [];
      for (const k of asArr(sec && sec.ct)) {
        if (k && k.nt === "bl") { for (const b of asArr(k.ct)) if (b && b.nt === "b") out.push(b); }
        else if (k && k.nt === "b") out.push(b);
      }
      return out;
    };
    const kidsOf = (n) => asArr(n && n.kids ? n.kids : (n && n.ct));
    const blUnder = (n) => { const out = []; for (const k of kidsOf(n)) { if (k && k.nt === "bl") { for (const b of asArr(k.ct)) if (b && b.nt === "b") out.push(b); } else if (k && k.nt === "b") out.push(b); } return out; };
    // HS 树：文档根 kids=[h1]，各节（## title / ## TEACH …）是 h1 的孩子 ⇒ 节查询要下探一层
    const sectionOf = (doc, name) => {
      for (const k of kidsOf(doc)) {
        if (k && k.nt === "h") {
          if (flatT(k.t) === name) return k;
          for (const c of kidsOf(k)) if (c && c.nt === "h" && flatT(c.t) === name) return c;
        }
      }
      return null;
    };
    const firstValue = (sec) => { const bs = blUnder(sec); return bs.length ? String(textOfB(bs[0])).trim() : ""; };
    const parseList = (secName) => bulletsOf(sectionOf(docOf("/ui_app/fe.md"), secName)).map((b) => {
      const raw = String(textOfB(b)).trim();
      const i = raw.indexOf(" · ");
      const name = typeof b.t === "string" ? b.t : "";
      return { name: name, desc: i >= 0 ? raw.slice(0, i).trim() : raw, doc: i >= 0 ? raw.slice(i + 3).trim() : "", route: "/about/" + name };
    });
    const localizedList = (zhSec, enSec) => {
      const zh = parseList(zhSec);
      if (self.lang !== "en") return zh;
      const en = parseList(enSec);
      const byName = new Map(en.map((x) => [x.name, x]));
      return zh.map((x) => {
        const e = byName.get(x.name);
        return e ? Object.assign({}, x, { desc: e.desc || x.desc }) : x;
      });
    };
    return {
      get title() { const v = firstValue(sectionOf(docOf("/ui_app/fe.md"), "title")); return v || "MDIO"; },
      get lang() { return self.langBox.get(); },
      get teach() { return localizedList("TEACH", "TEACH_EN"); },
      get learn() { return localizedList("LEARN", "LEARN_EN"); },
      get teachAll() { return self.teach.concat(self.learn); },
      get emptyText() { return firstValue(sectionOf(docOf("/ui_app/fe.md"), "EMPTY")); },
      get registry() {
        const doc = docOf("/.mds/worktrees.md");
        const out = [];
        const h1 = kidsOf(doc).find((k) => k && k.nt === "h");
        for (const k of kidsOf(h1)) {
          if (k && k.nt === "h") {
            let uid = "";
            for (const b of blUnder(k)) if (b && b.t === "uid") uid = String(textOfB(b)).trim();
            if (uid) out.push({ name: flatT(k.t), uid: uid });
          }
        }
        return out;
      },
      get cards() { return self.cardsBox.get(); },
      hasMod(name) {
        const d = main() && main().decl;
        if (!d || typeof d.modOf !== "function") return false;
        const ns = d.modOf(name) && d.modOf(name).ns;
        return !!(ns && (typeof ns.default === "function" || typeof ns.Component === "function"));
      },
    };
  })
  .actions((self) => ({
    setLang(v) {
      self.langBox.set(v === "en" ? "en" : "zh");
      try { localStorage.setItem(TEACH_LANG_KEY, self.langBox.get()); } catch (e) { /* localStorage 不可用则只在内存生效 */ }
    },
    load: flow(function* () {
      const env = getEnv(self);
      // 需求登记：store 直读 wt.by，必须先 observe 让这些文档有 F 帧（exp_scripts 同款纪律）
      const wt = env.getMainRoot && env.getMainRoot() && env.getMainRoot().wts && env.getMainRoot().wts.wt;
      if (wt && typeof wt.observe === "function") {
        for (const p of ["/ui_app/fe.md", "/.mds/worktrees.md", "/ui_app/teach/antd_components.md", "/ui_app/teach/antd_dashboard.md", "/ui_app/teach/ui_theory.md", "/ui_app/teach/ui_demos.md", "/ui_app/teach/antd_components.en.md", "/ui_app/teach/antd_dashboard.en.md", "/ui_app/teach/ui_theory.en.md", "/ui_app/teach/ui_demos.en.md"]) { try { wt.observe(p); } catch (e) { /* 登记失败不挡画 */ } }
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 8000) { if (self.registry.length) break; yield new Promise((res) => setTimeout(res, 100)); }
      // 读每个 wt 的 README `# app`：**全部并发**，解析统一走 mdio_ui/devview 的 aboutFromAst。
      const cli = env.client;
      const readAst = async (uid) => {
        if (cli && typeof cli.readDocAst === "function") return cli.readDocAst(uid, "/README.md");
        // 旧打包 UI 的 client 没有 readDocAst：退回同一条 HTTP exec（仍是引擎解析，只是自己发请求）
        const res = await fetch("/exec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "$ /README.md | tojson", active_doc: "/", wt_uid: uid }) });
        const o = await res.json();
        return o && o.status === "ok" ? JSON.parse(String(o.result || "{}")) : null;
      };
      const loadCard = async (r) => {
        const card = { name: r.name, uid: r.uid, desc: "", icon: "", tags: [], version: "", author: "", repo: "" };
        try {
          const ast = await readAst(r.uid).catch(() => null);
          const a = aboutFromAst(ast);
          if (a.tags.indexOf("app") < 0) return null;          // 只有 README 标了 tag: app 的树进首页
          if (a.tags.indexOf("devview") >= 0) return null;     // devview 部件（log/monaco/console 等）只当槽位，不进首页
          if (a.name || a.descTitle) card.name = a.descTitle || a.name;
          if (a.icon) card.icon = a.icon;
          if (a.descText) card.desc = cleanAppDesc(a.descText);
          if (a.tags.length) card.tags = a.tags;
          if (a.version) card.version = a.version;
          if (a.author) card.author = a.author;
          if (a.repo) card.repo = a.repo;
          return card;
        } catch (e) { return null; }                           // 读不到 README 的树不进首页
      };
      const loaded = yield Promise.all(self.registry.map((r) => loadCard(r)));
      self.cardsBox.set(loaded.filter(Boolean));
    }),
  }));
const TEACH_DOC = (id) => "/ui_app/teach/" + id + ".md";
const TEACH_DOC_LANG = (id, lang) => "/ui_app/teach/" + id + "." + (lang === "en" ? "en" : "zh") + ".md";

/**
 * antd 教学页 = 两篇独立数据 md（上下两篇）：COMPONENTS / 数据看板。
 * 每篇各自被自己的 match 件渲染；本组件只负责把两篇的章节节点取出来交给件。
 */
/**
 * antd 教学页 = 两篇独立数据 md（上下两篇）。
 * 认领仍由 `.mds/ui.md::## match` 声明（path 用 `/ui_app/teach/antd*` 同时覆盖两篇），
 * 这里只负责把两篇各自的章节节点取出来交给 `env.renderNode(node)`（= NodeView 逐节点派发）。
 */
const ANTD_DOCS = (lang) => (lang === "en" ? [
  { name: "CRDT_ARCH", doc: "/ui_app/teach/antd_dashboard.en.md" },
  { name: "Idea", doc: "/ui_app/teach/ui_theory.en.md" },
  { name: "Demos", doc: "/ui_app/teach/ui_demos.en.md" },
  { name: "COMPONENTS", doc: "/ui_app/teach/antd_components.en.md" },
  { name: "Dashboard", doc: "/ui_app/teach/antd_dashboard.en.md" },
] : [
  { name: "CRDT_ARCH", doc: "/ui_app/teach/antd_dashboard.md" },
  { name: "理念", doc: "/ui_app/teach/ui_theory.md" },
  { name: "演示", doc: "/ui_app/teach/ui_demos.md" },
  { name: "COMPONENTS", doc: "/ui_app/teach/antd_components.md" },
  { name: "数据看板", doc: "/ui_app/teach/antd_dashboard.md" },
]);
// UI 页的 doc 指针固定挂在 dashboard 那篇（与展示顺序无关，页首动图只是第一节）
const ANTD_BASE_DOC = (lang) => lang === "en" ? "/ui_app/teach/antd_dashboard.en.md" : "/ui_app/teach/antd_dashboard.md";
const AntdDocs = observer(function AntdDocs({ env, part, lang }) {
  const en = lang === "en";
  const DOCS = ANTD_DOCS(lang);
  const main = env && typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const wt = main && main.wts ? main.wts.wt : null;
  // 标题文本可能是 run 数组（含 `_` 等标点的标题会被切段）——比较前先摊平
  const flatTitle = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v) || (v && typeof v.length === "number")) {
      let s = "";
      for (const c of Array.prototype.slice.call(v)) s += flatTitle(c);
      return s;
    }
    if (typeof v === "object") return flatTitle(v.ct != null ? v.ct : v.t);
    return String(v);
  };
  const sectionOf = (path, title) => {
    const id = wt && wt.byPath ? wt.byPath[path] : undefined;
    const doc = id != null && wt && wt.by ? wt.by.get(String(id)) : null;
    const kids = doc && doc.kids ? Array.prototype.slice.call(doc.kids) : [];
    for (const k of kids) {
      if (!k || k.nt !== "h") continue;
      const sub = k.kids ? Array.prototype.slice.call(k.kids) : [];
      for (const c of sub) if (c && c.nt === "h" && flatTitle(c.t) === title) return c;
    }
    return null;
  };
  const splitRow = (key, label) => h("div", { key, className: "antd-split" }, h("span", null, label));
  const renderSection = (d) => {
    const node = sectionOf(d.doc, d.name);
    return h("section", { key: d.doc + "|" + d.name, id: "sec-" + d.name, "data-antd-doc": d.doc, className: "antd-doc-sec" },
      node && typeof env.renderNode === "function" ? env.renderNode(node) : h("div", { className: "gen-teach-pending" },
        h("div", { className: "gen-teach-pending-t" }, en ? "Loading data doc…" : "数据文档装载中…"),
        h("div", { className: "gen-teach-pending-p" }, d.doc))
    );
  };
  // 首图单独成块（在 teach-layout 之外渲染）：独立拿满主区宽度，标题也归它。
  if (part === "hero") {
    return h("div", { className: "ui-hero" },
      h("h1", { className: "antd-page-title" }, "MDIO UI"),
      renderSection({ name: "CRDT_ARCH", doc: DOCS[0].doc })
    );
  }
  // 页面其余部分（理念 / 演示 / antd 展示）；正文与 antd 之间留一条分隔线。
  const blocks = [];
  DOCS.forEach((d) => {
    if (d.name === "CRDT_ARCH") return;
    if (d.name === "COMPONENTS") blocks.push(splitRow("split-antd", en ? "antd · components & dashboard" : "antd · 组件与看板"));
    blocks.push(renderSection(d));
  });
  return h("div", { className: "antd-docs" }, blocks);
});

const TeachShell = observer(function TeachShell({ app, env, route }) {
  const store = app;
  const lang = store ? store.lang : "zh";
  // 渲染期就写全局：切语言时被 key 重挂的子树（ui 页的 claim 件）在首次 render 就能读到新语言。
  try { globalThis.__teachLang = lang; } catch (e) { /* 无 window 时忽略 */ }
  useEffect(() => {
    try {
      globalThis.__teachLang = lang;
      window.dispatchEvent(new CustomEvent("dsh:lang", { detail: lang }));
    } catch (e) { /* 广播失败不影响渲染 */ }
  }, [lang]);
  const appRouter = env.appRouter;
  const teach = store ? store.teach : [];
  const learn = store ? store.learn : [];
  // 侧栏显示名（路由名不变）：中文页用中文；英文页保留 route 名（readwrite 统一写成 read&write）。
  // 例外（按业主口径）：hook / wt / ui 保持原样；about 已是品牌名 MDIO。
  const LEARN_LABEL_ZH = { about: "MDIO", projection: "投影", readwrite: "读写", hook: "hook", pipe: "管道与扩展", arrow: "箭头", plugin: "插件", wt: "wt", ui: "ui" };
  const learnLabel = (name) => {
    if (lang !== "en") return LEARN_LABEL_ZH[name] || name;
    return name === "readwrite" ? "read&write" : name;
  };
  const raw = String(route || "");
  const active = raw.indexOf("/teach") === 0 ? (raw.slice(7).split("/")[0] || "antd") : "antd";
  const isAntd = active === "antd" || active === "ui";
  const mainRoot = typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const wt = mainRoot && mainRoot.wts ? mainRoot.wts.wt : null;
  const decl = mainRoot && mainRoot.decl;
  const baseDoc = isAntd ? ANTD_BASE_DOC(lang) : TEACH_DOC(active);
  const langDoc = isAntd ? null : TEACH_DOC_LANG(active, lang);
  const docPath = isAntd ? baseDoc : (langDoc && wt && wt.byPath && wt.byPath[langDoc] != null ? langDoc : baseDoc);
  const exists = !!(wt && wt.byPath && wt.byPath[docPath] != null);
  const synced = !!(decl && String(decl.route) === docPath);
  const toc = (() => {
    if (isAntd) return ANTD_DOCS(lang).map((d) => d.name);
    try {
      const id = wt && wt.byPath ? wt.byPath[docPath] : undefined;
      const doc = id != null && wt && wt.by ? wt.by.get(String(id)) : null;
      const kids = doc && doc.kids ? Array.prototype.slice.call(doc.kids) : [];
      const labelOf = (v) => {
        if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? (x.ct != null ? x.ct : (x.t != null ? x.t : "")) : x)).join("");
        return v == null ? "" : String(v);
      };
      const out = [];
      for (const k of kids) {
        if (!k || k.nt !== "h") continue;
        const sub = k.kids ? Array.prototype.slice.call(k.kids) : [];
        for (const c of sub) if (c && c.nt === "h") out.push(labelOf(c.t));
      }
      return out;
    } catch (e) { return []; }
  })();
  useEffect(() => {
    if (!exists || !appRouter || typeof appRouter.setDocPointer !== "function") return;
    if (synced) return;
    appRouter.setDocPointer(docPath);
  }, [exists, synced, docPath, appRouter]);
  const go = (r) => { if (appRouter && appRouter.push) appRouter.push(r); };
  const mainRef = useRef(null);
  const tocKey = toc.join("|");
  const [tocOn, setTocOn] = useState("");
  useEffect(() => {
    const box = mainRef.current;
    if (!box) return;
    const root = box.getRootNode ? box.getRootNode() : document;
    const calc = () => {
      let cur2 = "";
      const names = tocKey ? tocKey.split("|") : [];
      for (const t of names) {
        const el2 = root.getElementById ? root.getElementById("sec-" + t) : null;
        if (!el2) continue;
        const top = el2.getBoundingClientRect().top - box.getBoundingClientRect().top;
        if (top <= 96) cur2 = t;
      }
      if (names.length && box.scrollHeight - box.scrollTop - box.clientHeight <= 4) cur2 = names[names.length - 1];
      setTocOn(cur2);
    };
    calc();
    box.addEventListener("scroll", calc, { passive: true });
    return () => box.removeEventListener("scroll", calc);
  }, [tocKey, active]);
  const jump = (t, ev) => {
    try {
      const root = ev && ev.currentTarget && ev.currentTarget.getRootNode ? ev.currentTarget.getRootNode() : document;
      const el2 = root && root.getElementById ? root.getElementById("sec-" + t) : null;
      if (el2) el2.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {}
  };
  return (
    <div className={"gen-teach-shell" + (active === "ow" ? " is-ow-canvas" : "")}>
      <header className="teach-topbar flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => go("/")} className="teach-topbar-brand flex items-center gap-2 appearance-none border-0 bg-transparent">
            <span className="text-sm font-medium text-white">{store ? store.title : "MDIO"}</span>
          </button>
          <span className="text-sm text-white/20">/</span>
          <span className="text-sm text-white/55">{lang === "en" ? "Docs" : "教学文档"}</span>
          <span className="text-sm text-white/20">/</span>
          <span className="text-sm text-white/80">{active}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => store && typeof store.setLang === "function" && store.setLang(lang === "zh" ? "en" : "zh")}
            className="teach-topbar-link appearance-none rounded-lg bg-transparent px-2 py-1 text-[13px] text-white/70 transition-colors hover:text-white"
            title={lang === "zh" ? "Switch to English" : "切换到中文"}>
            {lang === "zh" ? "中文 / EN" : "EN / 中文"}
          </button>
          <button type="button" onClick={() => go("/")} className="teach-topbar-link appearance-none rounded-lg bg-transparent px-2 py-1 text-[13px] text-white/70 transition-colors hover:text-white">{lang === "en" ? "Back home" : "返回首页"}</button>
        </div>
      </header>
      <div className="gen-teach-body flex min-h-0 flex-1">
        <aside className="gen-teach-side flex w-[200px] shrink-0 flex-col overflow-y-auto px-3 py-4">
          {teach.length ? (
            <div className="gen-teach-label flex h-9 items-center rounded-lg px-2 text-[13px] font-medium text-white/90">教学</div>
          ) : null}
          {teach.length ? (
            <nav className="gen-teach-nav ml-[13px] flex flex-col gap-0.5 border-l border-white/[0.07] pl-3">
              {teach.map((t, i) => (
                <button key={t.name} type="button" onClick={() => go("/teach/" + t.name)}
                  className={"gen-teach-nav-item flex h-8 appearance-none items-center gap-2 rounded-lg border-0 px-2 text-left text-[13px] transition-colors " + (t.name === active ? "is-on bg-white/[0.06] font-medium text-white" : "bg-transparent text-white/65 hover:bg-white/[0.04] hover:text-white/90")}>
                  <span className="gen-teach-num font-mono text-[11px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
                  <span className="gen-teach-name">{t.name}</span>
                </button>
              ))}
            </nav>
          ) : null}
          <div className="gen-teach-label mt-4 flex h-9 items-center rounded-lg px-2 text-[13px] font-medium text-white/90">{lang === "en" ? "About MDIO" : "关于MDIO"}</div>
          <nav className="gen-teach-nav ml-[13px] flex flex-col gap-0.5 border-l border-white/[0.07] pl-3">
            {learn.map((t, i) => (
              <button key={t.name} type="button" onClick={() => go("/teach/" + t.name)}
                className={"gen-teach-nav-item flex h-8 appearance-none items-center gap-2 rounded-lg border-0 px-2 text-left text-[13px] transition-colors " + (t.name === active ? "is-on bg-white/[0.06] font-medium text-white" : "bg-transparent text-white/65 hover:bg-white/[0.04] hover:text-white/90")}>
                <span className="gen-teach-num font-mono text-[11px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
                <span className="gen-teach-name">{learnLabel(t.name)}</span>
              </button>
            ))}
          </nav>
        </aside>
        <main ref={mainRef} className="teach-main min-h-0 flex-1 overflow-y-auto">
          {isAntd ? h(AntdDocs, { env: env, part: "hero", lang: lang, key: "hero-" + lang }) : null}
          <div className="teach-layout">
            <div className={"teach-content min-w-0 flex-1" + (active === "antd" || active === "ow" || active === "ui" ? " is-wide" : "") + (active === "projection" ? " is-projection" : "") + (active === "readwrite" || active === "pipe" ? " is-demo" : "")}>
              {isAntd ? h(AntdDocs, { env: env, lang: lang, key: "docs-" + lang }) : exists ? (synced && env.renderNode ? env.renderNode() : (
                <div className="gen-teach-pending">{lang === "en" ? "Loading the “" + active + "” page…" : "打开「" + active + "」教学页…"}</div>
              )) : (
                <div className="gen-teach-pending">
                  <div className="gen-teach-pending-t">{lang === "en" ? "The “" + active + "” page is not built yet" : "「" + active + "」教学页还没建"}</div>
                  <div className="gen-teach-pending-p">{docPath}</div>
                </div>
              )}
            </div>
            {isAntd ? null : (
            <aside className="teach-toc sticky top-4 flex w-[224px] shrink-0 flex-col self-start">
              <div className="toc-label mb-3 text-xs text-white/50">{lang === "en" ? "On this page" : "本页目录"}</div>
              <nav className="toc-nav flex flex-col gap-1">
                {toc.map((t) => (
                  <button key={t} type="button" className={"toc-item block appearance-none border-0 bg-transparent py-1 text-left text-[13px] leading-snug transition-colors " + (tocOn === t ? "font-medium text-white" : "text-white/60 hover:text-white")} onClick={(ev) => jump(t, ev)}>{t}</button>
                ))}
              </nav>
            </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
});

export default observer(function GenesisApp({ app }) {
  const env = app ? (getEnv(app) || {}) : {};
  const mainRoot = typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const decl = mainRoot && mainRoot.decl;
  const appRouter = env.appRouter;
  const [route, setRoute] = useState(() => (appRouter && typeof appRouter.route === "function" ? String(appRouter.route() || "/") : "/"));
  useEffect(() => {
    if (!appRouter || typeof appRouter.subscribe !== "function") return undefined;
    return appRouter.subscribe((r) => setRoute(String(r || "/") || "/"));
  }, [appRouter]);
  useEffect(() => { if (app && typeof app.load === "function") app.load().catch(function (e) { /* 装载失败不挡画 */ }); }, [app]);
  if (String(route || "").indexOf("/teach") === 0) {
    return h("div", { "data-genesis": "app" }, h(TeachShell, { app: app, env: env, route: route }));
  }
  const modName = "HOME";   // 非 /teach 路由只剩首页（router.md 已删）
  const rec = decl && typeof decl.modOf === "function" ? decl.modOf(modName) : null;
  const C = modCompOf(rec);
  if (!C) return h("div", { className: "p-10 text-[#686868]" }, "缺件 " + modName);
  return h("div", { "data-genesis": "app" }, h(C, { app: app, env: env }));
});
```

## home

```jsx@home
import { observer } from "mobx-react-lite";

const GITHUB_URL = "https://github.com/cloudwalkerfre/MDIO_WTS";
const SITE_URL = "https://md-io.org";

export default observer(function Home({ app, env }) {
  const store = app;
  const appRouter = env && env.appRouter ? env.appRouter : null;
  const title = store ? store.title : "MDIO";
  const lang = store && store.lang === "en" ? "en" : "zh";
  const L = lang === "en"
    ? { about: "About", apps: "App library", items: (n) => n + " apps", lang: "EN / 中文" }
    : { about: "关于", apps: "应用库", items: (n) => n + " 个应用", lang: "中文 / EN" };
  const cards = store ? store.cards : [];
  const open = (c) => { if (appRouter && c && c.uid) appRouter.switchTo(c.uid); };
  const goAbout = () => { if (appRouter) appRouter.push("/teach/about"); };
  const toggleLang = () => { if (store && typeof store.setLang === "function") store.setLang(lang === "zh" ? "en" : "zh"); };
  return (
    <div className="gen-home">
      <header className="gen-home-top">
        <div className="gen-home-brand">
          <a className="gen-home-brandlink" href={SITE_URL} target="_blank" rel="noreferrer" title={lang === "en" ? "Website" : "官网"}>{title}</a>
        </div>
        <nav className="gen-home-nav">
          <a className="gen-home-iconlink" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
          </a>
          <a className="gen-home-sitelink" href={SITE_URL} target="_blank" rel="noreferrer" aria-label={lang === "en" ? "Website" : "官网"} title={lang === "en" ? "Website" : "官网"}>{lang === "en" ? "Website" : "官网"}</a>
          <button type="button" className="gen-home-navlink" onClick={toggleLang}>{L.lang}</button>
        </nav>
      </header>
      <main className="gen-home-wrap">
        <h1 className="gen-home-h1">{title}</h1>
        <div className="gen-home-entrywrap">
          <button type="button" className="gen-home-entry" onClick={goAbout}>
            <span>{L.about}</span>
            <span className="gen-home-arrow">→</span>
          </button>
        </div>
        <section className="gen-home-sec">
          <div className="gen-home-sechead">
            <h2 className="gen-home-h2">{L.apps}</h2>
            <span className="gen-home-count">{L.items(cards.length)}</span>
          </div>
          <div className="gen-app-grid">
            {cards.map((c) => (
              <button key={c.uid || c.name} type="button" className="gen-app-card" onClick={() => open(c)}>
                <span className="gen-app-head">
                  <span className="gen-app-name">{c.name}</span>
                  {c.version ? <span className="gen-app-ver">v{c.version}</span> : null}
                  <span className="gen-app-arrow">→</span>
                </span>
                <span className="gen-app-desc">{c.desc || c.uid}</span>
                {c.tags && c.tags.filter((t) => t !== "app").length ? (
                  <span className="gen-app-tags">
                    {c.tags.filter((t) => t !== "app").slice(0, 3).map((t) => (<span key={t} className="gen-app-tag">{t}</span>))}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
});
```

## css

```css@app
:host {
  --c-void: #0a0a0a;
  --c-graphite: #161616;
  --c-bone: #ededed;
  --c-ash: #c2c2c2;
  --c-slate: #686868;
  --c-smoke: #b2b2b2;
  --c-violet: #6b62f2;
}
[data-genesis="app"] { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--c-void); }
[data-genesis="app"] button:not([class]) {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
/* ── 首页（样式参考「关于MDIO」教学页：848 内容列 + 居中 36px 标题 + 细分割线）── */
.gen-home { min-height: 100vh; background: var(--c-void); color: var(--c-ash); }
.gen-home-top {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  height: 48px; padding: 0 24px; box-sizing: border-box;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 10, 0.88);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.gen-home-brand { display: flex; align-items: center; }
.gen-home-brandlink { font-size: 14px; font-weight: 500; color: #fff; text-decoration: none; transition: opacity .15s ease; }
.gen-home-brandlink:hover { opacity: .72; }
.gen-home-nav { display: flex; align-items: center; gap: 18px; }
.gen-home-navlink {
  appearance: none; -webkit-appearance: none; border: 0; background: transparent;
  color: rgba(255, 255, 255, 0.62); font: inherit; font-size: 13px; cursor: pointer;
  padding: 2px 0; transition: color .15s ease;
}
.gen-home-navlink:hover { color: #fff; }
.gen-home-iconlink {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px; margin: 0 -4px;
  color: rgba(255, 255, 255, 0.62); transition: color .15s ease, background .15s ease;
}
.gen-home-iconlink:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
.gen-home-sitelink {
  font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.62); text-decoration: none; transition: color .15s ease;
}
.gen-home-sitelink:hover { color: #fff; }
.gen-home-wrap { width: 848px; max-width: 100%; margin: 0 auto; padding: 56px 24px 96px; box-sizing: border-box; }
.gen-home-h1 {
  margin: 8px 0 48px; text-align: center;
  font-size: clamp(80px, 12vw, 144px); font-weight: 500; line-height: 0.96; letter-spacing: -0.045em; color: var(--c-bone);
}
.gen-home-entrywrap { display: flex; justify-content: center; margin: 0 0 72px; }
.gen-home-entry {
  appearance: none; -webkit-appearance: none; border: 0; background: transparent;
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--c-bone); font: inherit; font-size: 18px; font-weight: 500;
  padding: 0; cursor: pointer; transition: color .15s ease;
}
.gen-home-entry:hover { color: #fff; }
.gen-home-arrow { color: rgba(255, 255, 255, 0.3); transition: transform .15s ease; }
.gen-home-entry:hover .gen-home-arrow { transform: translateX(4px); }
.gen-home-sec { scroll-margin-top: 24px; }
.gen-home-sechead {
  display: flex; align-items: baseline; justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  padding-bottom: 12px; margin-bottom: 20px;
}
.gen-home-h2 { margin: 0; font-size: 20px; font-weight: 500; line-height: 28px; letter-spacing: -0.4px; color: #ededed; }
.gen-home-count { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--c-slate); }
.gen-app-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.gen-app-card {
  appearance: none; -webkit-appearance: none; font: inherit; text-align: left;
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px 18px 14px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px;
  background: rgba(255, 255, 255, 0.02); color: inherit; cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.gen-app-card:hover { border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.035); }
.gen-app-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.gen-app-name { min-width: 0; font-size: 16px; font-weight: 500; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gen-app-ver { flex: 0 0 auto; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--c-slate); }
.gen-app-arrow { margin-left: auto; flex: 0 0 auto; font-size: 14px; line-height: 1; color: rgba(255, 255, 255, 0.2); transition: color .15s ease, transform .15s ease; }
.gen-app-card:hover .gen-app-arrow { color: rgba(255, 255, 255, 0.62); transform: translateX(2px); }
.gen-app-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.gen-app-tag { font-size: 11px; line-height: 1; color: rgba(255, 255, 255, 0.5); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; padding: 3px 7px; }
.gen-app-desc {
  margin: 0; font-size: 13px; line-height: 1.65; color: var(--c-ash);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
@media (max-width: 720px) {
  .gen-app-grid { grid-template-columns: 1fr; }
  .gen-home-wrap { padding: 32px 18px 64px; }
}
:host(.light) .gen-home { background: #fff; }
:host(.light) .gen-home-top { background: rgba(255, 255, 255, 0.9); border-bottom-color: rgba(0, 0, 0, 0.08); }
:host(.light) .gen-home-brandlink { color: #111; }
:host(.light) .gen-home-navlink { color: rgba(0, 0, 0, 0.55); }
:host(.light) .gen-home-navlink:hover { color: #111; }
:host(.light) .gen-home-iconlink { color: rgba(0, 0, 0, 0.55); }
:host(.light) .gen-home-iconlink:hover { color: #111; background: rgba(0, 0, 0, 0.05); }
:host(.light) .gen-home-sitelink { color: rgba(0, 0, 0, 0.55); }
:host(.light) .gen-home-sitelink:hover { color: #111; }
:host(.light) .gen-home-h1,
:host(.light) .gen-home-h2 { color: #111; }
:host(.light) .gen-home-count { color: rgba(0, 0, 0, 0.45); }
:host(.light) .gen-home-entry { color: #111; }
:host(.light) .gen-home-entry:hover { color: #000; }
:host(.light) .gen-home-arrow { color: rgba(0, 0, 0, 0.3); }
:host(.light) .gen-home-sechead { border-bottom-color: rgba(0, 0, 0, 0.1); }
:host(.light) .gen-app-card { background: rgba(0, 0, 0, 0.015); border-color: rgba(0, 0, 0, 0.1); }
:host(.light) .gen-app-card:hover { background: rgba(0, 0, 0, 0.03); border-color: rgba(0, 0, 0, 0.2); }
:host(.light) .gen-app-name { color: #111; }
:host(.light) .gen-app-ver { color: rgba(0, 0, 0, 0.4); }
:host(.light) .gen-app-arrow { color: rgba(0, 0, 0, 0.2); }
:host(.light) .gen-app-card:hover .gen-app-arrow { color: rgba(0, 0, 0, 0.55); }
:host(.light) .gen-app-desc { color: rgba(0, 0, 0, 0.65); }
:host(.light) .gen-app-tag { color: rgba(0, 0, 0, 0.5); border-color: rgba(0, 0, 0, 0.15); }

[data-genesis="app"] {
  --color-md-fg: #c2c2c2;
  --color-md-heading: #ededed;
  --color-md-muted: #686868;
  --color-md-border: rgba(255,255,255,0.10);
  --color-md-code-bg: rgba(255,255,255,0.05);
  --color-md-code-border: rgba(255,255,255,0.10);
  --color-md-inline-code-bg: rgba(107,98,242,0.16);
  --color-md-inline-code-fg: #cfcbff;
  --color-md-blockquote-fg: #b2b2b2;
  --color-md-blockquote-border: rgba(255,255,255,0.18);
  --color-md-link: #9d97ff;
  --color-md-table-header-bg: rgba(255,255,255,0.06);
  --color-md-table-stripe: rgba(255,255,255,0.03);
  --color-md-scroll: rgba(255,255,255,0.25);
  --color-md-scroll-hover: rgba(255,255,255,0.4);
  --color-md-mark-bg: rgba(107,98,242,0.28);
  --color-md-ins-fg: #8ce99a;
  --color-md-del-fg: #ff8787;
}

/* 教学壳：只留布局骨架（视觉走 JSX 里的 tailwind 工具类；无层规则优先于 tailwind utilities）
   宿主 tailwind 未引 preflight ⇒ 壳内固定尺寸元素显式 border-box */
.teach-topbar, .gen-teach-side, .gen-teach-label, .gen-teach-nav, .gen-teach-nav-item, .teach-toc, .toc-item, .teach-topbar-link, .teach-topbar-brand { box-sizing: border-box; }
/* 侧栏宽度走无层规则（JSX 里的 w-[200px] 不一定在 tailwind 产物里） */
.gen-teach-side { width: 200px; flex: 0 0 200px; }
.gen-teach-nav-item { padding-top: 0; padding-bottom: 0; }
.teach-topbar-brand { padding: 0; font-family: inherit; }
/* 顶栏按钮不要浏览器默认按钮框：appearance-none/border-0 这类工具类在宿主产物里不一定有，走无层规则兜底 */
.teach-topbar-brand, .teach-topbar-link { appearance: none; -webkit-appearance: none; border: 0; background: transparent; }
.lab-h, .antd-page-h, .mdio-doc h2 { scroll-margin-top: 16px; }
.toc-item { padding-left: 0; padding-right: 0; }
.gen-teach-shell { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: var(--c-void); --ui-demo-bd: rgba(255,255,255,.12); --ui-demo-bg: rgba(255,255,255,.03); }
.gen-teach-shell.is-ow-canvas { background: #000; }
.gen-teach-body { flex: 1 1 auto; min-height: 0; display: flex; }
.teach-main { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; }
.teach-layout { display: flex; align-items: flex-start; padding: 16px 0 128px; }
.teach-content { flex: 0 1 848px; width: 848px; min-width: 0; max-width: 848px; margin-left: auto; margin-right: auto; }
.teach-toc { width: 224px; flex: 0 0 224px; box-sizing: border-box; padding-right: 16px; position: sticky; top: 16px; display: flex; flex-direction: column; }
/* 全站统一页标题：36px 居中（与 UI / projection 同款） */
.teach-content .mdio-doc h1,
.teach-content .mdio-std > h1 { display: block; margin: 8px 0 36px; text-align: center; font-size: 36px; font-weight: 500; line-height: 1.15; letter-spacing: -1px; color: var(--c-bone); border-bottom: 0; padding-bottom: 0; }
.teach-content .mdio-doc h2 { font-size: 20px; font-weight: 500; line-height: 28px; letter-spacing: -0.4px; color: #ededed; border-bottom: 0; padding-bottom: 0; margin: 40px 0 16px; }
.teach-main .mdio-doc pre { max-height: 380px; overflow: auto; border-radius: 12px; font-size: 13px; line-height: 1.6; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); }
/* 演示页（读写 / 管道）：内容列放宽给动图拿满宽，正文块收在 848 内仍好读 */
.teach-content.is-demo { flex: 0 1 1360px; width: 1360px; max-width: 1360px; }
.teach-content.is-demo .mdio-doc > * { max-width: 848px; margin-left: auto; margin-right: auto; }
.teach-content.is-demo .mdio-doc > [class*="-host"],
.teach-content.is-demo .mdio-doc [class*="-host"] { max-width: none; }
.gen-teach-pending { padding: 120px 0; text-align: center; color: var(--c-slate); font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
.gen-teach-pending-t { font-size: 15px; color: var(--c-bone); }
.gen-teach-pending-p { font: 12px ui-monospace, Menlo, monospace; }

.antd-page { display: flex; flex-direction: column; gap: 36px; }
.antd-page-h { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-size: 20px; font-weight: 500; line-height: 28px; letter-spacing: -0.4px; color: #ededed; margin: 0; }
.antd-page-meta { font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.4); letter-spacing: .01em; }
.antd-sub { display: flex; flex-direction: column; gap: 14px; }
.antd-sub-h { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.42); letter-spacing: .01em; }
.antd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 16px; align-items: start; grid-auto-flow: dense; }
.antd-group { display: flex; flex-direction: column; gap: 0; margin: 56px 0 72px; scroll-margin-top: 16px; }
.antd-group:first-of-type { margin-top: 8px; }
.antd-group:last-child { margin-bottom: 0; }
.antd-card { display: flex; flex-direction: column; gap: 10px; min-height: 92px; padding: 12px 14px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); transition: border-color .14s ease, background .14s ease; }
.antd-card:hover { transform: translateY(-1px); }
.antd-card:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.04); }
.antd-card-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.antd-card-name { font-size: 13px; font-weight: 500; color: #ededed; }
.antd-card-val { font: 11px ui-monospace, Menlo, monospace; color: var(--c-slate); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.07); border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.antd-card-body { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 4px; min-height: 52px; }
.antd-card-body > .ant-slider,
.antd-card-body > .ant-input,
.antd-card-body > .ant-select,
.antd-card-body > .ant-input-number,
.antd-card-body > .ant-progress,
.antd-card-body > .ant-tabs,
.antd-card-body > .ant-steps,
.antd-card-body > .ant-timeline,
.antd-card-body > .ant-descriptions,
.antd-card-body > .ant-card,
.antd-card-body > .ant-list,
.antd-card-body > .ant-alert,
.antd-card-body > .ant-segmented,
.antd-card-body > .ant-radio-group { align-self: stretch; width: 100%; }
.antd-card-body > .ant-slider { margin: 4px 6px; }
[data-genesis="app"] .antd-group table { border-collapse: separate; border-spacing: 0; }
[data-genesis="app"] .antd-group th,
[data-genesis="app"] .antd-group td { border: 0 !important; background: transparent !important; }
[data-genesis="app"] .antd-group tr:nth-child(2n) td,
[data-genesis="app"] .antd-group thead th { background: transparent !important; }
[data-genesis="app"] .antd-group ul,
[data-genesis="app"] .antd-group ol { margin: 0; padding: 0; }
[data-genesis="app"] .antd-group li { margin: 0; }
[data-genesis="app"] .antd-group p { margin: 0; }
[data-genesis="app"] .antd-group pre { margin: 0; padding: 0; border: 0; background: transparent; }
.antd-rows { display: flex; flex-direction: column; gap: 10px; }
.antd-row { display: grid; grid-template-columns: 190px minmax(0, 1fr); align-items: center; gap: 20px; padding: 14px 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: rgba(212,212,212,0.04); }
.antd-row.is-bare { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 0; border: 0; background: transparent; }
.antd-row-h { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.antd-row-body { min-width: 0; display: flex; align-items: center; }
.antd-row-body > .ant-alert,
.antd-row-body > .ant-progress,
.antd-row-body > .ant-descriptions,
.antd-row-body > .ant-list,
.antd-row-body > .ant-timeline,
.antd-row-body > .ant-steps { flex: 1 1 auto; width: 100%; }
.antd-row.is-bare .antd-row-body { width: 100%; }
.antd-row.is-bare .ant-card { width: 100%; max-width: 460px; }
.showcase { display: flex; flex-direction: column; gap: 26px; padding: 28px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.015); }
.showcase-top { display: flex; flex-direction: column; gap: 14px; }
.showcase-title-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.showcase-title { font-size: 20px; font-weight: 500; letter-spacing: -0.4px; color: #ededed; }
.showcase-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.showcase-block { display: flex; flex-direction: column; gap: 12px; }
.showcase-h { font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
.showcase-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.showcase-tile { display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
.datapage-col { display: flex; flex-direction: column; gap: 8px; }
.showcase .ant-divider { margin: 4px 0; }
.showcase-tile .ant-result { padding: 0; }
.showcase .ant-alert { background: rgba(255,255,255,0.02) !important; border: 1px solid rgba(255,255,255,0.10) !important; color: var(--c-ash); }
.showcase .ant-alert .ant-alert-icon { color: var(--c-slate) !important; }
.showcase .ant-result-icon .anticon { font-size: 34px; }
.showcase .ant-result-icon svg { color: #8a8a8a !important; }
.showcase-tile .ant-result-title { font-size: 17px; }
.showcase-tile .ant-result-icon { margin-bottom: 8px; }
/* ── antd 教学页：三章画布（01 基础 / 02 高级 / 03 数据看板） ── */
.teach-content.is-wide { flex: 0 1 1360px; width: 1360px; max-width: 1360px; }
.teach-content.is-wide .mdio-std > h1 { display: none; }
/* ── 教学页 markdown 统一排版（所有页共用一套；只加样式，不改渲染逻辑） ── */
.teach-content .mdio-doc { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif; }
.teach-content .mdio-doc h2 { margin: 56px 0 18px; font-size: 24px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.3; color: var(--c-bone); border-bottom: 0; padding-bottom: 0; }
.teach-content .mdio-doc h3 { margin: 36px 0 12px; font-size: 17px; font-weight: 500; line-height: 1.4; color: var(--c-bone); }
.teach-content .mdio-doc p { margin: 14px 0; font-size: 14.5px; line-height: 1.85; color: var(--c-ash); }
.teach-content .mdio-doc strong { color: var(--c-bone); font-weight: 600; }
.teach-content .mdio-doc ul,
.teach-content .mdio-doc ol { margin: 14px 0; padding-left: 22px; font-size: 14px; line-height: 1.9; color: var(--c-ash); }
.teach-content .mdio-doc li { margin: 4px 0; }
.teach-content .mdio-doc hr { border: 0; border-top: 1px solid rgba(255,255,255,.08); margin: 44px 0; }
.teach-content .mdio-doc code { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.88em; color: #e6edf3; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 5px; padding: 1px 5px; }
.teach-content .mdio-doc pre { margin: 18px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; background: #0d0d0f; overflow: auto; max-height: 420px; }
.teach-content .mdio-doc pre code { background: transparent; border: 0; padding: 0; font-size: 12.5px; line-height: 1.7; color: #d6dde6; }
.teach-content .mdio-doc blockquote { margin: 18px 0; padding: 12px 18px; border-left: 2px solid rgba(255,255,255,.18); background: rgba(255,255,255,.03); border-radius: 0 10px 10px 0; color: var(--c-smoke); font-size: 13.5px; }
.teach-content .mdio-doc blockquote p { margin: 0; font-size: 13.5px; color: inherit; }
.teach-content .mdio-doc table { width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; overflow: hidden; font-size: 12.8px; line-height: 1.6; }
.teach-content .mdio-doc thead th { padding: 10px 14px; text-align: left; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10.5px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-slate); background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.12); white-space: nowrap; }
.teach-content .mdio-doc tbody td { padding: 10px 14px; color: var(--c-ash); border-bottom: 1px solid rgba(255,255,255,.06); vertical-align: top; }
.teach-content .mdio-doc tbody tr:last-child td { border-bottom: 0; }
.teach-content .mdio-doc tbody tr:nth-child(odd) td { background: rgba(255,255,255,.015); }
.teach-content .mdio-doc tbody tr:hover td { background: rgba(255,255,255,.045); }
.teach-content .mdio-doc td code,
.teach-content .mdio-doc th code { white-space: nowrap; font-size: 11.5px; }
/* UI 页：分节节奏 + md 章节（理念 / 演示）沿用教学页排版，正文/卡片收在 848 内 */
.antd-page { gap: 40px; }
.antd-page-title { margin: 0; text-align: center; font-size: 36px; font-weight: 500; line-height: 1.15; letter-spacing: -1px; color: var(--c-bone); }
/* 首图独立：跳出正文列，取主区可用最大宽度（左右各留一点、不压右侧 TOC） */
/* 首图独立成块：渲染在 teach-layout 之外，独立拿满主区宽度（内容列 1360 不再限制它） */
.ui-hero { padding: 8px 24px 28px; }
.ui-hero .antd-page-title { margin: 0 0 70px; }
.ui-hero .ow-crdt-arch-host { height: min(1040px, 96vh) !important; }
@media (max-width: 720px) { .ui-hero { padding: 8px 16px 20px; } }
/* antd 展示与上面 mdio 部分的分隔线（带标签） */
.antd-split { display: flex; align-items: center; gap: 14px; color: var(--c-slate); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; }
.antd-split::before, .antd-split::after { content: ""; height: 1px; flex: 1 1 auto; background: currentColor; opacity: .22; }
.antd-docs { display: flex; flex-direction: column; gap: 64px; }
.antd-doc-sec > .mdio-std h2 { margin: 0 0 12px; font-size: 24px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.3; color: var(--c-bone); }
.antd-doc-sec > .mdio-std h3 { margin: 32px 0 12px; font-size: 17px; font-weight: 500; line-height: 1.4; color: var(--c-bone); }
.antd-doc-sec > p { margin: 14px 0; font-size: 14.5px; line-height: 1.85; color: var(--c-ash); }
.antd-doc-sec > ul,
.antd-doc-sec > ol { margin: 14px 0; padding-left: 22px; font-size: 14px; line-height: 1.9; color: var(--c-ash); }
.antd-doc-sec > ul li,
.antd-doc-sec > ol li { margin: 4px 0; }
.antd-doc-sec > .md-codeblock { box-sizing: border-box; margin: 18px 0; padding: 16px 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; background: #0d0d0f; overflow: auto; max-height: 420px; }
.antd-doc-sec > .md-codeblock pre { margin: 0; padding: 0; background: transparent; }
.antd-doc-sec > .md-codeblock code { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.7; color: #d6dde6; }
/* 正文与演示卡放大到 1320 —— 和 antd 面板同宽，左右对齐（原来 848 只有一半宽） */
.antd-doc-sec > .mdio-std,
.antd-doc-sec > p,
.antd-doc-sec > ul,
.antd-doc-sec > ol,
.antd-doc-sec > .md-codeblock { max-width: 1320px; margin-left: auto; margin-right: auto; }
/* 演示卡同宽对齐 */
.antd-doc-sec [data-swap],
.antd-doc-sec [data-page="fields"] { max-width: 1320px; margin-left: auto; margin-right: auto; }
/* projection 页专属：版心 1120；标题走全站统一页标题规则 */
.teach-content.is-projection { flex: 0 1 1120px; width: 1120px; max-width: 1120px; }
/* 投影 demo：demo 自己按宿主高度做竖直居中，900px 会空出大块顶部；压到 620 让内容上提 */
.teach-content.is-projection .ow-pjl-host { height: 560px !important; margin-bottom: 200px; }
.teach-content.is-projection .mdio-doc h2:first-of-type { margin-top: 8px; }
/* ── 层级令牌：章（h2）/ 栏（h3）/ 组（h4）/ 字段（bullet），间距走 8pt 阶 ── */
.antd2-chapter { margin: 0 0 48px; }
.antd2-chapter-head { display: flex; align-items: flex-start; gap: 16px; margin: 0 0 24px; padding: 0 0 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.antd2-chapter-idx { font-family: ui-monospace, Menlo, monospace; font-size: 32px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: rgba(255,255,255,0.12); padding-top: 4px; min-width: 48px; }
.antd2-chapter-titles { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.antd2-chapter-h { font-size: 24px; font-weight: 550; line-height: 30px; letter-spacing: -0.4px; color: #f0f1f5; margin: 0; scroll-margin-top: 16px; }
.antd2-chapter-sub { font-size: 12px; line-height: 18px; color: rgba(255,255,255,0.38); }
/* 唯一的面：画布 */
.antd2-canvas { display: flex; flex-direction: column; gap: 32px; padding: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.012); }
.antd2-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; align-items: start; }
.antd2-col { min-width: 0; display: flex; flex-direction: column; }
/* 栏 */
.antd2-region { display: flex; flex-direction: column; min-width: 0; }
.antd2-region + .antd2-region { margin-top: 32px; }
.antd2-region-h { display: flex; align-items: baseline; gap: 8px; padding: 0 0 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.antd2-region-name { font-size: 14px; font-weight: 600; letter-spacing: 0.01em; color: rgba(255,255,255,0.88); }
.antd2-region-count { font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 18px; color: rgba(255,255,255,0.36); }
.antd2-region-hint { margin-left: auto; font-size: 12px; color: rgba(255,255,255,0.30); }
.antd2-region-cells { display: flex; flex-direction: column; gap: 24px; }
.antd2-cell { min-width: 0; display: flex; }
.antd2-cell.is-wide { grid-column: span 2; }
/* 组：无盒，靠留白分组 */
.antd2-group { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.antd2-group-h { display: flex; align-items: baseline; gap: 8px; }
.antd2-group-name { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: rgba(255,255,255,0.56); }
.antd2-group-n { font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 18px; color: rgba(255,255,255,0.28); }
.antd2-group-body { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-start; }
.antd2-group-body .antd2-cell.is-s { flex: 0 0 auto; max-width: 160px; }
.antd2-group-body .antd2-cell.is-s .antd2-field-ctl > .ant-spin { width: auto !important; }
.antd2-group-body .antd2-cell.is-m { flex: 0 0 188px; }
.antd2-group-body .antd2-cell.is-l { flex: 1 1 100%; max-width: 100%; }
.antd2-group-body .antd2-cell.is-s .antd2-field { width: auto; }
/* 字段 */
.antd2-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; width: 100%; }
.antd2-field-name { font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.04em; color: rgba(255,255,255,0.34); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .12s ease; }
.antd2-field:hover .antd2-field-name { color: rgba(150,185,255,0.75); }
.antd2-field-ctl { display: flex; flex-direction: column; gap: 4px; min-width: 0; min-height: 32px; justify-content: flex-start; }
.antd2-field-ctl > .ant-switch { width: 36px; min-width: 36px; align-self: flex-start; }
.antd2-field-ctl > .ant-spin { width: auto; align-self: flex-start; }
.antd2-field-ctl > .ant-btn { align-self: flex-start; }
.antd2-field-ctl > .ant-tag { align-self: flex-start; }
.antd2-field-ctl > .ant-rate { display: flex; flex-wrap: nowrap; align-self: flex-start; }
.antd2-cell .ant-rate-star { margin-inline-end: 4px !important; }
.antd2-cell .ant-rate-star:last-child { margin-inline-end: 0 !important; }
.antd2-field-ctl > .ant-avatar { align-self: flex-start; }
.antd2-field-ctl > .ant-badge { align-self: flex-start; }
.antd2-field-ctl > .ant-color-picker-trigger { width: 100%; }
.antd2-field-ctl > .ant-segmented { width: 100%; }
.antd2-field-ctl .ant-select, .antd2-field-ctl .ant-picker, .antd2-field-ctl .ant-input-number,
.antd2-field-ctl .ant-input, .antd2-field-ctl .ant-input-affix-wrapper, .antd2-field-ctl .ant-slider,
.antd2-field-ctl .ant-tabs, .antd2-field-ctl .ant-menu, .antd2-field-ctl .ant-collapse,
.antd2-field-ctl .ant-auto-complete, .antd2-field-ctl .ant-segmented { width: 100% !important; max-width: 100%; }
.antd2-cell .ant-btn { width: auto; }
.antd2-cell .ant-transfer { width: 100%; }
.antd2-cell .ant-transfer-list { flex: 1 1 0; min-width: 0; }
.antd2-cell .ant-transfer-list-body { font-size: 12px; }
.antd2-cell .ant-picker-calendar { font-size: 12px; }
.antd2-cell .ant-tag, .antd2-cell .ant-badge { white-space: nowrap; }
.antd2-cell .ant-input, .antd2-cell .ant-btn { max-width: 100%; }
.antd2-cell .ant-tabs, .antd2-cell .ant-steps, .antd2-cell .ant-progress, .antd2-cell .ant-slider, .antd2-cell .ant-divider, .antd2-cell .ant-space { width: 100%; }
/* 高级章：布局 = 特殊组（预览卡 + 4 列控件），其余组同基础章语言 */
.antd2-canvas.is-adv { gap: 32px; }
.antd2-layout-block { display: flex; flex-direction: column; gap: 8px; }
.antd2-layout { display: flex; flex-direction: column; gap: 16px; }
.antd2-layout-controls { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; align-content: start; }
.antd2-layout-controls .antd2-cell { flex-basis: auto; max-width: none; }
.antd2-adv-grid { display: flex; flex-direction: column; gap: 32px; }
.antd2-adv-col { min-width: 0; display: flex; flex-direction: column; }
.antd2-adv-col .antd2-region-cells { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 32px; align-items: start; }
.antd2-adv-col .antd2-group-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.antd2-adv-col .antd2-group { min-width: 0; }
/* data 看板 */
.dash-shell { display: flex; flex-direction: column; background: #0b0b0b; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; }
.dash-appbar { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.dash-brand { display: flex; align-items: center; gap: 8px; }
.dash-logo { width: 16px; height: 16px; border-radius: 4px; background: linear-gradient(135deg, #6b62f2, #12b76a); }
.dash-brand-t { font-size: 14px; font-weight: 600; color: #ededed; }
.dash-appbar-icons { display: flex; align-items: center; gap: 16px; color: rgba(255,255,255,0.45); font-size: 14px; }
.dash-body { display: flex; min-height: 460px; }
.dash-side { width: 176px; flex: 0 0 176px; padding: 16px 8px; border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 16px; }
.dash-navgroup-t { font-size: 12px; color: rgba(255,255,255,0.35); padding: 0 8px 8px; }
.dash-navitem { font-size: 13px; color: rgba(255,255,255,0.62); padding: 8px; border-radius: 4px; }
.dash-navitem.is-on { background: #1b2f66; color: #fff; font-weight: 500; }
.dash-main { flex: 1 1 auto; min-width: 0; padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 16px; }
.dash-crumb { font-size: 12px; color: rgba(255,255,255,0.4); display: flex; align-items: center; }
.dash-crumb-sep { color: rgba(255,255,255,0.2); margin: 0 4px; }
.dash-headrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
.dash-tabs { display: flex; gap: 2px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 2px; }
.dash-tab { font-size: 12px; padding: 4px 12px; border-radius: 4px; color: rgba(255,255,255,0.55); }
.dash-tab.is-on { background: #1f1f1f; color: #fff; }
.dash-actions { display: flex; align-items: center; gap: 12px; }
.dash-iconbtn { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.55); }
.dash-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.dash-stat { background: #141414; border: 1px solid #303030; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.dash-stat-t { font-size: 12px; color: rgba(255,255,255,0.45); }
.dash-stat-row { display: flex; align-items: baseline; gap: 8px; }
.dash-stat-v { font-size: 24px; font-weight: 600; color: #ededed; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
.dash-delta { font-size: 12px; font-variant-numeric: tabular-nums; }
.dash-delta.up { color: #12b76a; }
.dash-delta.down { color: #f04438; }
.dash-tablecard { background: #141414; border: 1px solid #303030; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.dash-tablehead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dash-tabletitle { font-size: 14px; font-weight: 500; color: #ededed; }
.dash-count { display: inline-block; margin-left: 8px; font-size: 12px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.65); font-variant-numeric: tabular-nums; }
.dash-tools { display: flex; gap: 8px; }
.dash-id { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
.dash-member { display: flex; align-items: center; gap: 8px; }
.dash-avatar { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #fff; }
.dash-member-txt { display: flex; flex-direction: column; line-height: 1.3; }
.dash-name { font-size: 12px; color: #ededed; }
.dash-mail { font-size: 12px; color: rgba(255,255,255,0.35); }
.dash-cell { font-size: 13px; color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; }
.dash-ops { display: flex; gap: 4px; }
.dash-op { width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; padding: 0; }
.dash-op.is-danger { color: #f04438; border-color: rgba(240,68,56,0.4); }
/* ── ant.design Components 面板复刻（按 ant.design 线上 DOM 尺寸 1:1 复刻） ── */
.antd2-chapter.is-collage { margin: 0 0 56px; }
.ac-panel { width: 1320px; max-width: 100%; margin: 0 auto; padding: 32px; border-radius: 16px; background: #242424; border: 1px solid #303030; box-sizing: border-box; }
.ac-panel, .ac-panel * { box-sizing: border-box; }
.ac-row { display: flex; gap: 12px; justify-content: center; align-items: flex-start; }
.ac-col { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.ac-left { width: 457px; flex: 0 1 457px; min-width: 0; }
.ac-left .ac-v { gap: 16px; }
.ac-left .ac-v + .ac-v { margin-top: 8px; }
.ac-left .ac-v > .ac-between { margin-top: 16px; padding: 0 4px; }
.ac-left .ant-steps { margin-top: 16px; }
.ac-mid { width: 453px; flex: 0 1 453px; min-width: 0; }
.ac-right { width: 320px; flex: 0 1 320px; min-width: 0; }
.ac-v { display: flex; flex-direction: column; gap: 16px; }
.ac-sliderrow { display: flex; align-items: center; gap: 10px; }
.ac-sliderrow .ant-slider { flex: 1 1 auto; margin: 4px 2px; }
.ac-slider-pct { flex: 0 0 40px; text-align: right; font-size: 13px; color: rgba(255,255,255,.65); font-variant-numeric: tabular-nums; }
.ac-left .ant-steps .ant-steps-item-icon { width: 32px; height: 32px; line-height: 32px; font-size: 16px; margin-inline-end: 10px; }
.ac-left .ant-steps .ant-steps-item-title { font-size: 16px; line-height: 32px; }
.ac-h { display: flex; align-items: center; gap: 16px; }
.ac-center { justify-content: center; }
.ac-between { justify-content: space-between; gap: 8px; }
/* 左栏 */
.ac-qrrow { display: flex; gap: 12px; align-items: stretch; }
.ac-qrcard { flex: 0 1 140px; width: 140px; min-width: 84px; aspect-ratio: 1 / 1; height: auto; background: #141414; border-radius: 8px; padding: 7px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ac-qrcard .ant-qrcode { background: transparent; padding: 0; width: 100% !important; height: 100% !important; }
.ac-qrcard .ant-qrcode canvas, .ac-qrcard .ant-qrcode svg, .ac-qrcard .ant-qrcode img { width: 100% !important; height: 100% !important; display: block; }
.ac-qrstack { flex: 1 1 auto; min-width: 0; width: auto; display: flex; flex-direction: column; }
.ac-qrrow1 { height: 41px; display: flex; align-items: center; justify-content: space-around; }
.ac-dots2 { display: grid; grid-template-columns: repeat(2, 6px); grid-auto-rows: 6px; gap: 4px; }
.ac-dots2 i { width: 6px; height: 6px; border-radius: 50%; background: #1677ff; display: block; }
.ac-tagcard { height: 34px; background: #141414; border-radius: 8px; padding: 6px; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ac-tagcard .ant-tag { margin-inline-end: 0; }
.ac-color { display: flex; align-items: center; gap: 8px; height: 32px; }
.ac-swatch { width: 24px; height: 24px; border-radius: 4px; background: #1677ff; border: 1px solid rgba(255,255,255,0.16); flex: 0 0 24px; }
.ac-color-t { font-size: 14px; color: rgba(255,255,255,0.85); }
.ac-pop { height: 78px; background: #1f1f1f; border-radius: 8px; box-shadow: 0 6px 16px rgba(0,0,0,0.45); padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ac-pop-b { display: flex; gap: 8px; }
.ac-pop-t { display: flex; align-items: center; gap: 8px; font-size: 14px; color: rgba(255,255,255,0.85); }
.ac-pop-ico { color: #faad14; display: inline-flex; }
.ac-logo-img { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.ac-segcard { background: #141414; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
/* 中栏 */
.ac-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.88); text-align: center; line-height: 24px; }
.ac-sub { font-size: 14px; color: rgba(255,255,255,0.45); text-align: center; line-height: 22px; }
.ac-sub a { color: #1668dc; margin-left: 4px; }
.ac-otp { display: flex; gap: 8px; justify-content: center; }
.ac-otp .ant-input { background: #141414; border-color: #303030; border-radius: 6px; }
.ac-btnrows { display: flex; flex-direction: column; gap: 24px; }
.ac-brandcard { background: #141414; border-radius: 8px; padding: 24px; display: flex; gap: 16px; align-items: flex-start; }
.ac-brandname { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.88); }
.ac-brandhandle { font-size: 14px; color: rgba(255,255,255,0.45); }
.ac-branddesc { font-size: 14px; color: rgba(255,255,255,0.85); margin-top: 8px; }
.ac-notice { position: relative; background: #1f1f1f; border-radius: 8px; padding: 20px 24px; display: flex; gap: 12px; align-items: flex-start; }
.ac-notice-icon { color: #52c41a; font-size: 20px; line-height: 1; margin-top: 2px; }
.ac-notice-main { min-width: 0; }
.ac-notice-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.88); }
.ac-notice-desc { margin-top: 4px; font-size: 14px; line-height: 22px; color: rgba(255,255,255,0.65); }
.ac-notice-close { position: absolute; top: 16px; right: 16px; color: rgba(255,255,255,0.45); font-size: 12px; }
/* 右栏 */
.ac-create { background: #141414; border-radius: 8px; padding: 32px 24px; text-align: center; }
.ac-create > .ac-logo-img { display: flex; justify-content: center; margin-bottom: 16px; }
.ac-create-t { font-size: 20px; font-weight: 600; line-height: 28px; color: rgba(255,255,255,0.88); margin: 0 0 10px; }
.ac-create-d { font-size: 14px; line-height: 22px; color: rgba(255,255,255,0.45); text-align: center; margin: 0 0 24px; }
.ac-create > .ant-btn-primary { margin-bottom: 16px; }
.ac-create .ant-divider { margin: 16px 0; font-size: 12px; color: rgba(255,255,255,0.45); }
.ac-create .ant-divider .ant-divider-inner-text { line-height: 19px; font-size: 12px; }
.ac-create-btns { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.ac-modal { position: relative; background: #1f1f1f; border-radius: 8px; padding: 20px 24px; }
.ac-modal-close { position: absolute; top: 20px; right: 24px; color: rgba(255,255,255,0.45); font-size: 14px; }
.ac-modal-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.88); margin-bottom: 8px; }
.ac-modal-desc { margin-top: 12px; font-size: 14px; line-height: 22px; color: rgba(255,255,255,0.65); }
.ac-modal-footer { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 1480px) {
  .ac-panel { padding: 24px; }
  .ac-row { flex-wrap: wrap; }
}


@media (max-width: 1480px) {
  .teach-content.is-wide { flex: 0 1 1120px; width: 1120px; max-width: 1120px; }
  .antd2-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dash-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .teach-content.is-wide { flex: 0 1 100%; width: auto; max-width: 848px; }
}
@media (max-width: 900px) {
  .antd2-cols { grid-template-columns: minmax(0, 1fr); }
  .antd2-layout-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dash-body { flex-direction: column; }
  .dash-side { width: 100%; flex: 0 0 auto; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.07); flex-direction: row; overflow-x: auto; }
  .dash-navgroup { min-width: 150px; }
}
/* ── 响应式断点：宽度收窄时先收右栏 TOC，再收侧栏，最后单列 ── */
.antd-page, .showcase, .teach-content { min-width: 0; }
@media (max-width: 1280px) {
  .teach-toc { display: none; }
}
@media (max-width: 960px) {
  .gen-teach-side { width: 64px; flex: 0 0 64px; padding: 16px 8px; }
  .gen-teach-label, .gen-teach-name { display: none; }
  .gen-teach-nav { margin-left: 0; border-left: 0; padding-left: 0; }
  .gen-teach-nav-item { justify-content: center; padding: 0; }
  .teach-layout { padding: 16px 16px 96px; }
}
@media (max-width: 720px) {
  .gen-teach-body { flex-direction: column; }
  .gen-teach-side { width: 100%; flex: 0 0 auto; height: auto; flex-direction: row; align-items: center; gap: 4px; padding: 8px 12px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; overflow-y: hidden; }
  .gen-teach-label { display: none; }
  .gen-teach-nav { flex-direction: row; margin-left: 0; border-left: 0; padding-left: 0; gap: 4px; }
  .gen-teach-nav-item { width: auto; flex: 0 0 auto; padding: 0 10px; }
  .gen-teach-side .gen-teach-name { display: inline; }
  .teach-layout { padding: 16px 16px 80px; }
  .antd-grid { grid-template-columns: minmax(0, 1fr); }
  .showcase-pair { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .showcase-tiles { grid-template-columns: minmax(0, 1fr); }
  .showcase { padding: 20px 16px; }
}
.antd-pending { padding: 60px 0; text-align: center; font-size: 13px; color: var(--c-slate); }
.dash-action { margin: 8px 0 0; font-size: 12px; color: #7ee787; letter-spacing: .01em; }

/* 滚动条：只换颜色，宽度/行为不动（scrollbar-color 可继承 ⇒ :host 设一次，影子内所有滚动容器跟着变） */
:host(.dark) { scrollbar-color: rgba(255,255,255,.22) transparent; }
:host(.light) { scrollbar-color: rgba(0,0,0,.28) transparent; }

/* ───────────── light mode ─────────────
   开关统一用调试壳 devview 的那个 ☾：它切 body.dark/.light，同时把同样类名打到
   appview 宿主 ⇒ 影子样式用 :host(.light) 命中。demos 跟 body.dark 走，两边保持同频。 */
:host(.light) {
  --c-void: #ffffff;
  --c-graphite: #f2f2f2;
  --c-bone: #171717;
  --c-ash: #3f3f3f;
  --c-slate: #767676;
  --c-smoke: #4d4d4d;
}
:host(.light) [data-genesis="app"] {
  --color-md-fg: #3f3f3f;
  --color-md-heading: #171717;
  --color-md-muted: #8a8a8a;
  --color-md-border: rgba(0,0,0,0.12);
  --color-md-code-bg: rgba(0,0,0,0.05);
  --color-md-code-border: rgba(0,0,0,0.10);
  --color-md-inline-code-bg: rgba(107,98,242,0.12);
  --color-md-inline-code-fg: #4b3fd4;
  --color-md-blockquote-fg: #4d4d4d;
  --color-md-blockquote-border: rgba(0,0,0,0.18);
  --color-md-link: #5b52e0;
  --color-md-table-header-bg: rgba(0,0,0,0.04);
  --color-md-table-stripe: rgba(0,0,0,0.02);
  --color-md-scroll: rgba(0,0,0,0.25);
  --color-md-scroll-hover: rgba(0,0,0,0.4);
  --color-md-mark-bg: rgba(107,98,242,0.18);
}
/* 白色叠层体系翻成黑色叠层（首页 / 教学壳 / 卡片都按这套写法） */
:host(.light) .text-white { color: #171717; }
:host(.light) .text-white\/90 { color: rgba(0,0,0,.9); }
:host(.light) .text-white\/80 { color: rgba(0,0,0,.8); }
:host(.light) .text-white\/70 { color: rgba(0,0,0,.7); }
:host(.light) .text-white\/65 { color: rgba(0,0,0,.65); }
:host(.light) .text-white\/60 { color: rgba(0,0,0,.6); }
:host(.light) .text-white\/55 { color: rgba(0,0,0,.55); }
:host(.light) .text-white\/50 { color: rgba(0,0,0,.5); }
:host(.light) .text-white\/30 { color: rgba(0,0,0,.3); }
:host(.light) .text-white\/25 { color: rgba(0,0,0,.25); }
:host(.light) .text-white\/20 { color: rgba(0,0,0,.2); }
:host(.light) .bg-white { background-color: #171717; }
:host(.light) .bg-white\/10 { background-color: rgba(0,0,0,.1); }
:host(.light) .bg-white\/15 { background-color: rgba(0,0,0,.15); }
:host(.light) .bg-white\/\[0\.06\] { background-color: rgba(0,0,0,.06); }
:host(.light) .border-white\/10 { border-color: rgba(0,0,0,.1); }
:host(.light) .border-white\/15 { border-color: rgba(0,0,0,.15); }
:host(.light) .border-white\/\[0\.06\] { border-color: rgba(0,0,0,.06); }
:host(.light) .border-white\/\[0\.07\] { border-color: rgba(0,0,0,.07); }
:host(.light) .hover\:text-white:hover { color: #171717; }
:host(.light) .hover\:text-white\/90:hover { color: rgba(0,0,0,.9); }
:host(.light) .hover\:bg-white\/\[0\.04\]:hover { background-color: rgba(0,0,0,.04); }
:host(.light) .hover\:border-white\/20:hover { border-color: rgba(0,0,0,.2); }
:host(.light) .hover\:border-white\/25:hover { border-color: rgba(0,0,0,.25); }
/* 壳与 markdown 里的硬编码深色 */
:host(.light) .teach-content .mdio-doc h1 { color: rgba(0,0,0,.9); }
:host(.light) .teach-content .mdio-doc h2 { color: #171717; }
:host(.light) .teach-main .mdio-doc pre { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.09); }
/* 教学页 markdown 统一排版的浅色对应（所有页共用） */
:host(.light) .teach-content .mdio-doc hr { border-top-color: rgba(0,0,0,.1); }
:host(.light) .teach-content .mdio-doc code { color: #1f1f1f; background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.1); }
:host(.light) .teach-content .mdio-doc pre { background: #f6f6f7; border-color: rgba(0,0,0,.1); }
:host(.light) .teach-content .mdio-doc pre code { color: #1f1f1f; }
:host(.light) .teach-content .mdio-doc blockquote { border-left-color: rgba(0,0,0,.18); background: rgba(0,0,0,.03); }
:host(.light) .teach-content .mdio-doc table { border-color: rgba(0,0,0,.12); }
:host(.light) .teach-content .mdio-doc thead th { background: rgba(0,0,0,.04); border-bottom-color: rgba(0,0,0,.12); }
:host(.light) .teach-content .mdio-doc tbody td { border-bottom-color: rgba(0,0,0,.06); }
:host(.light) .teach-content .mdio-doc tbody tr:nth-child(odd) td { background: rgba(0,0,0,.02); }
:host(.light) .teach-content .mdio-doc tbody tr:hover td { background: rgba(0,0,0,.04); }
/* UI 页 md 章节的浅色对应 */
:host(.light) .antd-doc-sec > .mdio-std h2,
:host(.light) .antd-doc-sec > .mdio-std h3 { color: #171717; }
:host(.light) .antd-doc-sec > p,
:host(.light) .antd-doc-sec > ul,
:host(.light) .antd-doc-sec > ol { color: #3f3f3f; }
:host(.light) .antd-doc-sec > .md-codeblock { background: #f6f6f7; border-color: rgba(0,0,0,.1); }
:host(.light) .antd-doc-sec > .md-codeblock code { color: #1f1f1f; }
@media (max-width: 720px) {
  :host(.light) .gen-teach-side { border-bottom-color: rgba(0,0,0,.07); }
}
/* ow 动图页：背景直接纯黑 / 纯白（demo 自身透明，无框无底） */
:host(.light) .gen-teach-shell.is-ow-canvas { background: #fff; }
:host(.light) .gen-teach-shell { --ui-demo-bd: rgba(0,0,0,.12); --ui-demo-bg: rgba(0,0,0,.03); }
/* antd 组件页的浅色文案与容器（深色 demo 卡本身是产品 mock，保留） */
:host(.light) .antd-page-h { color: #171717; }
:host(.light) .antd-page-meta, :host(.light) .antd-sub-h { color: rgba(0,0,0,.45); }
:host(.light) .antd-card { border-color: rgba(0,0,0,.1); background: rgba(0,0,0,.02); }
:host(.light) .antd-card:hover { border-color: rgba(0,0,0,.2); background: rgba(0,0,0,.04); }
:host(.light) .antd-card-name { color: #171717; }
:host(.light) .antd-card-val { background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.07); }
:host(.light) .antd-row { border-color: rgba(0,0,0,.08); background: rgba(0,0,0,.03); }
:host(.light) .showcase { border-color: rgba(0,0,0,.08); background: rgba(0,0,0,.015); }
:host(.light) .showcase-title { color: #171717; }
:host(.light) .showcase-h { color: rgba(0,0,0,.45); }
:host(.light) .showcase-tile { border-color: rgba(0,0,0,.08); background: rgba(0,0,0,.02); }
:host(.light) .antd2-chapter-head { border-bottom-color: rgba(0,0,0,.08); }
:host(.light) .antd2-region-h { border-bottom-color: rgba(0,0,0,.06); }
:host(.light) .antd2-region-name { color: rgba(0,0,0,.88); }
:host(.light) .antd2-region-count, :host(.light) .antd2-region-hint { color: rgba(0,0,0,.36); }
:host(.light) .antd2-group-name { color: rgba(0,0,0,.56); }
:host(.light) .antd2-group-n { color: rgba(0,0,0,.28); }

/* @wts-tailwind:start */
/*! tailwindcss v0.0.0-insiders.fa81d69 | MIT License | https://tailwindcss.com */
@layer properties;
:root, :host {
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  --color-white: #fff;
  --spacing: 0.25rem;
  --text-xs: 0.75rem;
  --text-xs--line-height: calc(1 / 0.75);
  --text-sm: 0.875rem;
  --text-sm--line-height: calc(1.25 / 0.875);
  --font-weight-medium: 500;
  --leading-snug: 1.375;
  --radius-lg: 0.5rem;
  --default-transition-duration: 150ms;
  --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
.sticky {
  position: sticky;
}
.top-4 {
  top: calc(var(--spacing) * 4);
}
.m-0 {
  margin: 0px;
}
.mx-auto {
  margin-inline: auto;
}
.mt-4 {
  margin-top: calc(var(--spacing) * 4);
}
.mt-\[10px\] {
  margin-top: 10px;
}
.mt-\[16px\] {
  margin-top: 16px;
}
.mb-3 {
  margin-bottom: calc(var(--spacing) * 3);
}
.mb-\[2px\] {
  margin-bottom: 2px;
}
.mb-\[6px\] {
  margin-bottom: 6px;
}
.mb-\[10px\] {
  margin-bottom: 10px;
}
.mb-\[12px\] {
  margin-bottom: 12px;
}
.mb-\[14px\] {
  margin-bottom: 14px;
}
.ml-\[13px\] {
  margin-left: 13px;
}
.block {
  display: block;
}
.flex {
  display: flex;
}
.grid {
  display: grid;
}
.inline-block {
  display: inline-block;
}
.h-8 {
  height: calc(var(--spacing) * 8);
}
.h-9 {
  height: calc(var(--spacing) * 9);
}
.h-12 {
  height: calc(var(--spacing) * 12);
}
.min-h-0 {
  min-height: 0px;
}
.w-\[200px\] {
  width: 200px;
}
.w-\[224px\] {
  width: 224px;
}
.w-full {
  width: 100%;
}
.max-w-\[720px\] {
  max-width: 720px;
}
.min-w-0 {
  min-width: 0px;
}
.flex-1 {
  flex: 1;
}
.shrink-0 {
  flex-shrink: 0;
}
.cursor-pointer {
  cursor: pointer;
}
.appearance-none {
  appearance: none;
}
.grid-cols-\[132px_minmax\(0\,1fr\)\] {
  grid-template-columns: 132px minmax(0,1fr);
}
.flex-col {
  flex-direction: column;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.gap-0\.5 {
  gap: calc(var(--spacing) * 0.5);
}
.gap-1 {
  gap: var(--spacing);
}
.gap-2 {
  gap: calc(var(--spacing) * 2);
}
.gap-2\.5 {
  gap: calc(var(--spacing) * 2.5);
}
.gap-3 {
  gap: calc(var(--spacing) * 3);
}
.gap-\[8px\] {
  gap: 8px;
}
.gap-x-\[14px\] {
  column-gap: 14px;
}
.gap-y-\[9px\] {
  row-gap: 9px;
}
.self-start {
  align-self: flex-start;
}
.overflow-y-auto {
  overflow-y: auto;
}
.rounded-\[10px\] {
  border-radius: 10px;
}
.rounded-\[12px\] {
  border-radius: 12px;
}
.rounded-\[16px\] {
  border-radius: 16px;
}
.rounded-\[20px\] {
  border-radius: 20px;
}
.rounded-full {
  border-radius: calc(infinity * 1px);
}
.rounded-lg {
  border-radius: var(--radius-lg);
}
.border {
  border-style: var(--tw-border-style);
  border-width: 1px;
}
.border-0 {
  border-style: var(--tw-border-style);
  border-width: 0px;
}
.border-b {
  border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
}
.border-l {
  border-left-style: var(--tw-border-style);
  border-left-width: 1px;
}
.border-\[color-mix\(in_srgb\,var\(--swap-accent\)_45\%\,var\(--color-app-border\)\)\] {
  border-color: var(--swap-accent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in srgb,var(--swap-accent) 45%,var(--color-app-border));
  }
}
.border-\[var\(--color-app-border\)\] {
  border-color: var(--color-app-border);
}
.border-\[var\(--swap-accent\)\] {
  border-color: var(--swap-accent);
}
.border-white\/\[0\.06\] {
  border-color: color-mix(in srgb, #fff 6%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-white) 6%, transparent);
  }
}
.border-white\/\[0\.07\] {
  border-color: color-mix(in srgb, #fff 7.000000000000001%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-white) 7.000000000000001%, transparent);
  }
}
.bg-\[color-mix\(in_srgb\,var\(--swap-accent\)_14\%\,transparent\)\] {
  background-color: var(--swap-accent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in srgb,var(--swap-accent) 14%,transparent);
  }
}
.bg-\[var\(--color-app-surface\)\] {
  background-color: var(--color-app-surface);
}
.bg-\[var\(--swap-accent\)\] {
  background-color: var(--swap-accent);
}
.bg-transparent {
  background-color: transparent;
}
.p-10 {
  padding: calc(var(--spacing) * 10);
}
.px-2 {
  padding-inline: calc(var(--spacing) * 2);
}
.px-3 {
  padding-inline: calc(var(--spacing) * 3);
}
.px-4 {
  padding-inline: calc(var(--spacing) * 4);
}
.px-\[2px\] {
  padding-inline: 2px;
}
.px-\[10px\] {
  padding-inline: 10px;
}
.px-\[12px\] {
  padding-inline: 12px;
}
.px-\[15px\] {
  padding-inline: 15px;
}
.px-\[24px\] {
  padding-inline: 24px;
}
.px-\[26px\] {
  padding-inline: 26px;
}
.py-1 {
  padding-block: var(--spacing);
}
.py-4 {
  padding-block: calc(var(--spacing) * 4);
}
.py-\[2px\] {
  padding-block: 2px;
}
.py-\[6px\] {
  padding-block: 6px;
}
.py-\[7px\] {
  padding-block: 7px;
}
.py-\[9px\] {
  padding-block: 9px;
}
.py-\[22px\] {
  padding-block: 22px;
}
.py-\[24px\] {
  padding-block: 24px;
}
.pt-\[8px\] {
  padding-top: 8px;
}
.pb-\[40px\] {
  padding-bottom: 40px;
}
.pl-3 {
  padding-left: calc(var(--spacing) * 3);
}
.text-left {
  text-align: left;
}
.font-mono {
  font-family: var(--font-mono);
}
.text-sm {
  font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
}
.text-xs {
  font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
}
.text-\[11\.5px\] {
  font-size: 11.5px;
}
.text-\[11px\] {
  font-size: 11px;
}
.text-\[13\.5px\] {
  font-size: 13.5px;
}
.text-\[13px\] {
  font-size: 13px;
}
.text-\[18px\] {
  font-size: 18px;
}
.text-\[20px\] {
  font-size: 20px;
}
.text-\[40px\] {
  font-size: 40px;
}
.leading-\[1\.6\] {
  --tw-leading: 1.6;
  line-height: 1.6;
}
.leading-none {
  --tw-leading: 1;
  line-height: 1;
}
.leading-snug {
  --tw-leading: var(--leading-snug);
  line-height: var(--leading-snug);
}
.font-\[650\] {
  --tw-font-weight: 650;
  font-weight: 650;
}
.font-medium {
  --tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
}
.tracking-\[\.06em\] {
  --tw-tracking: .06em;
  letter-spacing: .06em;
}
.text-\[\#686868\] {
  color: #686868;
}
.text-\[var\(--color-app-fg\)\] {
  color: var(--color-app-fg);
}
.text-\[var\(--color-app-fg-muted\)\] {
  color: var(--color-app-fg-muted);
}
.text-\[var\(--color-md-fg\)\] {
  color: var(--color-md-fg);
}
.text-\[var\(--swap-accent\)\] {
  color: var(--swap-accent);
}
.text-white {
  color: var(--color-white);
}
.text-white\/20 {
  color: color-mix(in srgb, #fff 20%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 20%, transparent);
  }
}
.text-white\/30 {
  color: color-mix(in srgb, #fff 30%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 30%, transparent);
  }
}
.text-white\/50 {
  color: color-mix(in srgb, #fff 50%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 50%, transparent);
  }
}
.text-white\/55 {
  color: color-mix(in srgb, #fff 55%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 55%, transparent);
  }
}
.text-white\/70 {
  color: color-mix(in srgb, #fff 70%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 70%, transparent);
  }
}
.text-white\/80 {
  color: color-mix(in srgb, #fff 80%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 80%, transparent);
  }
}
.text-white\/90 {
  color: color-mix(in srgb, #fff 90%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-white) 90%, transparent);
  }
}
.shadow-\[0_1px_2px_rgba\(0\,0\,0\,\.05\)\] {
  --tw-shadow: 0 1px 2px var(--tw-shadow-color, rgba(0,0,0,.05));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
}
.transition-colors {
  transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
}
.\[--swap-accent\:\#3b82f6\] {
  --swap-accent: #3b82f6;
}
.\[--swap-accent\:\#f59e0b\] {
  --swap-accent: #f59e0b;
}
@media (hover: hover) {
  .hover\:text-white:hover {
    color: var(--color-white);
  }
}
.disabled\:opacity-60:disabled {
  opacity: 60%;
}
@property --tw-border-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}
@property --tw-leading {
  syntax: "*";
  inherits: false;
}
@property --tw-font-weight {
  syntax: "*";
  inherits: false;
}
@property --tw-tracking {
  syntax: "*";
  inherits: false;
}
@property --tw-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-shadow-color {
  syntax: "*";
  inherits: false;
}
@property --tw-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
@property --tw-inset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-inset-shadow-color {
  syntax: "*";
  inherits: false;
}
@property --tw-inset-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}
@property --tw-ring-color {
  syntax: "*";
  inherits: false;
}
@property --tw-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-inset-ring-color {
  syntax: "*";
  inherits: false;
}
@property --tw-inset-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-ring-inset {
  syntax: "*";
  inherits: false;
}
@property --tw-ring-offset-width {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
@property --tw-ring-offset-color {
  syntax: "*";
  inherits: false;
  initial-value: #fff;
}
@property --tw-ring-offset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@layer properties {
  @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {
    *, ::before, ::after, ::backdrop {
      --tw-border-style: solid;
      --tw-leading: initial;
      --tw-font-weight: initial;
      --tw-tracking: initial;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-color: initial;
      --tw-shadow-alpha: 100%;
      --tw-inset-shadow: 0 0 #0000;
      --tw-inset-shadow-color: initial;
      --tw-inset-shadow-alpha: 100%;
      --tw-ring-color: initial;
      --tw-ring-shadow: 0 0 #0000;
      --tw-inset-ring-color: initial;
      --tw-inset-ring-shadow: 0 0 #0000;
      --tw-ring-inset: initial;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-offset-shadow: 0 0 #0000;
    }
  }
}
/* @wts-tailwind:end */
```
