# OW_WR_CMD

## 实现

```jsx@node
/** CmdLine：命令栏画布（原页 class CmdLine 的逐段搬运）+ hook ghost 控制。 */
import { CONFIG } from "@app/OW_WR_DATA";
import { FONTS } from "@app/OW_SHARED_THEME";

const font = (size) => size + "px " + FONTS.mono;

export class CmdLine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1;
    this.height = 1;
    this.layouts = new Map();
  }

  resize(width, height) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = width;
    this.height = height;
    this.size = Math.max(14, Math.min(26, Math.round(width / 52)));
    this.layouts.clear();
  }

  layoutOf(step) {
    const cached = this.layouts.get(step);
    if (cached) return cached;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = font(this.size);
    const measure = (tokens) => {
      const widths = tokens.map((token) => ctx.measureText(token.text).width);
      return { tokens, widths, width: widths.reduce((sum, w) => sum + w, 0) };
    };

    if (step.kind === "hook") {
      const line = measure([
        { text: "hook", color: CONFIG.palette.cmd.op },
        { text: " -cb ", color: CONFIG.palette.cmd.bar },
        { text: "'" + step.cb + "'", color: CONFIG.palette.cmd.payload },
        { text: " -target ", color: CONFIG.palette.cmd.bar },
        { text: step.target, color: CONFIG.palette.cmd.path },
      ]);
      const layout = { single: true, line };
      ctx.restore();
      this.layouts.set(step, layout);
      return layout;
    }

    const address = step.selector.split(".").flatMap((part, index, parts) => {
      const tokens = [{ text: part, color: CONFIG.palette.cmd.path }];
      if (index < parts.length - 1) tokens.push({ text: ".", color: CONFIG.palette.cmd.bar });
      return tokens;
    });

    const readPrefix = [{ text: "$", color: CONFIG.palette.cmd.prompt }];
    const writePrefix = [];
    if (step.kind === "write") {
      if (step.payload) {
        writePrefix.push({ text: '"' + step.payload + '"', color: CONFIG.palette.cmd.payload });
        writePrefix.push({ text: " | ", color: CONFIG.palette.cmd.bar });
      }
      writePrefix.push({ text: step.op, color: CONFIG.palette.cmd.op });
    }

    const suffix = step.pj
      ? [{ text: " -pj ", color: CONFIG.palette.cmd.bar }, { text: step.pj, color: CONFIG.palette.face[step.face] || CONFIG.palette.face.raw }]
      : [];

    const layout = {
      address: measure(address),
      prefix: measure(step.kind === "write" ? writePrefix : readPrefix),
      suffix: measure(suffix),
    };
    ctx.restore();
    this.layouts.set(step, layout);
    return layout;
  }

  clear() { this.ctx.clearRect(0, 0, this.width, this.height); }

  paint(step, alpha) {
    if (!step || alpha <= 0.01) return;
    const ctx = this.ctx;
    const layout = this.layoutOf(step);
    const y = this.height / 2;

    ctx.save();
    ctx.font = font(this.size);
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;
    if (layout.single) {
      let x = Math.round((this.width - layout.line.width) / 2);
      layout.line.tokens.forEach((token, index) => {
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, x, y);
        x += layout.line.widths[index];
      });
      ctx.restore();
      return;
    }
    const gap = Math.round(this.size * 0.55);
    const addressX = Math.round((this.width - layout.address.width) / 2);
    let x = addressX - gap - layout.prefix.width;
    layout.prefix.tokens.forEach((token, index) => {
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, x, y);
      x += layout.prefix.widths[index];
    });
    x = addressX;
    layout.address.tokens.forEach((token, index) => {
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, x, y);
      x += layout.address.widths[index];
    });
    x = addressX + layout.address.width;
    layout.suffix.tokens.forEach((token, index) => {
      ctx.fillStyle = token.color;
      ctx.fillText(token.text, x, y);
      x += layout.suffix.widths[index];
    });
    ctx.restore();
  }
}

/** ghost 控制：hook 格的虚线卡（等待/淡出两态）。 */
export function createGhostCtl({ el, steps }) {
  const ghostIdx = steps.findIndex((step) => step.kind === "hook");
  let state = "";
  let flew = false;
  let flyTimer = 0;
  const setGhost = (mode) => {
    if (!el) return;
    if (mode !== "wait") {
      if (state !== "wait") return;
      // 1 → 2 切换完成后，hookbar 保持原位原内容，只开始淡出。
      state = "retiring";
      el.classList.add("retiring");
      return;
    }
    if (state === "wait") return;
    state = "wait";
    el.classList.remove("retiring", "fire");
    if (ghostIdx >= 0) el.textContent = steps[ghostIdx].ghostCb || "";
    el.classList.add("show");
  };
  const flyGhostCb = () => {
    if (flew || !el) return;
    flew = true;
    clearTimeout(flyTimer);
    el.classList.remove("flyin");
    void el.offsetWidth;
    el.classList.add("flyin");
    flyTimer = setTimeout(() => el.classList.remove("flyin"), 900);
  };
  const dispose = () => { clearTimeout(flyTimer); };
  const resetFly = () => { flew = false; };
  return { setGhost, flyGhostCb, dispose, resetFly, ghostIdx, get flew() { return flew; } };
}
```
