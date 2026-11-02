# OW_CRDT_ARCH_STYLE

## 实现

```jsx@node
/** 原页 CSS（/fe 2026-11-02 版）作用域化：
 *  - :root / html / body 三条页面壳规则合并成 :host（定高 900、无滚动）；
 *  - 原页两段 :root 合并成有效 token（paper-white 基线）+ 当前字体栈（原页字体族按约定留到
 *    样式统一批）；原页没有字体文件或外部样式导入，本文件也未引入；
 *  - 原页深色主题段 → :host([data-theme="dark"])（由教学页壳 body.dark 驱动；浅色 = 上面的基线）；
 *    原页没有浅色主题选择器，本文件也不加；
 *  - 教学页壳自带明暗/语言开关：藏掉 demo 自带的 #langBtn/#themeBtn（legend 与 stage-head 保留，
 *    仍作为图注/标题）；其余选择器原样（shadow 作用域内等价）；.top/.hud/.step-tag/.stage-foot
 *    等当前 DOM 未用的段保留。 */
export const CSS = `
:host{
  /* 有效 token = 原页第二段 :root（paper-white）；字体栈保持现有 */
  --bg:#fafafa; --ink:#171717; --dim:#4d4d4d; --faint:#8f8f8f;
  --line:#ebebeb; --line2:#c9c9c9;
  --crdt:#171717; --proj:#4d4d4d; --deliv:#7d7d7d; --map:#a8a8a8; --warn:#297a3a;
  --mono:ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans:"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display:block; height:var(--ow-h, 900px); overflow:hidden; margin:0;
  background:transparent; color:var(--ink); font-family:var(--sans);
  color-scheme: light;
}
*{box-sizing:border-box}
.app{height:100%; display:flex; flex-direction:column}
.top{
  display:flex; align-items:baseline; gap:16px; padding:12px 24px 8px; flex:none;
}
.brand{font-family:var(--mono); letter-spacing:.16em; font-size:11px; color:var(--dim)}
.brand b{font-family:var(--sans); letter-spacing:.24em; font-size:14px; color:#fff}
.top .hint{margin-left:auto; font-family:var(--mono); font-size:9.5px; color:var(--faint)}
.hint kbd{border:1px solid var(--line); padding:1px 5px; border-radius:2px; color:var(--dim)}

.stage-holder{position:relative; flex:1; min-height:0; display:grid; place-items:center; overflow:hidden}
.stage{
  position:absolute; top:0; left:0; width:1600px; height:1000px; transform-origin:top left;
  border:1px solid var(--line); background:linear-gradient(180deg, rgba(13,20,30,.72), rgba(8,13,20,.85));
  overflow:hidden;
}
.stage::before,.stage::after{content:""; position:absolute; width:15px; height:15px; border:1px solid var(--line2); pointer-events:none}
.stage::before{left:-1px; top:-1px; border-right:0; border-bottom:0}
.stage::after{right:-1px; bottom:-1px; border-left:0; border-top:0}

.stage-head{position:absolute; left:34px; top:24px; display:flex; align-items:baseline; gap:14px}
.stage-idx{font-family:var(--mono); font-size:10px; letter-spacing:.18em; color:var(--proj); border:1px solid rgba(240,180,95,.45); padding:2px 7px}
.stage-title{font-size:14px; font-weight:600; letter-spacing:.01em}
.stage-sub{font-family:var(--mono); font-size:10px; color:var(--faint)}
.legend{position:absolute; right:34px; top:28px; display:flex; gap:16px; font-family:var(--mono); font-size:9.5px; color:var(--dim)}
.dot{display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:5px; vertical-align:1px}

svg.wires{position:absolute; inset:0; width:1600px; height:1000px; pointer-events:none; overflow:visible}
svg.wires path.base{fill:none; stroke-width:1.1; stroke-opacity:.34}
svg.wires path.base.dashed{stroke-dasharray:5 5; stroke-opacity:.25}
svg.wires path.base.faint{stroke-dasharray:2 6; stroke-opacity:.10}
svg.wires path.lit{filter:drop-shadow(0 0 5px rgba(255,255,255,.4)); stroke-width:1.7}
svg.wires text.wire-label{font-family:var(--mono); font-size:8.5px; letter-spacing:.04em; fill:var(--faint); paint-order:stroke; stroke:#080d14; stroke-width:3px; stroke-linejoin:round}

.lane-band{
  position:absolute; left:28px; right:28px; height:126px; border-radius:5px; pointer-events:none;
  border-top:1px solid var(--line);
}
.entry-tag{position:absolute; left:40px; top:72px; width:168px; z-index:2; pointer-events:none; font-family:var(--mono)}
.entry-tag span{display:block; font-size:9px; color:var(--faint); margin-top:4px; line-height:1.35}
.lane-head{
  position:absolute; left:40px; width:168px; z-index:2; pointer-events:none;
  font-family:var(--mono);
}
.lane-head .no{display:block; font-size:8.5px; letter-spacing:.16em; color:var(--c); opacity:.8}
.lane-head .nm{display:block; font-size:12px; font-weight:600; color:var(--ink); margin-top:4px; letter-spacing:.01em; font-family:var(--sans)}
.lane-head .ds{display:block; font-size:9px; color:var(--faint); margin-top:4px; line-height:1.35}
.stage-foot{
  position:absolute; right:34px; bottom:28px; font-family:var(--mono); font-size:9px;
  color:var(--faint); letter-spacing:.02em; z-index:6;
}

.node{
  position:absolute; background:var(--panel,#0c131d); border:1px solid var(--line);
  padding:9px 12px 8px; border-radius:3px; transition:border-color .25s, box-shadow .25s, background .25s;
  cursor:default;
}
.node .k{display:block; font-family:var(--mono); font-size:8.5px; letter-spacing:.08em; color:var(--faint)}
.node .t{display:block; font-size:13px; font-weight:600; margin-top:4px; line-height:1.15}
.node .s{display:block; font-family:var(--mono); font-size:9px; color:var(--dim); margin-top:4px; line-height:1.35}
.node.c-crdt{border-top:2px solid var(--crdt)} .node.c-crdt .k{color:var(--crdt)}
.node.c-proj{border-top:2px solid var(--proj)} .node.c-proj .k{color:var(--proj)}
.node.c-deliv{border-top:2px solid var(--deliv)} .node.c-deliv .k{color:var(--deliv)}
.node.c-map{border-top:2px solid var(--map)} .node.c-map .k{color:var(--map)}
.node.engine{border-style:dashed}
.node.on{background:#13202e; border-color:rgba(220,235,255,.42)}
.node.on.c-crdt{box-shadow:0 0 0 1px rgba(111,211,238,.55), 0 0 30px rgba(111,211,238,.16)}
.node.on.c-proj{box-shadow:0 0 0 1px rgba(240,180,95,.55), 0 0 30px rgba(240,180,95,.16)}
.node.on.c-deliv{box-shadow:0 0 0 1px rgba(143,227,172,.55), 0 0 30px rgba(143,227,172,.16)}
.node.on.c-map{box-shadow:0 0 0 1px rgba(201,168,255,.55), 0 0 30px rgba(201,168,255,.16)}
.node.on .t{color:#fff}

.pulse{
  position:absolute; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%;
  background:#fff; box-shadow:0 0 12px 3px rgba(255,255,255,.35); opacity:0; z-index:5;
  pointer-events:none;
}
.pulse.crdt{background:var(--crdt); box-shadow:0 0 14px 3px rgba(111,211,238,.5)}
.pulse.proj{background:var(--proj); box-shadow:0 0 14px 3px rgba(240,180,95,.5)}
.pulse.deliv{background:var(--deliv); box-shadow:0 0 14px 3px rgba(143,227,172,.5)}
.pulse.map{background:var(--map); box-shadow:0 0 14px 3px rgba(201,168,255,.5)}
.pulse.ghost{width:7px; height:7px; margin:-3.5px 0 0 -3.5px; opacity:.8}

.callout{
  position:absolute; z-index:6; font-family:var(--mono); font-size:9.5px; line-height:1.5;
  border:1px solid var(--line2); background:rgba(9,15,23,.94); padding:7px 9px; border-radius:3px;
  color:var(--dim); max-width:340px; opacity:0; transform:translateY(4px); transition:opacity .3s, transform .3s;
  pointer-events:none;
}
.callout.show{opacity:1; transform:translateY(0)}
.callout b{color:var(--ink); font-weight:600}
.callout .op{color:var(--proj)}
.callout .claim{color:var(--map)}
.callout .mod{color:var(--deliv)}
.callout .dim{color:var(--faint)}

.step-tag{
  position:absolute; left:34px; bottom:32px; z-index:7; display:flex; align-items:center; gap:12px;
  font-family:var(--mono); font-size:10px; color:var(--dim);
}
.step-tag .n{color:var(--faint); letter-spacing:.1em}
.step-tag .l{color:var(--ink)}
.step-tag .p{color:var(--faint)}
.step-tag .payload{color:var(--proj); max-width:720px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.step-tag .bar{width:120px; height:2px; background:rgba(255,255,255,.08); overflow:hidden}
.step-tag .bar i{display:block; height:100%; width:0; background:var(--proj); transition:width .1s linear}

.hud{
  flex:none; display:flex; align-items:center; gap:10px; padding:10px 24px 12px;
  border-top:1px solid var(--line); font-family:var(--mono); font-size:10px; color:var(--faint);
}
.hud button{
  appearance:none; cursor:pointer; background:transparent; border:1px solid var(--line);
  color:var(--dim); font-family:var(--mono); font-size:10px; padding:5px 9px; border-radius:2px;
}
.hud button:hover{border-color:var(--line2); color:var(--ink)}
.hud button.on{border-color:var(--proj); color:var(--proj)}
.hud .sep{width:1px; height:14px; background:var(--line); margin:0 6px}
.hud .ref{margin-left:auto; max-width:60vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dim)}
.hud .ref span{color:var(--crdt)}
.hud .cases{display:flex; gap:4px}

/* ── Vercel reference: paper-white, monochrome, mono stamps（原页浅色基线）────── */
:host{background:transparent!important;color:#171717!important}
:host{background-image:none!important}
.app{background:transparent}
.top{background:rgba(250,250,250,.94);border-bottom:1px solid #ebebeb;backdrop-filter:blur(14px)}
.brand{color:#8f8f8f;letter-spacing:.08em}
.brand .tri{display:inline-block;color:#000;font-size:10px;line-height:1;margin-right:9px;transform:translateY(-1px)}
.brand b{color:#171717;font-weight:500;letter-spacing:.18em}
.top .hint{color:#8f8f8f;letter-spacing:.02em}
.hint kbd{background:#fff;border:1px solid #ebebeb;border-radius:2px;color:#4d4d4d}

.stage{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.stage::before,.stage::after{display:none}
.stage-idx{color:#171717;background:#fafafa;border:1px solid #ebebeb;border-radius:2px;letter-spacing:.1em}
.stage-title{color:#171717;font-size:20px;font-weight:450;letter-spacing:-.02em}
.stage-sub{color:#8f8f8f;font-size:10px;letter-spacing:.071em;text-transform:uppercase}
.legend{color:#8f8f8f;font-size:10px;letter-spacing:.02em}
.legend .dot{width:5px;height:5px;border-radius:1px;margin-right:6px;vertical-align:0}
.stage-tools{position:absolute; right:34px; top:24px; display:flex; align-items:center; gap:9px; z-index:8}
.stage-tools .legend{position:static; margin-right:3px}
.tool-btn{height:24px; min-width:24px; padding:0 8px; border:1px solid #e5e5e5; background:#fff; color:#4d4d4d; border-radius:9999px; font-family:var(--mono); font-size:9px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:4px}
.tool-btn:hover{border-color:#171717; color:#171717}
.tool-btn.tool-icon{width:24px; padding:0}
.tool-btn svg{display:block}
.lane-band{background:transparent!important;border-top:1px solid #ebebeb!important;border-radius:0}
.lane-head .no{color:#8f8f8f!important;letter-spacing:.14em}
.lane-head .nm{color:#171717!important;font-weight:500;font-size:12.5px;letter-spacing:-.01em}
.lane-head .ds{color:#8f8f8f!important;font-size:9.5px;letter-spacing:.02em}
.entry-tag{color:#171717;font-size:11px;letter-spacing:.071em}
.entry-tag span{color:#8f8f8f;font-size:9.5px;letter-spacing:.02em}
.entry-tag .entry-title{display:block;color:#171717;font-size:11px;letter-spacing:.071em;margin:0}

.node{background:#fff!important;border:1px solid #ebebeb!important;border-radius:6px!important;box-shadow:0 0 0 1px rgba(0,0,0,.02)}
.node:hover{border-color:#c9c9c9!important}
.node .k{color:#8f8f8f!important;letter-spacing:.071em}
.node .t{color:#171717;font-size:13px;font-weight:450;letter-spacing:-.01em}
.node .s{color:#666;font-family:var(--mono);font-size:9.5px}
.node.on{background:#fff!important;border-color:#171717!important;box-shadow:0 0 0 1px #171717,0 0 0 3px #fafafa!important}
.node.on .k{color:#4d4d4d!important}
.node.on .t{color:#171717!important}
.node.engine{border-style:dashed!important}

svg.wires path.base{stroke:#a8a8a8!important;stroke-opacity:1!important;stroke-width:1!important}
svg.wires path.base.dashed{stroke:#bdbdbd!important;stroke-dasharray:3 5!important}
svg.wires path.base.faint{stroke-opacity:.55!important}
svg.wires path.lit{stroke:#171717!important;stroke-width:1.5!important;filter:none!important}
svg.wires marker path{fill:#171717!important}
svg.wires text.wire-label{fill:#8f8f8f!important;stroke:#fff}

.pulse,.pulse.crdt,.pulse.proj,.pulse.deliv,.pulse.map{background:#171717!important;box-shadow:0 0 0 2px #fff,0 0 0 3px #e5e5e5!important}
.pulse.ghost{background:#171717!important}

.callout{background:#fff!important;border:1px solid #ebebeb!important;border-radius:6px;color:#4d4d4d!important;box-shadow:0 0 0 1px rgba(0,0,0,.03);font-size:10px;max-width:300px!important}
.callout b{color:#171717!important;font-weight:500}
.callout .op{color:#171717!important}
.callout .claim{color:#297a3a!important}
.callout .mod{color:#171717!important}
.callout .dim{color:#8f8f8f!important}

.node-info{
  position:absolute; z-index:10; width:320px; padding:12px 14px;
  background:#fff; border:1px solid #e5e5e5; border-radius:6px;
  box-shadow:0 18px 50px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.05);
  font-family:var(--mono); font-size:10px; line-height:1.5; color:#4d4d4d;
}
.node-info[hidden]{display:none}
.node-info .ni-head{display:flex; align-items:flex-start; justify-content:space-between; gap:10px}
.node-info b{font-family:var(--sans); font-size:14px; font-weight:450; letter-spacing:-.01em; color:#171717; line-height:1.25}
.node-info .ni-close{border:0; background:transparent; color:#8f8f8f; font:16px/1 var(--sans); padding:0 0 0 4px; cursor:pointer}
.node-info .ni-close:hover{color:#171717}
.node-info .ni-sub{margin-top:5px; color:#4d4d4d}
.node-info .ni-ref{margin-top:8px; padding-top:7px; border-top:1px solid #ebebeb; color:#8f8f8f; font-size:9px; word-break:break-all}

.step-tag{color:#4d4d4d;font-size:10.5px}
.step-tag .n{color:#8f8f8f;letter-spacing:.071em;text-transform:uppercase}
.step-tag .n::before{content:"▲ ";font-size:8px;color:#000;letter-spacing:0}
.step-tag .l{color:#171717;font-weight:500}
.step-tag .p{color:#8f8f8f}
.step-tag .payload{color:#4d4d4d}
.step-tag .bar{background:#ebebeb}
.step-tag .bar i{background:#297a3a}
.stage-foot{color:#8f8f8f;letter-spacing:.02em}

.hud{background:#fafafa;border-top:1px solid #ebebeb;color:#8f8f8f;font-size:11px}
.hud button{background:#fff;border:1px solid #ebebeb;color:#4d4d4d;border-radius:6px;font-size:11px;padding:5px 10px}
.hud button:hover{border-color:#171717;color:#171717}
.hud button.on{background:#171717!important;color:#fff!important;border-color:#171717!important}
.hud #playBtn{background:#171717!important;color:#fff!important;border-color:#171717!important}
.hud #playBtn:hover{background:#333!important;border-color:#333!important}
.hud .sep{background:#ebebeb}
.hud .ref{color:#8f8f8f}
.hud .ref span{color:#297a3a}
.hud .cases .case-btn{border-radius:9999px;padding:4px 12px;background:#fff;color:#4d4d4d}
.hud .cases .case-btn.on{background:#171717!important;color:#fff!important;border-color:#171717!important}

.step-panel{
  position:absolute; left:1000px; top:260px; width:540px; height:300px;
  background:rgba(255,255,255,.78); backdrop-filter:blur(16px);
  border:0; border-radius:10px; padding:0; overflow:hidden; z-index:6;
  box-shadow:0 24px 70px rgba(0,0,0,.14),0 2px 10px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04);
  font-family:var(--mono); color:#4d4d4d;
  display:flex; flex-direction:column;
}
.step-panel .sp-main{padding:14px 18px 0; flex:1 1 auto; min-height:0; overflow:hidden}
.step-panel .sp-head{display:flex; justify-content:space-between; gap:12px; padding-bottom:9px; border-bottom:1px solid rgba(0,0,0,.06); font-size:10px; letter-spacing:.071em; text-transform:uppercase; color:#8f8f8f}
.step-panel .sp-num{color:#171717}
.step-panel .sp-tag{color:#297a3a}
.step-panel .sp-title{margin-top:0; font-family:var(--sans); font-size:19px; font-weight:450; letter-spacing:-.01em; line-height:1.2; color:#171717}
.step-panel .sp-body{margin-top:7px; font-family:var(--sans); font-size:12px; line-height:1.5; color:#4d4d4d; max-height:54px; overflow:hidden}
.step-panel .sp-code{margin:9px 0 0; padding:7px 9px; border:1px solid rgba(0,0,0,.07); border-radius:4px; background:rgba(250,250,250,.7); font-family:var(--mono); font-size:9.5px; line-height:1.5; color:#171717; white-space:pre-wrap; overflow-wrap:anywhere; max-height:66px; overflow:auto}
.step-panel .sp-foot{margin-top:7px; font-size:9px; letter-spacing:.02em; color:#8f8f8f; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.step-panel .sp-bottom{position:relative; border-top:1px solid rgba(0,0,0,.07); background:rgba(250,250,250,.55); padding:10px 16px 15px}
.step-panel .sp-status{display:flex; align-items:center; justify-content:flex-start; gap:8px; min-height:28px; white-space:nowrap; overflow:hidden}
.step-panel .sp-step{font-family:var(--mono); font-size:10px; letter-spacing:.075em; color:#171717; white-space:nowrap; flex:0 0 auto}
.step-panel .player{display:flex; align-items:center; gap:5px; flex:0 0 auto}
.step-panel .player-btn{width:24px; height:24px; border-radius:9999px; display:grid; place-items:center; padding:0; cursor:pointer; background:#fff; color:#4d4d4d; border:1px solid #e5e5e5}
.step-panel .player-btn:hover{border-color:#171717; color:#171717}
.step-panel .player-btn.primary{background:#171717; color:#fff; border-color:#171717}
.step-panel .player-btn.primary:hover{background:#333; color:#fff; border-color:#333}
.step-panel .player-btn svg{display:block; width:12px; height:12px}
.step-panel .player-btn.primary svg{width:10px; height:10px}
.step-panel .sp-sep{width:1px; height:14px; background:#e5e5e5; flex:0 0 auto; margin-left:auto}
.step-panel .sp-scenes-label{font-family:var(--mono); font-size:8.5px; letter-spacing:.08em; text-transform:uppercase; color:#8f8f8f; flex:0 0 auto}
.step-panel .sp-status .cases{display:flex; align-items:center; gap:4px; min-width:0; overflow:hidden}
.step-panel .sp-status .cases .case-btn{border-radius:9999px; padding:4px 8px; background:#fff; color:#4d4d4d; border:1px solid #e5e5e5; font-size:9px; line-height:1.2; white-space:nowrap}
.step-panel .sp-status .cases .case-btn:hover{border-color:#171717; color:#171717}
.step-panel .sp-status .cases .case-btn.on{background:#171717!important; color:#fff!important; border-color:#171717!important}
.step-panel .sp-progress{position:absolute; left:0; right:0; bottom:0; height:2px; background:#ebebeb; overflow:hidden}
.step-panel .sp-progress i{display:block; height:100%; width:0; background:#8f8f8f; transition:width .1s linear}

/* +20px air between the title row and the diagram content */
.stage > svg.wires,
.stage > .node,
.stage > .lane-band,
.stage > .lane-head,
.stage > .entry-tag,
.stage > .pulse,
.stage > .callout,
.stage > .node-info,
.stage > .step-panel { translate: 0 20px; }

/* ── dark theme（原页 html[data-theme="dark"] 段；默认 dark，浅色 = 上面的基线）── */
:host([data-theme="dark"]){color-scheme:dark}
:host([data-theme="dark"]),
:host([data-theme="dark"]) .app{background:transparent!important;color:#ededed}
:host([data-theme="dark"]) .stage{background:transparent!important;border-color:transparent!important;box-shadow:none!important;border-radius:0!important}
:host([data-theme="dark"]) .stage-idx{color:#ededed;background:#0a0a0a;border-color:#262626}
:host([data-theme="dark"]) .stage-title{color:#ededed}
:host([data-theme="dark"]) .legend{color:#8f8f8f}
:host([data-theme="dark"]) .tool-btn{background:#111;border-color:#333;color:#a1a1a1}
:host([data-theme="dark"]) .tool-btn:hover{border-color:#ededed;color:#ededed}
:host([data-theme="dark"]) .lane-band{border-top-color:#262626!important;background:transparent!important}
:host([data-theme="dark"]) .lane-head .no{color:#666!important}
:host([data-theme="dark"]) .lane-head .nm{color:#ededed!important}
:host([data-theme="dark"]) .lane-head .ds{color:#8f8f8f!important}
:host([data-theme="dark"]) .entry-tag{color:#ededed}
:host([data-theme="dark"]) .entry-tag span{color:#8f8f8f}
:host([data-theme="dark"]) .entry-tag .entry-title{color:#ededed}
:host([data-theme="dark"]) .node{background:#111!important;border-color:#262626!important;box-shadow:0 0 0 1px #1a1a1a}
:host([data-theme="dark"]) .node:hover{border-color:#525252!important}
:host([data-theme="dark"]) .node .k{color:#8f8f8f!important}
:host([data-theme="dark"]) .node .t{color:#ededed}
:host([data-theme="dark"]) .node .s{color:#a1a1a1}
:host([data-theme="dark"]) .node.on{background:#111!important;border-color:#ededed!important;box-shadow:0 0 0 1px #ededed,0 0 0 3px #000!important}
:host([data-theme="dark"]) .node.on .k{color:#a1a1a1!important}
:host([data-theme="dark"]) .node.on .t{color:#fff!important}
:host([data-theme="dark"]) svg.wires path.base{stroke:#333!important}
:host([data-theme="dark"]) svg.wires path.base.dashed{stroke:#3f3f3f!important}
:host([data-theme="dark"]) svg.wires path.base.faint{stroke-opacity:.5!important}
:host([data-theme="dark"]) svg.wires path.lit{stroke:#ededed!important}
:host([data-theme="dark"]) svg.wires marker path{fill:#ededed!important}
:host([data-theme="dark"]) svg.wires text.wire-label{fill:#8f8f8f!important;stroke:#0a0a0a}
:host([data-theme="dark"]) .pulse,
:host([data-theme="dark"]) .pulse.crdt,
:host([data-theme="dark"]) .pulse.proj,
:host([data-theme="dark"]) .pulse.deliv,
:host([data-theme="dark"]) .pulse.map{background:#ededed!important;box-shadow:0 0 0 2px #111,0 0 0 3px #333!important}
:host([data-theme="dark"]) .callout{background:#111!important;border-color:#333!important;color:#a1a1a1!important;box-shadow:0 0 0 1px #1a1a1a}
:host([data-theme="dark"]) .callout b{color:#ededed!important}
:host([data-theme="dark"]) .callout .op,
:host([data-theme="dark"]) .callout .mod{color:#ededed!important}
:host([data-theme="dark"]) .callout .claim{color:#4ade80!important}
:host([data-theme="dark"]) .callout .dim{color:#8f8f8f!important}
:host([data-theme="dark"]) .node-info{background:#111;border-color:#333;color:#a1a1a1;box-shadow:0 18px 50px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.3)}
:host([data-theme="dark"]) .node-info b{color:#ededed}
:host([data-theme="dark"]) .node-info .ni-close{color:#8f8f8f}
:host([data-theme="dark"]) .node-info .ni-close:hover{color:#ededed}
:host([data-theme="dark"]) .node-info .ni-sub{color:#a1a1a1}
:host([data-theme="dark"]) .node-info .ni-ref{color:#666;border-top-color:#262626}
:host([data-theme="dark"]) .step-panel{background:rgba(20,20,20,.84);color:#a1a1a1;box-shadow:0 24px 70px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.25),0 0 0 1px #262626}
:host([data-theme="dark"]) .step-panel .sp-title{color:#ededed}
:host([data-theme="dark"]) .step-panel .sp-body{color:#a1a1a1}
:host([data-theme="dark"]) .step-panel .sp-code{background:#0a0a0a;border-color:#262626;color:#ededed}
:host([data-theme="dark"]) .step-panel .sp-foot{color:#666}
:host([data-theme="dark"]) .step-panel .sp-bottom{background:rgba(10,10,10,.62);border-top-color:#262626}
:host([data-theme="dark"]) .step-panel .sp-step{color:#ededed}
:host([data-theme="dark"]) .step-panel .sp-sep{background:#333}
:host([data-theme="dark"]) .step-panel .sp-scenes-label{color:#666}
:host([data-theme="dark"]) .step-panel .player-btn{background:#111;border-color:#333;color:#a1a1a1}
:host([data-theme="dark"]) .step-panel .player-btn:hover{border-color:#ededed;color:#ededed}
:host([data-theme="dark"]) .step-panel .player-btn.primary{background:#ededed;border-color:#ededed;color:#000}
:host([data-theme="dark"]) .step-panel .player-btn.primary:hover{background:#fff;border-color:#fff;color:#000}
:host([data-theme="dark"]) .step-panel .sp-status .cases .case-btn{background:#111;border-color:#333;color:#a1a1a1}
:host([data-theme="dark"]) .step-panel .sp-status .cases .case-btn:hover{border-color:#ededed;color:#ededed}
:host([data-theme="dark"]) .step-panel .sp-status .cases .case-btn.on{background:#ededed!important;border-color:#ededed!important;color:#000!important}
:host([data-theme="dark"]) .step-panel .sp-progress{background:#262626}
:host([data-theme="dark"]) .step-panel .sp-progress i{background:#a1a1a1}

/* 教学页壳（mdio）自带主题/语言开关：藏掉 demo 自带入口（legend/stage-head 保留）。 */
#langBtn, #themeBtn { display: none !important; }
`;
```
