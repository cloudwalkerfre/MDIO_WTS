# OW_WR_DOC

## 实现

```jsx@node
/** Editor：文档画布渲染（原页 class Editor 的逐段搬运）。
 *  三种画面：drawRead（静止+框住/洗色）、drawWrite（改写动画）、drawReset（回绕）。 */
import { CONFIG, INITIAL, buildDocs } from "@app/OW_WR_DATA";
import { FONTS } from "@app/OW_SHARED_THEME";
import { clamp01, lerp } from "@app/OW_SHARED_KIT";

const DOCS = buildDocs();
export const MAX_LINES = DOCS.reduce((n, lines) => Math.max(n, lines.length), 0);
export const LONGEST = DOCS.reduce((n, lines) => Math.max(n, ...lines.map((text) => text.length)), 0);

const font = (size) => size + "px " + FONTS.mono;

export class DocEditor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.probe = document.createElement("canvas").getContext("2d");
    this.width = 1;
    this.height = 1;
    this.tabHeight = CONFIG.editor.tabHeight;
  }

  fit(maxWidth, maxHeight) {
    const measure = (size) => {
      this.probe.font = font(size);
      const advance = this.probe.measureText("M").width || size * 0.6;
      const lineHeight = Math.round(size * CONFIG.editor.lineGap);
      const gutter = Math.max(26, Math.round(String(MAX_LINES).length * advance * 0.66 + CONFIG.editor.gutterPad));
      return {
        size,
        advance,
        lineHeight,
        gutter,
        width: Math.round(gutter + CONFIG.editor.textInset + LONGEST * advance + CONFIG.editor.contentPadX),
        height: this.tabHeight + MAX_LINES * lineHeight + CONFIG.editor.contentPadY * 2,
      };
    };
    let size = CONFIG.editor.maxFontSize;
    for (let guard = 0; guard < 40; guard++) {
      const box = measure(size);
      if (box.width <= maxWidth && box.height <= maxHeight) return box;
      if (size <= CONFIG.editor.minFontSize) return box;
      const scale = Math.min(maxWidth / box.width, maxHeight / box.height);
      size = Math.max(CONFIG.editor.minFontSize, Math.floor(size * Math.min(0.98, scale)));
    }
    return measure(size);
  }

  resize(width, height, fit) {
    this.fontSize = fit.size;
    this.advance = fit.advance;
    this.gutter = fit.gutter;
    this.lineHeight = fit.lineHeight;
    this.textX = this.gutter + CONFIG.editor.textInset;
    this.padTop = this.tabHeight + CONFIG.editor.contentPadY;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = width;
    this.height = height;
  }

  lineTop(n) { return this.padTop + (n - 1) * this.lineHeight; }
  baseline(n) { return this.lineTop(n) + Math.round(this.lineHeight * 0.76); }

  rectOf(span, lines) {
    if (!span) return null;
    const top = this.lineTop(span.line) + 2;
    if (span.to) {
      let endCol = span.end;
      if (endCol == null) {
        endCol = 0;
        for (let n = span.line; n <= span.to; n++) endCol = Math.max(endCol, (lines[n - 1] || "").length);
      }
      return {
        x1: this.textX + (span.start || 0) * this.advance - 7,
        x2: this.textX + endCol * this.advance + 7,
        y1: top,
        y2: this.lineTop(span.to) + this.lineHeight - 2,
      };
    }
    return {
      x1: this.textX + span.start * this.advance - 5,
      x2: this.textX + span.end * this.advance + 5,
      y1: top,
      y2: this.lineTop(span.line) + this.lineHeight - 2,
    };
  }

  paintSurface(ctx) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0.5, 0.5, this.width - 1, this.height - 1, 10);
    else ctx.rect(0, 0, this.width, this.height);
    ctx.fillStyle = CONFIG.editor.surface;
    ctx.fill();
    ctx.strokeStyle = CONFIG.editor.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(0, 0, this.gutter + 8, this.height);
    ctx.fillStyle = CONFIG.editor.gutterTint;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.gutter + 8.5, 10);
    ctx.lineTo(this.gutter + 8.5, this.height - 10);
    ctx.strokeStyle = CONFIG.editor.rule;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = font(11);
    ctx.fillStyle = CONFIG.editor.tabText;
    ctx.fillText("notes.md", this.gutter + 26, 18);
    ctx.beginPath();
    ctx.arc(this.gutter + 17, 14.5, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.editor.tabDot;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, this.tabHeight - 0.5);
    ctx.lineTo(this.width, this.tabHeight - 0.5);
    ctx.strokeStyle = CONFIG.editor.tabRule;
    ctx.stroke();
    ctx.restore();
  }

  paintNumbers(count) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(Math.max(8, Math.round(this.fontSize * 0.58)));
    ctx.fillStyle = CONFIG.editor.number;
    ctx.textAlign = "right";
    for (let n = 1; n <= count; n++) ctx.fillText(String(n), this.gutter, this.baseline(n));
    ctx.restore();
  }

  paintLine(text, n, alpha, color, dy, col) {
    if (!text || alpha <= 0.01) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(this.fontSize);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillText(text, this.textX + (col || 0) * this.advance, this.baseline(n) + (dy || 0));
    ctx.restore();
  }

  drawRead({ lines, entries, color }) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.paintSurface(ctx);
    this.paintNumbers(lines.length);
    for (let n = 1; n <= lines.length; n++) this.paintLine(lines[n - 1], n, 1, CONFIG.editor.text);
    for (const entry of entries || []) {
      const rect = entry.rect;
      const alpha = entry.alpha;
      if (!rect || alpha <= 0.01) continue;
      const w = Math.max(0, rect.x2 - rect.x1);
      const h = Math.max(0, rect.y2 - rect.y1);
      if (!w || !h) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x1, rect.y1, w, h);
      ctx.clip();
      ctx.clearRect(rect.x1, rect.y1, w, h);
      ctx.fillStyle = CONFIG.editor.surface;
      ctx.fillRect(rect.x1, rect.y1, w, h);
      ctx.globalAlpha = alpha * CONFIG.palette.wash;
      ctx.fillStyle = color;
      ctx.fillRect(rect.x1, rect.y1, w, h);
      ctx.globalAlpha = 1;
      const from = Math.max(1, Math.floor((rect.y1 - this.padTop) / this.lineHeight) + 1);
      const to = Math.min(lines.length, Math.floor((rect.y2 - this.padTop) / this.lineHeight) + 1);
      for (let n = from; n <= to; n++) this.paintLine(lines[n - 1], n, alpha, color);
      ctx.restore();
    }
  }

  drawWrite({ fromLines, toLines, kind, line, edit, u, color, entries, strength }) {
    const L = line;
    const lh = this.lineHeight;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.paintSurface(ctx);
    this.paintNumbers(Math.round(lerp(fromLines.length, toLines.length, u)));

    for (let n = 1; n < L; n++) this.paintLine(toLines[n - 1], n, 1, CONFIG.editor.text);

    if (kind === "replace") {
      const c1 = edit.cols[0];
      const c2 = edit.cols[1];
      const oldLine = fromLines[L - 1] || "";
      const newLine = toLines[L - 1] || "";
      const same = oldLine.slice(c1, c2).length === newLine.slice(c1, c2).length;
      if (same) {
        const prefix = newLine.slice(0, c1);
        const suffix = newLine.slice(c2);
        this.paintLine(prefix, L, 1, CONFIG.editor.text);
        this.paintLine(suffix, L, 1, CONFIG.editor.text, 0, c2);
        const rise = Math.round(lh * 0.5);
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.textX + c1 * this.advance - 3, this.lineTop(L) - 1, (c2 - c1) * this.advance + 6, lh + 2);
        ctx.clip();
        this.paintLine(oldLine.slice(c1, c2), L, 1 - u, color, -u * rise, c1);
        this.paintLine(newLine.slice(c1, c2), L, u, color, (1 - u) * rise, c1);
        ctx.restore();
      } else {
        this.paintLine(oldLine, L, 1 - u, color, -u * lh * 0.5);
        this.paintLine(newLine, L, u, color, (1 - u) * lh * 0.5);
      }
      for (let n = L + 1; n <= toLines.length; n++) this.paintLine(toLines[n - 1], n, 1, CONFIG.editor.text);
    } else if (kind === "insert") {
      const dy = -(1 - u) * lh;
      this.paintLine(toLines[L - 1], L, u, color, dy);
      for (let n = L + 1; n <= toLines.length; n++) this.paintLine(toLines[n - 1], n, 1, CONFIG.editor.text, dy);
    } else if (kind === "delete") {
      const dy = (1 - u) * lh;
      this.paintLine(fromLines[L - 1], L, 1 - u, color, -u * lh);
      for (let n = L; n <= toLines.length; n++) this.paintLine(toLines[n - 1], n, 1, CONFIG.editor.text, dy);
    }

    for (const entry of entries || []) this.paintWash(entry.rect, color, strength * entry.alpha);
  }

  drawReset({ fromLines, toLines, u }) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.paintSurface(ctx);
    this.paintNumbers(Math.round(lerp(fromLines.length, toLines.length, u)));
    const travel = (MAX_LINES + 1) * this.lineHeight;
    const alpha = Math.sin(Math.PI * clamp01(u)) * 0.0 + 1;
    for (let n = 1; n <= fromLines.length; n++) {
      this.paintLine(fromLines[n - 1], n, (1 - u) * alpha, CONFIG.editor.text, -u * travel);
    }
    for (let n = 1; n <= toLines.length; n++) {
      this.paintLine(toLines[n - 1], n, u * alpha, CONFIG.editor.text, (1 - u) * travel);
    }
  }

  paintWash(rect, color, alpha) {
    if (!rect || alpha <= 0.01) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * CONFIG.palette.wash;
    ctx.fillStyle = color;
    ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    ctx.restore();
  }
}

export { DOCS, INITIAL };
```
