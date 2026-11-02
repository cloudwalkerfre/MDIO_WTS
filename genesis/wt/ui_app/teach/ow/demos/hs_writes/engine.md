# OW_WR_ENGINE

## 实现

```jsx@node
/** hs-writes 引擎：装配 + timeline + stage.draw + reel 合成
 *  createWritesEngine({ root, shadow, data, options }) → { dispose, pause, resume, setLang, setTheme, park, parkPos }。
 *  原页的 window.__hs 调试把手保留成实例方法（验证冻结帧用）。 */
import { STEPS, CONFIG, LIGHT, HOOK_CB, INITIAL, buildDocs, labelOf, applyEdit } from "@app/OW_WR_DATA";
import { FONTS } from "@app/OW_SHARED_THEME";
import { clamp01, lerp, easeInOutCubic, mixHex } from "@app/OW_SHARED_KIT";
import { DocEditor, MAX_LINES, LONGEST } from "@app/OW_WR_DOC";
import { DocFrame } from "@app/OW_WR_FRAME";
import { CmdLine, createGhostCtl } from "@app/OW_WR_CMD";

const MONO = FONTS.mono;
const font = (size) => size + "px " + MONO;
const mixColor = (a, b, t) => mixHex(a, b, t);

/** 深色（默认）palette 快照：setTheme 切回 dark 时用它恢复；
 *  取模块加载时的 CONFIG（此时还没有实例改过 palette）。 */
const DARK_PALETTE = {
  face: { ...CONFIG.palette.face },
  cmd: { ...CONFIG.palette.cmd },
  reel: { ...CONFIG.palette.reel },
  wash: CONFIG.palette.wash,
  frame: { ...CONFIG.palette.frame },
  editor: { ...CONFIG.editor },
};

export function createWritesEngine({ root, shadow, data, options }) {
  const opts = options || {};
  const $ = (id) => (shadow && shadow.getElementById ? shadow.getElementById(id) : null);
  const mainEl = shadow.querySelector(".main");
  const headerEl = shadow.querySelector(".top");
  const brandEl = shadow.querySelector(".brand");
  const board = $("board");
  const docBox = $("docBox");
  const cmdBox = $("cmdBox");
  const reelEl = $("reel");
  const ghostEl = $("ghostCmd");
  const editor = new DocEditor($("docCanvas"));
  const frame = new DocFrame($("docFrame"));
  const cmd = new CmdLine($("cmdCanvas"));
  if (opts.lang === "en" || opts.lang === "zh") CONFIG.sequence.lang = opts.lang;
  if (opts.slow) CONFIG.sequence.slow = Math.max(0.25, Math.min(8, Number(opts.slow) || 1));

  const DOCS = buildDocs();
  const stepDoc = (index) => DOCS[index + (STEPS[index].kind === "write" ? 1 : 0)];
  const closesLoop = DOCS[DOCS.length - 1].length === INITIAL.length
    && DOCS[DOCS.length - 1].every((text, index) => text === INITIAL[index]);
  const CMD_H = cmdBox ? cmdBox.offsetHeight : 40;
  const REEL_H = reelEl ? reelEl.offsetHeight : 32;
  const GHOST_IDX = STEPS.findIndex((step) => step.kind === "hook");
  const HOOK_FIRE_IDX = STEPS.findIndex((step) => step.hookFire);
  const ghost = createGhostCtl({ el: ghostEl, steps: STEPS });
  const setGhost = ghost.setGhost;
  const flyGhostCb = ghost.flyGhostCb;

  let running = true;
  let raf = 0;
  let paused = false;

  const timeline = {
    pos: 0,
    move: null,
    drag: null,
    timer: 0,
    arrivedAt: 0,
    paused: false,
    step() {
      if (this.drag) { this.pos = this.drag.pos; return; }
      if (!this.move) return;
      const t = clamp01((performance.now() - this.move.start) / this.move.duration);
      this.pos = lerp(this.move.from, this.move.to, easeInOutCubic(t));
      if (t >= 1) {
        this.pos = this.move.to;
        this.move = null;
        this.arrivedAt = performance.now();
        this.schedule();
      }
    },
    pause() {
      this.paused = true;
      clearTimeout(this.timer);
      this.move = null;
    },
    play() {
      this.paused = false;
      this.schedule();
    },
    slideTo(target, duration) {
      const slow = CONFIG.sequence.slow || 1;
      const base = Math.max(120, duration || CONFIG.transition.durationMs) * slow;
      this.move = { from: this.pos, to: target, start: performance.now(), duration: base };
      clearTimeout(this.timer);
    },
    schedule() {
      clearTimeout(this.timer);
      if (this.drag || paused || this.paused) return;
      const count = STEPS.length;
      const index = ((Math.round(this.pos) % count) + count) % count;
      const step = STEPS[index];
      const baseDwell = step && step.hookFire
        ? CONFIG.sequence.dwellMs * 2 + CONFIG.transition.durationMs
        : CONFIG.sequence.dwellMs;
      this.timer = setTimeout(() => this.advance(), baseDwell * (CONFIG.sequence.slow || 1));
    },
    advance() {
      if (paused || this.paused || this.drag || this.move) return;
      this.slideTo(this.pos + 1, CONFIG.transition.durationMs);
    },
    nearest(index) {
      const count = STEPS.length;
      return index + Math.round((this.pos - index) / count) * count;
    },
  };

  const stage = {
    version: 0,
    painted: "",
    init() {
      this.layout();
      this.ro = new ResizeObserver(() => this.layout());
      this.ro.observe(mainEl);
      this.onResize = () => this.layout();
      window.addEventListener("resize", this.onResize);
      const tick = (now) => {
        timeline.step(now);
        this.draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      timeline.schedule();
    },
    layout() {
      const style = getComputedStyle(mainEl);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const rootH = root ? root.clientHeight : window.innerHeight;
      const budgetH = Math.max(
        220,
        Math.round(rootH - padTop - padBottom - headerEl.offsetHeight - 24 - CMD_H - 10 - REEL_H - 18)
      );
      const budgetW = Math.max(320, board.clientWidth);
      const fit = editor.fit(budgetW, budgetH);
      docBox.style.width = fit.width + "px";
      docBox.style.height = fit.height + "px";
      editor.resize(fit.width, fit.height, fit);
      frame.resize(fit.width, fit.height);
      cmd.resize(budgetW, CMD_H);
      reel.measureWidth();
      this.version += 1;
      this.draw();
    },
    drawHookDwell(index) {
      const step = STEPS[index];
      const doc = stepDoc(index);
      const color = CONFIG.palette.face[step.face] || CONFIG.palette.face.raw;
      const holdMs = CONFIG.sequence.dwellMs;
      const cbMs = CONFIG.transition.durationMs;
      const elapsed = Math.max(0, performance.now() - (timeline.arrivedAt || 0));
      const authorRect = editor.rectOf(step.hl[0], doc);
      const quoteRect = editor.rectOf(step.hookHl, doc);
      const authorEntries = authorRect ? [{ rect: authorRect, alpha: 1 }] : [];
      const quoteEntries = quoteRect ? [{ rect: quoteRect, alpha: 1 }] : [];

      if (elapsed < holdMs) {
        editor.drawRead({ lines: doc, entries: authorEntries, color });
        frame.draw(authorEntries, color, 1);
        cmd.paint(step, 1);
      } else if (elapsed < holdMs + cbMs) {
        const v = (elapsed - holdMs) / cbMs;
        const hookColor = mixColor(color, CONFIG.palette.face.content, v);
        const appear = clamp01((v - 0.05) / 0.25);
        const textEntries = quoteRect ? [{ rect: quoteRect, alpha: appear }] : [];
        const frameEntries = [];
        if (authorRect) frameEntries.push({ rect: authorRect, alpha: 1 - v });
        if (quoteRect) frameEntries.push({ rect: quoteRect, alpha: appear });
        editor.drawRead({ lines: doc, entries: textEntries, color: hookColor });
        frame.draw(frameEntries, hookColor, 1);
        cmd.paint(HOOK_CB, 1);
      } else {
        editor.drawRead({ lines: doc, entries: quoteEntries, color: CONFIG.palette.face.content });
        frame.draw(quoteEntries, CONFIG.palette.face.content, 1);
        cmd.paint(HOOK_CB, 1);
      }
    },
    settle(index) {
      const step = STEPS[index];
      if (step.hookFire) { this.drawHookDwell(index); return; }
      const doc = stepDoc(index);
      const color = CONFIG.palette.face[step.face] || CONFIG.palette.face.raw;
      const isHook = step.kind === "hook";
      if (isHook) flyGhostCb();
      const targetRect = isHook && step.targetHl ? editor.rectOf(step.targetHl, doc) : null;
      const entries = targetRect ? [{ rect: targetRect, alpha: 1 }] : this.rectsFor(step, doc);
      editor.drawRead({ lines: doc, entries: isHook ? [] : entries, color });
      frame.draw(entries, color, 1, { dashed: isHook });
      cmd.paint(step, 1);
    },
    draw() {
      const count = STEPS.length;
      const whole = Math.floor(timeline.pos + 1e-6);
      const frac = clamp01(timeline.pos - whole);
      const index = ((whole % count) + count) % count;
      const current = STEPS[index];
      const nextIndex = (index + 1) % count;
      const next = STEPS[nextIndex];
      const wrapped = index === count - 1;
      const animateUntil = CONFIG.transition.animateUntil;

      const fireDwell = HOOK_FIRE_IDX >= 0 && index === HOOK_FIRE_IDX && frac < 0.02;
      const holdMs = CONFIG.sequence.dwellMs;
      const cbMs = CONFIG.transition.durationMs;
      const dwellElapsed = fireDwell ? Math.max(0, performance.now() - (timeline.arrivedAt || 0)) : 0;

      if (GHOST_IDX >= 0) {
        // hook 挂上后一直挂着：注册格和中间的写格都保持 cb，cb 执行开始时直接消失。
        if (index < GHOST_IDX) ghost.resetFly();
        let mode = "hidden";
        if (index >= GHOST_IDX && index < HOOK_FIRE_IDX) {
          mode = "wait";
        } else if (index === HOOK_FIRE_IDX && fireDwell && dwellElapsed < holdMs) {
          mode = "wait";
        }
        setGhost(mode);
      }

      const dwellKey = fireDwell
        ? (dwellElapsed < holdMs + cbMs ? String(Math.round(dwellElapsed / 16)) : "cb-done")
        : "";
      const key = this.version + "|" + index + "|" + frac.toFixed(4) + "|" + dwellKey;
      if (key === this.painted) { reel.render(); return; }
      this.painted = key;
      cmd.clear();

      const settleAt = 0.02;
      if (frac < settleAt) { this.settle(index); reel.render(); return; }

      if (frac < animateUntil) {
        const u = (frac - settleAt) / (animateUntil - settleAt);
        const currentDoc = stepDoc(index);
        const nextDoc = stepDoc(nextIndex);
        const currentEntries = this.rectsFor(current, currentDoc);
        const nextEntries = next.hookFire ? this.rectsForSpans(next.hl, nextDoc) : this.rectsFor(next, nextDoc);
        const entries = this.lerpRects(currentEntries, nextEntries, u);
        const color = mixColor(
          CONFIG.palette.face[current.face] || CONFIG.palette.face.raw,
          CONFIG.palette.face[next.face] || CONFIG.palette.face.raw,
          u
        );

        if (current.hookFire) {
          const nextRects = this.rectsFor(next, nextDoc);
          const fadeEntries = nextRects.map((entry) => ({ rect: entry.rect, alpha: u }));
          const fadeColor = mixColor(CONFIG.palette.face.content, CONFIG.palette.face[next.face] || CONFIG.palette.face.raw, u);
          if (next.kind === "write") {
            editor.drawWrite({
              fromLines: DOCS[nextIndex], toLines: nextDoc,
              kind: next.edit.kind, line: next.edit.line, edit: next.edit,
              u, color: fadeColor, entries: fadeEntries, strength: 1,
            });
          } else {
            editor.drawRead({ lines: currentDoc, entries: fadeEntries, color: fadeColor });
          }
          frame.draw(fadeEntries, fadeColor, 1);
          if (u < 0.18) cmd.paint(HOOK_CB, 1);
          else cmd.paint(next, clamp01((u - 0.18) / 0.42));
          reel.render();
          return;
        }

        if (wrapped && !closesLoop) {
          editor.drawReset({ fromLines: currentDoc, toLines: INITIAL, u });
          frame.draw(null, color, 0);
        } else if (next.kind === "write") {
          editor.drawWrite({
            fromLines: DOCS[nextIndex], toLines: nextDoc,
            kind: next.edit.kind, line: next.edit.line, edit: next.edit,
            u, color, entries, strength: 1,
          });
          frame.draw(entries, color, 1);
        } else {
          editor.drawRead({ lines: currentDoc, entries, color });
          frame.draw(entries, color, 1);
        }

        cmd.paint(current, 1 - clamp01(u / 0.5));
        cmd.paint(next, clamp01((u - 0.15) / 0.6));
      } else {
        const doc = stepDoc(nextIndex);
        if (next.hookFire) {
          const writeEntries = this.rectsForSpans(next.hl, doc);
          const writeColor = CONFIG.palette.face[next.face] || CONFIG.palette.face.raw;
          editor.drawRead({ lines: doc, entries: writeEntries, color: writeColor });
          frame.draw(writeEntries, writeColor, 1);
          cmd.paint(next, 1);
          reel.render();
          return;
        }
        const entries = this.rectsFor(next, doc);
        const color = CONFIG.palette.face[next.face] || CONFIG.palette.face.raw;
        editor.drawRead({ lines: doc, entries, color });
        frame.draw(entries, color, 1);
        cmd.paint(next, 1);
      }

      reel.render();
    },
    rectsForSpans(spans, doc) {
      return (spans || [])
        .map((span) => editor.rectOf(span, doc))
        .filter(Boolean)
        .map((rect) => ({ rect, alpha: 1 }));
    },
    rectsFor(step, doc) {
      if (step.hookFire) return this.rectsForSpans([step.hookHl], doc);
      return this.rectsForSpans(step.hl, doc);
    },
    lerpRects(fromEntries, toEntries, u) {
      const count = Math.max(fromEntries.length, toEntries.length);
      const out = [];
      for (let i = 0; i < count; i++) {
        const a = fromEntries[Math.min(i, fromEntries.length - 1)];
        const b = toEntries[Math.min(i, toEntries.length - 1)];
        if (!a) { out.push({ rect: b.rect, alpha: u }); continue; }
        if (!b) { out.push({ rect: a.rect, alpha: 1 - u }); continue; }
        const ar = a.rect;
        const br = b.rect;
        out.push({
          rect: {
            x1: lerp(ar.x1, br.x1, u),
            x2: lerp(ar.x2, br.x2, u),
            y1: lerp(ar.y1, br.y1, u),
            y2: lerp(ar.y2, br.y2, u),
          },
          alpha: lerp(a.alpha, b.alpha, u),
        });
      }
      return out;
    },
  };

  const reel = {
    copies: 3,
    middle: 1,
    hover: null,
    init() {
      this.host = reelEl;
      this.track = $("reelTrack");
      this.track.textContent = "";
      this.items = [];
      for (let copy = 0; copy < this.copies; copy++) {
        for (let index = 0; index < STEPS.length; index++) {
          const item = document.createElement("button");
          item.className = "reel-item";
          item.type = "button";
          item.textContent = labelOf(STEPS[index]);
          item.dataset.at = String(copy * STEPS.length + index);
          item.tabIndex = -1;
          this.track.append(item);
          this.items.push(item);
        }
      }
      this.measure();
      this.onResize = () => this.measure();
      window.addEventListener("resize", this.onResize);
      this.onDown = (event) => this.onPointerDown(event);
      this.onOver = (event) => { this.hover = event.target.closest(".reel-item"); };
      this.onOut = (event) => { if (event.target.closest(".reel-item") === this.hover) this.hover = null; };
      this.host.addEventListener("pointerdown", this.onDown);
      this.host.addEventListener("pointerover", this.onOver);
      this.host.addEventListener("pointerout", this.onOut);
    },
    measure() {
      this.widths = this.items.map((item) => item.offsetWidth);
      this.starts = [];
      let acc = 0;
      for (const width of this.widths) { this.starts.push(acc); acc += width; }
      this.unit = acc / this.items.length;
      this.measureWidth();
      this.offset = null;
      this.hoverShown = undefined;
      this.shown = [];
      this.render();
    },
    measureWidth() { this.hostWidth = this.host.clientWidth; },
    applyLabels() {
      this.items.forEach((item) => {
        const index = Number(item.dataset.at) % STEPS.length;
        item.textContent = labelOf(STEPS[index]);
      });
      this.measure();
    },
    centreOf(index) {
      const at = ((index % this.items.length) + this.items.length) % this.items.length;
      return this.starts[at] + this.widths[at] / 2;
    },
    place(pos) {
      const count = STEPS.length;
      const wrapped = ((pos % count) + count) % count;
      const index = wrapped + count * this.middle;
      const floor = Math.floor(index);
      const frac = index - floor;
      const a = this.centreOf(floor);
      const b = this.centreOf(floor + 1);
      return a + (b - a) * frac;
    },
    labelAt(offset) {
      const centre = this.hostWidth / 2 - offset;
      for (let i = 0; i < this.items.length - 1; i++) {
        const a = this.centreOf(i);
        const b = this.centreOf(i + 1);
        if (centre >= a && centre <= b) return i + (centre - a) / (b - a || 1);
      }
      return null;
    },
    render() {
      const offset = timeline.drag && timeline.drag.offset != null
        ? timeline.drag.offset
        : this.hostWidth / 2 - this.place(timeline.pos);
      if (offset === this.offset && this.hover === this.hoverShown) return;
      this.offset = offset;
      this.hoverShown = this.hover;
      this.track.style.transform = "translate3d(" + Math.round(offset) + "px,0,0)";
      this.look();
    },
    onPointerDown(event) {
      const item = event.target.closest(".reel-item");
      if (!item || event.button !== 0) return;
      clearTimeout(timeline.timer);
      timeline.move = null;
      const count = STEPS.length;
      timeline.drag = {
        x: event.clientX,
        offset: this.offset,
        pos: timeline.pos,
        from: ((timeline.pos % count) + count) % count,
        at: Number(item.dataset.at) % count,
        moved: false,
      };
      try { this.host.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      this.bindDrag();
    },
    bindDrag() {
      this.unbindDrag();
      this.onDragMove = (event) => {
        if (!timeline.drag) return;
        if (event.pointerType === "mouse" && event.buttons === 0) { this.endDrag(); return; }
        const dx = event.clientX - timeline.drag.x;
        if (Math.abs(dx) > 3) timeline.drag.moved = true;
        timeline.drag.offset += dx;
        timeline.drag.x = event.clientX;
        const label = this.labelAt(timeline.drag.offset);
        if (label == null) return;
        const count = STEPS.length;
        timeline.drag.pos = timeline.drag.pos + (label - count * this.middle - timeline.drag.from);
        timeline.drag.from = label - count * this.middle;
      };
      this.onDragEnd = () => this.endDrag();
      window.addEventListener("pointermove", this.onDragMove, { passive: true });
      window.addEventListener("pointerup", this.onDragEnd);
      window.addEventListener("pointercancel", this.onDragEnd);
      window.addEventListener("blur", this.onDragEnd);
    },
    unbindDrag() {
      if (this.onDragMove) window.removeEventListener("pointermove", this.onDragMove);
      if (this.onDragEnd) {
        window.removeEventListener("pointerup", this.onDragEnd);
        window.removeEventListener("pointercancel", this.onDragEnd);
        window.removeEventListener("blur", this.onDragEnd);
      }
      this.onDragMove = null;
      this.onDragEnd = null;
    },
    endDrag() {
      if (!timeline.drag) return;
      this.unbindDrag();
      const drag = timeline.drag;
      timeline.drag = null;
      if (!drag.moved) {
        const target = timeline.nearest(drag.at);
        timeline.slideTo(target, Math.min(460, 160 + Math.abs(target - timeline.pos) * 80));
        return;
      }
      timeline.slideTo(Math.round(drag.pos), 200);
    },
    look() {
      const centre = this.hostWidth / 2 - this.offset;
      const centreColor = CONFIG.palette.reel.centre;
      const rest = CONFIG.palette.reel.rest;
      const hoverColor = CONFIG.palette.reel.hover;
      this.items.forEach((item) => {
        const at = Number(item.dataset.at);
        const itemCentre = this.starts[at] + this.widths[at] / 2;
        const distance = Math.abs(itemCentre - centre) / this.unit;
        const near = Math.max(0, 1 - distance);
        let color = distance < 0.5 ? centreColor : rest;
        let opacity = 0.34 + near * 0.66;
        if (item === this.hover && distance > 0.4) {
          color = hoverColor;
          opacity = Math.min(1, opacity + 0.25);
        }
        const style = opacity.toFixed(3) + "|" + color;
        if (this.shown[at] === style) return;
        this.shown[at] = style;
        item.style.opacity = opacity.toFixed(3);
        item.style.color = color;
      });
    },
  };

  const STEP_CONTROLS = {
    init() {
      this.root = $("stepControls");
      if (!this.root) return;
      this.toggle = this.root.querySelector('[data-step="toggle"]');
      this.root.addEventListener("click", () => {
        if (timeline.paused) timeline.play();
        else timeline.pause();
        this.sync();
      });
      this.sync();
    },
    sync() {
      if (!this.root) return;
      const paused = timeline.paused;
      this.root.classList.toggle("paused", paused);
      if (this.toggle) this.toggle.setAttribute("aria-label", CONFIG.sequence.lang === "en" ? (paused ? "play" : "pause") : (paused ? "播放" : "暂停"));
    },
  };

  reel.init();
  stage.init();
  STEP_CONTROLS.init();

  const applyPark = (pos, arrivedOffset) => {
    clearTimeout(timeline.timer);
    timeline.move = null;
    timeline.drag = null;
    timeline.pos = pos;
    timeline.arrivedAt = performance.now() - (arrivedOffset || 0);
    stage.painted = "";
    stage.draw();
  };

  return {
    dispose() {
      running = false;
      paused = true;
      clearTimeout(timeline.timer);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (stage.ro) { try { stage.ro.disconnect(); } catch (e) { /* ignore */ } }
      window.removeEventListener("resize", stage.onResize);
      window.removeEventListener("resize", reel.onResize);
      reel.unbindDrag();
      ghost.dispose();
    },
    pause() {
      paused = true;
      running = false;
      clearTimeout(timeline.timer);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    resume() {
      if (!paused) return;
      paused = false;
      running = true;
      const tick = (now) => {
        if (!running) return;
        timeline.step(now);
        stage.draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      timeline.schedule();
    },
    setLang(lang) {
      CONFIG.sequence.lang = lang === "en" ? "en" : "zh";
      if (brandEl) brandEl.textContent = CONFIG.sequence.lang === "en" ? "Read & write" : "读写";
      if (reelEl) reelEl.setAttribute("aria-label", CONFIG.sequence.lang === "en" ? "write steps" : "读写步骤");
      reel.applyLabels();
      stage.painted = "";
      stage.draw();
    },
    setTheme(theme) {
      // light/dark 都从对应 palette 覆盖：切回 dark 时恢复模块加载时的深色快照。
      const P = theme === "light" ? LIGHT : DARK_PALETTE;
      Object.assign(CONFIG.palette.face, P.face);
      Object.assign(CONFIG.palette.cmd, P.cmd);
      Object.assign(CONFIG.palette.reel, P.reel);
      CONFIG.palette.wash = P.wash;
      Object.assign(CONFIG.palette.frame, P.frame);
      Object.assign(CONFIG.editor, P.editor);
      cmd.layouts.clear();
      // 轮盘颜色走 this.shown 缓存、render 在 offset 不变时会早退，这里主动重测一次再整体重绘。
      reel.measure();
      stage.painted = "";
      stage.layout();
    },
    park(index) { applyPark(index, 0); },
    parkDwell(offsetMs) { applyPark(HOOK_FIRE_IDX, offsetMs); },
    parkPos(pos) { applyPark(pos, 0); },
    get pos() { return timeline.pos; },
    get paused() { return paused; },
    stage,
    timeline,
    reel,
    steps: STEPS,
  };
}
```
