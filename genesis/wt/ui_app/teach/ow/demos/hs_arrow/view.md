# OW_ARROW_VIEW

## 实现

```jsx@node
import { createElement as h, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createArrowEngine } from "@app/OW_ARROW_ENGINE";
import { CSS } from "@app/OW_ARROW_STYLE";
import { getShellTheme, onShellTheme, getTeachLang, onTeachLang } from "@app/OW_SHARED_KIT";

/** 薄壳：shadow 内建原页 body 的静态 DOM 壳（stagebar/stepcontrols/sql/data 九层/beat-dots）+ 原页样式。
 *  主题/语言跟随教学页壳：host 上记 data-theme（CSS 换浅色 + engine 换色），语言直接换 bar 文案。 */
const HTML = `
<div class="page">
  <header class="head"><div class="brand">MDIO</div></header>
  <div class="stage">
    <div class="stagebar" id="stageBar"></div>
    <div class="stepcontrols" id="stepControls" aria-label="播放控制">
      <button type="button" data-step="toggle" aria-label="暂停">
        <svg class="ctrl-pause" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="3" y="2" width="2" height="8" rx="1" fill="currentColor"/>
          <rect x="7" y="2" width="2" height="8" rx="1" fill="currentColor"/>
        </svg>
        <svg class="ctrl-play" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4 2.5 10 6 4 9.5Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
    <div class="stageRow">
      <section class="sqlPanel"><div class="sqlBody" id="sqlBody"></div></section>
      <div class="dataPanel">
        <div class="layer on" id="layerModel">
          <div class="model" id="mModel">
            <svg class="mlinks" id="mLinks" aria-hidden="true"></svg>
            <div class="mdoc" id="mDoc">
              <div class="mdline" data-node="0"># Project A</div>
              <div class="mdline" data-node="1">## Todo</div>
              <div class="mdline" data-node="2">- todo: record demo</div>
              <div class="mdline" data-node="3">- todo: fix tag bug</div>
              <div class="mdline" data-node="4">- todo: light theme</div>
              <div class="mdline" data-node="5">## Decision</div>
              <div class="mdline" data-node="6">- decision: light theme only</div>
            </div>
            <div class="execbar">
              <div class="mcmd"></div>
              <div class="mflow"><i></i></div>
              <div class="moutmodes"><b>md</b>/json/rows</div>
            </div>
            <div class="mrowwrap">
              <div class="mcol">
                <div class="mtree">
                  <svg viewBox="0 0 240 296" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M 120 34 C 120 52 68 56 55 70" />
                    <path d="M 120 34 C 120 52 172 56 185 70" />
                    <path d="M 55 104 C 55 116 85 112 85 122 M 85 156 L 85 164 M 85 198 L 85 206" />
                    <path d="M 185 104 C 185 150 190 210 190 258" />
                  </svg>
                  <div class="t-node root" data-n="0" style="left:120px;top:0"># Project A</div>
                  <div class="t-node sec" data-n="1" style="left:55px;top:70px">## Todo</div>
                  <div class="t-node sec" data-n="5" style="left:185px;top:70px">## Decision</div>
                  <div class="t-node blk" data-n="2" style="left:85px;top:122px">- todo: record demo</div>
                  <div class="t-node blk" data-n="3" style="left:85px;top:164px">- todo: fix tag bug</div>
                  <div class="t-node blk" data-n="4" style="left:85px;top:206px">- todo: light theme</div>
                  <div class="t-node blk" data-n="6" style="left:190px;top:258px">- decision: light theme only</div>
                </div>
              </div>
              <div class="flow one"><div class="fline"><i></i></div></div>
              <div class="mcol">
                <div class="mtab faces">
                  <div class="mrow head"><span>node</span><span>raw</span><span>mark</span><span>tag</span><span>content</span><span>container</span></div>
                  <div class="mrow" data-r="0"><span>0</span><span># Project A</span><span>#</span><span>Project A</span><span>## Todo …</span><span># Project A</span></div>
                  <div class="mrow" data-r="1"><span>1</span><span>## Todo</span><span>##</span><span>Todo</span><span>- todo: record demo …</span><span>## Todo</span></div>
                  <div class="mrow" data-r="2"><span>2</span><span>- todo: record demo</span><span>-</span><span>todo</span><span>record demo</span><span>- todo: </span></div>
                  <div class="mrow" data-r="3"><span>3</span><span>- todo: fix tag bug</span><span>-</span><span>todo</span><span>fix tag bug</span><span>- todo: </span></div>
                  <div class="mrow" data-r="4"><span>4</span><span>- todo: light theme</span><span>-</span><span>todo</span><span>light theme</span><span>- todo: </span></div>
                  <div class="mrow" data-r="5"><span>5</span><span>## Decision</span><span>##</span><span>Decision</span><span>- decision: light theme only</span><span>## Decision</span></div>
                  <div class="mrow" data-r="6"><span>6</span><span>- decision: light theme only</span><span>-</span><span>decision</span><span>light theme only</span><span>- decision: </span></div>
                </div>
              </div>
              <div class="mcol pjcol">
                <div class="mtab long">
                  <div class="mrow head"><span>node</span><span>pj</span><span>value</span></div>
                  <div class="mrow" data-r="1"><span>4</span><span>raw</span><span>- todo: light theme</span></div>
                  <div class="mrow" data-r="2"><span>4</span><span>mark</span><span>-</span></div>
                  <div class="mrow" data-r="3"><span>4</span><span>tag</span><span>todo</span></div>
                  <div class="mrow" data-r="4"><span>4</span><span>content</span><span>light theme</span></div>
                  <div class="mrow" data-r="5"><span>4</span><span>container</span><span>- todo: </span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="layer" id="layerStats"><div class="stats"><div class="hdr"><span>path</span><span>heading</span><span>n</span><span>rn</span></div><div id="statRows"></div></div></div>
        <div class="layer" id="layerResult"><div class="result" id="resultRows"></div></div>
        <div class="layer" id="layerPivot"><div class="pivot"><div class="hdr"><span>path</span><span>node</span><span>mark</span><span>tag</span><span>content</span></div><div id="pivotRows"></div></div></div>
        <div class="layer" id="layerResult2"><div class="result" id="resultRows2"></div></div>
        <div class="layer" id="layerNestMd"><pre class="nestmd" id="nestMd"></pre></div>
        <div class="layer" id="layerNest"><div class="nest" id="nestRows"></div></div>
        <div class="layer" id="layerNestResult"><div class="nest-result" id="nestResult"></div></div>
        <div class="layer" id="layerBm25"><div class="bm25" id="bm25Rows"></div></div>
      </div>
    </div>
  </div>
  <div class="beat-dots" id="dots"></div>
