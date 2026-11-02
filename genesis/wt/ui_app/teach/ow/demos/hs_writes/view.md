# OW_WR_VIEW

## 实现

```jsx@node
import { createElement as h, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { createWritesEngine } from "@app/OW_WR_ENGINE";
import { CSS } from "@app/OW_WR_STYLE";
import { getShellTheme, onShellTheme, getTeachLang, onTeachLang } from "@app/OW_SHARED_KIT";

/** 薄壳：shadow 内建原页 DOM 壳（main/top/brand/board/cmd/reel/doc）+ 原页样式，挂 engine。
 *  主题/语言跟随教学页壳：host 上记 data-theme（CSS 驱动深浅两套），语言换轮盘标签。 */
export default observer(function OwWritesView() {
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
    const main = el("div", "main");
    const top = el("header", "top");
    top.appendChild(el("div", "brand", lang === "en" ? "Read & write" : "读写"));
    main.appendChild(top);

    const board = el("div", "board");
    board.id = "board";
    const cmdBox = el("div", "cmd");
    cmdBox.id = "cmdBox";
    const cmdCanvas = el("canvas");
    cmdCanvas.id = "cmdCanvas";
    const ghost = el("div", "ghost-cmd");
    ghost.id = "ghostCmd";
    cmdBox.appendChild(cmdCanvas);
    cmdBox.appendChild(ghost);
    board.appendChild(cmdBox);

    const reel = el("div", "reel");
    reel.id = "reel";
    reel.setAttribute("aria-label", lang === "en" ? "write steps" : "读写步骤");
    const track = el("div", "reel-track");
    track.id = "reelTrack";
    reel.appendChild(track);
    board.appendChild(reel);

    const controls = el("div", "stepcontrols");
    controls.id = "stepControls";
    controls.setAttribute("aria-label", lang === "en" ? "playback controls" : "播放控制");
    const toggle = el("button");
    toggle.type = "button";
    toggle.dataset.step = "toggle";
    toggle.setAttribute("aria-label", lang === "en" ? "pause" : "暂停");
    const svgEl = (cls) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      node.setAttribute("class", cls);
      node.setAttribute("viewBox", "0 0 12 12");
      node.setAttribute("aria-hidden", "true");
      return node;
    };
    const pauseIcon = svgEl("ctrl-pause");
    for (const x of ["3", "7"]) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", "2");
      rect.setAttribute("width", "2");
      rect.setAttribute("height", "8");
      rect.setAttribute("rx", "1");
      rect.setAttribute("fill", "currentColor");
      pauseIcon.appendChild(rect);
    }
    const playIcon = svgEl("ctrl-play");
    const playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    playPath.setAttribute("d", "M4 2.5 10 6 4 9.5Z");
    playPath.setAttribute("fill", "currentColor");
    playIcon.appendChild(playPath);
    toggle.appendChild(pauseIcon);
    toggle.appendChild(playIcon);
    controls.appendChild(toggle);
    board.appendChild(controls);

    const doc = el("div", "doc");
    doc.id = "docBox";
    const docCanvas = el("canvas", "doc-text");
    docCanvas.id = "docCanvas";
    const docFrame = el("canvas", "doc-frame");
    docFrame.id = "docFrame";
    doc.appendChild(docCanvas);
    doc.appendChild(docFrame);
    board.appendChild(doc);

    main.appendChild(board);
    shadow.appendChild(main);

    const engine = createWritesEngine({ root: host, shadow, data: {}, options: { lang } });
    host.__owEngine = engine;

    // 壳层切换：host 的 data-theme 驱动 style.md 的深浅两套；engine 同步内部 palette / 标签。
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
  return h("div", { ref: hostRef, className: "ow-writes-host w-full", style: { height: "900px" } });
});
```
