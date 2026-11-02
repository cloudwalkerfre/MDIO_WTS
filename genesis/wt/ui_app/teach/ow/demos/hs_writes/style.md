# OW_WR_STYLE

## 实现

```jsx@node
/** 原页 CSS：html/body 搬到 :host；教学页壳适配：
 *  - 原页 html[data-theme="light"] 段 → :host([data-theme="light"])（暗色 = :host 基线）；
 *  - 教学页壳自带页头/明暗/语言开关：按 /fe hideCss 藏掉 .brand 与 .top；
 *  - 浅色下的 ghost 对比度取自 /fe coreCss（原页 light 段本身没覆盖 ghost）。 */
export const CSS = `
:host {
  display: block; position: relative; height: var(--ow-h, 900px); overflow: hidden;
  --bg: #050506; --text: #f2f4f7;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: transparent; color: var(--text); font-family: var(--sans);
  display: flex; flex-direction: column; align-items: center;
}
* { box-sizing: border-box; }

/* 教学页壳主题：原页 html[data-theme="light"] 段改写成 :host([data-theme="light"])（dark = 上面的基线）。 */
:host([data-theme="light"]) { --bg: #f6f7f9; --text: #15181d; }

.main { flex: 1; min-width: 0; width: 100%; display: flex; flex-direction: column; align-items: center;
  padding: 32px 24px 22px; }
.top { width: 100%; max-width: 1200px; text-align: center; flex: none; }
.brand { font-family: var(--sans); font-size: clamp(22px, 2.4vw, 32px); font-weight: 800;
  letter-spacing: .24em; text-indent: .24em; color: #f4f7fb; line-height: 1; }
/* 教学页壳（mdio）自带页头：按 /fe hideCss 藏掉原页 .brand，.top 一并藏；只留 demo 功能 UI。 */
.top { display: none !important; }
.brand { display: none !important; }

.board { width: 100%; max-width: 1200px; display: flex; flex-direction: column; align-items: center;
  margin-top: 24px; min-height: 0; flex: 1; justify-content: center; }
.cmd { position: relative; width: 100%; height: 40px; flex: none; }
.cmd canvas { display: block; width: 100%; height: 100%; }
.ghost-cmd { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%) translateY(8px);
  font-family: var(--mono); font-size: 13.5px; letter-spacing: .01em; padding: 5px 12px;
  border: 1px dashed rgba(251,191,36,.45); border-radius: 9px; background: rgba(251,191,36,.05);
  color: rgba(226,232,240,.5); white-space: nowrap; pointer-events: none; opacity: 0;
  transition: opacity .45s ease, transform .45s ease, border-color .45s ease, color .45s ease, background .45s ease; }
.ghost-cmd:not(.show) { transition: none; }
.ghost-cmd.show { opacity: .55; transform: translateX(-50%) translateY(0); }
.ghost-cmd.retiring { opacity: 0 !important; transition: opacity .5s ease !important; }
.ghost-cmd.monitor { opacity: .3; border-style: solid; border-color: rgba(148,163,184,.22);
  background: transparent; color: rgba(203,213,225,.45); }
.ghost-cmd.flyin { animation: ghostFly .85s cubic-bezier(.22,.68,.2,1) both; }
@keyframes ghostFly {
  0% { opacity: 0; transform: translateX(-50%) translateY(44px) scale(.9); }
  35% { opacity: .18; transform: translateX(-50%) translateY(26px) scale(.94); }
  100% { opacity: .55; transform: translateX(-50%) translateY(0) scale(1); }
}
.ghost-cmd.fire { opacity: 1; border-style: solid; border-color: rgba(251,191,36,.75);
  color: #fde68a; background: rgba(251,191,36,.10); animation: ghostFire .6s ease; }
@keyframes ghostFire {
  0% { opacity: .45; transform: translateX(-50%) translateY(0) scale(.99); }
  40% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.02); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.reel { position: relative; width: 100%; height: 32px; margin-top: 14px; flex: none;
  overflow: hidden; touch-action: none;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.reel-track { position: absolute; top: 0; left: 0; display: flex; align-items: center; height: 100%; }
.reel-item { flex: 0 0 auto; height: 100%; padding: 0 24px; border: 0; background: none;
  font-family: var(--sans); font-size: 16px; letter-spacing: 0; color: #b2bcc9;
  opacity: .3; cursor: grab; user-select: none;
  white-space: nowrap; }
.reel:active .reel-item { cursor: grabbing; }
.stepcontrols { display: flex; align-items: center; justify-content: center;
  height: 20px; margin-top: 15px; opacity: .32; transition: opacity .22s ease; }
.stepcontrols:hover { opacity: .85; }
.stepcontrols.paused { opacity: .92; }
.stepcontrols.paused:hover { opacity: 1; }
.stepcontrols button { appearance: none; border: 0; background: none; padding: 0;
  display: grid; place-items: center; width: 20px; height: 20px;
  color: #8b96a3; cursor: pointer; transition: color .2s ease; }
.stepcontrols button:hover { color: #f2f4f7; }
.stepcontrols.paused button { color: #c7d0da; }
.stepcontrols svg { display: block; width: 12px; height: 12px; }
.stepcontrols .ctrl-play { display: none; }
.stepcontrols.paused .ctrl-pause { display: none; }
.stepcontrols.paused .ctrl-play { display: block; }
.stepcontrols + .doc { margin-top: 16px !important; }

/* 浅色主题（续）：原页 stepcontrols 浅色规则 + /fe coreCss 的 ghost 浅色对比。 */
:host([data-theme="light"]) .brand { color: #15181d; }
:host([data-theme="light"]) .stepcontrols button { color: #8a929e; }
:host([data-theme="light"]) .stepcontrols.paused button { color: #3d444e; }
:host([data-theme="light"]) .ghost-cmd { color: rgba(30, 41, 59, .82) !important;
  border-color: rgba(180, 83, 9, .5) !important; background: rgba(251, 191, 36, .07) !important; }
:host([data-theme="light"]) .ghost-cmd.show { opacity: .9 !important; }
:host([data-theme="light"]) .ghost-cmd.retiring { opacity: 0 !important; }
:host([data-theme="light"]) .ghost-cmd.monitor { color: rgba(71, 85, 105, .7) !important;
  border-color: rgba(148, 163, 184, .5) !important; background: rgba(255, 255, 255, .7) !important;
  opacity: .65 !important; }
:host([data-theme="light"]) .ghost-cmd.fire { color: #92400e !important;
  border-color: rgba(180, 83, 9, .8) !important; background: rgba(251, 191, 36, .14) !important; }

.doc { position: relative; margin-top: 28px; flex: none; }
.doc canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.doc .doc-text { z-index: 1; }
.doc .doc-frame { z-index: 2; pointer-events: none; }
`;
```
