# OW_CRDT_ARCH_ENGINE

## 实现

```jsx@node
/** crdt-arch 引擎（/fe 2026-11-02 版，9 步）：时间线播放 + hold 定格 + step-panel 讲解 +
 *  节点 popover 跳转 + 场景切换 + 中英 / 深浅切换。
 *  options.lang = "zh"|"en"（原 ?lang）；options.theme = "dark"|"light"（默认 dark，原 ?theme；
 *  浅色即 style 里的 paper-white 基线，深色由 :host([data-theme="dark"]) 覆盖）；
 *  options.auto = 是否自动播放（默认 true；false 时停在第 1 帧，等 resume）。
 *  导出：dispose/pause/resume/toggle/replay/park/setCase/setLang/setTheme/jumpToNode/state
 *  + 只读 stepCount/caseIds/caseIndex/paused/lang/theme。 */
import {
  CASES, NODES, NODE_EN, EDGES, STEPS, IDLE, LANES, LANE_RGBA, PANEL, PANEL_EN, ICONS, LABELS,
  shortPath, opSummary
} from "@app/OW_CRDT_ARCH_DATA";

export function createCrdtArchEngine({ root, shadow, data, options }) {
  const opts = options || {};
  let lang = opts.lang === "en" ? "en" : "zh";
  let theme = opts.theme === "light" ? "light" : "dark";
  const auto = opts.auto !== false;
  const T = (key) => (LABELS[lang] && LABELS[lang][key]) || LABELS.zh[key];
  const $ = (id) => (shadow && shadow.getElementById ? shadow.getElementById(id) : null);
  const NS = "http://www.w3.org/2000/svg";

  // ── DOM setup（查询一律限定在 shadow 内）────────────────────────────────
  const stage = $("stage");
  const holder = $("holder");
  const svg = $("wires");
  const pulse = $("pulse");
  const stageTitleEl = $("stageTitle");
  const legendLabel = $("legendLabel");
  const entryLabel = $("entryLabel");
  const sceneLabel = $("sceneLabel");
  const langBtn = $("langBtn");
  const themeBtn = $("themeBtn");
  const panelEl = $("stepPanelMain");
  const stepBar = $("stepBar");
  const stepCounter = $("stepCounter");
  const playBtn = $("playBtn");
  const replayBtn = $("replayBtn");
  const casesEl = $("cases");
  const co = {
    fframe: $("co-fframe"),
    pframe: $("co-pframe"),
    mst: $("co-mst"),
    decl: $("co-decl"),
    claim: $("co-claim")
  };

  // 不改共享 data：NODES 补 id/cx/cy、STEPS 补 index/start/segs，全部落在副本上。
  const N = {};
  for (const [id, n] of Object.entries(NODES)) {
    N[id] = Object.assign({}, n, { id: id, cx: n.x + n.w / 2, cy: n.y + n.h / 2 });
  }
  const SEQ = STEPS.map((s) => Object.assign({}, s, { path: s.path.slice() }));
  const cycleMs = SEQ.reduce((sum, s) => sum + s.ms, 0) + IDLE;

  // ── 状态 / 账本 ─────────────────────────────────────────────────────────
  const ctl = new AbortController();
  const nodeEls = {};
  const laneHeads = [];
  const edgePaths = {};
  const nodeInfo = document.createElement("div");
  nodeInfo.className = "node-info";
  nodeInfo.hidden = true;
  if (stage) stage.append(nodeInfo);
  nodeInfo.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target && e.target.closest && e.target.closest(".ni-close")) nodeInfo.hidden = true;
  }, { signal: ctl.signal });

  let caseIdx = 0;
  let paused = false;
  let startTime = 0;
  let pausedElapsed = 0;
  let lastStepIndex = -1;
  let lastPanelStep = -1;
  let calloutCache = {};
  let infoNodeId = null;
  let raf = 0;
  let disposed = false;
  let ro = null;

  // ── lane rails: horizontal headers instead of vertical tags ─────────────
  for (const L of LANES) {
    const band = document.createElement("div");
    band.className = "lane-band";
    band.style.top = (L.y - 46) + "px";
    band.style.background = `linear-gradient(90deg, rgba(${LANE_RGBA[L.c]},.05), transparent 55%)`;
    stage.append(band);

    const head = document.createElement("div");
    head.className = "lane-head";
    head.style.top = (L.y - 30) + "px";
    head.style.setProperty("--c", `var(--${L.c})`);
    head.innerHTML = `<span class="no">${L.no}</span><span class="nm">${L.nm}</span><span class="ds">${L.ds}</span>`;
    stage.append(head);
    laneHeads.push(head);
  }

  // ── nodes（点击 = popover + 跳到该节点所在时间点）───────────────────────
  for (const [id, n] of Object.entries(N)) {
    const el = document.createElement("div");
    el.className = "node c-" + n.c + (n.engine ? " engine" : "");
    el.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px`;
    el.innerHTML = `<span class="k">${n.k}</span><span class="t">${n.t}</span><span class="s">${n.s}</span>`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      showNodeInfo(n);
      jumpToNode(id);
    }, { signal: ctl.signal });
    stage.append(el);
    nodeEls[id] = el;
  }
  if (stage) stage.addEventListener("click", () => { nodeInfo.hidden = true; }, { signal: ctl.signal });

  // ── wires ───────────────────────────────────────────────────────────────
  function edgePoints(e) {
    const A = N[e.a], B = N[e.b];
    if (e.pts) return e.pts(A, B);
    if (e.t === "h") {
      const [l, r] = A.cx < B.cx ? [A, B] : [B, A];
      return [[l.x + l.w, l.cy], [r.x, r.cy]];
    }
    const [t, b] = A.cy < B.cy ? [A, B] : [B, A];
    return [[t.cx, t.y + t.h], [b.cx, b.y]];
  }

  function drawWires() {
    if (!svg) return;
    svg.innerHTML = "<defs>" + ["crdt", "proj", "deliv", "map"].map((k) =>
      `<marker id="m-${k}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${"#" + ({ crdt: "6fd3ee", proj: "f0b45f", deliv: "8fe3ac", map: "c9a8ff" })[k]}"/></marker>`).join("") + "</defs>";
    for (const e of EDGES) {
      const pts = edgePoints(e);
      const d = "M " + pts.map((p) => p.join(" ")).join(" L ");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "base" + (e.dashed ? " dashed" : "") + (e.faint ? " faint" : ""));
      path.setAttribute("stroke", `var(--${e.c})`);
      path.setAttribute("marker-end", `url(#m-${e.c})`);
      svg.append(path);
      edgePaths[e.a + ">" + e.b] = { pts: pts, el: path, edge: e };
      if (e.label) {
        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        let target = total / 2, at = e.labelPos || pts[0];
        if (!e.labelPos) for (let i = 0; i < pts.length - 1; i++) {
          const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
          if (target <= len) {
            const u = len ? target / len : 0;
            at = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
            break;
          }
          target -= len;
        }
        const t = document.createElementNS(NS, "text");
        t.setAttribute("class", "wire-label");
        t.setAttribute("x", at[0]);
        t.setAttribute("y", at[1] - 6);
        t.setAttribute("text-anchor", "middle");
        t.textContent = e.label;
        svg.append(t);
      }
    }
  }

  // ── step-panel（9 段讲解；idle 面板 = 回到起点）─────────────────────────
  function renderStepPanel(step) {
    if (!panelEl) return;
    const c = CASES[caseIdx];
    const info = PANEL[step.index] || PANEL[0];
    const en = lang === "en" ? PANEL_EN[step.index] : null;
    const title = en ? en.title : info.title;
    const body = en ? en.body : info.body;
    const code = typeof info.code === "function" ? info.code(c) : info.code;
    panelEl.innerHTML =
      `<div class="sp-title">${title}</div>` +
      `<div class="sp-body">${body}</div>` +
      `<pre class="sp-code">${code.replace(/[&<>]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[s]))}</pre>` +
      `<div class="sp-foot">${info.foot}</div>`;
  }

  function renderIdlePanel() {
    if (!panelEl) return;
    panelEl.innerHTML =
      `<div class="sp-title">${T("idleTitle")}</div>` +
      `<div class="sp-body">${T("idleBody")}</div>` +
      `<pre class="sp-code">${T("idleCode")}</pre>` +
      `<div class="sp-foot">${T("idleFoot")}</div>`;
    lastPanelStep = -1;
  }

  // ── callouts（hold 阶段弹；随 case / 语言重画）───────────────────────────
  function calloutHTML() {
    const c = CASES[caseIdx];
    if (lang === "en") {
      return {
        fframe: `<b>F frame</b> · full delivery tree<br><span class="dim">FJ thread render · UP_OPEN → submit_ast_packet direct socket</span><br><span class="dim">'F' + JSON · ${c.fSize}B total · bypass AstBridge</span>`,
        pframe: `<b>P frame</b> · 6902 delta<br><span class="op">${opSummary(c)}</span><br><span class="dim">'P' + op[] · ${c.pSize}B total · Path Worker → AstBridge</span>`,
        mst: `<b>MST .applyPatch</b><br>path <span class="dim">${shortPath(c.path)}</span><br>${c.change}<br><span class="dim">store is root · rev+1</span>`,
        decl: `<b>ui.md</b> · ## mods · ## match · ### visibility<br><span class="dim">claim ${c.claim} → ${c.mod}</span>`,
        claim: `<b>claim</b> <span class="claim">${c.claim}</span> · ancestor chain hit<br><b>compFor</b> → <span class="mod">${c.mod}</span><br><span class="dim">visible: include hit · client-local IR</span>`
      };
    }
    return {
      fframe: `<b>F 帧</b> · 全量交付树<br><span class="dim">FJ 线程渲染 · UP_OPEN 时 submit_ast_packet 直发 socket</span><br><span class="dim">'F' + JSON · ${c.fSize}B total · 不经过 AstBridge</span>`,
      pframe: `<b>P 帧</b> · 6902 增量<br><span class="op">${opSummary(c)}</span><br><span class="dim">'P' + op[] · ${c.pSize}B total · Path Worker → AstBridge</span>`,
      mst: `<b>MST .applyPatch</b><br>path <span class="dim">${shortPath(c.path)}</span><br>${c.change}<br><span class="dim">store 即根节点 · rev+1</span>`,
      decl: `<b>ui.md</b> · ## mods · ## match · ### visibility<br><span class="dim">claim ${c.claim} → ${c.mod}</span>`,
      claim: `<b>claim</b> <span class="claim">${c.claim}</span> · 祖先链命中<br><b>compFor</b> → <span class="mod">${c.mod}</span><br><span class="dim">visible: include 命中 · 客户端本地 IR</span>`
    };
  }

  function paintCallouts() {
    calloutCache = calloutHTML();
    Object.keys(co).forEach((k) => { if (co[k]) co[k].innerHTML = calloutCache[k]; });
  }

  // ── node popover（补 step-panel；点击节点同时把时间线定格到该节点）──────
  function showNodeInfo(n) {
    infoNodeId = n.id;
    const en = lang === "en" ? NODE_EN[n.id] : null;
    const title = en && en.t ? en.t : n.t;
    const sub = en && en.s ? en.s : n.s;
    const W = 320;
    let left = n.x > 900 ? 644 : Math.max(20, Math.min(1260, n.x + n.w / 2 - W / 2));
    if (left + W > 980) left = 980 - W;
    const top = n.y - 104 < 90 ? n.y + n.h + 12 : n.y - 104;
    nodeInfo.style.left = left + "px";
    nodeInfo.style.top = top + "px";
    nodeInfo.innerHTML =
      `<div class="ni-head"><b>${title}</b><button class="ni-close" type="button" aria-label="${T("close")}">×</button></div>` +
      `<div class="ni-sub">${sub}</div>` +
      `<div class="ni-ref">${n.ref || "—"}</div>`;
    nodeInfo.hidden = false;
  }

  function jumpToNode(id) {
    const step = SEQ.find((s) => s.hold && s.hold.node === id) || SEQ.find((s) => s.path.includes(id));
    if (!step) return;
    let target;
    if (step.hold && step.hold.node === id) {
      const hf = step.hold.ms / step.ms;
      target = step.start + step.ms * (step.hold.atStart ? hf * .5 : 1 - hf * .5);
    } else {
      const hf = step.hold ? step.hold.ms / step.ms : 0;
      const frac = step.nodeAt[id] ?? 0;
      const local = step.hold
        ? (step.hold.atStart ? hf + frac * (1 - hf) : frac * (1 - hf))
        : frac;
      target = step.start + step.ms * Math.min(.98, Math.max(0, local));
    }
    pause();
    pausedElapsed = target;
    startTime = performance.now() - target;
    resetLights();
    lastStepIndex = -1;
    lastPanelStep = -1;
    paintCallouts();
    updatePlayBtn();
    stopLoop();
    renderAt(target);
  }

  // ── theme / language ────────────────────────────────────────────────────
  function applyTheme() {
    if (root) { try { root.dataset.theme = theme; } catch (e) { /* ignore */ } }
    if (!themeBtn) return;
    themeBtn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
    const title = theme === "dark" ? T("themeToLight") : T("themeToDark");
    themeBtn.title = title;
    themeBtn.setAttribute("aria-label", title);
  }

  function applyLanguage() {
    const en = lang === "en";
    if (root) { try { root.lang = en ? "en" : "zh-CN"; } catch (e) { /* ignore */ } }
    if (stageTitleEl) stageTitleEl.textContent = T("stageTitle");
    if (legendLabel) legendLabel.textContent = T("legend");
    if (entryLabel) entryLabel.textContent = T("entry");
    if (sceneLabel) sceneLabel.textContent = T("scene");
    if (langBtn) {
      langBtn.textContent = T("langText");
      langBtn.title = T("langTitle");
      langBtn.setAttribute("aria-label", T("langTitle"));
    }
    for (const [id, n] of Object.entries(N)) {
      const tr = en ? NODE_EN[id] : null;
      const el = nodeEls[id];
      if (!el) continue;
      const t = el.querySelector(".t");
      const s = el.querySelector(".s");
      if (t) t.textContent = tr && tr.t ? tr.t : n.t;
      if (s) s.textContent = tr && tr.s ? tr.s : n.s;
    }
    laneHeads.forEach((head, i) => {
      const ds = head.querySelector(".ds");
      if (ds) ds.textContent = en ? LANES[i].dsEn : LANES[i].ds;
    });
    if (casesEl) [...casesEl.children].forEach((b, i) => { b.textContent = en ? CASES[i].labelEn : CASES[i].label; });
    if (replayBtn) {
      replayBtn.title = T("replayTitle");
      replayBtn.setAttribute("aria-label", T("replayTitle"));
    }
    paintCallouts();
    lastPanelStep = -1;
    renderAt(currentElapsed());
    if (!nodeInfo.hidden && infoNodeId && N[infoNodeId]) showNodeInfo(N[infoNodeId]);
    updatePlayBtn();
    applyTheme();
  }

  // ── animation machinery ─────────────────────────────────────────────────
  function updatePlayBtn() {
    if (!playBtn) return;
    playBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
    const label = paused ? T("playLabel") : T("pauseLabel");
    playBtn.setAttribute("aria-label", label);
    playBtn.title = label;
    playBtn.classList.toggle("on", paused);
  }

  function buildStepGeometry() {
    SEQ.forEach((s, i) => {
      s.index = i;
      s.start = SEQ.slice(0, i).reduce((n, x) => n + x.ms, 0);
      s.hops = [];
      const parts = [];
      let prev = null;
      for (let k = 0; k < s.path.length - 1; k++) {
        const a = s.path[k], b = s.path[k + 1];
        const e = edgePaths[a + ">" + b];
        let ptsHop;
        if (e) ptsHop = e.pts;
        else {
          const er = edgePaths[b + ">" + a];
          ptsHop = er ? [...er.pts].reverse() : [[N[a].cx, N[a].cy], [N[b].cx, N[b].cy]];
        }
        if (prev) parts.push({ gap: true, pts: [prev, ptsHop[0]] });
        parts.push({ gap: false, pts: ptsHop, a: a, b: b, edge: e ? a + ">" + b : (edgePaths[b + ">" + a] ? b + ">" + a : null) });
        s.hops.push({ a: a, b: b, edge: parts[parts.length - 1].edge });
        prev = ptsHop[ptsHop.length - 1];
      }
      // flatten into segments; gap segments = crossing a node. Gaps get a short fixed
      // time weight (not their geometric length), so the pulse never lingers inside a node.
      const gapTime = 16;
      s.segs = [];
      s.total = 0;
      for (const part of parts) {
        const nSeg = Math.max(1, part.pts.length - 1);
        for (let k = 0; k < part.pts.length - 1; k++) {
          const p0 = part.pts[k], p1 = part.pts[k + 1];
          const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          const timeLen = part.gap ? gapTime / nSeg : len;
          s.segs.push({ p0: p0, p1: p1, len: len, timeLen: timeLen, acc0: s.total, acc1: s.total + timeLen, gap: !!part.gap });
          s.total += timeLen;
        }
      }
      // node reach fractions + edge light fractions (both on time axis)
      s.nodeAt = {}; s.edgeAt = {};
      s.nodeAt[s.path[0]] = 0;
      let acc = 0;
      for (const part of parts) {
        const geomLen = part.pts.reduce((n, p, idx) => idx ? n + Math.hypot(p[0] - part.pts[idx - 1][0], p[1] - part.pts[idx - 1][1]) : 0, 0);
        const timeLen = part.gap ? gapTime : geomLen;
        if (part.gap) { acc += timeLen; continue; }
        if (part.edge) s.edgeAt[part.edge] = (acc + timeLen * 0.55) / s.total;
        acc += timeLen;
        s.nodeAt[part.b] = acc / s.total;
      }
      s.path.forEach((id) => { if (s.nodeAt[id] == null) s.nodeAt[id] = 0; });
    });
  }

  function sampleAt(step, t) {
    const target = Math.max(0, Math.min(1, t)) * step.total;
    for (const seg of step.segs) {
      if (target <= seg.acc1 || seg === step.segs[step.segs.length - 1]) {
        const u = seg.timeLen ? Math.max(0, Math.min(1, (target - seg.acc0) / seg.timeLen)) : 0;
        return {
          p: [seg.p0[0] + (seg.p1[0] - seg.p0[0]) * u, seg.p0[1] + (seg.p1[1] - seg.p0[1]) * u],
          gap: seg.gap
        };
      }
    }
    return { p: step.segs.length ? step.segs[step.segs.length - 1].p1 : [0, 0], gap: true };
  }

  function resetLights() {
    Object.values(nodeEls).forEach((el) => el.classList.remove("on"));
    for (const e of Object.values(edgePaths)) {
      e.el.classList.remove("lit");
      e.el.style.strokeOpacity = "";
    }
    Object.values(co).forEach((el) => { if (el) el.classList.remove("show"); });
  }

  function lightEdge(key) {
    const e = edgePaths[key];
    if (!e) return;
    e.el.classList.add("lit");
    e.el.style.strokeOpacity = ".9";
  }

  function renderAt(elapsed) {
    let step = null, local = 0;
    if (elapsed < SEQ[SEQ.length - 1].start + SEQ[SEQ.length - 1].ms) {
      step = SEQ.find((s) => elapsed >= s.start && elapsed < s.start + s.ms) || SEQ[SEQ.length - 1];
      local = (elapsed - step.start) / step.ms;
    }

    if (!step) {
      if (pulse) pulse.style.opacity = 0;
      if (stepBar) stepBar.style.width = "0%";
      if (stepCounter) stepCounter.textContent = T("idleCounter");
      renderIdlePanel();
      Object.values(co).forEach((el) => { if (el) el.classList.remove("show"); });
      lastStepIndex = -1;
      return;
    }

    if (step.index !== lastStepIndex) {
      Object.values(nodeEls).forEach((el) => el.classList.remove("on"));
      lastStepIndex = step.index;
    }
    if (step.index !== lastPanelStep) {
      renderStepPanel(step);
      lastPanelStep = step.index;
    }

    let travelLocal = local;
    let holdActive = false;
    if (step.hold) {
      const hf = Math.min(.95, step.hold.ms / step.ms);
      if (step.hold.atStart) {
        holdActive = local < hf;
        travelLocal = holdActive ? 0 : (local - hf) / (1 - hf);
      } else {
        holdActive = local >= 1 - hf;
        travelLocal = holdActive ? 1 : local / (1 - hf);
      }
    }

    const sample = sampleAt(step, travelLocal);
    if (pulse) {
      pulse.className = "pulse " + step.tone + (step.ghost ? " ghost" : "");
      pulse.style.left = sample.p[0] + "px";
      pulse.style.top = sample.p[1] + "px";
      pulse.style.opacity = sample.gap ? 0 : (step.ghost ? .72 : 1);
    }

    // light nodes of the current step, and keep traversed edges lit
    step.path.forEach((id) => {
      const at = step.nodeAt[id] ?? 0;
      if (local >= at - 0.02 && nodeEls[id]) nodeEls[id].classList.add("on");
    });
    for (const [key, at] of Object.entries(step.edgeAt)) {
      if (local >= at - 0.02) lightEdge(key);
    }

    Object.values(co).forEach((el) => { if (el) el.classList.remove("show"); });
    if (step.hold && holdActive && co[step.hold.pop]) co[step.hold.pop].classList.add("show");

    if (stepCounter) stepCounter.textContent = "▲ STEP " + String(step.index + 1).padStart(2, "0") + " / " + SEQ.length;
    if (stepBar) stepBar.style.width = Math.round(Math.min(1, local) * 100) + "%";
  }

  function currentElapsed() {
    if (paused) return pausedElapsed;
    if (!startTime) return 0;
    return (performance.now() - startTime) % cycleMs;
  }

  function draw(now) { renderAt((now - startTime) % cycleMs); }

  // ── rAF ledger：paused/disposed 时不排帧，resume 再重启 ──────────────────
  function stopLoop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function startLoop() {
    if (disposed || paused || raf) return;
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    raf = 0;
    if (disposed || paused) return;
    if (!startTime) startTime = now;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function resetCycle() {
    startTime = performance.now();
    pausedElapsed = 0;
    resetLights();
    lastStepIndex = -1;
    lastPanelStep = -1;
    paintCallouts();
    drawWires();
  }

  // ── controls ────────────────────────────────────────────────────────────
  function pause() {
    if (paused || disposed) return;
    pausedElapsed = (performance.now() - startTime) % cycleMs;
    paused = true;
    updatePlayBtn();
    stopLoop();
  }

  function resume() {
    if (!paused || disposed) return;
    startTime = performance.now() - pausedElapsed;
    paused = false;
    updatePlayBtn();
    startLoop();
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function replay() {
    paused = false;
    updatePlayBtn();
    resetCycle();
    startLoop();
  }

  function setCase(next) {
    if (!(next >= 0 && next < CASES.length)) return;
    caseIdx = next;
    if (casesEl) [...casesEl.children].forEach((x, j) => x.classList.toggle("on", j === next));
    paused = false;
    updatePlayBtn();
    resetCycle();
    startLoop();
  }

  // 冻结到某一拍（原页 window.__demo.park 的 engine 版）
  function park(stepIndex, progress = 0.55) {
    const idx = Math.max(0, Math.min(SEQ.length - 1, stepIndex | 0));
    const step = SEQ[idx];
    pause();
    pausedElapsed = step.start + step.ms * progress;
    startTime = performance.now() - pausedElapsed;
    resetLights();
    lastStepIndex = -1;
    lastPanelStep = -1;
    paintCallouts();
    updatePlayBtn();
    stopLoop();
    renderAt(pausedElapsed);
  }

  function setLang(next) {
    if (next !== "en" && next !== "zh") return;
    lang = next;
    applyLanguage();
  }

  function setTheme(next) {
    if (next !== "light" && next !== "dark") return;
    theme = next;
    applyTheme();
  }

  function state() {
    const elapsed = currentElapsed();
    let stepIndex = -1;
    for (let i = 0; i < SEQ.length; i += 1) {
      if (elapsed >= SEQ[i].start && elapsed < SEQ[i].start + SEQ[i].ms) { stepIndex = i; break; }
    }
    return {
      paused: paused,
      caseIndex: caseIdx,
      caseId: CASES[caseIdx] ? CASES[caseIdx].id : null,
      stepIndex: stepIndex,
      elapsed: elapsed,
      stepCount: SEQ.length,
      lang: lang,
      theme: theme
    };
  }

  // ── scenario chips ──────────────────────────────────────────────────────
  CASES.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.label;
    b.className = "case-btn" + (i === 0 ? " on" : "");
    b.addEventListener("click", () => setCase(i), { signal: ctl.signal });
    if (casesEl) casesEl.append(b);
  });

  // ── listeners（AbortController 统一回收）────────────────────────────────
  if (playBtn) playBtn.addEventListener("click", togglePause, { signal: ctl.signal });
  if (replayBtn) replayBtn.addEventListener("click", replay, { signal: ctl.signal });
  if (langBtn) langBtn.addEventListener("click", () => { lang = lang === "zh" ? "en" : "zh"; applyLanguage(); }, { signal: ctl.signal });
  if (themeBtn) themeBtn.addEventListener("click", () => { theme = theme === "light" ? "dark" : "light"; applyTheme(); }, { signal: ctl.signal });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); togglePause(); }
  }, { signal: ctl.signal });
  window.addEventListener("resize", fit, { signal: ctl.signal });

  // ── fit stage ───────────────────────────────────────────────────────────
  function fit() {
    if (!holder || !stage) return;
    const padW = 28, padH = 8;
    const availW = holder.clientWidth - padW, availH = holder.clientHeight - padH;
    const s = Math.min(availW / 1600, availH / 1000);
    stage.style.transform = `scale(${s})`;
    holder.style.setProperty("--stage-scale", s);
    const holderW = 1600 * s, holderH = 1000 * s;
    stage.style.left = ((holder.clientWidth - holderW) / 2) + "px";
    stage.style.top = ((holder.clientHeight - holderH) / 2) + "px";
  }

  // 容器尺寸变化（页签切显/侧栏开合）时重算 scale；window resize 之外补一手。
  if (typeof ResizeObserver !== "undefined" && holder) {
    ro = new ResizeObserver(() => fit());
    ro.observe(holder);
  }

  // ── boot ────────────────────────────────────────────────────────────────
  drawWires();
  buildStepGeometry();
  resetCycle();
  updatePlayBtn();
  applyTheme();
  if (lang === "en") applyLanguage();
  fit();
  if (auto) {
    startLoop();
  } else {
    paused = true;
    updatePlayBtn();
    renderAt(0);
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      try { ctl.abort(); } catch (e) { /* ignore */ }
      if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
      stopLoop();
    },
    pause: pause,
    resume: resume,
    toggle: togglePause,
    replay: replay,
    park: park,
    setCase: setCase,
    jumpToNode: jumpToNode,
    showNodeInfo: (id) => { if (N[id]) showNodeInfo(N[id]); },
    setLang: setLang,
    setTheme: setTheme,
    state: state,
    stepCount: SEQ.length,
    caseIds: CASES.map((c) => c.id),
    get caseIndex() { return caseIdx; },
    get paused() { return paused; },
    get lang() { return lang; },
    get theme() { return theme; }
  };
}
```
