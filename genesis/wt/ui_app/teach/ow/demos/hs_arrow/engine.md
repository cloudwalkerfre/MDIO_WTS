# OW_ARROW_ENGINE

## 实现

```jsx@node
/** hs-arrow 引擎：把原页的填充/节拍播放/查询交互收敛成 createArrowEngine。
 *  options.lang = "zh"|"en"（原 ?lang）；options.theme = "dark"|"light"（原 ?theme）。
 *  主题/语言由教学页壳驱动：setTheme 换 QUERIES/BEATS 颜色并重绘当前拍；setLang 用当前语言重建 bar 文案。
 *  导出：dispose/pause/resume/park/jumpQuery/setLang/setTheme + 只读 beat/paused/theme/lang/beats/state。 */
import { SQL1, SQL2, SQL3, SQL4, NEST_MD, NEST_ROWS, NEST_RESULTS, BM25_DOCS, STATS, RESULT1, PIVOT, RESULT2, BEATS, QUERIES, STEP_LABELS, QUERY_LABELS, Q_COLOR_MAP, stepsOf } from "@app/OW_ARROW_DATA";

export function createArrowEngine({ root, shadow, data, options }) {
  const opts = options || {};
  const $ = (id) => (shadow && shadow.getElementById ? shadow.getElementById(id) : null);
  let LANG = opts.lang === "en" ? "en" : "zh";
  let THEME = opts.theme === "light" ? "light" : "dark";
  let ACCENT = "#34d399";
  let QUERIES_L = [];
  let BEATS_L = [];

  // 主题色视图：深色原样、浅色按 Q_COLOR_MAP 压暗（不改数据模块本身）。
  function applyThemeColors(theme) {
    const light = theme === "light";
    ACCENT = light ? "#047857" : "#34d399";
    QUERIES_L = QUERIES.map((q) => Object.assign({}, q, { color: light ? (Q_COLOR_MAP[q.color] || q.color) : q.color }));
    BEATS_L = BEATS.map((def) => {
      const copy = { ms: def.ms };
      if (def.state) copy.state = Object.assign({}, def.state, { hlc: light ? (Q_COLOR_MAP[def.state.hlc] || def.state.hlc) : def.state.hlc });
      if (def.steps) copy.steps = def.steps.map((st) => Object.assign({}, st, { hlc: light ? (Q_COLOR_MAP[st.hlc] || st.hlc) : st.hlc }));
      return copy;
    });
  }
  applyThemeColors(THEME);

  const sqlBody = $("sqlBody");
  const dots = $("dots");
  const stepControls = $("stepControls");
  const stepToggle = stepControls ? stepControls.querySelector('[data-step="toggle"]') : null;
  const stageEl = shadow.querySelector(".stage");
  const modelEl = $("mModel");
  const layers = {
    model: $("layerModel"),
    stats: $("layerStats"),
    result: $("layerResult"),
    pivot: $("layerPivot"),
    result2: $("layerResult2"),
    nestMd: $("layerNestMd"),
    nest: $("layerNest"),
    nestResult: $("layerNestResult"),
    bm25: $("layerBm25"),
  };

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function colorize(line) {
    if (line.trim().startsWith("--")) return '<span class="cm">' + esc(line) + "</span>";
    return esc(line)
      .replace(/'([^']*)'/g, "<span class=\"str\">'$1'</span>")
      .replace(/\b(with|as|select|from|where|join|on|and|or|group|by|order|limit|partition|over|desc|<>|case|when|then|end|max)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(row_number|count)\b/g, '<span class="fn">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
  }

  let queryTimers = [];
  let ghostTimers = [];
  let subTimers = [];
  let beat = 0;
  let timer = 0;
  let paused = false;
  let currentStep = 0;
  // bar 当前模式与高亮项：setLang 重建时按它恢复（"model" = 结构+四条查询，"steps" = 当前拍步骤）。
  let barMode = "model";
  let barIdx = 0;

  function syncStepControls() {
    if (!stepControls) return;
    stepControls.classList.toggle("paused", paused);
    if (stepToggle) stepToggle.setAttribute("aria-label", LANG === "en" ? (paused ? "play" : "pause") : (paused ? "播放" : "暂停"));
  }

  function pausePlayback() {
    paused = true;
    if (dots) dots.classList.add("paused");
    clearTimeout(timer);
    subTimers.forEach(clearTimeout);
    subTimers = [];
    queryTimers.forEach(clearTimeout);
    queryTimers = [];
    if (stageEl) stageEl.classList.add("anim-paused");
    syncStepControls();
  }

  function resumePlayback() {
    paused = false;
    if (dots) dots.classList.remove("paused");
    if (stageEl) stageEl.classList.remove("anim-paused");
    syncStepControls();
    // 重跑当前拍，把它还没触发的延迟步骤重新排上（原页同）。
    apply(beat);
  }

  function paintSql(which, hl, color) {
    const panel = shadow.querySelector(".sqlPanel");
    if (panel) panel.classList.toggle("compact", which === 3);
    if (!sqlBody) return;
    if (which === 0) {
      sqlBody.innerHTML = '<div class="ln cmdline"><b>arrow -duckdb</b> "…"</div>';
      sqlBody.style.opacity = "1";
      return;
    }
    const src = which === 1 ? SQL1 : which === 2 ? SQL2 : which === 3 ? SQL3 : SQL4;
    const sqlLines = src.split("\n");
    const rows = [{ text: '"', cmd: "head" }, ...sqlLines.map((line, i) => ({ text: "  " + line, n: i + 1 })), { text: '"', cmd: "tail" }];
    let k = 0;
    sqlBody.innerHTML = rows.map(({ text, cmd, n }) => {
      if (cmd === "head") return '<div class="ln cmdline"><b>arrow -duckdb</b> "</div>';
      if (cmd === "tail") return '<div class="ln cmdline">"</div>';
      const marked = hl && hl.includes(n);
      const vars = marked ? ' style="--hl:' + (color || "#34d399") + ";--k:" + k++ + '"' : "";
      const cls = hl && hl.length ? (marked ? "ln hl" : "ln dim") : "ln";
      return '<div class="' + cls + '"' + vars + ">" + (colorize(text) || " ") + "</div>";
    }).join("");
    sqlBody.style.opacity = "1";
  }

  function fillStatic() {
    const statRows = $("statRows");
    STATS.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "r";
      d.innerHTML = "<span>" + s.path + ".md</span><span>" + s.heading + '</span><span class="n">' + s.n + "</span><span>" + s.rn + "</span>";
      d.style.setProperty("--i", i);
      statRows.append(d);
    });
    const rr = $("resultRows");
    RESULT1.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "res-item";
      d.innerHTML = '<span class="doc">' + r.doc + '</span><span class="hd">' + r.hd + '</span><span class="body">' + r.body + '</span><span class="tag">' + r.n + (LANG === "en" ? " blocks" : " 块") + "</span>";
      d.style.setProperty("--i", i);
      rr.append(d);
    });
    const pr = $("pivotRows");
    PIVOT.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "r" + (p.mark === "-" && p.tag === "todo" ? " hit" : "");
      d.innerHTML = '<span title="' + p.path + '">' + p.path + "</span><span>" + p.node + '</span><span class="mark">' + p.mark + '</span><span class="tag">' + p.tag + '</span><span class="content">' + p.content + "</span>";
      d.style.setProperty("--i", i);
      pr.append(d);
    });
    const r2 = $("resultRows2");
    RESULT2.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "res-item";
      d.innerHTML = '<span class="doc" title="' + r.doc + '">' + r.doc + '</span><span class="hd">' + r.hd + '</span><span class="body">' + r.body + '</span><span class="tag">node ' + r.node + "</span>";
      d.style.setProperty("--i", i);
      r2.append(d);
    });
    const nestMd = $("nestMd");
    if (nestMd) nestMd.textContent = NEST_MD;
    const nr = $("nestRows");
    NEST_ROWS.forEach((row, i) => {
      const d = document.createElement("div");
      d.className = "nrow" + (row.depth === 0 ? " root" : "") + (row.type === "code" ? " hit" : "");
      d.style.setProperty("--d", row.depth);
      d.style.setProperty("--i", i);
      const badge = row.type === "head" ? '<span class="nbadge">h' + row.level + "</span>" : "";
      const tag = row.tag ? '<span class="ntag">' + row.tag + "</span>" : "";
      d.innerHTML = '<span class="nnum">' + row.n + '</span><span class="nchip ' + row.type + '">' + row.type + "</span>" + badge + tag;
      nr.append(d);
    });
    const bm = $("bm25Rows");
    BM25_DOCS.forEach((doc) => {
      const card = document.createElement("div");
      card.className = "bdoc";
      card.innerHTML = '<div class="bh">' + doc.name + "</div>";
      doc.sections.forEach((sec) => {
        const sr = document.createElement("div");
        sr.className = "bsec" + (sec.selS ? " sel-s" : "") + (sec.selH ? " sel-h" : "");
        sr.innerHTML = '<span class="st">## ' + sec.title + "</span>" + (sec.scoreH ? '<span class="sc sc-h">' + sec.scoreH + "</span>" : "");
        card.append(sr);
        sec.bullets.forEach((b) => {
          const br = document.createElement("div");
          br.className = "brow" + (b.q ? " sel-q" : "") + (b.selH ? " sel-h" : "");
          br.innerHTML = '<span class="k">' + b.key + ':</span><span class="txt">' + b.text + "</span>" + (b.q ? '<span class="rk">#' + b.rank + '</span><span class="sc sc-q">' + b.score + "</span>" : "");
          card.append(br);
        });
      });
      bm.append(card);
    });
    const nres = $("nestResult");
    NEST_RESULTS.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "codecard";
      d.style.setProperty("--i", i);
      d.innerHTML = '<div class="hd"><span>node ' + r.node + " · code</span><span>" + r.lang + "</span></div><pre>" + r.code + "</pre>";
      nres.append(d);
    });
  }

  function buildDots() {
    if (!dots) return;
    dots.textContent = "";
    for (let i = 0; i < BEATS_L.length; i++) {
      const n = String(i + 1).padStart(2, "0");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = n + (LANG === "en" ? " | jump to this beat" : "｜切换到这一拍");
      btn.setAttribute("aria-label", LANG === "en" ? "beat " + (i + 1) : "第 " + (i + 1) + " 拍");
      btn.append(document.createElement("i"));
      btn.addEventListener("click", () => switchBeat(i));
      dots.append(btn);
    }
  }

  function modelGeometry() {
    if (!modelEl) return null;
    const mr = modelEl.getBoundingClientRect();
    if (!mr.width) return null;
    return {
      model: modelEl,
      svg: $("mLinks"),
      box(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left - mr.left, y: r.top - mr.top, w: r.width, h: r.height, cx: r.left - mr.left + r.width / 2, cy: r.top - mr.top + r.height / 2, right: r.right - mr.left, bottom: r.bottom - mr.top };
      },
    };
  }

  function layoutModelLinks() {
    const g = modelGeometry();
    if (!g) return;
    const rowEl = g.model.querySelector('.mtab.faces .mrow[data-r="4"]');
    const pjRows = [...g.model.querySelectorAll(".mtab.long .mrow[data-r]")];
    const pjTable = g.model.querySelector(".mtab.long");
    if (!rowEl || !pjRows.length || !pjTable) return;
    const row4 = g.box(rowEl);
    const table = g.box(pjTable);
    let d = "";
    pjRows.forEach((el, i) => {
      const p = g.box(el);
      const x1 = row4.right + 2;
      const y1 = row4.cy;
      const x2 = table.x - 4;
      const y2 = p.cy;
      const mid = (x1 + x2) / 2;
      d += '<path class="fan" style="animation-delay:' + (4.55 + i * 0.08).toFixed(2) + 's" d="M ' + x1 + " " + y1 + " C " + mid + " " + y1 + " " + mid + " " + y2 + " " + x2 + " " + y2 + '"/>';
    });
    if (g.svg) g.svg.innerHTML = d;
  }

  function clearGhosts() {
    ghostTimers.forEach(clearTimeout);
    ghostTimers = [];
    if (!modelEl) return;
    modelEl.querySelectorAll(".mdghost").forEach((el) => el.remove());
    modelEl.querySelectorAll(".mdline").forEach((el) => el.classList.remove("gone"));
  }

  function flyLines(progress, count) {
    if (!modelEl) return;
    const lines = [...modelEl.querySelectorAll(".mdline")].slice(0, count || 999);
    const mr = modelEl.getBoundingClientRect();
    if (!mr.width) return;
    lines.forEach((line, i) => {
      const target = modelEl.querySelector('.t-node[data-n="' + line.dataset.node + '"]');
      if (!target) return;
      ghostTimers.push(setTimeout(() => {
        const base = modelEl.getBoundingClientRect();
        const lr = line.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        if (!lr.width || !tr.width) return;
        const cx0 = lr.left - base.left + lr.width / 2;
        const cy0 = lr.top - base.top + lr.height / 2;
        const cx1 = tr.left - base.left + tr.width / 2;
        const cy1 = tr.top - base.top + tr.height / 2;
        const ghost = document.createElement("div");
        ghost.className = "mdghost";
        ghost.textContent = line.textContent;
        ghost.style.left = cx0 + "px";
        ghost.style.top = cy0 + "px";
        modelEl.appendChild(ghost);
        line.classList.add("gone");
        const REAL_KIND = { 0: "root", 1: "sec", 5: "sec", 2: "blk", 3: "blk", 4: "blk", 6: "blk" };
        const kind = REAL_KIND[Number(line.dataset.node)] || "blk";
        const dx = cx1 - cx0;
        const dy = cy1 - cy0;
        const startW = lr.width;
        ghost.style.width = startW + "px";
        const end = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
        const anim = ghost.animate([
          { transform: "translate(-50%,-50%)", width: startW + "px", opacity: 1 },
          { transform: end, width: tr.width + "px", opacity: 1 },
        ], { duration: 500, easing: "cubic-bezier(.4,.05,.2,1)", fill: "forwards" });
        anim.onfinish = () => {
          const base2 = modelEl.getBoundingClientRect();
          const t2 = target.getBoundingClientRect();
          anim.cancel();
          ghost.style.left = t2.left - base2.left + t2.width / 2 + "px";
          ghost.style.top = t2.top - base2.top + t2.height / 2 + "px";
          ghost.style.transform = "translate(-50%,-50%)";
          ghost.style.width = t2.width + "px";
          ghost.style.overflow = "visible";
          ghost.style.textOverflow = "clip";
          ghost.classList.add("landed", kind);
          requestAnimationFrame(() => ghost.classList.add("flash"));
          setTimeout(() => ghost.classList.remove("flash"), 420);
        };
        if (typeof progress === "number") { anim.pause(); anim.currentTime = 500 * progress; }
      }, progress != null ? 0 : 1250 + i * 200));
    });
  }

  function clearQueries() {
    queryTimers.forEach(clearTimeout);
    queryTimers = [];
    if (!modelEl) return;
    modelEl.querySelectorAll(".mrow.qhit").forEach((el) => el.classList.remove("qhit"));
    const svg = $("mLinks");
    if (svg) svg.querySelectorAll("path.sql").forEach((p) => p.remove());
  }

  function markQueryTarget(targetEl, color) {
    if (!targetEl) return;
    targetEl.style.setProperty("--q", color);
    targetEl.classList.remove("qtarget");
    void targetEl.offsetWidth;
    targetEl.classList.add("qtarget");
    clearTimeout(targetEl._qt);
    targetEl._qt = setTimeout(() => targetEl.classList.remove("qtarget"), 1300);
  }

  function positionExecTail() {
    if (!modelEl) return;
    const bar = modelEl.querySelector(".execbar");
    if (!bar) return;
    const cmd = bar.querySelector(".mcmd");
    const flow = bar.querySelector(".mflow");
    const pill = bar.querySelector(".moutmodes");
    if (!cmd || !flow || !pill) return;
    const base = bar.getBoundingClientRect();
    const cr = cmd.getBoundingClientRect();
    const flowLeft = cr.right - base.left + 14;
    flow.style.left = flowLeft + "px";
    pill.style.left = flowLeft + 56 + 14 + "px";
  }

  function applyQuery(q) {
    if (!modelEl) return;
    modelEl.classList.add("queries");
    const cmd = modelEl.querySelector(".mcmd");
    if (!cmd) return;
    cmd.innerHTML = q.html;
    [...cmd.querySelectorAll(".id")].forEach((el) => el.classList.add("tok"));
    positionExecTail();
    if (beat === 0) setModelBar(QUERIES_L.indexOf(q) + 1);
    modelEl.querySelectorAll(".mrow.qhit").forEach((el) => el.classList.remove("qhit"));
    const paint = (tableSel, n) => {
      const el = modelEl.querySelector(tableSel + ' .mrow[data-r="' + n + '"]');
      if (!el) return;
      el.style.setProperty("--q", q.color);
      el.classList.add("qhit");
    };
    q.rows.forEach((n) => paint(".mtab.faces", n));
    q.pjRows.forEach((n) => paint(".mtab.long", n));
    const target = q.target === "pj" ? modelEl.querySelector(".mtab.long") : modelEl.querySelector(".mtab.faces");
    markQueryTarget(target, q.color);
  }

  function setStageBar(idx) {
    const bar = $("stageBar");
    if (!bar) return;
    barMode = "steps";
    barIdx = idx;
    bar.innerHTML = "";
    const labels = (STEP_LABELS[LANG] || STEP_LABELS.zh)[beat];
    if (!labels) return;
    labels.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (i === idx) btn.classList.add("on");
      const color = (stepsOf(BEATS_L[beat])[i] || {}).hlc || "#fff";
      btn.style.setProperty("--q", color);
      btn.addEventListener("click", () => {
        const wasPaused = paused;
        jumpStep(i);
        if (wasPaused) pausePlayback();
      });
      bar.append(btn);
    });
  }

  function setModelBar(activeIdx) {
    const bar = $("stageBar");
    if (!bar) return;
    barMode = "model";
    barIdx = activeIdx;
    bar.innerHTML = "";
    const labels = [LANG === "en" ? "structure" : "结构", ...QUERY_LABELS[LANG]];
    const colors = [ACCENT, ...QUERIES_L.map((q) => q.color)];
    labels.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (i === activeIdx) btn.classList.add("on");
      btn.style.setProperty("--q", colors[i]);
      btn.addEventListener("click", () => {
        const wasPaused = paused;
        if (i === 0) restartModel();
        else jumpQuery(i - 1);
        if (wasPaused) pausePlayback();
      });
      bar.append(btn);
    });
  }

  function replayRise() {
    ["resultRows", "resultRows2"].forEach((id) => {
      const host = $(id);
      if (!host) return;
      [...host.children].forEach((el, i) => {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
        el.style.setProperty("--i", i);
      });
    });
  }

  function render(s, idx) {
    const bm = shadow.querySelector(".bm25");
    if (bm) bm.dataset.mode = s.mode || "q";
    if (stageEl) stageEl.classList.toggle("modelmode", s.layer === "model");
    for (const [name, el] of Object.entries(layers)) if (el) el.classList.toggle("on", name === s.layer);
    paintSql(s.sql, s.hl, s.hlc);
    const statRows = [...shadow.querySelectorAll("#statRows .r")];
    statRows.forEach((el, i) => {
      const r = STATS[i];
      el.classList.toggle("win", !!(s.win && r.rn === 1));
      el.classList.toggle("dim", !!(s.win && r.rn !== 1));
    });
    if (typeof idx === "number") {
      const bar = $("stageBar");
      if (bar) [...bar.children].forEach((el, i) => el.classList.toggle("on", i === idx));
      replayRise();
    }
  }

  function scheduleAdvance(ms) {
    clearTimeout(timer);
    if (paused) return;
    timer = setTimeout(() => { park((beat + 1) % BEATS_L.length); }, Math.max(300, ms));
  }

  function startBeat(fromIdx) {
    const def = BEATS_L[beat];
    subTimers.forEach(clearTimeout);
    subTimers = [];
    const steps = stepsOf(def);
    const idx0 = Math.max(0, Math.min(fromIdx || 0, steps.length - 1));
    currentStep = idx0;
    const base = steps[idx0].at || 0;
    render(steps[idx0], idx0);
    setStageBar(idx0);
    steps.slice(idx0 + 1).forEach((st, i) => {
      const idx = idx0 + 1 + i;
      subTimers.push(setTimeout(() => {
        currentStep = idx;
        render(st, idx);
        setStageBar(idx);
      }, (st.at || 0) - base));
    });
    scheduleAdvance(def.ms - base);
  }

  function jumpStep(idx) {
    paused = false;
    if (dots) dots.classList.remove("paused");
    if (stageEl) stageEl.classList.remove("anim-paused");
    syncStepControls();
    startBeat(idx);
  }

  function apply(b) {
    const def = BEATS_L[b];
    subTimers.forEach(clearTimeout);
    subTimers = [];
    clearQueries();
    clearGhosts();
    if (modelEl) {
      modelEl.classList.remove("play");
      modelEl.classList.remove("queries");
    }
    const first = stepsOf(def)[0];
    if (first.layer === "model") {
      currentStep = 0;
      render(first);
      setModelBar(0);
      if (modelEl) modelEl.classList.remove("skip");
      layoutModelLinks();
      const cmd = modelEl && modelEl.querySelector(".mcmd");
      if (cmd) cmd.innerHTML = "";
      positionExecTail();
      if (modelEl) {
        void modelEl.offsetWidth;
        modelEl.classList.add("play");
      }
      flyLines();
      QUERIES_L.forEach((q) => queryTimers.push(setTimeout(() => applyQuery(q), q.at)));
      scheduleAdvance(def.ms);
    } else {
      startBeat(0);
    }
    if (dots) [...dots.children].forEach((el, i) => el.classList.toggle("on", i === b));
  }

  function baseOfStep(idx) {
    const steps = stepsOf(BEATS_L[beat]);
    const st = steps[Math.min(idx, steps.length - 1)];
    return st.at || 0;
  }

  // 旧拍点切换：新原页把 click 改到 switchBeat，这段按上游保留（当前无调用点）。
  function onDot(i) {
    clearTimeout(timer);
    if (paused && i === beat) {
      paused = false;
      if (dots) dots.classList.remove("paused");
      if (stageEl) stageEl.classList.remove("anim-paused");
      scheduleAdvance(BEATS_L[beat].ms - baseOfStep(currentStep));
      syncStepControls();
      return;
    }
    paused = true;
    if (dots) dots.classList.add("paused");
    if (stageEl) stageEl.classList.add("anim-paused");
    park(i);
    syncStepControls();
  }

  function park(b) {
    beat = ((b % BEATS_L.length) + BEATS_L.length) % BEATS_L.length;
    clearTimeout(timer);
    apply(beat);
  }

  // 拍点：切到第 i 拍；原本暂停时保持暂停（跳动后立刻冻住，原页 switchBeat 同）。
  function switchBeat(i) {
    const wasPaused = paused;
    paused = false;
    if (dots) dots.classList.remove("paused");
    if (stageEl) stageEl.classList.remove("anim-paused");
    syncStepControls();
    park(i);
    if (wasPaused) pausePlayback();
  }

  function jumpQuery(idx) {
    clearQueries();
    const q = QUERIES_L[idx];
    if (!modelEl) return;
    if (!modelEl.classList.contains("skip")) {
      clearGhosts();
      modelEl.classList.add("skip");
    }
    applyQuery(q);
    QUERIES_L.slice(idx + 1).forEach((nq) => queryTimers.push(setTimeout(() => applyQuery(nq), nq.at - q.at)));
    paused = false;
    if (dots) dots.classList.remove("paused");
    if (stageEl) stageEl.classList.remove("anim-paused");
    syncStepControls();
    scheduleAdvance(BEATS_L[beat].ms - q.at);
  }

  function restartModel() {
    paused = false;
    if (dots) dots.classList.remove("paused");
    if (stageEl) stageEl.classList.remove("anim-paused");
    syncStepControls();
    if (modelEl) modelEl.classList.remove("skip");
    park(0);
  }

  const onResize = () => {
    if (layers.model && layers.model.classList.contains("on")) layoutModelLinks();
    positionExecTail();
  };

  fillStatic();
  buildDots();
  window.addEventListener("resize", onResize);
  park(0);
  if (stepToggle) {
    stepToggle.addEventListener("click", () => {
      if (paused) resumePlayback();
      else pausePlayback();
    });
  }
  syncStepControls();

  return {
    dispose() {
      clearTimeout(timer);
      subTimers.forEach(clearTimeout);
      queryTimers.forEach(clearTimeout);
      ghostTimers.forEach(clearTimeout);
      window.removeEventListener("resize", onResize);
      clearGhosts();
      clearQueries();
    },
    pause() { pausePlayback(); },
    resume() { resumePlayback(); },
    park(b) { park(b); },
    jumpQuery(idx) { jumpQuery(idx); },
    // 语言：用当前语言重建 bar 文案（模型 bar = 结构+四条查询，步进 bar = 当前拍步骤）。
    setLang(lang) {
      const next = lang === "en" ? "en" : "zh";
      if (next === LANG) return LANG;
      LANG = next;
      if (barMode === "model") setModelBar(barIdx);
      else setStageBar(barIdx);
      // 静态区里带语言的可见文案（结果行 "N 块" / 节拍点 tooltip+aria / 播放按钮 aria）
      const markRows = $("resultRows");
      if (markRows) {
        const tags = markRows.querySelectorAll(".res-item .tag");
        for (let i = 0; i < tags.length; i++) {
          const raw = (tags[i].textContent || "").replace(/\s*(块|blocks)$/, "").trim();
          tags[i].textContent = raw + (LANG === "en" ? " blocks" : " 块");
        }
      }
      buildDots();
      syncStepControls();
      return LANG;
    },
    // 主题：QUERIES/BEATS 颜色按 Q_COLOR_MAP 换一份，再重绘当前拍（暂停中保持冻结）。
    setTheme(theme) {
      const next = theme === "light" ? "light" : "dark";
      if (next === THEME) return THEME;
      const wasPaused = paused;
      THEME = next;
      applyThemeColors(next);
      park(beat);
      if (wasPaused) pausePlayback();
      return THEME;
    },
    get beat() { return beat; },
    get paused() { return paused; },
    get theme() { return THEME; },
    get lang() { return LANG; },
    get beats() { return BEATS_L; },
    state() { return { beat: beat, paused: paused, theme: THEME, lang: LANG }; },
  };
}
```
