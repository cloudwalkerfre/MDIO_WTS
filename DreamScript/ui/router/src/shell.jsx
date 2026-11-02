// RouterShell：给 md 内嵌组件用的路由外壳（视图用 render-prop）。
import { createElement as h, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';   // 层容器由壳提供（appRouter.layerHost()），这里只 portal 进去
import { Router, RouterMode } from '@esmx/router';
import { RouterProvider, RouterView, useRouter, useRoute, RouterLink } from '@esmx/router-react';

export { useRouter, useRoute, RouterLink };

export function matchRoute(routes, path) {
  let best = null;
  for (const r of (routes || [])) {
    const rp = String(r.path || '/');
    const pat = '^' + rp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[^/]+/g, '([^/]+)') + '/?$';
    let m = null; try { m = new RegExp(pat).exec(path); } catch (e) { m = null; }
    if (m && (!best || rp.length > String(best.r.path).length)) best = { r: r, m: m };
  }
  return best;
}

export function readHashRoute() {
  const hash = typeof location !== 'undefined' ? String(location.hash || '') : '';
  const p = hash.replace(/^#/, '');
  return p && p.charAt(0) === '/' ? p : '/';
}

export function useRouteView(routes) {
  return useMemo(() => function RouteView() {
    const route = useRoute();
    const path = String((route && route.path) || '/');
    const hit = matchRoute(routes, path) || { r: (routes || [])[0], m: [] };
    const param = hit.m && hit.m[1] ? decodeURIComponent(hit.m[1]) : '';
    const info = { path: path, n: (routes || []).length, matched: hit.r ? String(hit.r.path) : null };
    return h('div', { 'data-shell': 'view', 'data-shell-path': path },
      h('div', { 'data-shell': 'debug', style: { opacity: 0.5, fontSize: '10pt' } }, JSON.stringify(info)),
      hit.r && hit.r.render ? hit.r.render({ path: path, param: param }) : null);
  }, []);
}

export function RouterShell({ routes, initial, renderNode, appRouter }) {
  const [rt, setRt] = useState(null);
  const [err, setErr] = useState('');
  const [fallbackView, setFallbackView] = useState(null);   // 试点：esmx fallback 未命中 ⇒ 组件级渲染 renderNode()
  const lastPageRef = useRef(null);                          // 试点：桥记上次推的页（不读 r.route，防无活跃路由时 getter 抛错）
  const V = useRouteView(routes);
  const spec = useMemo(() => (routes || []).map((r) => ({ path: r.path, component: V })), [V]);
  useEffect(() => { (async () => {
    try {
      const router = new Router({
        mode: RouterMode.memory,
        base: new URL('/edit', location.origin),
        routes: spec,
        // 试点（esmx 官方机制）：未命中即触发、每次导航一次、渲染全归 handler（route-transition.ts:34-42）
        fallback: (to, from, router) => {
          setFallbackView(h('div', { 'data-fallback': 'md' }, renderNode ? renderNode() : null));
        },
      });
      // 试点：afterEach 每次导航都触发（to.handle 恒存在）；命中路径 ⇒ 清 fallbackView
      router.afterEach((to) => { if (to.matched.length > 0) setFallbackView(null); });
      await router.push(initial || '/');   // 初始页由调用方给（URL 归宿主注入的 appRouter）
      window.__appRouter = router;
      setRt(router);
    } catch (e) { setErr(String((e && e.message) || e)); }
  })(); }, []);
  // 试点：桥移进 RouterShell —— fallback 态下 Nav（住在 RouterView 命中树里）会卸载，
  // 桥若只留在 Nav，回命中路径的路就断了。这里订阅 appRouter 自己跟随。
  useEffect(() => {
    if (!rt || !appRouter || typeof appRouter.subscribe !== 'function') return;
    lastPageRef.current = String(initial == null ? '/' : initial);
    const onUrl = (page) => {
      const p = String(page == null ? '/' : page);
      if (lastPageRef.current === p) return;
      lastPageRef.current = p;
      try { rt.push(p).catch(() => {}); } catch (e) { /* 桥只负责跟随，失败不崩 */ }
    };
    return appRouter.subscribe(onUrl);
  }, [rt, appRouter]);
  if (err) return h('div', { 'data-shell': 'err', style: { color: '#f88' } }, 'router 失败：' + err);
  if (!rt) return h('div', { 'data-shell': 'wait' }, 'router 启动中…');
  // 试点：fallbackView 与 RouterView 并排渲染（不整体替换视图 ⇒ Provider/桥永不下树）
  return h(RouterProvider, { router: rt }, h('div', { 'data-shell': 'host' }, fallbackView, h(RouterView)));
}

// 面板/层：createLayer 在路由表里挑一条路由，叠加渲染（父路由继续跑，状态不销毁）
export async function openPanel(router, opts) {
  const o = opts || {};
  const made = await router.createLayer({ path: o.path || '/panel', layer: { push: false, autoPush: false, keepAlive: 'exact', zIndex: o.zIndex || 10000 } });   // push:false = 不记历史条目（实测 push:true 会把 /panel 写进浏览器 URL，抹掉壳参数）
  return { promise: made.promise, router: made.router };
}

// 覆盖层：库只给"隔离的路由上下文"，容器由使用方提供（§28 实测结论）
export function PanelLayer({ router, zIndex, appRouter }) {
  if (!router) return null;
  const host = (appRouter && appRouter.layerHost && appRouter.layerHost()) || null;
  const node = h('div', { 'data-layer': '1', style: { position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: zIndex || 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    h('div', { style: { minWidth: '260pt', background: '#1e222a', color: '#e6e8ee', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' } },
      h(RouterProvider, { router: router }, h(RouterView))));
  return host ? createPortal(node, host) : node;
}


export function panelView(text, onClose) {
  return h('div', { 'data-panel': '1', style: { padding: '18pt', fontFamily: 'system-ui' } },
    h('h2', { style: { fontSize: '15pt', margin: '0 0 8pt' } }, text || '面板'),
    h('button', { 'data-panel': 'close', onClick: () => { try { onClose(); } catch (e) {} } }, '关闭'),
    h('div', { style: { marginTop: '8pt', opacity: 0.7, fontSize: '10pt' } }, '父页面仍在运行（层是独立路由上下文）'));
}
