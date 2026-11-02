// 探针：用 @esmx/router-react 的真 API 跑一个两层路由（证明接入成立）
import { useState, useEffect } from 'react';
import { Router, RouterMode } from '@esmx/router';
import { RouterProvider, RouterView, RouterLink, useRoute } from '@esmx/router-react';

function Home() { return <div data-rp='home'>路由 / ⇒ HOME ✓</div>; }
function Edit() { return <div data-rp='edit'>路由 /edit ⇒ EDIT ✓</div>; }

function Badge() {
  const route = useRoute();
  return <div data-rp='cur' style={{ opacity: 0.75 }}>当前路由: {String((route && route.path) || '?')}</div>;
}

export default function Probe() {
  const [rt, setRt] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
    try {
      const router = new Router({ mode: RouterMode.memory, base: new URL('/edit', location.origin), routes: [
        { path: '/', component: Home },
        { path: '/edit', component: Edit },
      ] });
      await router.push('/edit');
      window.__rpRouter = router;   // 探针：暴露实例，便于页面内直接验证导航   // 库自己提示的入口：先导航，否则 get route 抛 No active route
      setRt(router);
    } catch (e) { setErr(String((e && e.message) || e)); }
    })();
  }, []);
  return (
    <div className='app-rp' data-rp='wrap' style={{ padding: '24pt', fontFamily: 'system-ui' }}>
      <h1 data-rp='title' style={{ fontSize: '17pt', margin: '0 0 10pt' }}>esmx router 探针（构建型 mod）</h1>
      {err ? <div style={{ color: '#f88' }}>构造失败：{err}</div> : null}
      {rt ? (
        <RouterProvider router={rt}>
          <div data-rp='links' style={{ margin: '0 0 10pt', display: 'flex', gap: '10pt' }}>
            <RouterLink to='/'>去 /</RouterLink>
            <RouterLink to='/edit'>去 /edit</RouterLink>
          </div>
          <div data-rp='view'><RouterView /></div>
          <Badge />
        </RouterProvider>
      ) : <div>创建 router…</div>}
    </div>
  );
}