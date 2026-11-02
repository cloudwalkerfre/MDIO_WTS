# routerapp

```jsx@routerapp
import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { RouterShell, useRoute } from 'ui_router/router';
import { createRouterStore } from 'ui_router/routerStore';

const Ctx = createContext({ exec: null, appRouter: null });

function Home({ exec }) {
  const [items, setItems] = useState([]);
  useEffect(() => { exec('ls -p /scripts').then((x) => setItems(String(x == null ? '' : x).split(/s+/).filter((n) => /.md$/.test(n)))).catch(() => {}); }, []);
  return <div data-rapp='home'><h2 style={{ fontSize: '15pt', margin: '0 0 6pt' }}>剧本陈列</h2>{items.map((n) => <div key={n} data-doc={n}>{n}</div>)}</div>;
}

function Paper({ exec, doc }) {
  const [txt, setTxt] = useState('');
  useEffect(() => { if (!doc) return; exec('$ /scripts/' + decodeURIComponent(doc) + '::').then((x) => setTxt(String(x == null ? '' : x))).catch((e) => setTxt('读取失败 ' + String((e && e.message) || e))); }, [doc]);
  return <div data-rapp='edit'><h2 style={{ fontSize: '15pt', margin: '0 0 6pt' }}>编辑 {doc}</h2><pre data-rapp='text' style={{ whiteSpace: 'pre-wrap', fontSize: '10pt' }}>{txt.slice(0, 300)}</pre></div>;
}

function Nav({ appRouter }) {
  const route = useRoute();
  const go = (p) => appRouter.push(p);
  return <div className='rapp-nav' style={{ display: 'flex', gap: '10pt', alignItems: 'center', marginBottom: '10pt' }}>
    <button data-nav='home' onClick={() => go('/')} style={{ padding: '3pt 10pt' }}>陈列</button>
    <button data-nav='edit' onClick={() => go('/edit/' + encodeURIComponent('剧本.md'))} style={{ padding: '3pt 10pt' }}>编辑剧本.md</button>
    <button data-nav='panel' onClick={() => go('/panel')} style={{ padding: '3pt 10pt' }}>面板</button>
    <span data-nav='cur' style={{ opacity: 0.7 }}>{route ? route.path : ''}</span>
  </div>;
}

function HomeRoute() { const { exec, appRouter } = useContext(Ctx); return <div><Nav appRouter={appRouter} /><Home exec={exec} /></div>; }
function EditRoute() { const { exec, appRouter } = useContext(Ctx); const route = useRoute(); const doc = route && route.params ? String(route.params.doc || '') : ''; return <div><Nav appRouter={appRouter} /><Paper exec={exec} doc={doc} /></div>; }
function PanelRoute() { const { appRouter } = useContext(Ctx); return <div><Nav appRouter={appRouter} /><div data-rapp='panel'><h2 style={{ fontSize: '15pt', margin: '0 0 6pt' }}>面板页</h2><button data-nav='home2' onClick={() => appRouter.push('/')} style={{ padding: '3pt 10pt' }}>回陈列</button></div></div>; }

const REGISTRY = { home: HomeRoute, edit: EditRoute, panel: PanelRoute };

export default function RouterApp({ read, exec, appRouter, wt, renderNode }) {
  const store = useMemo(() => createRouterStore({ wt, read }), [wt, read]);
  useEffect(() => {
    const ob = wt && typeof wt.observe === 'function' ? wt.observe('/router.md') : null;
    if (ob && ob.ok && typeof ob.docId === 'number') store.setTableDocId(ob.docId);
  }, [wt, store]);
  const table = useMemo(() => (store.table || []).map((r) => ({ path: String(r.path || '/'), view: REGISTRY[r.name] })).filter((r) => !!r.view), [store.table]);
  return <Ctx.Provider value={{ exec, appRouter }}><div className='app-rapp' data-rapp='wrap' style={{ padding: '22pt', fontFamily: 'system-ui' }}>
    <h1 data-rapp='title' style={{ fontSize: '18pt', margin: '0 0 10pt' }}>剧本 app（router.md + ui_router 对齐版）</h1>
    <RouterShell table={table} initial={appRouter.page()} appRouter={appRouter} renderNode={renderNode} />
  </div></Ctx.Provider>;
}
```
