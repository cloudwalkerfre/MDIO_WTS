# OW_PJL_VIEW

## 实现

```jsx@node
import { createElement as h, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createPjlEngine } from "@app/OW_PJL_ENGINE";
import { CSS } from "@app/OW_PJL_STYLE";
import { FORMULA, LABELS } from "@app/OW_PJL_DATA";
import { getShellTheme, onShellTheme, getTeachLang, onTeachLang } from "@app/OW_SHARED_KIT";

/** 薄壳：shadow 内建原页 DOM 壳（bg/page/header/stage/board/formula/canvases/reel/stepcontrols）
 *  + 注入原页浅色样式；引擎只负责画、时间线和按钮。
 *  主题/语言跟随教学页壳：host 上记 data-theme（CSS 反相/换色），语言直接换序列文案。 */
export default observer(function OwProjectionLightView() {
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

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = String(text);
      return n;
    };
    const labels = LABELS[lang] || LABELS.zh;

    shadow.appendChild(el("div", "bg"));
    const page = el("div", "page");
    const main = el("div", "main");
    const top = el("header", "top");
    top.appendChild(el("div", "brand", "MDIO"));
    top.appendChild(el("h1", null, labels.headline));
    main.appendChild(top);

    const stageEl = el("main", "stage");
    stageEl.id = "stage";
    const langToggle = el("button", "lang-toggle", labels.switchLang);
    langToggle.id = "langToggle";
    langToggle.type = "button";
    langToggle.setAttribute("aria-label", labels.langAria);
    stageEl.appendChild(langToggle);
    const loop = el("button", "loop-toggle", "⏸");
    loop.id = "loopToggle";
    loop.type = "button";
    loop.setAttribute("aria-label", labels.loopAria);
    stageEl.appendChild(loop);

    const board = el("div", "board");
    board.id = "board";
    const formula = el("p", "formula");
    formula.id = "formula";
    formula.setAttribute("aria-label", labels.formulaAria);
    for (const item of FORMULA) {
      const span = el("span", item.kind === "face" ? "fc" : "op");
      if (item.kind === "face") {
        span.dataset.face = item.face;
        span.appendChild(el("b"));
      } else {
        span.textContent = item.text;
      }
      formula.appendChild(span);
    }
    board.appendChild(formula);

    const win = el("div", "line-window");
    win.id = "lineWindow";
    const lineCanvas = el("canvas", "line-canvas");
    lineCanvas.id = "lineCanvas";
    const frameCanvas = el("canvas", "frame-canvas");
    frameCanvas.id = "frameCanvas";
    frameCanvas.setAttribute("aria-hidden", "true");
    const mixCanvas = el("canvas", "mix-canvas");
    mixCanvas.id = "mixCanvas";
    mixCanvas.setAttribute("aria-hidden", "true");
    win.appendChild(lineCanvas);
    win.appendChild(frameCanvas);
    win.appendChild(mixCanvas);
    board.appendChild(win);

    const reel = el("div", "reel");
    reel.id = "reel";
    reel.setAttribute("aria-label", labels.reelAria);
    const track = el("div", "reel-track");
    track.id = "reelTrack";
    reel.appendChild(track);
    board.appendChild(reel);

    // 轮次下方的安静播放条：一枚按钮，暂停/播放两枚 SVG（CSS 用 .paused 切显隐）。
    const svgEl = (tag, attrs) => {
      const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const key of Object.keys(attrs)) n.setAttribute(key, attrs[key]);
      return n;
    };
    const controls = el("div", "stepcontrols");
    controls.id = "stepControls";
    controls.setAttribute("aria-label", "播放控制");
    const stepToggle = el("button");
    stepToggle.type = "button";
    stepToggle.dataset.step = "toggle";
    stepToggle.setAttribute("aria-label", "暂停");
    const pauseIcon = svgEl("svg", { class: "ctrl-pause", viewBox: "0 0 12 12", "aria-hidden": "true" });
    pauseIcon.appendChild(svgEl("rect", { x: "3", y: "2", width: "2", height: "8", rx: "1", fill: "currentColor" }));
    pauseIcon.appendChild(svgEl("rect", { x: "7", y: "2", width: "2", height: "8", rx: "1", fill: "currentColor" }));
    const playIcon = svgEl("svg", { class: "ctrl-play", viewBox: "0 0 12 12", "aria-hidden": "true" });
    playIcon.appendChild(svgEl("path", { d: "M4 2.5 10 6 4 9.5Z", fill: "currentColor" }));
    stepToggle.appendChild(pauseIcon);
    stepToggle.appendChild(playIcon);
    controls.appendChild(stepToggle);
    board.appendChild(controls);

    stageEl.appendChild(board);
    main.appendChild(stageEl);
    page.appendChild(main);
    shadow.appendChild(page);

    const engine = createPjlEngine({
      root: host,
      shadow,
      data: {},
      options: { lang, auto: true },
    });
    host.__owEngine = engine;
    // 教学页壳是主题/语言的唯一入口：主题只改 host 的 data-theme（CSS 驱动），
    // 语言真的换一条序列（canvas 文案 + 公式高亮跟着重画）。
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
  return h("div", { ref: hostRef, className: "ow-pjl-host w-full", style: { height: "900px" } });
});
```
