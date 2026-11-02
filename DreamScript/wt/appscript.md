# script app

- 说明: 剧本集 app（画廊 + 阅读页）—— **纯渲染**：store（MST：`script` 绑定一篇 md / `scripts` 是 map+list 并 computed 出封面字段）· comps（顶栏/封面卡/阅读页）· 路由走壳注入的 `appRouter`（hash 段，不用 `@esmx/router`）。

## app

```jsx@app
import { useEffect, useRef, useState, useMemo } from 'react';
import { types, flow, getRoot, getEnv } from 'mobx-state-tree';
import { observable } from 'mobx';
import { observer } from 'mobx-react-lite';
// 新架构 B2：认领与可见性策略归 app —— 直接复用 ui_std/claimEval（与 basic_render 同款，零自造）。
import { createClaimEval, createChainWalk } from 'ui_std/claimEval';
import { MDRoot } from 'ui_std/comps';
export { createClaimEval, createChainWalk };

const DIR = '/scripts/';

// ── store ①：一篇 md 一个店；店只存 path，字段**每次从活树读**（阶段①-5）────────────
//   封面不再是「载入时抄一份」，而是「渲染时读 wt.by.get(docId) 那棵 MD 活树」——
//   F/P 帧改树 ⇒ 读它的 observer 自动重渲（增量；不 exec、不刷新）。
//   取活树的路径与 Node.gates 同款：getRoot(self) 爬到持有盒 wtBox（volatile + box 才能被追踪）。
const Script = types.model('Script', {
  path: types.identifier,
}).views((self) => {
  const wtOf = () => {
    const root = getRoot(self);
    const box = root && root.wtBox;
    return box && typeof box.get === 'function' ? box.get() : null;
  };
  const mdOf = () => {
    const wt = wtOf();
    const id = wt && wt.byPath ? wt.byPath[self.path] : undefined;
    return wt && id != null ? (wt.by.get(String(id)) || null) : null;
  };
  // 根 → h1 → bl → 「- KEY: 值」：与旧 tojson 解析同字段（编剧 / 稿次 / 日期）
  const field = (key) => {
    const md = mdOf();
    const h = md && md.kids[0];
    const bl = h ? h.kids.find((n) => n && n.nt === 'bl') : null;
    const b = bl ? bl.kids.find((n) => n && n.t === key) : null;
    const v = b && b.kids[0];
    return v && v.ct != null ? String(v.ct) : '';
  };
  return {
    get label() { return String(self.path).replace(/^.*[/]/, '').replace(/[.]md$/, ''); },
    get title() { const md = mdOf(); const h = md && md.kids[0]; return (h && h.t) || self.label; },
    get writer() { return field('编剧'); },
    get draft() { return field('稿次'); },
    get date() { return field('日期'); },
    // 场数（②-4）：从活树里数 h2 节点（递归本节点子树）—— 不加 API、不引依赖，随活树更新。
    get scenes() { const md = mdOf(); if (!md) return 0; let n = 0; const walk = (ns) => { for (const k of ns) { if (!k) continue; if (k.nt === 'h' && k.lv === 2) n += 1; if (k.kids && k.kids.length) walk(k.kids); } }; walk(md.kids); return n; },
    get cover() { const s = self; return { path: s.path, title: s.title, writer: s.writer, draft: s.draft, date: s.date, scenes: s.scenes }; },
  };
});

// ── store ②：byPath + order + 活树持有盒 wtBox ─────────────────────────────────
const Scripts = types.model('Scripts', {
  byPath: types.map(Script),
  order: types.array(types.string),
  loaded: types.optional(types.boolean, false),   // 清单装载完成（空态判据：loaded 且 0 条 ⇒ 才提示，避免装载途中闪空态）
}).volatile((self) => ({
  // 活树持有位：volatile + observable.box（与 uiStore 的 docBox / Wt 的 uiBox 同款；不进快照）
  wtBox: observable.box(null, { deep: false }),
})).views((self) => ({
  get list() { return self.order.map((k) => self.byPath.get(k)).filter(Boolean); },
  get frontPage() { return self.list.map((s) => s.cover); },
  get count() { return self.order.length; },
  at(path) { return self.byPath.get(String(path || '')) || null; },
})).actions((self) => ({
  setWt(wt) { self.wtBox.set(wt || null); },
  setLoaded(v) { self.loaded = !!v; },
  // 契约（阶段②-1）：wt.files 过滤 → 逐篇 wt.observe(path) → 建/补齐 Script → 有界等 phaseOf===ready。
  // 先建 Script 再等：卡片立刻在（字段是活树视图，帧到了自己填），等待只作「列出即已装载」的顺序保证。
  load: flow(function* (wt) {
    const names = (wt && Array.isArray(wt.files) ? wt.files : [])
      .map((f) => String((f && f.path) || ''))
      .filter((p) => p.indexOf(DIR) === 0 && p.slice(-3) === '.md' && p.slice(DIR.length).indexOf('/') < 0);
    self.setWt(wt);
    self.setLoaded(false);
    for (const p of names) { try { wt.observe(p); } catch (e) { /* 登记失败不挡画 */ } }
    names.forEach((path) => { let one = self.byPath.get(path); if (!one) self.byPath.put(Script.create({ path: path })); });
    self.order.replace(names);
    Array.from(self.byPath.keys()).forEach((k) => { if (names.indexOf(k) < 0) self.byPath.delete(k); });
    const t0 = Date.now();
    while (wt && Date.now() - t0 < 8000) {
      const waiting = names.some((p) => { const id = wt.byPath[p]; return id == null || wt.phaseOf(id) !== 'ready'; });
      if (!waiting) break;
      yield new Promise((r) => setTimeout(r, 80));
    }
    self.setLoaded(true);
  }),
}));
export const Store = Scripts;   // app 店类型（决策点乙：runtime 拼进 root.app，组件收 store prop）

// ── 组件（comps）────────────────────────────────────────────────────────────
const Chrome = observer(function Chrome({ scripts, doc, active, onHome, onOpen, children, wt, route }) {
  // 当前篇**从路由现场读**（RouterShell 的 view 是首帧闭包 ⇒ 不能靠 props 里的 doc）
  const liveDoc = route && String(route).indexOf('/doc/') === 0 ? decodeURIComponent(String(route).slice(5)) : String(doc || '');
  const cur = scripts.at(liveDoc);
  // header 右侧（②-2 / ②-4）：阅读页 = 剧本 · 稿次 · 日期；画廊 = 真实汇总（共 N 部 · 场数 M）—— 不留空、不显示 app 自身档路径。
  const scenesTotal = scripts.list.reduce((a, s) => a + (s.scenes || 0), 0);
  const curLabel = active === 'reader'
    ? (cur ? String(cur.label) + (cur.draft ? ' · ' + cur.draft : '') + (cur.date ? ' · ' + cur.date : '') : String(doc || ''))
    : ('共 ' + scripts.count + ' 部 · 场数 ' + scenesTotal);
  return (
    <div className="app-scripts" data-app="scripts" data-phase={(wt && typeof wt.phaseOf === 'function' && wt.phaseOf(wt.byPath[liveDoc])) || ''}>
      <header className="app-scripts-top">
        <span className="app-scripts-brand">剧本集</span>
        <span className="app-scripts-count">{scripts.count} 部</span>
        {/* 阅读页：返回键与当前篇信息**并到左侧**（与品牌同排，发丝分隔）；右侧只留画廊汇总。 */}
        {active === 'reader' ? (
          <>
            <span className="app-scripts-sep" aria-hidden="true" />
            <button type="button" className="app-scripts-back" onClick={onHome}>← 返回剧本集</button>
            <span className="app-scripts-cur">
              <span className="app-scripts-cur-name">{cur ? String(cur.label) : String(doc || '')}</span>
              {cur && (cur.draft || cur.date) ? (
                <span className="app-scripts-cur-meta">{' · ' + [cur.draft, cur.date].filter(Boolean).join(' · ')}</span>
              ) : null}
            </span>
          </>
        ) : null}
        <span className="app-scripts-spacer" />
        {active === 'reader' ? null : <span className="app-scripts-cur">{curLabel}</span>}
      </header>
      <div className="app-scripts-body">
        {/* rail 的角色（②-4）：**首页不显示**（卡片即清单）；只有阅读页留作「切换剧本」。 */}
        {active === 'reader' ? (
          <aside className="app-scripts-side" data-app-list="1">
            <div className="app-scripts-rail-h">剧本</div>
            {scripts.loaded && scripts.list.length === 0 ? <div className="app-scripts-empty-rail">/scripts 下还没有剧本</div> : null}
            {scripts.list.map((s) => (
              <button key={s.path} type="button" data-doc={s.path} title={s.path}
                className={'app-scripts-item' + (s.path === liveDoc ? ' on' : '')}
                onClick={() => onOpen(s)}>{s.label}</button>
            ))}
          </aside>
        ) : null}
        <main className="app-scripts-main">{children}</main>
      </div>
    </div>
  );
});

const Gallery = observer(function Gallery({ scripts, onOpen, wt }) {
  // 卡片三态（②-2）：ready 画真卡；pending / 未观测 画**同尺寸骨架**（8.5:11 由 .app-scripts-card 承接）；
  //   error 画通用失败占位 —— **不显示 reason**（app 只读三态字符串，读不到也不该读细节）。
  const phaseOfCard = (path) => {
    const id = wt && wt.byPath ? wt.byPath[path] : undefined;
    return id != null && wt && typeof wt.phaseOf === 'function' ? wt.phaseOf(id) : undefined;
  };
  const items = scripts.frontPage;
  return (
    <div className="app-scripts-home">
      <h1 className="app-scripts-h">剧本集</h1>
      {scripts.loaded && items.length === 0 ? <div className="app-scripts-empty">/scripts 下还没有剧本</div> : null}
      <div className="app-scripts-grid">
        {items.map((c) => {
          const phase = phaseOfCard(c.path);
          if (phase === 'error') return (
            <button key={c.path} type="button" className="app-scripts-card is-error" data-cover={c.path} data-state="error" disabled>暂时打不开</button>
          );
          if (phase !== 'ready') return (
            <button key={c.path} type="button" className="app-scripts-card is-skeleton" data-cover={c.path} data-state="pending" aria-busy="true" disabled>
              <span className="app-scripts-sk-line" />
              <span className="app-scripts-sk-line short" />
              <span className="app-scripts-sk-block" />
            </button>
          );
          return (
            <button key={c.path} type="button" className="app-scripts-card" data-cover={c.path} data-state="ready" onClick={() => onOpen(scripts.at(c.path))}>
              <span className="app-scripts-card-title">{c.title}</span>
              {c.writer ? <span className="app-scripts-card-by">Written by<br />{c.writer}</span> : null}
              <span className="app-scripts-card-draft">{[c.draft, c.date].filter(Boolean).join(' · ')}</span>
              <span className="app-scripts-card-scenes">场数 {c.scenes || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const Reader = observer(function Reader({ scripts, renderNode, wt, route }) {
  const p = route && String(route).indexOf('/doc/') === 0 ? decodeURIComponent(String(route).slice(5)) : '';
  const [obs, setObs] = useState(null);
  // 需求登记与**「这一篇在不在」**都取 `observe` 的结果（判据必须来自它，不能只查 byPath：首帧还没装载）
  useEffect(() => { if (!p || !wt) { setObs(null); return; } try { setObs(wt.observe(p)); } catch (e) { setObs({ ok: false }); } }, [p, wt]);
  const unknown = !!(obs && obs.ok === false);
  const id = wt && wt.byPath ? wt.byPath[p] : undefined;
  const phase = id != null && wt.phaseOf ? wt.phaseOf(id) : undefined;
  const skel = { width: '100%', height: '68vh', background: 'var(--line)', opacity: .22, borderRadius: 6 };
  if (p && unknown) return (<div className="app-scripts-reader" data-state="error"><div style={{ padding: '24px 4px', fontSize: 13, opacity: .7 }}>打不开这一篇：{p}</div></div>);
  if (p && phase === 'pending') return (<div className="app-scripts-reader" data-state="pending"><div style={skel} /></div>);
  if (p && phase === 'error') return (<div className="app-scripts-reader" data-state="error"><div style={{ padding: '24px 4px', fontSize: 13, opacity: .7 }}>暂时打不开：{p}</div></div>);
  return (<div className="app-scripts-reader" data-state="ready"><MDRoot renderNode={renderNode} /></div>);
});

// ── app：页内路由走壳注入的 appRouter（hash 段）；不用 @esmx/router ──
export default observer(function ScriptApp({ app }) {
  // 契约 { app }：app = 总店 app 槽挂的 app 店；工具（renderNode/read/exec/appRouter）一律 getEnv(app) 取（env 范式）
  const env = app ? (getEnv(app) || {}) : {};
  const mainRoot = typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const ui = mainRoot && mainRoot.decl;
  const wt = mainRoot && mainRoot.wts && mainRoot.wts.wt;
  // 文件面晚于 app 挂载是常态（fullTree/树帧异步到）⇒ 清单长度参与触发，装载完自动补列。
  const wtFileCount = wt && Array.isArray(wt.files) ? wt.files.length : 0;
  const exec = env.exec;
  const appRouter = env.appRouter;
  const scripts = app;
  // **URL(hash) 是唯一路由来源**（P1）：`route` = 当前页；订阅 hash 驱动它；渲染直接由它决定。
  //   `@esmx/router`（memory）**已从 app 撤掉** —— 本 app 只有两个平级页，不需要路由库（note §82.5 也把它降为可选库）。
  const hashPath = String(location.hash || '').replace(/^#/, '');
  const urlDoc = String(new URLSearchParams(location.search).get('route') || new URLSearchParams(location.search).get('app') || '');
  const isScriptDocOf = (p) => /^\/scripts\/[^/]+\.md$/.test(String(p || '')) && !!(scripts.at(p) || (wt && wt.byPath && wt.byPath[p]));
  const [route, setRoute] = useState(() => hashPath || (isScriptDocOf(urlDoc) ? '/doc/' + encodeURIComponent(urlDoc) : '/'));
  useEffect(() => {
    if (!appRouter || typeof appRouter.subscribe !== 'function') return undefined;
    return appRouter.subscribe((r) => setRoute(String(r || '/') || '/'));
  }, [appRouter]);
  // 深链（`?app=/scripts/*`）首屏：把算出的页写回 hash，使 URL 与显示一致（replace 不加历史）。
  useEffect(() => { if (!hashPath && String(route).indexOf('/doc/') === 0 && appRouter && appRouter.replace) appRouter.replace(route); }, []);
  const nav = (p) => { if (appRouter && appRouter.push) appRouter.push(p); };
  useEffect(() => { if (scripts && wt) scripts.load(wt); }, [wt, wtFileCount]);
  // **换树即回首页**：hash 是 app 自己的页状态，不跨 wt 携带 —— 从别的 wt 切进来若还停在
  //   「某一篇的读者页」，读者页画的是**壳的当前档**（壳在新 wt 里按 boot 约定开的是 /README.md），
  //   实测就是「一进来看到一篇无关的 md」。所以 wt 一变，页回首页、指针清空。
  const wtSeen = useRef(wt);
  useEffect(() => {
    if (!wt) return;
    if (wtSeen.current && wtSeen.current !== wt) {
      setRoute('/');
      if (appRouter && appRouter.replace) appRouter.replace('/');
      if (appRouter && appRouter.setDocPointer) appRouter.setDocPointer(null);
    }
    wtSeen.current = wt;
  }, [wt]);
  // **文档页要把指针再声明一次**：换树后壳会按 boot 约定新开一篇；app 在自己是文档页时重新声明，
  //   壳的当前档才与「读者页显示的这一篇」一致（读者页的正文由壳的原语 renderNode() 出）。
  useEffect(() => {
    const dp = String(route || '');
    if (dp.indexOf('/doc/') !== 0 || !appRouter || typeof appRouter.setDocPointer !== 'function') return;
    appRouter.setDocPointer(decodeURIComponent(dp.slice(5)));
  }, [route, wt]);
  // 开档 = 基线「指针归一入口」：app 显式请求（壳注入的 handler 写指针 + 走 app-doc 通道开档），不调不存在的 setRoute。
  const open = (s) => { if (s) { nav('/doc/' + encodeURIComponent(s.path)); if (appRouter && appRouter.setDocPointer) appRouter.setDocPointer(s.path); } };
  const home = () => { nav('/'); if (appRouter && appRouter.setDocPointer) appRouter.setDocPointer(null); };
  const docRaw = String(route || '').indexOf('/doc/') === 0 ? '' : urlDoc;
  // 页标记（壳与判据读它）：app 自己声明「我在哪一页」——与 URL 同源。
  const page = String(route || '').indexOf('/doc/') === 0
    ? <Chrome scripts={scripts} doc={urlDoc} active="reader" onHome={home} onOpen={open} wt={wt} route={route}><Reader scripts={scripts} renderNode={env.renderNode} route={route} wt={wt} /></Chrome>
    : <Chrome scripts={scripts} doc={urlDoc} active="home" onHome={home} onOpen={open} wt={wt} route={route}><Gallery scripts={scripts} onOpen={open} wt={wt} /></Chrome>;
  // 页标记与 hash **同形**（`/doc/<urlencoded 全路径>`），壳与判据读它做「三态一致」。
  const liveDoc = String(route || '').indexOf('/doc/') === 0 ? decodeURIComponent(String(route).slice(5)) : '';
  const shellPath = liveDoc ? '/doc/' + encodeURIComponent(liveDoc) : '/';
  return <div data-shell="view" data-shell-path={shellPath}>{page}</div>;
});
```

## app 自己的样式

```css@app
/* 主题跟壳走（与 ui_std/basic_render.css 同款约定）：默认亮、:host(.dark) 暗 —— 壳的 ☾ 翻转 appview 宿主类即生效。 */
:host {
  --bg:#f7f7f4; --panel:#efece5; --line:rgba(0,0,0,.12); --fg:#26251e; --dim:rgba(38,37,30,.55); --accent:#f54e00; --paper:#fff; --ink:#14161c;
  --top-bg:rgba(0,0,0,.02); --chip-bg:rgba(0,0,0,.04); --hover:rgba(0,0,0,.05); --sel-bg:rgba(245,78,0,.12);
  --sk-card:#efece5; --sk-line:rgba(0,0,0,.08); --sk-block:rgba(0,0,0,.05); --err-bg:rgba(0,0,0,.03);
}
:host(.dark) {
  --bg:#101218; --panel:#171a22; --line:rgba(255,255,255,.10); --fg:#e6e8ee; --dim:rgba(230,232,238,.55); --accent:#7aa2f7; --paper:#fff; --ink:#14161c;
  --top-bg:rgba(255,255,255,.02); --chip-bg:rgba(255,255,255,.04); --hover:rgba(255,255,255,.05); --sel-bg:rgba(122,162,247,.16);
  --sk-card:#1b1e27; --sk-line:rgba(255,255,255,.10); --sk-block:rgba(255,255,255,.07); --err-bg:rgba(255,255,255,.03);
}
.app-scripts {
  display:flex; flex-direction:column; height:100%; min-height:100%; background:var(--bg); color:var(--fg);
  font:13px/1.55 system-ui,-apple-system,'Segoe UI','PingFang SC',sans-serif; }
