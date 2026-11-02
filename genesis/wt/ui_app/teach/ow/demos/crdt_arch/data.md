# OW_CRDT_ARCH_DATA

## 实现

```jsx@node
/** crdt-arch（/fe 2026-11-02 版，9 步）：一条写 = 两通道 + 四层结构。
 *  全部照原页逐字搬：场景 / 21 节点 / 20 连线 / 9 步时间线（含 hold 定格）/ 4 泳道 /
 *  9 段讲解面板（中英）/ 4 个运行时 svg 图标 / 中英文案。引擎只读这里。 */

// ── scenarios (op shapes from judge_cases_6902.json) ────────────────────
export const CASES = [
  { id: 'rename', label: '纯改名', labelEn: 'Rename', op: 'replace', path: '/ct/0/t', value: 'Alphax',
    change: 't: Alpha → Alphax', claim: 'WIDGET', mod: 'exp_app_card/card.js', sel: 'Alpha',
    fSize: 156, pSize: 73 },
  { id: 'slot', label: '值槽写', labelEn: 'Slot write', op: 'replace', path: '/ct/0/ct/0/ct/0/ct/0/ct/1/ct/0/ct', value: 'tab2',
    change: 'ct: a → tab2', claim: 'SWITCH', mod: 'exp_app_card/switch.js', sel: 'DEMO_UI.PAGE1.SWITCH1',
    fSize: 447, pSize: 97 },
  { id: 'append', label: '追加整节', labelEn: 'Append', op: 'add', path: '/ct/0/ct/1', value: 'h(Appended)',
    change: '+ h(Appended)', claim: 'FLOW', mod: 'exp_app_card/flow.js', sel: 'Alpha',
    fSize: 242, pSize: 149 }
];

// ── scene geometry (1600 × 1000) ───────────────────────────────────────
export const NODES = {
  crdtIn:  { x: 220, y: 56, w: 220, h: 68, c: 'crdt',  k: 'L0 · CRDT',          t: 'CRDT',                s: 'Monaco / LPP · LocalInsert 0x03', ref: 'client.js · lpp_protocol.rs' },
  exec:    { x: 710, y: 56, w: 300, h: 68, c: 'proj',  k: 'L0 · EXEC',          t: 'EXEC',                 s: 'ExecReq 0x0E → UP_EXEC → write_locator', ref: 'crdt.py · workspace.py' },
  crdt:    { x: 230, y: 170, w: 200, h: 74, c: 'crdt',  k: 'L0 · WASM',          t: 'CRDT 文本引擎',       s: 'rope 收敛，不知 AST',       ref: 'lib.rs · lpp_protocol.rs' },
  upsync:  { x: 470, y: 170, w: 200, h: 74, c: 'crdt',  k: 'WIRE · UP',          t: 'UP_SYNC 0x04',        s: '13B header + 文本 op',      ref: 'protocol.rs' },
  session: { x: 760, y: 170, w: 200, h: 74, c: 'crdt',  k: 'L1 · GATEWAY',       t: 'session / rope',      s: 'execute_transaction · CRDT / EXEC', ref: 'session.rs · store.rs' },
  dnsync:  { x: 1000, y: 170, w: 200, h: 74, c: 'crdt', k: 'WIRE · DOWN',        t: 'DN_SYNC 0x83',        s: '文本广播 · Monaco sink', ref: 'store.rs · workspace.py' },

  projection:{ x: 230, y: 380, w: 200, h: 74, c: 'proj', k: 'L1 · PROJECTION',  t: 'ripple / Snapshot',   s: '文本 → 交付 AST JSON',      ref: 'projection.rs' },
  diff:     { x: 470, y: 380, w: 200, h: 74, c: 'proj',  k: 'L1 · DIFF',          t: 'incr::Patch',         s: '旧树 vs 新树 → 位置 op',    ref: 'incr.rs' },
  pframe:   { x: 710, y: 380, w: 200, h: 74, c: 'proj',  k: 'WIRE · P',           t: 'P 帧 · 6902',         s: "DN_AST 0x84 + 'P' + op[]",  ref: 'store.rs' },
  fframe:   { x: 470, y: 286, w: 190, h: 60, c: 'proj',  k: 'WIRE · F',           t: 'F 帧 · 全量',         s: 'FJ 全量 · 直发 AST view', ref: 'store.rs · crdt.py' },

  bridge:   { x: 230, y: 590, w: 200, h: 74, c: 'deliv', k: 'L2 · PY BRIDGE',    t: 'AstBridge',           s: '只接 P 增量；F 直发 socket', ref: 'ast_bridge.py · state.py' },
  ws:       { x: 470, y: 590, w: 200, h: 74, c: 'deliv', k: 'WIRE · 0x84',        t: 'WS / iroh',           s: '按 doc 广播订阅视图',       ref: 'crdt.py' },
  wasm:     { x: 710, y: 590, w: 200, h: 74, c: 'deliv', k: 'L0 · WASM NET',      t: 'Net tag → LPP',       s: 'AST_FULL=3 / AST_PATCH=4',  ref: 'net_protocol.rs · lpp_protocol.rs' },
  astview:  { x: 950, y: 590, w: 200, h: 74, c: 'deliv', k: 'L2 · JS',            t: 'AST view',            s: 'F 直发入 · P applyPatch', ref: 'client.js' },
  mst:      { x: 1190, y: 590, w: 200, h: 74, c: 'deliv', k: 'L3 · MST',          t: 'Node / MD 交付树',    s: 'store 即根节点，结构字段镜像',  ref: 'client.js' },

  uidoc:    { x: 230, y: 800, w: 180, h: 74, c: 'map',   k: 'L3 · DATA',          t: 'ui.md',               s: 'mods / match / visibility', ref: 'ui.md' },
  decl:     { x: 440, y: 800, w: 200, h: 74, c: 'map',   k: 'L3 · PARSE',         t: 'extractDecl',         s: '声明 → {mods, match, vis}', ref: 'uiMd.js' },
  irmatch:  { x: 670, y: 800, w: 180, h: 74, c: 'map',   k: 'L3 · COMPILE',       t: 'match → IR',          s: '选择器编译必须走引擎',      ref: 'uiMd.js · sel_ops.py' },
  gates:    { x: 880, y: 800, w: 170, h: 74, c: 'map',   k: 'L3 · GATE',          t: 'claim / visible',     s: '祖先链上一次判定',          ref: 'uiMd.js · uiStore.js' },
  compfor:  { x: 1080, y: 800, w: 180, h: 74, c: 'map',  k: 'L3 · ROUTER',        t: 'compFor',             s: '名字 → 组件函数',           ref: 'uiMd.js · compTable.jsx' },
  nodeview: { x: 1290, y: 800, w: 180, h: 74, c: 'map',  k: 'L3 · RENDER',        t: 'NodeView',            s: 'claim → comp → React',      ref: 'NodeView.jsx' }
};

// 节点文案英文覆盖（原页 NODE_EN：缺省回退中文）
export const NODE_EN = {
  crdt:    { t: 'CRDT text engine', s: 'rope convergence · no AST' },
  upsync:  { s: '13B header + text op' },
  dnsync:  { s: 'text broadcast · Monaco sink' },
  projection: { s: 'text → delivery AST JSON' },
  diff:    { s: 'old tree vs new tree → positional op' },
  pframe:  { t: 'P frame · 6902' },
  fframe:  { t: 'F frame · full', s: 'FJ full · direct to AST view' },
  bridge:  { s: 'P delta only; F direct socket' },
  ws:      { s: 'per-doc broadcast subscriber view' },
  astview: { s: 'F direct in · P applyPatch' },
  mst:     { t: 'Node / MD delivery tree', s: 'store is root · structural field mirror' },
  decl:    { s: 'decl → {mods, match, vis}' },
  irmatch: { s: 'selector compile must use engine' },
  gates:   { s: 'one decision on ancestor chain' },
  compfor: { s: 'name → component fn' }
};

// ── edges: h = horizontal, v = vertical, custom points; dashed = conceptual ──
export const EDGES = [
  { a: 'crdtIn', b: 'crdt', c: 'crdt', dashed: 1, t: 'v' },
  { a: 'crdt', b: 'upsync', t: 'h', c: 'crdt' },
  { a: 'upsync', b: 'session', t: 'h', c: 'crdt' },
  { a: 'session', b: 'dnsync', t: 'h', c: 'crdt' },
  { a: 'exec', b: 'session', c: 'proj', dashed: 1, t: 'v' },
  { a: 'session', b: 'projection', c: 'proj', pts: (A, B) => [[A.cx, A.y + A.h], [A.cx, 316], [B.cx, 316], [B.cx, B.y]] },
  { a: 'projection', b: 'diff', t: 'h', c: 'proj' },
  { a: 'projection', b: 'fframe', c: 'proj', pts: (A, B) => [[A.x + A.w, A.y + 4], [A.x + A.w + 18, A.y + 4], [A.x + A.w + 18, B.cy], [B.x - 4, B.cy]] },
  { a: 'diff', b: 'pframe', t: 'h', c: 'proj' },
  { a: 'pframe', b: 'bridge', c: 'deliv', pts: (A, B) => [[A.cx, A.y + A.h], [A.cx, 526], [B.cx, 526], [B.cx, B.y]] },
  { a: 'bridge', b: 'ws', t: 'h', c: 'deliv' },
  { a: 'ws', b: 'wasm', t: 'h', c: 'deliv' },
  { a: 'wasm', b: 'astview', t: 'h', c: 'deliv' },
  { a: 'astview', b: 'mst', t: 'h', c: 'deliv' },
  { a: 'mst', b: 'gates', c: 'map', pts: (A, B) => [[A.cx, A.y + A.h], [A.cx, 736], [B.cx, 736], [B.cx, B.y]] },
  { a: 'uidoc', b: 'decl', t: 'h', c: 'map' },
  { a: 'decl', b: 'irmatch', t: 'h', c: 'map' },
  { a: 'irmatch', b: 'gates', t: 'h', c: 'map' },
  { a: 'gates', b: 'compfor', t: 'h', c: 'map' },
  { a: 'compfor', b: 'nodeview', t: 'h', c: 'map' }
];

// ── timed sequence: one loop = one write（hold = 该步内定格某一节点、弹对应 callout）──
export const STEPS = [
  { path: ['exec', 'session'], ms: 2100, tone: 'proj', label: 'exec 命令入口：ExecReq 0x0E → UP_EXEC → write_locator', payload: 'LPP ExecReq=0x0E → runtime.exec → workspace.write_locator → session.execute_transaction' },
  { path: ['session', 'dnsync'], ms: 1000, tone: 'crdt', label: 'DN_SYNC 0x83 · 文本广播（Monaco sink）', payload: 'deliver(KIND_TEXT) · lineage + bincode(WireOps)' },
  { path: ['session', 'projection', 'diff'], ms: 1700, tone: 'proj', label: 'ripple 投影 → 新旧交付树 diff', payload: 'Snapshot::ensure_projected → incr::Patch' },
  { path: ['projection', 'fframe'], ms: 1800, tone: 'proj', ghost: 1, hold: { node: 'fframe', ms: 1400, atStart: false, pop: 'fframe' }, label: 'F 帧：FJ 线程全量渲染（UP_OPEN 触发）', payload: "'F' + 整树 · submit_ast_packet 直发 socket" },
  { path: ['diff', 'pframe'], ms: 1900, tone: 'proj', hold: { node: 'pframe', ms: 1400, atStart: false, pop: 'pframe' }, label: 'P 帧 · 增量 6902 补丁（Path Worker）', payload: "DN_AST 0x84 + 'P' + [{op,path,value}]" },
  { path: ['pframe', 'bridge', 'ws', 'wasm', 'astview', 'mst'], ms: 2900, tone: 'deliv', label: 'P 交付：AstBridge → 广播 → LPP → MST', payload: 'AST_PATCH=4 → assertPatchOps → applyPatch(md, ops)' },
  { path: ['mst', 'gates'], ms: 1600, tone: 'deliv', hold: { node: 'mst', ms: 1400, atStart: true, pop: 'mst' }, label: 'patch 已落地：结构已变，谁画？', payload: 'MST 只负责结构；渲染分流在下一层' },
  { path: ['uidoc', 'decl', 'irmatch', 'gates'], ms: 3000, tone: 'map', hold: { node: 'uidoc', ms: 1400, atStart: true, pop: 'decl' }, label: '声明：## mods + ## match + ### visibility → IR', payload: 'ui.md → extractDecl → sel compile → IR' },
  { path: ['gates', 'compfor', 'nodeview'], ms: 2600, tone: 'map', hold: { node: 'gates', ms: 1400, atStart: true, pop: 'claim' }, label: 'claim → compFor → 组件', payload: 'claim/visible 一次判定 → mods 名字 → 组件函数' }
];
export const IDLE = 900;

// ── lane rails: horizontal headers instead of vertical tags, so each layer reads as a row ──
export const LANES = [
  { y: 170, c: 'crdt',  no: 'L0 – L1', nm: 'EXECUTE_TRANSACTION',      ds: 'CRDT / EXEC 统一写入口', dsEn: 'CRDT / EXEC unified write inlet' },
  { y: 380, c: 'proj',  no: 'L1',      nm: 'PROJECTION · F / P',      ds: '投影 + ripple: Patch Json', dsEn: 'projection + ripple: Patch Json' },
  { y: 590, c: 'deliv', no: 'L2 – L3', nm: 'WS MST',                  ds: '桥 / 广播 / WASM / MST', dsEn: 'bridge / broadcast / WASM / MST' },
  { y: 800, c: 'map',   no: 'L3',      nm: 'MODS / MATCH',            ds: 'ui.md: mods + match', dsEn: 'ui.md: mods + match' }
];
export const LANE_RGBA = { crdt: '111,211,238', proj: '240,180,95', deliv: '143,227,172', map: '201,168,255' };

// ── helpers（原页 shortPath/opSummary；PANEL 的 code 行会用到）──────────
export function shortPath(path, keep = 3) {
  const segs = String(path).split('/').filter(Boolean);
  return segs.length <= keep ? '/' + segs.join('/') : '…/' + segs.slice(-keep).join('/');
}
export function opSummary(c) {
  return `${c.op} ${shortPath(c.path)} = ${JSON.stringify(c.value)}`;
}

// ── step explainer panel（9 段；code 为函数时按当前 case 生成）──────────
export const PANEL = [
  { tag: 'EXEC', title: '命令写入口',
    body: 'ExecReq 0x0E 到网关；_exec_pipeline 走 runtime.exec，再进 workspace.write_locator，最终调用 session.execute_transaction。',
    code: 'LPP ExecReq 0x0E → UP_EXEC 0x0E\n→ _exec_pipeline → runtime.exec\n→ workspace.write_locator → execute_transaction',
    foot: 'handlers/crdt.py · workspace.py' },
  { tag: 'TEXT', title: 'DN_SYNC 文本广播',
    body: '事务返回 wire ops；deliver(KIND_TEXT) 广播给文本订阅者，Monaco sink 消费，与 AST 通道互不替代。',
    code: 'deliver(KIND_TEXT, lineage + bincode(WireOps))',
    foot: 'store.rs · workspace.py' },
  { tag: 'PROJ', title: 'ripple 投影 → diff',
    body: 'execute_transaction 发布新 Snapshot；Path Worker 对旧/新树做位置化 diff，F 与 P 从这里分叉。',
    code: 'Snapshot::ensure_projected\n→ incr::Patch diff',
    foot: 'projection.rs · incr.rs' },
  { tag: 'F', title: 'F 全量 · FJ 渲染',
    body: 'FJ 线程从 Snapshot 全量渲染；UP_OPEN 时 submit_ast_packet 直接绑到请求 socket，不经过 AstBridge。',
    code: (c) => `'F' + JSON · ${c.fSize}B\nUP_OPEN → FJ → direct socket`,
    foot: 'store.rs · crdt.py' },
  { tag: 'P', title: 'P 帧 · 6902',
    body: 'Path Worker 只发变化位置；P 帧经 AstBridge 广播给 AST sink；应用失败会重开 UP_OPEN 全量重同步。',
    code: (c) => `P 6902 · 1 op · ${c.pSize}B\n${opSummary(c)}`,
    foot: 'store.rs · client.js' },
  { tag: 'DELIVERY', title: 'P 交付',
    body: "DN_AST 0x84 的 'P' 经 WS/iroh 到 WASM，转 LPP AST_PATCH=4；AST view 断言 op 白名单后 applyPatch。",
    code: "DN_AST 0x84 · 'P'\n→ AST_PATCH=4 → assertPatchOps\n→ applyPatch(md, ops)",
    foot: 'lib.rs · client.js' },
  { tag: 'MST', title: 'MST · applyPatch',
    body: 'path 是交付树内指针；字段写 replace，结构写 add/remove；store 就是根节点，原地应用并通知 observer。',
    code: (c) => `path ${shortPath(c.path)}\n${c.change}`,
    foot: 'client.js · patch_6902_plan.md' },
  { tag: 'DECL', title: 'ui.md 声明',
    body: 'ui.md 自身以 F 帧交付；extractDecl 拆 ## mods / ## match / ### visibility；match 选择器经引擎 sel compile 得 IR。',
    code: '## mods · ## match · ### visibility\nsel compile → IR',
    foot: 'uiMd.js · entry.client.ts' },
  { tag: 'CLAIM', title: 'claim → compFor',
    body: 'claim / visible 在祖先链上一次判定；compFor 用 mods 名字取组件；这是客户端本地 IR，不读帧上的 match。',
    code: (c) => `claim ${c.claim} → ${c.mod}\ncompFor → NodeView`,
    foot: 'NodeView.jsx · compTable.jsx' }
];

// 面板英文覆盖（原页 PANEL_EN：只覆盖 title/body，code/foot 仍用 PANEL）
export const PANEL_EN = [
  { title: 'Command write inlet', body: 'ExecReq 0x0E reaches the gateway; _exec_pipeline runs runtime.exec, then workspace.write_locator, and finally session.execute_transaction.' },
  { title: 'DN_SYNC text broadcast', body: 'The transaction returns wire ops; deliver(KIND_TEXT) broadcasts to text subscribers while the Monaco sink consumes them.' },
  { title: 'ripple projection → diff', body: 'execute_transaction publishes a new Snapshot; the Path Worker diffs old and new trees into positional ops; F and P branch here.' },
  { title: 'F full · FJ render', body: 'The FJ thread renders the full Snapshot; on UP_OPEN, submit_ast_packet binds the FJ callback directly to the request socket, bypassing AstBridge.' },
  { title: 'P frame · 6902', body: 'The Path Worker sends changed positions only; the P frame is broadcast via AstBridge to AST sinks; a failed apply reopens UP_OPEN for a full resync.' },
  { title: 'P delivery', body: "The 'P' in DN_AST 0x84 reaches WASM over WS/iroh and maps to LPP AST_PATCH=4; AST view asserts the op whitelist, then applies applyPatch." },
  { title: 'MST · applyPatch', body: 'path is a pointer inside the delivery tree; fields use replace, structure uses add/remove; store is the root, so apply is in place and notifies observers.' },
  { title: 'ui.md declaration', body: 'ui.md itself arrives as an F frame; extractDecl splits ## mods / ## match / ### visibility; selector matching is compiled to IR by the engine sel compile.' },
  { title: 'claim → compFor', body: 'claim / visible is decided once on the ancestor chain; compFor resolves the mod name to a component; this is client-local IR, not match from the frame.' }
];

// ── 运行时 svg 图标（原页 6 个 svg：wires/replay 在 view，play/pause/theme 在这里切）──
export const ICONS = {
  play: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M5 3.4 12.4 8 5 12.6Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="4.2" y="3.4" width="2.4" height="9.2" rx=".6" fill="currentColor"/><rect x="9.4" y="3.4" width="2.4" height="9.2" rx=".6" fill="currentColor"/></svg>',
  moon: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8 5.7 5.7 0 1 0 13.2 10.2Z"/></svg>',
  sun: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="2.6"/><path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1"/></svg>'
};

// ── 中英文案（原页 applyLanguage/applyTheme/updatePlayBtn 的逐字字符串）──
export const LABELS = {
  zh: {
    stageTitle: 'EXEC / CRDT => MDIO_UI 链路',
    legend: 'MDIO_UI 链路',
    entry: 'L0 输入',
    scene: '场景',
    langText: 'EN',
    langTitle: 'Switch to English',
    replayTitle: '重放',
    playLabel: '播放',
    pauseLabel: '暂停',
    themeToLight: '切换到浅色',
    themeToDark: '切换到深色',
    close: '关闭',
    idleCounter: '▲ STEP · IDLE',
    idleTitle: '回到起点',
    idleBody: '等待下一次 EXEC / CRDT 写入；两条入口最终都汇入 session.execute_transaction。',
    idleCode: 'CRDT / EXEC → execute_transaction',
    idleFoot: 'ow/crdt-arch.html · 9 steps'
  },
  en: {
    stageTitle: 'EXEC / CRDT => MDIO_UI PATH',
    legend: 'MDIO_UI PATH',
    entry: 'L0 INPUT',
    scene: 'SCENES',
    langText: '中文',
    langTitle: '切换到中文',
    replayTitle: 'Replay',
    playLabel: 'Play',
    pauseLabel: 'Pause',
    themeToLight: 'Light mode',
    themeToDark: 'Dark mode',
    close: 'Close',
    idleCounter: '▲ STEP · IDLE',
    idleTitle: 'Back to start',
    idleBody: 'Waiting for the next EXEC / CRDT write; both inlets converge at session.execute_transaction.',
    idleCode: 'CRDT / EXEC → execute_transaction',
    idleFoot: 'ow/crdt-arch.html · 9 steps'
  }
};
```
