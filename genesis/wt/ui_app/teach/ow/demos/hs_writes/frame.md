# OW_WR_FRAME

## 实现

```jsx@node
/** Frame：文档上的高亮框（原页 class Frame 的逐段搬运）。 */
import { CONFIG } from "@app/OW_WR_DATA";

export class DocFrame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1;
    this.height = 1;
  }

  resize(width, height) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = width;
    this.height = height;
  }

  draw(entries, color, scale, opts) {
    const ctx = this.ctx;
    const s = scale == null ? 1 : scale;
    const o = opts || {};
    ctx.clearRect(0, 0, this.width, this.height);
    const edge = CONFIG.palette.frame.edge;
    const corner = CONFIG.palette.frame.corner;
    const dashed = !!o.dashed;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (const entry of entries || []) {
      const rect = entry.rect;
      const alpha = entry.alpha * s;
      if (!rect || alpha <= 0.01) continue;
      const x = Math.round(rect.x1) + 0.5;
      const y = Math.round(rect.y1) + 0.5;
      const w = Math.round(rect.x2 - rect.x1);
      const h = Math.round(rect.y2 - rect.y1);
      if (w < 2 || h < 2) continue;
      ctx.save();
      if (dashed) {
        ctx.globalAlpha = alpha * 0.55;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = alpha * edge;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = alpha * corner;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + 0.5);
      ctx.lineTo(x + 6, y + 0.5);
      ctx.moveTo(x + w, y + h - 6);
      ctx.lineTo(x + w, y + h - 0.5);
      ctx.lineTo(x + w - 6, y + h - 0.5);
      ctx.stroke();
      ctx.restore();
    }
  }
}
```