.app-scripts-top { display:flex; align-items:center; gap:10px; height:46px; padding:0 22px; border-bottom:1px solid var(--line); background:var(--top-bg); flex:0 0 auto; }
.app-scripts-brand { font-weight:600; letter-spacing:.02em; }
.app-scripts-count { font-size:11px; color:var(--dim); border:1px solid var(--line); border-radius:999px; padding:1px 8px; }
.app-scripts-spacer { flex:1 1 auto; }
/* 顶栏：左=品牌·计数·(发丝)·返回·当前篇；右=画廊汇总。等宽篇名 + 弱化稿次日期，与卡片同一套字体语言。 */
.app-scripts-sep { width:1px; height:14px; flex:0 0 auto; background:var(--line); }
.app-scripts-cur { display:inline-flex; align-items:baseline; font-size:12px; color:var(--dim); max-width:44ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.app-scripts-cur-name { font-family:ui-monospace,Menlo,monospace; letter-spacing:.01em; color:var(--fg); }
.app-scripts-cur-meta { color:var(--dim); }
.app-scripts-back { font:inherit; font-size:12px; cursor:pointer; color:var(--dim); border:0; background:none; border-radius:6px; padding:4px 8px; margin-left:-2px; transition:color .12s ease,background .12s ease; }
.app-scripts-back:hover { color:var(--accent); background:var(--hover); }
.app-scripts-body { display:flex; flex:1 1 auto; min-height:0; height:100%; }
.app-scripts-side { flex:0 0 220px; background:var(--panel); border-right:1px solid var(--line); padding:14px 12px; overflow:auto; }
.app-scripts-rail-h { font-size:11px; letter-spacing:.1em; color:var(--dim); text-transform:uppercase; padding:0 8px 8px; }
.app-scripts-item { display:block; width:100%; text-align:left; font:inherit; cursor:pointer; padding:6px 10px; margin:1px 0; border-radius:7px; background:none; color:var(--fg); border:0; border-left:2px solid transparent; }
.app-scripts-item:hover { background:var(--hover); }
.app-scripts-item.on { background:var(--sel-bg); border-left-color:var(--accent); color:var(--fg); }
.app-scripts-main { flex:1 1 auto; min-width:0; overflow:auto; height:100%; }
.app-scripts-home { padding:26px 28px 48px; max-width:1240px; margin:0 auto; }   /* ②-4：首页整块居中，宽屏不留左上角死区 */
.app-scripts-h { margin:0 0 18px; font-size:20px; font-weight:600; }
.app-scripts-grid { justify-content:center; display:grid; grid-template-columns:repeat(auto-fit,232px); gap:20px; }   /* 列数随宽度自适应（上限由 .app-scripts-home 的 1240 收口） */
.app-scripts-card { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; aspect-ratio:8.5/11; padding:22px 18px; cursor:pointer; text-align:center; background:var(--paper); color:var(--ink); font:inherit; border:1px solid rgba(0,0,0,.18); border-radius:2px; box-shadow:0 1px 2px rgba(0,0,0,.35),0 10px 24px rgba(0,0,0,.28); transition:transform .12s ease,box-shadow .12s ease; }
.app-scripts-card:hover { transform:translateY(-3px); box-shadow:0 3px 6px rgba(0,0,0,.35),0 18px 36px rgba(0,0,0,.40); }
.app-scripts-card-title { font-family:ui-monospace,Menlo,monospace; font-size:15px; letter-spacing:.08em; text-transform:uppercase; }
.app-scripts-card-by { font-family:ui-monospace,Menlo,monospace; font-size:11px; line-height:1.7; color:#3b3f47; }
.app-scripts-card-draft { position:absolute; left:18px; bottom:16px; font-family:ui-monospace,Menlo,monospace; font-size:10px; color:#6b7280; }
.app-scripts-card-scenes { position:absolute; right:18px; bottom:16px; font-family:ui-monospace,Menlo,monospace; font-size:10px; color:#6b7280; }
.app-scripts-reader { padding:0; min-height:100%; }
/* 对齐（②-2 · 5）：删掉 meta 条后把纸面中轴交回栏内居中；窄栏（纸面 > 栏宽）时纸面按栏宽收，宽栏时居中。 */
.app-scripts-reader > .mdio-doc { width:max-content; max-width:100%; margin:0 auto; }
.app-scripts-reader .sc-root, .app-scripts-reader .sc-sheet { max-width:100%; }
/* 键盘可达（②-2 · 6）：Tab 聚焦有可见环（卡片/左栏项/返回键） */
.app-scripts-card:focus-visible, .app-scripts-item:focus-visible, .app-scripts-back:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
/* 高度链（appview 概念下的全屏）：app 外层那层 data-shell=view 容器默认 auto，会把 `.app-scripts` 的
   height:100% 截断（实测：appview 1012px，app 根只有 470px，下面露出壳的底色）⇒ 这层也撑满。 */
[data-shell='view'] { height:100%; min-height:100%; }
/* RouterShell 自带一行调试信息（data-shell=debug）—— app 里不该出现，隐藏 */
[data-shell='debug'] { display:none !important; }
/* 三态与空态（②-2 · 3/4） */
.app-scripts-card.is-skeleton { background:var(--sk-card); border-color:var(--line); box-shadow:none; cursor:default; gap:12px; }
.app-scripts-sk-line { display:block; width:62%; height:14px; border-radius:3px; background:var(--sk-line); animation:appSkPulse 1.2s ease-in-out infinite; }
.app-scripts-sk-line.short { width:42%; height:10px; animation-delay:.15s; }
.app-scripts-sk-block { display:block; width:72%; height:92px; border-radius:4px; background:var(--sk-block); animation:appSkPulse 1.2s ease-in-out infinite; animation-delay:.3s; }
@keyframes appSkPulse { 0%,100% { opacity:.45 } 50% { opacity:.95 } }
.app-scripts-card.is-error { background:var(--err-bg); border:1px dashed rgba(248,136,136,.45); box-shadow:none; cursor:default; color:#f88; font-size:12px; }
.app-scripts-empty { color:var(--dim); font-size:12px; padding:2px 0 14px; }
.app-scripts-empty-rail { color:var(--dim); font-size:11px; padding:4px 10px; }

/* @wts-tailwind:start */
/*! tailwindcss v0.0.0-insiders.fa81d69 | MIT License | https://tailwindcss.com */
/* @wts-tailwind:end */
```