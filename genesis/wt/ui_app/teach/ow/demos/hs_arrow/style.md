# OW_ARROW_STYLE

## 实现

```jsx@node
/** 原页 CSS：:root/html/body 合并成 :host；其余选择器原样（shadow 作用域内）。
 *  浅色主题：上游 html[data-theme="light"] 整段作用域化为 :host([data-theme="light"])，
 *  由教学页壳切 host 的 data-theme 属性；字体栈（--mono/--sans）保持旧版不动（样式适配放最后）。 */
export const CSS = `
:host {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: var(--ow-h, 900px); overflow: hidden;
  --bg: #050506; --text: #f2f4f7; --dim: rgba(203,213,225,.5);
  --line: rgba(255,255,255,.07); --panel: rgba(255,255,255,.028);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --raw: #93c5fd; --container: #67e8f9; --mark: #fbbf24; --tag: #c4b5fd; --content: #34d399;
  background: transparent; color: var(--text); font-family: var(--sans);
}
* { box-sizing: border-box; }

.page { width: 100%; max-width: 1340px; padding: 22px 32px 20px; display: flex; flex-direction: column; flex: none; }
.head { display: flex; align-items: baseline; justify-content: center; gap: 16px; flex: none; }
.brand { font-family: var(--sans); font-size: clamp(24px, 2.6vw, 34px); font-weight: 800; letter-spacing: .24em; text-indent: .24em; color: #f4f7fb; line-height: 1; }
.counts { display: none; }
/* /fe hideCss：教学页嵌入时原页页头/brand 由页面壳代替，不重复出现（fe 同款）。 */
.head, .brand { display: none !important; }

.stage { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; flex: none; height: 512px; }
.stageRow { display: flex; gap: 18px; align-items: stretch; flex: 1; min-height: 0; }
.stagebar { display: flex; flex-wrap: wrap; gap: 40px; justify-content: center; align-items: center;
  flex: none; min-height: 36px; }
.stagebar:empty { display: none; }
.stagebar button { appearance: none; cursor: pointer; font-family: var(--sans); font-size: 16px;
  letter-spacing: 0; color: #b2bcc9; border: 0; border-radius: 0; padding: 0;
  background: none; opacity: .32; transform-origin: 50% 50%;
  transition: color .28s, opacity .28s, transform .28s; }
.stagebar button:hover { color: #e5edf7; opacity: .72; }
.stagebar button.on { font-size: 16px; font-weight: 400; color: #f2f4f7; opacity: 1;
  background: none; border: 0; transform: scale(1.1); }
.stepcontrols { display: flex; align-items: center; justify-content: center;
  height: 20px; margin-top: 3px; opacity: .32;
  transition: opacity .22s ease; flex: none; }
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
.stage.anim-paused *, .stage.anim-paused *::before, .stage.anim-paused *::after {
  animation-play-state: paused !important; }
.stage.modelmode .sqlPanel { display: none; }
.sqlPanel { width: 552px; flex: none; background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
  padding: 13px 15px; overflow: hidden; display: flex; flex-direction: column; }
.sqlBody { font-family: var(--mono); font-size: 11.1px; line-height: 1.5; color: rgba(203,213,225,.82);
  white-space: pre; overflow: hidden; flex: 1; }
.sqlBody .kw { color: #fbbf24 } .sqlBody .fn { color: #67e8f9 } .sqlBody .str { color: #34d399 }
.sqlBody .num { color: #c4b5fd } .sqlBody .cm { color: rgba(148,163,184,.45) }
.sqlBody .ln.cmdline { color: rgba(148,163,184,.62) }
.sqlBody .ln.cmdline b { color: rgba(251,191,36,.85); font-weight: 600 }

.dataPanel { flex: 1; position: relative; min-width: 0 }
.layer { position: absolute; inset: 0; opacity: 0; transform: translateY(6px); transition: opacity .32s, transform .32s;
  pointer-events: none; display: flex; flex-direction: column; gap: 9px }
.layer.on { opacity: 1; transform: none; pointer-events: auto }

.model.skip .mdoc { display: none }
.model.skip .mtab, .model.skip .mtab .mrow, .model.skip .mtab .mrow span, .model.skip .mlinks path,
.model.skip .mtree path, .model.skip .execbar, .model.skip .mflow i, .model.skip .moutmodes {
  animation: none !important; opacity: 1 !important; transform: none !important; stroke-dashoffset: 0 !important }
.model.skip .mflow::after { animation: none !important; opacity: 1 !important }
.model.skip .t-node { opacity: 1 }

.model { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px }
.mdoc { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(.96); opacity: 0; z-index: 3;
  width: 540px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 12px;
  background: rgba(255,255,255,.02); font-family: var(--mono); font-size: 12.5px; line-height: 1.75;
  color: rgba(203,213,225,.82); white-space: normal; display: flex; flex-direction: column; gap: 6px }
.model.play .mdoc { animation: mdoc 3.0s ease forwards }
@keyframes mdoc { 0% { opacity: 0 } 4% { opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
.mdline { padding: 1px 0; transition: opacity .18s }
.mdline.gone { opacity: 0 }
.mdghost { position: absolute; z-index: 5; font-family: var(--mono); font-size: 12px; line-height: 1.5;
  padding: 4px 10px; border: 1px solid rgba(255,255,255,.25); border-radius: 8px;
  background: rgba(10,10,12,.94); color: rgba(226,232,240,.92); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  pointer-events: none; transform: translate(-50%,-50%); transform-origin: center;
  transition: padding .32s ease, border-color .32s ease, color .32s ease, background .32s ease, border-radius .32s ease, box-shadow .32s ease }
.mdghost.landed { padding: 7px 13px; border-radius: 9px; background: rgba(255,255,255,.028); box-shadow: 0 0 0 6px rgba(255,255,255,0) }
.mdghost.landed.root { border-color: rgba(147,197,253,.55); color: #bfdbfe }
.mdghost.landed.sec { border-color: rgba(52,211,153,.5); color: #a7f3d0 }
.mdghost.landed.blk { border-color: rgba(196,181,253,.45); color: #ddd6fe }
.mdghost.landed.flash { box-shadow: 0 0 0 7px rgba(255,255,255,.12) }
.mrowwrap { display: flex; align-items: center; justify-content: center; gap: 12px }
.mlinks { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible }
.mlinks path { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-dasharray: 400; stroke-dashoffset: 400; opacity: 0 }
.mlinks path.fan { stroke: rgba(52,211,153,.5) }
.mlinks path.sql { stroke: rgba(196,181,253,.6) }
.model.play .mlinks path { animation: draw .35s ease forwards; opacity: 1 }
.mcol { display: flex; flex-direction: column; align-items: center; gap: 9px; min-width: 0 }
.pjcol { margin-left: 36px }

.execbar { position: relative; top: -60px; display: flex; align-items: center; justify-content: center; width: 100%; opacity: 0 }
.execbar .mflow { position: absolute; top: 50%; left: 0; transform: translateY(-50%) }
.execbar .moutmodes { position: absolute; top: 50%; left: 0; transform: translateY(-50%); display: inline-flex; align-items: center; height: 34px; box-sizing: border-box }
.model.play .execbar { animation: fadein .35s ease forwards; animation-delay: 5.6s }
.mcmd { font-family: var(--mono); font-size: 14px; color: rgba(203,213,225,.85); white-space: nowrap;
  min-width: 560px; text-align: left; padding: 8px 14px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,.02) }
.mcmd .p { color: #fbbf24 } .mcmd .kw { color: #fbbf24 } .mcmd .str { color: #34d399 }
.mcmd .num { color: #c4b5fd } .mcmd .id { color: #c4b5fd; padding: 0 3px; border-radius: 3px }
.mcmd .id.tok { animation: tokhl .5s ease forwards }
.mrow.qhit { box-shadow: inset 3px 0 0 var(--q, rgba(255,255,255,.6)); background: color-mix(in srgb, var(--q, #fff) 9%, transparent) }
.model.play.queries .mtab.faces .mrow[data-r="4"] span { animation: none; background: transparent }
.mrow.qhit span:first-child { color: #fff }
.mflow { position: relative; width: 56px; height: 1.4px }
.mflow i { position: absolute; inset: 0; background: rgba(148,163,184,.5); transform: scaleX(0); transform-origin: left }
.mflow::after { content: ""; position: absolute; right: 0; top: -3.2px; border-left: 6px solid rgba(148,163,184,.5);
  border-top: 4px solid transparent; border-bottom: 4px solid transparent; opacity: 0 }
.model.play .mflow i { animation: grow .3s ease forwards; animation-delay: 5.75s }
.model.play .mflow::after { animation: fadein .15s ease forwards; animation-delay: 5.92s }
.moutmodes { font-family: var(--mono); font-size: 12.5px; color: rgba(148,163,184,.55);
  border: 1px solid var(--line); border-radius: 999px; padding: 5px 14px; white-space: nowrap; opacity: 0 }
.model.play .moutmodes { animation: fadein .35s ease forwards; animation-delay: 5.85s }
.moutmodes b { color: #a7f3d0; font-weight: 600 }
.mtree { position: relative; width: 240px; height: 296px; flex: none }
.mtree svg { position: absolute; inset: 0; width: 100%; height: 100% }
.mtree path { stroke: rgba(255,255,255,.22); stroke-width: 1.4; fill: none; stroke-dasharray: 400; stroke-dashoffset: 400 }
.t-node { position: absolute; transform: translateX(-50%); padding: 7px 13px; border-radius: 9px; opacity: 0;
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.03);
  font-family: var(--mono); font-size: 12px; color: rgba(226,232,240,.9); white-space: nowrap }
.t-node.root { border-color: rgba(147,197,253,.55); color: #bfdbfe }
.t-node.sec { border-color: rgba(52,211,153,.5); color: #a7f3d0 }
.t-node.blk { border-color: rgba(196,181,253,.45); color: #ddd6fe }

.mtab { border: 1px solid var(--line); border-radius: 11px; overflow: hidden; background: rgba(255,255,255,.02);
  transition: border-color .3s ease, box-shadow .3s ease }
.mtab.qtarget { border-color: color-mix(in srgb, var(--q, #fff) 65%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--q, #fff) 10%, transparent) }
.model .mtab { opacity: 0 }
.model.play .mtab.faces { animation: fadein .25s ease forwards; animation-delay: 3.25s }
.model.play .mtab.long { animation: fadein .25s ease forwards, glowp .7s ease forwards; animation-delay: 4.6s, 5.6s }
.mtab.faces { width: 566px }
.mtab.long { width: 296px }
.mrow { display: grid; font-family: var(--mono); font-size: 11.8px; color: rgba(203,213,225,.66);
  border-top: 1px solid rgba(255,255,255,.04); white-space: nowrap; opacity: 0 }
.mrow span { padding: 7px 10px; overflow: hidden; text-overflow: ellipsis }
.mrow.head { background: rgba(255,255,255,.03); color: rgba(148,163,184,.6); border-top: 0 }
.mtab.faces .mrow { grid-template-columns: 52px 1.2fr 62px 88px 1fr 1fr }
.mtab.long .mrow { grid-template-columns: 56px 92px 1fr }
.mtab.faces .mrow span:nth-child(1) { color: rgba(148,163,184,.6) }
.mtab.faces .mrow span:nth-child(2) { color: #93c5fd }
.mtab.faces .mrow span:nth-child(3) { color: #fbbf24 }
.mtab.faces .mrow span:nth-child(4) { color: #c4b5fd }
.mtab.faces .mrow span:nth-child(5) { color: #34d399 }
.mtab.faces .mrow span:nth-child(6) { color: #67e8f9 }
.mtab.long .mrow span:nth-child(2) { color: #c4b5fd }

.flow { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 80px; flex: none }
.fline { position: relative; width: 100%; height: 1.4px }
.fline i { position: absolute; inset: 0; background: rgba(148,163,184,.5); transform: scaleX(0); transform-origin: left }
.fline::after { content: ""; position: absolute; right: 0; top: -3.2px; border-left: 6px solid rgba(148,163,184,.5);
  border-top: 4px solid transparent; border-bottom: 4px solid transparent; opacity: 0 }

.model.play .mtree path { animation: draw .45s ease forwards }
.model.play .mtree path:nth-of-type(1) { animation-delay: 2.0s }
.model.play .mtree path:nth-of-type(2) { animation-delay: 2.2s }
.model.play .mtree path:nth-of-type(3) { animation-delay: 2.35s }
.model.play .mtree path:nth-of-type(4) { animation-delay: 2.85s }
.model.play .t-node { animation: none }
.model.play .flow.one .fline i { animation: grow .4s ease forwards; animation-delay: 3.3s }
.model.play .flow.one .fline::after { animation: fadein .2s ease forwards; animation-delay: 3.55s }
.model.play .mtab.faces .mrow { animation: rise .3s ease forwards }
.model.play .mtab.faces .mrow.head { animation-delay: 3.45s }
.model.play .mtab.faces .mrow[data-r="0"] { animation-delay: 3.51s }
.model.play .mtab.faces .mrow[data-r="1"] { animation-delay: 3.57s }
.model.play .mtab.faces .mrow[data-r="2"] { animation-delay: 3.63s }
.model.play .mtab.faces .mrow[data-r="3"] { animation-delay: 3.69s }
.model.play .mtab.faces .mrow[data-r="4"] { animation-delay: 3.75s }
.model.play .mtab.faces .mrow[data-r="5"] { animation-delay: 3.81s }
.model.play .mtab.faces .mrow[data-r="6"] { animation-delay: 3.87s }
.model.play .mtab.faces .mrow[data-r="4"] span { animation: cellhl .5s ease forwards }
.model.play .mtab.faces .mrow[data-r="4"] span:nth-child(2) { animation-delay: 4.15s }
.model.play .mtab.faces .mrow[data-r="4"] span:nth-child(3) { animation-delay: 4.23s }
.model.play .mtab.faces .mrow[data-r="4"] span:nth-child(4) { animation-delay: 4.31s }
.model.play .mtab.faces .mrow[data-r="4"] span:nth-child(5) { animation-delay: 4.39s }
.model.play .mtab.faces .mrow[data-r="4"] span:nth-child(6) { animation-delay: 4.47s }
.model.play .mtab.long .mrow { animation: rise .3s ease forwards }
.model.play .mtab.long .mrow.head { animation-delay: 4.65s }
.model.play .mtab.long .mrow[data-r="1"] { animation-delay: 4.8s }
.model.play .mtab.long .mrow[data-r="2"] { animation-delay: 4.88s }
.model.play .mtab.long .mrow[data-r="3"] { animation-delay: 4.96s }
.model.play .mtab.long .mrow[data-r="4"] { animation-delay: 5.04s }
.model.play .mtab.long .mrow[data-r="5"] { animation-delay: 5.12s }

@keyframes tin { from { opacity: 0; transform: translate(-50%,-6px) scale(.92) } to { opacity: 1; transform: translate(-50%,0) scale(1) } }
@keyframes landflash { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.22) } 70% { box-shadow: 0 0 0 9px rgba(255,255,255,0) } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0) } }
@keyframes draw { to { stroke-dashoffset: 0 } }
@keyframes grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes fadein { to { opacity: 1 } }
@keyframes cellhl { 0% { background: transparent } 40% { background: rgba(52,211,153,.22) } 100% { background: rgba(52,211,153,.09) } }
@keyframes cellhlp { 0% { background: transparent } 40% { background: rgba(196,181,253,.26) } 100% { background: rgba(196,181,253,.13) } }
@keyframes tokhl { 0% { background: transparent } 40% { background: rgba(196,181,253,.28) } 100% { background: rgba(196,181,253,.14) } }
@keyframes glowp { 0% { border-color: rgba(255,255,255,.07) } 50% { border-color: rgba(196,181,253,.55) } 100% { border-color: rgba(196,181,253,.3) } }

.stats { background: var(--panel); border: 1px solid var(--line); border-radius: 11px; overflow: hidden; flex: 1 }
.stats .hdr, .stats .r { display: grid; grid-template-columns: 1fr 128px 64px 62px; font-family: var(--mono); white-space: nowrap; overflow: hidden }
.stats .hdr { font-size: 10.5px; color: rgba(148,163,184,.55); background: rgba(255,255,255,.03); border-bottom: 1px solid var(--line); padding: 7px 0 }
.stats .hdr span, .stats .r span { padding: 3px 10px; overflow: hidden; text-overflow: ellipsis }
.stats .r { animation: rise .3s both; animation-delay: calc(var(--i, 0) * 26ms); font-size: 11.5px; color: rgba(203,213,225,.55); border-bottom: 1px solid rgba(255,255,255,.03); transition: background .35s, color .35s, box-shadow .35s }
.stats .r:last-child { border-bottom: 0 }
.stats .r.win { background: rgba(52,211,153,.10); color: rgba(255,255,255,.95); box-shadow: inset 3px 0 0 rgba(52,211,153,.75) }
.stats .r.dim { opacity: .3 }
.stats .r .n { color: #a7f3d0 }
.res-head { font-family: var(--mono); font-size: 11px; color: rgba(148,163,184,.55); display: flex; justify-content: space-between; gap: 12px }
.result { flex: 1; display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow: hidden }
.res-item { animation: rise .3s both; animation-delay: calc(var(--i, 0) * 40ms); background: var(--panel); border: 1px solid var(--line); border-radius: 9px; padding: 6px 10px;
  display: flex; align-items: baseline; gap: 10px; font-family: var(--mono); font-size: 11px }
.res-item .doc { color: rgba(147,197,253,.75); flex: none; max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.res-item .hd { color: rgba(52,211,153,.9); flex: none }
.res-item .body { color: rgba(203,213,225,.55); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.res-item .tag { margin-left: auto; flex: none; font-size: 10px; color: rgba(148,163,184,.5) }

.pivot { background: var(--panel); border: 1px solid var(--line); border-radius: 11px; overflow: hidden; flex: 1 }
.pivot .hdr, .pivot .r { display: grid; grid-template-columns: 1.1fr 52px 54px 1fr 1.35fr; font-family: var(--mono); white-space: nowrap; overflow: hidden }
.pivot .hdr { font-size: 10.5px; color: rgba(148,163,184,.55); background: rgba(255,255,255,.03); border-bottom: 1px solid var(--line); padding: 7px 0 }
.pivot .hdr span, .pivot .r span { padding: 3px 10px; overflow: hidden; text-overflow: ellipsis }
.pivot .r { animation: rise .3s both; animation-delay: calc(var(--i, 0) * 26ms); font-size: 11px; color: rgba(203,213,225,.6); border-bottom: 1px solid rgba(255,255,255,.03) }
.pivot .r:last-child { border-bottom: 0 }
.pivot .r .mark { color: var(--mark) } .pivot .r .tag { color: var(--tag) } .pivot .r .content { color: var(--content) }
.pivot .r.hit { background: rgba(196,181,253,.10); box-shadow: inset 2px 0 0 rgba(196,181,253,.65) }

@keyframes rise { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }
.sqlBody .ln { padding: 0 6px 0 9px; margin: 0 -6px; border-radius: 4px; transition: background .28s, color .28s, opacity .28s }
.sqlBody .ln.dim { opacity: .32 }
.sqlBody .ln.hl { background: color-mix(in srgb, var(--hl) 14%, transparent); box-shadow: inset 2px 0 0 color-mix(in srgb, var(--hl) 78%, transparent); color: #fff;
  animation: hlIn .34s both; animation-delay: calc(var(--k, 0) * 42ms) }
@keyframes hlIn { from { background: transparent; box-shadow: inset 2px 0 0 transparent } to {} }
.beat-dots { display: flex; justify-content: center; align-items: center; gap: 2px; margin-top: 12px; flex: none }
.beat-dots button { appearance: none; border: 0; background: transparent; padding: 6px; cursor: pointer; display: grid; place-items: center; border-radius: 999px; transition: background .25s }
.beat-dots button i { display: block; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.22); transition: width .25s, background .25s, border-radius .25s }
.beat-dots button:hover i { background: rgba(255,255,255,.55) }
.beat-dots button.on { background: rgba(255,255,255,.06) }
.beat-dots button.on i { width: 22px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.88) }
.beat-dots.paused button.on i { background: rgba(251,191,36,.85) }

.nest { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; background: var(--panel); border: 1px solid var(--line); border-radius: 11px; padding: 16px 18px; overflow: hidden }
.nrow { position: relative; display: flex; align-items: center; gap: 9px; width: min(100%, 620px); padding: 5px 0 5px calc(24px * var(--d, 0)); animation: rise .3s both; animation-delay: calc(var(--i, 0) * 50ms) }
.nrow:not(.root)::before { content: ""; position: absolute; left: calc(24px * var(--d) - 12px); top: 0; bottom: 0; border-left: 1px solid rgba(255,255,255,.13) }
.nrow:not(.root)::after { content: ""; position: absolute; left: calc(24px * var(--d) - 12px); top: 50%; width: 10px; border-top: 1px solid rgba(255,255,255,.13) }
.nnum { font-family: var(--mono); font-size: 10.5px; color: rgba(148,163,184,.55); width: 14px; text-align: right; flex: none }
.nchip { font-family: var(--mono); font-size: 10.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: rgba(203,213,225,.8); background: rgba(255,255,255,.02) }
.nchip.head { color: var(--content); border-color: color-mix(in srgb, var(--content) 45%, transparent) }
.nchip.bq { color: var(--container); border-color: color-mix(in srgb, var(--container) 45%, transparent) }
.nchip.code { color: var(--mark); border-color: color-mix(in srgb, var(--mark) 45%, transparent) }
.ntag { font-family: var(--mono); font-size: 11.5px; color: rgba(226,232,240,.85) }
.nbadge { font-family: var(--mono); font-size: 9.5px; color: rgba(148,163,184,.6); border: 1px solid var(--line); border-radius: 999px; padding: 0 6px }
.nrow.hit .ntag { color: #a7f3d0 }
.nrow.hit .nchip.code { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.55); color: #a7f3d0 }
.nest-result { display: flex; flex-direction: column; justify-content: center; gap: 12px; flex: 1 }
.nestmd { flex: 1; margin: 0; padding: 18px 20px; background: var(--panel); border: 1px solid var(--line); border-radius: 11px;
  font-family: var(--mono); font-size: 12.8px; line-height: 1.75; color: rgba(203,213,225,.85); white-space: pre; overflow: hidden }
.codecard { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; animation: rise .3s both; animation-delay: calc(var(--i, 0) * 90ms) }
.codecard .hd { display: flex; justify-content: space-between; gap: 12px; font-family: var(--mono); font-size: 10.5px; color: rgba(148,163,184,.58); margin-bottom: 7px }
.codecard pre { margin: 0; font-family: var(--mono); font-size: 12px; line-height: 1.6; color: rgba(226,232,240,.9) }

.bm25 { flex: 1; display: flex; gap: 10px; align-items: stretch; min-height: 0 }
.bdoc { flex: 1; min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px;
  font-family: var(--mono); font-size: 10.8px; line-height: 1.5; display: flex; flex-direction: column; gap: 2px; overflow: hidden }
.bdoc .bh { font-size: 11px; color: rgba(147,197,253,.8); margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.bsec { display: flex; align-items: baseline; gap: 8px; padding: 3px 4px; border-radius: 5px; margin-top: 5px; color: rgba(52,211,153,.85); transition: background .3s, color .3s, box-shadow .3s, opacity .3s }
.brow { display: flex; align-items: flex-start; gap: 6px; padding: 2px 4px 2px 12px; border-radius: 5px; color: rgba(203,213,225,.62); transition: background .3s, color .3s, box-shadow .3s, opacity .3s }
.brow .k { color: rgba(203,213,225,.85) }
.brow .txt { white-space: normal; overflow-wrap: anywhere }
.brow .rk, .brow .sc, .bsec .sc { margin-left: auto; font-size: 10px; opacity: 0; transition: opacity .3s }
.brow .rk { color: rgba(251,191,36,.8); margin-left: auto }
.bsec .sc { margin-left: auto }
.brow .sc { color: var(--mark) }
.bsec .sc { color: var(--tag) }
.bm25[data-mode="q"] .brow.sel-q { background: rgba(251,191,36,.12); box-shadow: inset 2px 0 0 rgba(251,191,36,.7); color: #fff }
.bm25[data-mode="q"] .brow:not(.sel-q) { opacity: .42 }
.bm25[data-mode="q"] .sc-q, .bm25[data-mode="q"] .rk { opacity: 1 }
.bm25[data-mode="s"] .bsec.sel-s { background: rgba(52,211,153,.10); box-shadow: inset 2px 0 0 rgba(52,211,153,.7); color: #fff }
.bm25[data-mode="s"] .bsec:not(.sel-s), .bm25[data-mode="s"] .brow { opacity: .4 }
.bm25[data-mode="h"] .bsec.sel-h { background: rgba(196,181,253,.12); box-shadow: inset 2px 0 0 rgba(196,181,253,.7); color: #fff }
.bm25[data-mode="h"] .brow.sel-h { background: rgba(196,181,253,.07) }
.bm25[data-mode="h"] .sc-h { opacity: 1 }
.bm25[data-mode="h"] .bsec:not(.sel-h), .bm25[data-mode="h"] .brow:not(.sel-h) { opacity: .28 }

.sqlPanel.compact .sqlBody { font-size: 10.1px; line-height: 1.47 }

/* ── 教学页浅色主题：上游 html[data-theme="light"] 全段（105 条规则），作用域改为 :host([data-theme="light"])；
 *  深色默认样式在上面，切主题只换 host 的 data-theme 属性。 ── */
:host([data-theme="light"]) {
  --bg: #f6f7f9; --text: #15181d;
  --dim: rgba(51,65,85,.55);
  --line: rgba(15,23,42,.12); --panel: rgba(15,23,42,.035);
  --raw: #475569; --container: #0e7490; --mark: #b45309; --tag: #6d28d9; --content: #047857;
  color-scheme: light;
}
:host([data-theme="light"]) .brand { color: #15181d; }
:host([data-theme="light"]) .stagebar button { color: rgba(15,23,42,.58); opacity: .62; background: none; }
:host([data-theme="light"]) .stagebar button:hover { color: #15181d; opacity: .85; }
:host([data-theme="light"]) .stagebar button.on { color: #15181d; opacity: 1; background: none; }
:host([data-theme="light"]) .stepcontrols button { color: #8a929e; }
:host([data-theme="light"]) .stepcontrols.paused button { color: #3d444e; }
:host([data-theme="light"]) .sqlPanel { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .sqlBody { color: rgba(30,41,59,.88); }
:host([data-theme="light"]) .sqlBody .kw,
:host([data-theme="light"]) .sqlBody .ln.cmdline b { color: #b45309; }
:host([data-theme="light"]) .sqlBody .fn { color: #0e7490; }
:host([data-theme="light"]) .sqlBody .str { color: #047857; }
:host([data-theme="light"]) .sqlBody .num { color: #6d28d9; }
:host([data-theme="light"]) .sqlBody .cm { color: rgba(100,116,139,.7); }
:host([data-theme="light"]) .sqlBody .ln.cmdline { color: rgba(71,85,105,.8); }
:host([data-theme="light"]) .sqlBody .ln.hl { color: #15181d; }
:host([data-theme="light"]) .sqlBody .ln.dim { opacity: .38; }
:host([data-theme="light"]) .mdoc { background: #fff; border-color: rgba(15,23,42,.1); color: rgba(30,41,59,.9); }
:host([data-theme="light"]) .mdghost { background: rgba(246,247,249,.97); border-color: rgba(15,23,42,.22); color: #15181d; }
:host([data-theme="light"]) .mdghost.landed { background: rgba(15,23,42,.03); }
:host([data-theme="light"]) .mdghost.landed.root { border-color: rgba(71,85,105,.5); color: #334155; }
:host([data-theme="light"]) .mdghost.landed.sec { border-color: rgba(4,120,87,.45); color: #047857; }
:host([data-theme="light"]) .mdghost.landed.blk { border-color: rgba(109,40,217,.4); color: #6d28d9; }
:host([data-theme="light"]) .mdghost.landed.flash { box-shadow: 0 0 0 7px rgba(15,23,42,.10); }
:host([data-theme="light"]) .mcmd { background: #fff; border-color: rgba(15,23,42,.1); color: rgba(30,41,59,.92); }
:host([data-theme="light"]) .mcmd .p,
:host([data-theme="light"]) .mcmd .kw { color: #b45309; }
:host([data-theme="light"]) .mcmd .str { color: #047857; }
:host([data-theme="light"]) .mcmd .num,
:host([data-theme="light"]) .mcmd .id { color: #6d28d9; }
:host([data-theme="light"]) .mcmd .id.tok { animation-name: tokhlL; }
:host([data-theme="light"]) .moutmodes { color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .moutmodes b { color: #047857; }
:host([data-theme="light"]) .mflow i,
:host([data-theme="light"]) .fline i { background: rgba(71,85,105,.5); }
:host([data-theme="light"]) .mflow::after,
:host([data-theme="light"]) .fline::after { border-left-color: rgba(71,85,105,.5); }
:host([data-theme="light"]) .mtree path { stroke: rgba(15,23,42,.28); }
:host([data-theme="light"]) .t-node { border-color: rgba(15,23,42,.16); background: #fff; color: #334155; }
:host([data-theme="light"]) .t-node.root { border-color: rgba(71,85,105,.5); color: #334155; }
:host([data-theme="light"]) .t-node.sec { border-color: rgba(4,120,87,.45); color: #047857; }
:host([data-theme="light"]) .t-node.blk { border-color: rgba(109,40,217,.4); color: #6d28d9; }
:host([data-theme="light"]) .mtab { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .mrow { color: rgba(30,41,59,.72); border-top-color: rgba(15,23,42,.06); }
:host([data-theme="light"]) .mrow.head { background: rgba(15,23,42,.04); color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(1) { color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(2) { color: #475569; }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(3) { color: #b45309; }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(4),
:host([data-theme="light"]) .mtab.long .mrow span:nth-child(2) { color: #6d28d9; }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(5) { color: #047857; }
:host([data-theme="light"]) .mtab.faces .mrow span:nth-child(6) { color: #0e7490; }
:host([data-theme="light"]) .mrow.qhit span:first-child { color: #15181d; }
:host([data-theme="light"]) .mtab.faces .mrow[data-r="4"] span { animation-name: cellhlL; }
:host([data-theme="light"]) .mtab.long { animation-name: fadein,glowpL; }
:host([data-theme="light"]) .stats { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .stats .hdr { background: rgba(15,23,42,.04); color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .stats .r { color: rgba(30,41,59,.62); border-bottom-color: rgba(15,23,42,.05); }
:host([data-theme="light"]) .stats .r.win { background: rgba(4,120,87,.09); color: #15181d; box-shadow: inset 3px 0 0 rgba(4,120,87,.7); }
:host([data-theme="light"]) .stats .r .n { color: #047857; }
:host([data-theme="light"]) .res-head { color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .res-item { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .res-item .doc { color: rgba(71,85,105,.82); }
:host([data-theme="light"]) .res-item .hd { color: #047857; }
:host([data-theme="light"]) .res-item .body { color: rgba(30,41,59,.62); }
:host([data-theme="light"]) .res-item .tag { color: rgba(51,65,85,.5); }
:host([data-theme="light"]) .pivot { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .pivot .hdr { background: rgba(15,23,42,.04); color: rgba(51,65,85,.62); }
:host([data-theme="light"]) .pivot .r { color: rgba(30,41,59,.68); border-bottom-color: rgba(15,23,42,.05); }
:host([data-theme="light"]) .pivot .r .mark { color: #b45309; }
:host([data-theme="light"]) .pivot .r .tag { color: #6d28d9; }
:host([data-theme="light"]) .pivot .r .content { color: #047857; }
:host([data-theme="light"]) .pivot .r.hit { background: rgba(109,40,217,.08); box-shadow: inset 2px 0 0 rgba(109,40,217,.6); }
:host([data-theme="light"]) .bdoc { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .bdoc .bh { color: #475569; }
:host([data-theme="light"]) .bsec { color: #047857; }
:host([data-theme="light"]) .brow { color: rgba(30,41,59,.62); }
:host([data-theme="light"]) .brow .k { color: rgba(30,41,59,.85); }
:host([data-theme="light"]) .brow .sc,
:host([data-theme="light"]) .bsec .sc { color: #b45309; }
:host([data-theme="light"]) .bm25[data-mode="q"] .brow.sel-q { background: rgba(180,83,9,.10); box-shadow: inset 2px 0 0 rgba(180,83,9,.7); color: #15181d; }
:host([data-theme="light"]) .bm25[data-mode="s"] .bsec.sel-s { background: rgba(4,120,87,.09); box-shadow: inset 2px 0 0 rgba(4,120,87,.7); color: #15181d; }
:host([data-theme="light"]) .bm25[data-mode="h"] .bsec.sel-h { background: rgba(109,40,217,.08); box-shadow: inset 2px 0 0 rgba(109,40,217,.7); color: #15181d; }
:host([data-theme="light"]) .bm25[data-mode="h"] .brow.sel-q { background: rgba(109,40,217,.05); }
:host([data-theme="light"]) .nestmd { background: #fff; border-color: rgba(15,23,42,.1); color: rgba(30,41,59,.9); }
:host([data-theme="light"]) .nest,
:host([data-theme="light"]) .codecard { background: #fff; border-color: rgba(15,23,42,.1); }
:host([data-theme="light"]) .nrow:not(.root)::before,
:host([data-theme="light"]) .nrow:not(.root)::after { border-color: rgba(15,23,42,.14); }
:host([data-theme="light"]) .nchip { color: rgba(30,41,59,.75); background: rgba(15,23,42,.02); }
:host([data-theme="light"]) .nchip.head { color: #047857; border-color: rgba(4,120,87,.4); }
:host([data-theme="light"]) .nchip.bq { color: #0e7490; border-color: rgba(14,116,144,.4); }
:host([data-theme="light"]) .nchip.code { color: #b45309; border-color: rgba(180,83,9,.4); }
:host([data-theme="light"]) .ntag { color: rgba(30,41,59,.9); }
:host([data-theme="light"]) .nbadge { color: rgba(51,65,85,.6); }
:host([data-theme="light"]) .nrow.hit .ntag { color: #047857; }
:host([data-theme="light"]) .nrow.hit .nchip.code { background: rgba(4,120,87,.09); border-color: rgba(4,120,87,.5); color: #047857; }
:host([data-theme="light"]) .codecard .hd { color: rgba(51,65,85,.6); }
:host([data-theme="light"]) .codecard pre { color: #15181d; }
:host([data-theme="light"]) .beat-dots button i { background: rgba(15,23,42,.25); }
:host([data-theme="light"]) .beat-dots button:hover i { background: rgba(15,23,42,.5); }
:host([data-theme="light"]) .beat-dots button.on { background: rgba(15,23,42,.06); }
:host([data-theme="light"]) .beat-dots button.on i { background: rgba(15,23,42,.88); }
:host([data-theme="light"]) .beat-dots.paused button.on i { background: rgba(180,83,9,.9); }
@keyframes cellhlL { 0% { background: transparent } 40% { background: rgba(4,120,87,.18) } 100% { background: rgba(4,120,87,.07) } }
@keyframes glowpL { 0% { border-color: rgba(15,23,42,.12) } 50% { border-color: rgba(109,40,217,.55) } 100% { border-color: rgba(109,40,217,.32) } }
@keyframes tokhlL { 0% { background: transparent } 40% { background: rgba(109,40,217,.20) } 100% { background: rgba(109,40,217,.10) } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
```