</div>
`;

export default observer(function OwArrowView() {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    // 教学页壳的信号：主题 = body.dark，语言 = window.__teachLang + dsh:lang。
    const theme = getShellTheme();
    const lang = getTeachLang();
    host.setAttribute("data-theme", theme);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const wrap = document.createElement("div");
    wrap.className = "ow-arrow-page";
    wrap.style.display = "contents";
    wrap.innerHTML = HTML;
    shadow.appendChild(wrap);

    const engine = createArrowEngine({ root: host, shadow, data: {}, options: { lang, theme } });
    host.__owEngine = engine;
    // 教学页壳是主题/语言的唯一入口：主题只改 host 的 data-theme（CSS + engine 颜色），
    // 语言用当前语言重建 bar 文案（不重载页面）。
    const offTheme = onShellTheme((next) => {
      host.setAttribute("data-theme", next);
      engine.setTheme(next);
    });
    const offLang = onTeachLang((next) => {
      engine.setLang(next);
    });
    return () => {
      offLang();
      offTheme();
      try { delete host.__owEngine; } catch (e) { /* ignore */ }
      engine.dispose();
      try { shadow.innerHTML = ""; } catch (e) { /* ignore */ }
    };
  }, []);
  return h("div", { ref: hostRef, className: "ow-arrow-host w-full", style: { height: "900px" } });
});
```
