# OW_CRDT_ARCH_VIEW

## 实现

```jsx@node
import { createElement as h, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createCrdtArchEngine } from "@app/OW_CRDT_ARCH_ENGINE";
import { CSS } from "@app/OW_CRDT_ARCH_STYLE";
import { getShellTheme, onShellTheme, getTeachLang, onTeachLang } from "@app/OW_SHARED_KIT";

/** 薄壳：原页 body 全量 DOM（stage-head / stage-tools[legend+langBtn+themeBtn] / wires /
 *  entry-tag / pulse / step-panel[讲解+player+场景 chips+进度条] / 5 callout）；
 *  lane / node / wire / node-info 由 engine 生成。 */
const HTML = `
<div class="app">
  <div class="stage-holder" id="holder">
    <div class="stage" id="stage">
      <div class="stage-head">
        <span class="stage-idx">MDIO</span>
        <span class="stage-title" id="stageTitle">EXEC / CRDT =&gt; MDIO_UI 链路</span>
      </div>
      <div class="stage-tools">
        <span class="legend" id="legendLabel">MDIO_UI 链路</span>
        <button id="langBtn" class="tool-btn" type="button" aria-label="切换语言">EN</button>
        <button id="themeBtn" class="tool-btn tool-icon" type="button" aria-label="切换深色模式"></button>
      </div>

      <svg class="wires" id="wires" width="1600" height="1000"></svg>

      <div class="entry-tag"><span class="entry-title" id="entryLabel">L0 输入</span><span>CRDT / EXEC</span></div>

      <div class="pulse" id="pulse"></div>

      <div class="step-panel" id="stepPanel" aria-live="polite">
        <div class="sp-main" id="stepPanelMain"></div>
        <div class="sp-bottom">
          <div class="sp-status">
            <span class="sp-step" id="stepCounter">▲ STEP 01 / 9</span>
            <span class="player">
              <button id="playBtn" class="player-btn primary" type="button" aria-label="暂停" title="暂停"></button>
              <button id="replayBtn" class="player-btn" type="button" aria-label="重放" title="重放">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4"/><path d="M3.2 3.5V6h2.5"/></svg>
              </button>
            </span>
            <span class="sp-sep"></span>
            <span class="sp-scenes-label" id="sceneLabel">场景</span>
            <span class="cases" id="cases"></span>
          </div>
          <div class="sp-progress"><i id="stepBar"></i></div>
        </div>
      </div>

      <div class="callout" id="co-fframe" style="left:680px;top:246px"></div>
      <div class="callout" id="co-pframe" style="left:660px;top:472px"></div>
      <div class="callout" id="co-mst" style="left:1130px;top:676px"></div>
      <div class="callout" id="co-decl" style="left:250px;top:686px"></div>
      <div class="callout" id="co-claim" style="left:650px;top:686px"></div>
    </div>
  </div>
</div>
`;

export default observer(function OwCrdtArchView() {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    // 初始主题/语言跟随教学页壳（mdio）：body.dark + window.__teachLang / dsh:lang。
    const theme = getShellTheme();
    const lang = getTeachLang();
    host.setAttribute("data-theme", theme);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const page = document.createElement("div");
    page.className = "ow-crdt-arch-page";
    page.style.display = "contents";
    page.innerHTML = HTML;
    shadow.appendChild(page);

    const engine = createCrdtArchEngine({ root: host, shadow, data: {}, options: { lang: lang, theme: theme, auto: true } });
    host.__owEngine = engine;

    // 壳层切换：host 的 data-theme 驱动 style.md 的深浅两套；engine 同步内部状态（不动当前帧）。
    const offTheme = onShellTheme((next) => {
      host.setAttribute("data-theme", next);
      engine.setTheme(next);
    });
    const offLang = onTeachLang((next) => {
      engine.setLang(next);
    });

    return () => {
      offTheme();
      offLang();
      try { delete host.__owEngine; } catch (e) { /* ignore */ }
      engine.dispose();
      try { shadow.innerHTML = ""; } catch (e) { /* ignore */ }
    };
  }, []);
  return h("div", { ref: hostRef, className: "ow-crdt-arch-host w-full", style: { height: "900px" } });
});
```
