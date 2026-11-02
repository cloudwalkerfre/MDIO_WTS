# OW_PJL_STYLE

## 实现

```jsx@node
/** 原页浅色 CSS 照搬：`:root` / `html` / `body` 合并成 `:host`（锚定 demo 自身高度），
 *  EDITOR 面板整段删除，其余选择器原样（shadow 作用域内）。
 *  作用域化：`.bg` fixed → absolute（随 demo 而不是视口）；`.page` 100vh → 100%（随 host）；
 *  `.line-window` 视口相关的 clamp(400,50vh,620) → 450px（宿主机高固定 900，与 demos/projection 一致）。
 *  主题：本 demo 是浅色-only；教学页壳 dark 时用 `:host([data-theme="dark"]) {
 *  filter: invert(1) hue-rotate(180deg) }` 整体反相（与 /fe 首页 darkCss 一致，画布一起反相）。
 *  上游两条 `html[data-theme="light"]` 规则作用域化为 `:host([data-theme="light"])`
 *  （shadow 内 html 不生效）。
 *  控件：按 /fe hideCss 藏掉 demo 自带的主题/语言/编辑器入口（改由教学页壳统一控制）。
 *  字体栈（--mono/--sans）与 FONT_FAMILY 保持旧版不动（样式适配放最后）。 */
export const CSS = `
:host {
  display: block; position: relative; height: var(--ow-h, 900px); overflow: hidden;
  --bg: #f6f7f9;
  --text: #15181d;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: transparent; color: var(--text); font-family: var(--sans); line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
/* 教学页壳 dark：本页浅色-only，整体反相（/fe darkCss 同款，画布一起反相）。 */
:host([data-theme="dark"]) { filter: invert(1) hue-rotate(180deg); }
/* /fe hideCss：demo 自带控件与页头由教学页壳统一代替，不重复出现。 */
#loopToggle, #langToggle, .editor, .ed-tab, .brand, .top { display: none !important; }
* { box-sizing: border-box; }
::selection { background: rgba(14,116,144,.16); color: #0b0d10; }

/* 教学页要求直接落在纯黑/纯白页面上：隐藏原页的装饰背景层（网格 + 光晕）。 */
.bg { display: none; }
.bg:before { content: ""; position: absolute; inset: 0; background:
  radial-gradient(ellipse 46% 32% at 18% 2%, rgba(14,116,144,.07), transparent 68%),
  radial-gradient(ellipse 40% 30% at 84% 14%, rgba(180,83,9,.05), transparent 68%); }
.bg:after { content: ""; position: absolute; inset: 0; background:
  linear-gradient(rgba(0,0,0,.032) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,0,0,.032) 1px, transparent 1px);
  background-size: 64px 64px; mask-image: radial-gradient(ellipse 65% 55% at 50% 0%, #000 8%, transparent 78%); }

.page { position: relative; z-index: 1; height: 100%; min-height: 560px; display: flex; align-items: stretch; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;
  padding: clamp(56px, 12vh, 150px) 24px 32px; }
.top { width: 100%; max-width: 1100px; text-align: center; }
/* MDIO is a wordmark, not a label: large, wide-tracked, quiet ink. */
.brand { font-family: var(--sans); font-size: clamp(34px, 3.8vw, 52px); font-weight: 800;
  letter-spacing: .22em; text-indent: .22em; color: #0f1218; line-height: 1; }
h1 { font-size: clamp(28px, 3vw, 40px); line-height: 1.08; letter-spacing: -.045em; margin: 24px 0 0; font-weight: 700; }

/* The formula is the model; the canvas below is its proof. Plain ink type:
   the only word in colour is the face being projected. Formula and canvas are
   one flow block (the board), so a bigger canvas can never ride over the line. */
.formula { display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap;
  gap: 0 .38em; position: relative; z-index: 4; margin: 0 0 var(--chapter-gap, 0); font-family: var(--mono);
  font-size: clamp(28px, 3vw, 40px); line-height: 1.06;
  letter-spacing: -.01em; user-select: none; color: #0f1218; }
/* Hovering lifts a word slightly, never past the size of the one being
   projected — that one stays the biggest thing on the line. */
/* The word's colour is part of the projection switch: it crossfades over the same
   time the canvas dissolves, so no step jumps from one face to the next. */
.fc { color: #0f1218; cursor: pointer; transform-origin: 50% 50%;
  transition: transform .18s ease, color .26s ease; }
.fc:hover { transform: scale(1.05); }
.fc b { font-weight: 400; }
/* The selected face: heavier, a little larger, and its colour deepened towards
   ink so it reads as the darkest word on the line instead of the faintest. */
.fc.active { color: var(--face); color: color-mix(in srgb, var(--face), #000 12%);
  transform: scale(1.1); }
.fc.active:hover { transform: scale(1.1); }
.fc.active b { font-weight: 700; }
/* Operators are only separators: smaller and dimmer than the five words. */
.op { color: rgba(0,0,0,.42); font-size: .6em; }

.stage { flex: 1; width: 100%; position: relative; display: block; min-height: 220px; }
/* One loop control that is always reachable on the stage itself. */
.loop-toggle { position: absolute; right: 8px; top: 8px; z-index: 4; width: 26px; height: 26px;
  border: 1px solid rgba(0,0,0,.12); border-radius: 50%; background: rgba(255,255,255,.7);
  color: #4a525d; font: 13px/1 var(--mono); cursor: pointer; opacity: .6;
  transition: opacity .18s ease, border-color .18s ease, color .18s ease; }
.loop-toggle:hover { opacity: 1; border-color: rgba(0,0,0,.3); color: #0f1218; }

/* Same row as the play toggle, one notch to the left: the button shows the
   language you would switch *to*, not the one you are reading. */
.lang-toggle { position: absolute; right: 40px; top: 8px; z-index: 4; height: 26px; padding: 0 10px;
  border: 1px solid rgba(0,0,0,.12); border-radius: 13px; background: rgba(255,255,255,.7);
  color: #4a525d; font: 12px/1 var(--mono); letter-spacing: .06em; cursor: pointer; opacity: .6;
  transition: opacity .18s ease, border-color .18s ease, color .18s ease; }
.lang-toggle:hover { opacity: 1; border-color: rgba(0,0,0,.3); color: #0f1218; }
.loop-toggle:focus-visible, .lang-toggle:focus-visible { opacity: 1; outline: 2px solid rgba(14,116,144,.4); outline-offset: 2px; }
/* One block: the sentence and the stage it describes. */
.board { display: flex; flex-direction: column; align-items: center; width: 100%; }
/* Three row slots are always reserved: a fenced block opens underneath the
   current line without the line itself moving. */
/* 作用域化：原页 clamp(400px,50vh,620px) 按视口长，而 demo 宿主固定 900px 高；
   这里钉成 450px（与 demos/projection 一致），避免视口高时画布把轮盘挤出宿主。 */
.line-window { position: relative; width: 100%; max-width: 1160px; margin: 0 auto; height: 450px; overflow: hidden; }
.line-window canvas { display: block; width: 100%; height: 100%; }
.line-canvas { position: absolute; inset: 0; pointer-events: none; }
.frame-canvas { position: absolute; inset: 0; pointer-events: none; z-index: 2; transition: opacity .22s ease; }
/* Holds a snapshot of the old face while a projection switch dissolves into the
   new one; it is transparent the rest of the time. */
.mix-canvas { position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0; }

/* The reel is a wheel lying on its side: no frame, no ticks, only the round
   names, with the one facing the camera being the round on screen. */
.reel { --reel-w: 78px; position: relative; width: 100%; max-width: 1160px; height: 26px;
  margin-top: var(--reel-gap, 22px); overflow: hidden; touch-action: none;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent); }
.reel-track { position: absolute; top: 0; left: 0; display: flex; align-items: center; height: 100%;
  will-change: transform; }
.reel-item { flex: 0 0 var(--reel-w); height: 100%; padding: 0; border: 0; background: none;
  font-family: var(--mono); font-size: 15px; letter-spacing: .12em; color: #6b7480;
  opacity: .3; cursor: grab; user-select: none; transform-origin: 50% 50%; will-change: opacity, transform; }
.reel:active .reel-item { cursor: grabbing; }

/* A very quiet playback strip, centered under the current round. */
.stepcontrols { display: flex; align-items: center; justify-content: center; gap: 10px;
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
/* 原页这两条是 html[data-theme="light"] 选择器（shadow 内 html 不生效）；
   作用域化为 :host([data-theme="light"])；dark 走上面的整体反相 + base 值。 */
:host([data-theme="light"]) .stepcontrols button { color: #8a929e; }
:host([data-theme="light"]) .stepcontrols.paused button { color: #3d444e; }

@media(max-width:700px){
  :host{overflow:auto}
  .page{height:auto;min-height:100vh}
  .main{padding:28px 14px 28px}
  .brand{font-size:26px}
  h1{margin-top:14px;font-size:28px}
  .formula{font-size:22px;gap:0 .24em}
  .stage{min-height:380px;padding:12px 0!important}
  .line-window{height:400px}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}
`;
```
