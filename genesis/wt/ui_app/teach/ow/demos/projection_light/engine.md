# OW_PJL_ENGINE

## 实现

```jsx@node
/** createPjlEngine({ root, shadow, data, options })：projection-light 的引擎（原页 FieldLine /
 *  FrameOverlay / Stage 的逐段搬运 + 本页的“按步播放”改造）。
 *  与原页同一套时序：一步 = 切换动画 + 停留；一步自带它的 proj，公式高亮该面的词，
 *  面切换骑在同一步的切换上（框 morph + 文字颜色混色），不是切换完再溶解一次。
 *  去掉 EDITOR 面板 / 持久化状态 / URL 参数，改为 options + 实例状态。
 *  所有 DOM 查询限定 shadow；rAF / setTimeout / ResizeObserver 全部记账，dispose() 清理。
 *
 *  2026-11-02 /fe 新版同步（旧源 b55d1326 → 新源 be77a473）：
 *  - 面几何重写：mark = marker 本身（有序列表是点）、tag = 名字/数字、container 去掉
 *    引出值的冒号并引入 rightPad（停在 tag / content 字形处，不再伸进内容）；
 *  - content 不再合成一个包围框：与别的面一样按行画（regionsFor 的 content 特例删除）；
 *  - raw 在“一轮含多个纯 marker 行”时按块分别成框，其余仍是整个节点的包围块；
 *  - 暂停/恢复语义：scrub 不翻转播放状态（resumeAfterInteraction），只有显式控件翻；
 *  - 新增 STEP_CONTROLS（轮次下方暂停/播放小按钮，onPlayStateChange 同步）。
 *  教学页壳适配：view 订阅壳的主题/语言后调 setTheme / setLang；主题纯 CSS 驱动
 *  （`:host([data-theme="dark"])` 整体反相），setTheme 是接住参数的 no-op；setLang 真的换序列。
 *  暂缓：字体栈 / FONT_FAMILY / @font-face。 */
import {
  CONFIG,
  LINE_STYLE,
  FRAME_STYLE,
  PALETTE,
  PROJ_STYLE,
  PROJECTIONS,
  ROW_KEYS,
  SEQ_ZH,
  SEQ_EN,
  LABELS,
} from "@app/OW_PJL_DATA";

// ── helpers（原页 helpers 段）────────────────────────────────────────────────
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutCubic = (t) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const font = (size) => `700 ${size}px ${CONFIG.font}`;
const crisp = (v) => Math.round(v) + 0.5;

/** Blend two face colours: a projection switch has to carry the line's colour from
 *  one face to the next, not cut it. */
function mixFaceColor(fromHex, toHex, t) {
  const parse = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const a = parse(fromHex);
  const b = parse(toHex);
  const channel = (i) => Math.round(lerp(a[i], b[i], t));
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

/** 投影前后区域数不同时：按下标配对，多余的一侧配“存活边”，合/分成两个框。 */
function morphRegions(fromRects, toRects, t) {
  const count = Math.max(fromRects.length, toRects.length);
  // 两边都有区时多出的那个有地方可飞；只有一侧时只能原地淡出/淡入。
  const travel = fromRects.length > 0 && toRects.length > 0;
  const span = CONFIG.frame.regionFrameSpan;
  const regions = [];
  for (let i = 0; i < count; i++) {
    const start = fromRects.length ? fromRects[Math.min(i, fromRects.length - 1)] : null;
    const end = toRects.length ? toRects[Math.min(i, toRects.length - 1)] : null;
    const a = start || end;
    const b = end || start;
    let alpha = 1;
    let crisp = 1;

    if (!start) {
      // 投影正在获得一个区：它从存活边飞出，到了才上色。
      alpha = clamp01(t / span);
      crisp = clamp01((t - CONFIG.frame.regionCrispEnter) / (1 - CONFIG.frame.regionCrispEnter));
    } else if (!end) {
      // 投影正在失去一个区：它飞进存活边的同时颜色先褪、轮廓最后走。
      alpha = travel ? clamp01((1 - t) / span) : clamp01(1 - t / span);
      crisp = clamp01(1 - t / CONFIG.frame.regionCrispLeave);
    }

    regions.push({
      x1: lerp(a.x1, b.x1, t),
      x2: lerp(a.x2, b.x2, t),
      y1: lerp(a.y1, b.y1, t),
      y2: lerp(a.y2, b.y2, t),
      alpha,
      crisp,
    });
  }
  return regions;
}

/** 有序列表把数字写在点前面：mark 是裸点且带 tag 时成立。 */
function numbersFirst(row) {
  return Boolean(row) && (row.mark || "").trim() === "." && Boolean(row.tag);
}

/** 字段从左到右的落位顺序；每个面都从这张表切自己的片。 */
function rowOrder(row) {
  return numbersFirst(row) ? ["tag", "mark", "space", "join", "content", "suffix"] : ROW_KEYS;
}

/** 分隔符是推导出来的：mark 与 tag 之间一个空格，tag 与 content 之间一个 join。 */
function rowField(row, key) {
  if (!row) return "";
  const number = numbersFirst(row);
  if (key === "space") return number ? "" : row.mark && row.tag ? " " : "";
  if (key === "join") {
    if (!row.content) return "";
    if (row.tag && !number) return ": ";
    return row.mark ? " " : "";
  }
  return row[key] || "";
}

function rowText(row) {
  if (!row) return "";
  // lead 属于上方项目符号的缩进，也是被量宽度的一行的一部分（它推文字，不画出来）。
  const lead = row.lead ? " ".repeat(row.lead) : "";
  if (row.body != null) return lead + row.body;
  return lead + rowOrder(row).map((key) => rowField(row, key)).join("");
}

function setupCanvas(canvas, width, height, dpr) {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  return ctx;
}

/** FieldLine：行渲染器（原页 class FieldLine 的逐段搬运）。
 *  浅色版差异：measureFontSize 的 sizeShift（小三个点）、行首 lead 缩进、
 *  draw(from,to,t,proj,projTo,blend) 的面混色。 */
class FieldLine {
  constructor(canvas, rounds) {
    this.canvas = canvas;
    this.rounds = rounds;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.fontSize = LINE_STYLE.maxFontSize;
    this.rowStep = LINE_STYLE.maxFontSize * LINE_STYLE.rowGap;
    this.probe = (canvas.ownerDocument || document).createElement("canvas").getContext("2d");
    this.roundCache = new Map();
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.ctx = setupCanvas(this.canvas, width, height, dpr);
    this.roundCache.clear();
    this.measureFontSize();
  }

  maxRowWidth() {
    let max = 1;
    for (const round of this.rounds) {
      for (const row of round.rows) {
        max = Math.max(max, this.probe.measureText(rowText(row)).width);
      }
    }
    return max;
  }

  measureFontSize() {
    const base = Math.min(
      LINE_STYLE.maxFontSize,
      (this.height * LINE_STYLE.heightFit) / (LINE_STYLE.slots * LINE_STYLE.rowGap)
    );
    this.probe.font = font(base);
    const maxAtBase = this.maxRowWidth();
    // 按配置的留白能塞下多大，以及最多能塞多大。
    const fit = base * Math.min(1, (this.width * LINE_STYLE.widthFit) / maxAtBase);
    this.maxFitFontSize = base * Math.min(1, (this.width * 0.97) / maxAtBase);
    // 浅色页在适配后的字号上减三个点：宽度（而不是行高）限制字号时也成立。
    this.autoFontSize = Math.max(18, fit + (LINE_STYLE.sizeShift || 0));
    // 手动字号封顶在还塞得下的尺寸。
    this.fontSize = LINE_STYLE.fontSizeOverride
      ? Math.min(LINE_STYLE.fontSizeOverride, this.maxFitFontSize)
      : this.autoFontSize;
    this.probe.font = font(this.fontSize);
    this.maxTextWidth = this.maxRowWidth();
    this.rowStep = this.fontSize * LINE_STYLE.rowGap;
    this.originX = (this.width - this.maxTextWidth) / 2;
    this.roundCache.clear();
  }

  geometry() {
    const padX = Math.max(12, this.fontSize * LINE_STYLE.padXRatio);
    const padY = Math.max(12, this.fontSize * LINE_STYLE.padYRatio);
    return { padX, padY, ascent: this.fontSize * 0.55, descent: this.fontSize * 0.47 };
  }

  baselines() {
    const mid = (LINE_STYLE.slots - 1) / 2;
    const center = this.height / 2;
    return Array.from(
      { length: LINE_STYLE.slots },
      (_, i) => center + (i - mid) * this.rowStep + this.fontSize * 0.04
    );
  }

  // 按 order 从左到右排字段；有序列表把数字放在点前面，其它行以 mark 打头。
  positionsFrom(widths, lead = 0, order = ROW_KEYS) {
    const positions = {};
    let x = this.originX + lead;
    for (const key of order) {
      const w = widths[key] || 0;
      positions[key] = { x, w };
      x += w;
    }
    for (const key of ROW_KEYS) if (!positions[key]) positions[key] = { x, w: 0 };
    return positions;
  }

  rowLayout(row) {
    this.probe.font = font(this.fontSize);
    const widths = {};
    for (const key of ROW_KEYS) widths[key] = this.probe.measureText(rowField(row, key)).width;
    // 属于项目符号内容的一行，比它的 mark 往右这么远。
    const lead = row.lead ? this.probe.measureText(" ".repeat(row.lead)).width : 0;
    const order = rowOrder(row);
    return {
      widths,
      lead,
      order,
      positions: this.positionsFrom(widths, lead, order),
      hasBody: row.body != null,
      bodyWidth: row.body != null ? this.probe.measureText(row.body).width : 0,
    };
  }

  roundRows(round) {
    const cached = this.roundCache.get(round.id);
    if (cached) return cached;
    const rows = round.rows.map((row) => this.rowLayout(row));
    this.roundCache.set(round.id, rows);
    return rows;
  }

  blendedLayout(layoutA, layoutB, t) {
    const widths = {};
    for (const key of ROW_KEYS) widths[key] = lerp(layoutA.widths[key], layoutB.widths[key], t);
    const lead = lerp(layoutA.lead || 0, layoutB.lead || 0, t);
    const positions = {};
    for (const key of ROW_KEYS) {
      const a = layoutA.positions[key] || { x: 0, w: 0 };
      const b = layoutB.positions[key] || { x: 0, w: 0 };
      positions[key] = { x: lerp(a.x, b.x, t), w: lerp(a.w, b.w, t) };
    }
    return {
      widths,
      lead,
      positions,
      hasBody: layoutA.hasBody || layoutB.hasBody,
      bodyWidth: lerp(layoutA.bodyWidth, layoutB.bodyWidth, t),
    };
  }

  rowStates(from, to, t) {
    const rowsA = this.roundRows(from);
    const rowsB = this.roundRows(to);
    const count = Math.max(rowsA.length, rowsB.length);
    const baselines = this.baselines();
    const geo = this.geometry();
    const rollSpan = CONFIG.transition.rollSpan;
    const stacked = count > 1;
    const states = [];

    for (let i = 0; i < count; i++) {
      const rowA = from.rows[i];
      const rowB = to.rows[i];
      const layoutA = rowsA[i];
      const layoutB = rowsB[i];
      const mode = rowA && rowB ? "morph" : rowA ? "leave" : "pop";
      const baseline = baselines[Math.min(i, baselines.length - 1)];

      const band = mode === "morph"
        ? null
        : { top: baseline - geo.ascent - geo.padY, bottom: baseline + geo.descent + geo.padY };
      const rollIn = mode === "pop" ? clamp01(t / rollSpan) : 0;
      const rollOut = mode === "leave" ? clamp01(t / rollSpan) : 0;

      states.push({
        index: i,
        mode,
        t,
        rowA,
        rowB,
        layoutA,
        layoutB,
        rise: this.fontSize * (stacked ? 0.45 : 0.8),
        stagger: stacked,
        layout: mode === "morph"
          ? this.blendedLayout(layoutA, layoutB, t)
          : (rowA ? layoutA : layoutB),
        baseline,
        band,
        rollOut,
        rollIn,
      });
    }

    return states;
  }

  // 一行向某个面贡献的矩形（画布绝对坐标）。没有 isHead 特例了：面就是这一行携带的
  // 东西，container 是每行 mark 与 tag 构成的包装。
  faceGroup(row, face, layout, box, padX) {
    if (!row) return [];
    const { positions, hasBody, bodyWidth } = layout;

    // 包装的后半段在 suffix 里以一个字符区间存在（注释：结尾的 -->）。
    const closeRect = () => {
      if (!row.close || !row.suffix) return null;
      const text = rowField(row, "suffix");
      const at = (offset) => positions.suffix.x + this.probe.measureText(text.slice(0, offset)).width;
      return box(at(row.close.start) - padX, at(row.close.end) + padX);
    };

    switch (face) {
      case "mark": {
        const rects = [];
        if (row.mark) {
          // mark 面就是 marker 本身：有序列表里那是点，数字是它的 tag。
          const number = numbersFirst(row);
          const left = number ? positions.mark.x : positions.mark.x - padX;
          const right = positions.mark.x + positions.mark.w + (number ? LINE_STYLE.olPadPx : padX);
          rects.push(box(left, right));
        }
        // 同一行里的第二个 mark 区（注释：<!-- ... -->）。
        const close = closeRect();
        if (close) rects.push(close);
        return rects;
      }
      case "tag": {
        // 有序列表的 tag 是它的数字；项目符号与引用没有 tag。
        if (!row.tag) return [];
        const number = numbersFirst(row);
        const left = positions.tag.x - (number ? LINE_STYLE.olPadPx : padX);
        const right = positions.tag.x + positions.tag.w + (number ? 0 : padX);
        return [box(left, right)];
      }
      case "container": {
        // container = mark + tag。引出值的冒号不属于 container：框停在 tag 字形处。
        if (!row.mark) return [];
        const number = numbersFirst(row);
        let end = row.tag
          ? positions.tag.x + positions.tag.w
          : positions.mark.x + positions.mark.w;
        let rightPad = padX;
        // `1.` 是数字后跟点：container 到点为止，不到数字为止。
        if (number) end = positions.mark.x + positions.mark.w;
        const join = rowField(row, "join");
        if (row.tag && !number && join.startsWith(":")) {
          rightPad = 0;
        } else if (!row.tag && row.content) {
          // 项目符号 / 引用：mark 与 content 之间的空格仍在 container 里，但框正好停在
          // content 字形处；共用的右内边距会伸进那个字形。
          end = positions.content.x;
          rightPad = 0;
        } else if (row.suffix && row.suffix.startsWith(":")) {
          // 内容在下方几行的项目符号，本行没有值，它的冒号在 suffix 里：仍属于 container。
          end = positions.suffix.x + this.probe.measureText(":").width;
        }
        const start = Math.min(positions.mark.x, row.tag ? positions.tag.x : positions.mark.x);
        const rects = [box(start - padX, end + rightPad)];
        const close = closeRect();
        if (close) rects.push(close);
        return rects;
      }
      case "content": {
        if (hasBody) {
          const bodyX = this.originX + (layout.lead || 0);
          return [box(bodyX, bodyX + bodyWidth + padX)];
        }
        if (!row.content) return [];
        return [box(positions.content.x, positions.content.x + positions.content.w + padX)];
      }
      default:
        return [];
    }
  }

  rowRight(state) {
    const layout = state.layout;
    let right = this.originX;
    for (const key of ROW_KEYS) {
      const pos = layout.positions[key];
      right = Math.max(right, pos.x + pos.w);
    }
    if (layout.hasBody) right = Math.max(right, this.originX + (layout.lead || 0) + layout.bodyWidth);
    return right;
  }

  regionsFor(face, states, t) {
    const geo = this.geometry();
    this.probe.font = font(this.fontSize);

    // 一个含多个 marker 行的轮次是多个块，不是一个节点。这种情况 raw 按块分别画；
    // 继续到 body 行的块仍然落到下面的单节点框。
    if (face === "raw") {
      const separateBlocks = states.length > 1 && states.every((state) => {
        const rows = [state.rowA, state.rowB].filter(Boolean);
        return rows.length > 0 && rows.every((row) => row.body == null && !!row.mark);
      });

      if (separateBlocks) {
        const rects = [];
        for (const state of states) {
          const row = state.mode === "leave" ? state.rowA : state.rowB;
          if (!row) continue;
          const presence = state.mode === "pop" ? state.rollIn
            : state.mode === "leave" ? 1 - state.rollOut
            : 1;
          if (presence <= 0.01) continue;
          const band = state.band ?? {
            top: state.baseline - geo.ascent - geo.padY,
            bottom: state.baseline + geo.descent + geo.padY,
          };
          const rowTop = state.mode === "pop" ? lerp(band.bottom, band.top, state.rollIn) : band.top;
          const rowBottom = state.mode === "leave" ? lerp(band.bottom, band.top, state.rollOut) : band.bottom;
          const right = this.originX + this.probe.measureText(rowText(row)).width;
          rects.push({
            x1: this.originX - geo.padX,
            x2: right + geo.padX,
            y1: rowTop,
            y2: rowBottom,
            alpha: presence,
            crisp: 1,
          });
        }
        return rects;
      }
    }

    // raw 是整个节点：屏上每一行仍在的包围块。进入的行从槽底长上来、离开的行向槽顶缩，
    // 所以块框随行打开/关闭，而不是跳。
    if (face === "raw") {
      let right = this.originX;
      let top = Infinity;
      let bottom = -Infinity;
      let any = false;

      for (const state of states) {
        const presence = state.mode === "pop" ? state.rollIn
          : state.mode === "leave" ? 1 - state.rollOut
          : 1;
        if (presence <= 0.01) continue;
        any = true;
        right = Math.max(right, this.rowRight(state));
        const band = state.band ?? {
          top: state.baseline - geo.ascent - geo.padY,
          bottom: state.baseline + geo.descent + geo.padY,
        };
        const rowTop = state.mode === "pop" ? lerp(band.bottom, band.top, state.rollIn) : band.top;
        const rowBottom = state.mode === "leave" ? lerp(band.bottom, band.top, state.rollOut) : band.bottom;
        top = Math.min(top, rowTop);
        bottom = Math.max(bottom, rowBottom);
      }

      if (!any) return [];
      return [{ x1: this.originX - geo.padX, x2: right + geo.padX, y1: top, y2: bottom, alpha: 1, crisp: 1 }];
    }

    // content 和别的面一样，按行画。
    const regions = [];
    for (const state of states) {
      // 一行的框永远落在它的槽上：行从框里滚过，框本身不动。
      const y1 = state.baseline - geo.ascent - geo.padY;
      const y2 = state.baseline + geo.descent + geo.padY;
      const box = (x1, x2) => ({ x1, x2, y1, y2 });
      const groupA = state.rowA ? this.faceGroup(state.rowA, face, state.layoutA, box, geo.padX) : [];
      const groupB = state.rowB ? this.faceGroup(state.rowB, face, state.layoutB, box, geo.padX) : [];

      if (state.mode === "morph") {
        regions.push(...morphRegions(groupA, groupB, t));
      } else if (state.mode === "pop") {
        // 进入的行把框一起带上来。
        for (const rect of groupB) regions.push({ ...rect, alpha: state.rollIn, crisp: 1 });
      } else {
        // 离开的行把框一起带走。
        const regionCrisp = clamp01(1 - t / CONFIG.frame.regionCrispLeave);
        for (const rect of groupA) regions.push({ ...rect, alpha: 1 - state.rollOut, crisp: regionCrisp });
      }
    }
    return regions;
  }

  // `proj` 是离开的面，`projTo` 是进入的面，`blend` 是切换走了多远：框从一面的区 morph 到
  // 另一面的区，同时清晰文字的颜色在两面之间过渡——一步不会从一个投影直接切到下一个。
  draw(from, to, t, proj, projTo = proj, blend = 1) {
    const ctx = this.ctx;
    const states = this.rowStates(from, to, t);
    const sameFace = proj === projTo;
    const regionsFrom = this.regionsFor(proj, states, t);
    const regionsTo = sameFace ? regionsFrom : this.regionsFor(projTo, states, t);
    const regions = sameFace ? regionsFrom : morphRegions(regionsFrom, regionsTo, blend);
    const faceColor = sameFace
      ? PROJ_STYLE[proj].color
      : mixFaceColor(PROJ_STYLE[proj].color, PROJ_STYLE[projTo].color, blend);

    ctx.clearRect(0, 0, this.width, this.height);

    this.paintRows({
      ctx,
      states,
      color: LINE_STYLE.outsideColor,
      alpha: LINE_STYLE.outsideAlpha,
      blur: LINE_STYLE.blurPx,
    });

    const inset = LINE_STYLE.clipInset;
    for (const region of regions) {
      const x = region.x1 + inset;
      const y = region.y1 + inset;
      const w = Math.max(0, region.x2 - region.x1 - inset * 2);
      const h = Math.max(0, region.y2 - region.y1 - inset * 2);
      if (!w || !h) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.clearRect(x, y, w, h);
      if (region.crisp < 1) {
        this.paintRows({
          ctx,
          states,
          color: LINE_STYLE.outsideColor,
          alpha: LINE_STYLE.outsideAlpha * (1 - region.crisp),
          blur: LINE_STYLE.blurPx,
        });
      }
      this.paintRows({ ctx, states, color: faceColor, alpha: region.crisp, blur: 0 });
      ctx.restore();
    }

    return { states, regions, color: faceColor };
  }

  paintRows({ ctx, states, color, alpha, blur }) {
    ctx.save();
    ctx.font = font(this.fontSize);
    ctx.fillStyle = color;
    ctx.filter = blur ? `blur(${blur}px)` : "none";

    for (const state of states) {
      const rowAlpha = alpha;
      if (rowAlpha <= 0.008) continue;
      const y = state.baseline;
      const banded = state.band != null;

      if (banded) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, state.band.top, this.width, state.band.bottom - state.band.top);
        ctx.clip();
      }

      if (state.mode === "morph") {
        const tt = state.t;
        const rise = state.rise;
        for (const key of ROW_KEYS) {
          const pos = state.layout.positions[key];
          const oldText = rowField(state.rowA, key);
          const newText = rowField(state.rowB, key);
          if (oldText === newText) {
            if (!oldText) continue;
            ctx.globalAlpha = rowAlpha;
            ctx.fillText(newText, pos.x, y);
          } else {
            ctx.globalAlpha = rowAlpha * (1 - tt);
            if (oldText) ctx.fillText(oldText, pos.x, y - tt * rise);
            ctx.globalAlpha = rowAlpha * tt;
            if (newText) ctx.fillText(newText, pos.x, y + (1 - tt) * rise);
          }
        }
        // A body row carries its text in a field of its own, at the row's indent.
        const bodyOld = state.rowA.body ?? "";
        const bodyNew = state.rowB.body ?? "";
        const bodyX = this.originX + (state.layout.lead || 0);
        if (bodyOld === bodyNew) {
          if (bodyOld) {
            ctx.globalAlpha = rowAlpha;
            ctx.fillText(bodyOld, bodyX, y);
          }
        } else {
          ctx.globalAlpha = rowAlpha * (1 - tt);
          if (bodyOld) ctx.fillText(bodyOld, bodyX, y - tt * rise);
          ctx.globalAlpha = rowAlpha * tt;
          if (bodyNew) ctx.fillText(bodyNew, bodyX, y + (1 - tt) * rise);
        }
      } else if (state.mode === "pop") {
        // A row arriving: the empty line above rolls out and the new line
        // comes up under it.
        ctx.globalAlpha = rowAlpha;
        this.paintWholeRow(ctx, state.rowB, state.layout, y + (1 - state.rollIn) * this.rowStep);
      } else {
        // A row leaving: it rolls up out of the slot and leaves an empty line.
        ctx.globalAlpha = rowAlpha;
        this.paintWholeRow(ctx, state.rowA, state.layout, y - state.rollOut * this.rowStep);
      }

      if (banded) ctx.restore();
    }

    ctx.restore();
  }

  // Fields of a row at the given baseline, either the outgoing text or the
  // incoming one. Unchanged fields are drawn by whichever side asks first.
  paintWholeRow(ctx, row, layout, baseline) {
    if (row.body != null) {
      ctx.fillText(row.body, this.originX + (layout.lead || 0), baseline);
      return;
    }
    for (const key of ROW_KEYS) {
      const text = rowField(row, key);
      if (text) ctx.fillText(text, layout.positions[key].x, baseline);
    }
  }
}

/** FrameOverlay：框/角标/粒子/面名（原页 class FrameOverlay 的逐段搬运）。
 *  浅色版差异：setTarget 接收混合色，框不会在 morph 中一帧换色。 */
class FrameOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 1;
    this.height = 1;
    this.regions = [];
    this.proj = null;
    this.color = null;
    this.frozen = false;
    this.pulseBase = 0;
    this.pulseStart = performance.now();
    this.canvas.style.opacity = "1";
  }

  resize(width, height, dpr) {
    this.width = width;
    this.height = height;
    setupCanvas(this.canvas, width, height, dpr);
  }

  setTarget(regions, proj, color) {
    this.regions = regions.map((region) => ({ ...region }));
    this.proj = proj;
    // 面切换交来的颜色已经在两个面中间，框不会一帧换色。
    this.color = color || (PROJ_STYLE[proj] ? PROJ_STYLE[proj].color : null);
  }

  pulseAt(now) {
    return this.frozen ? this.pulseBase : this.pulseBase + (now - this.pulseStart) / 1000;
  }

  setFrozen(value) {
    if (value === this.frozen) return;
    if (value) this.pulseBase = this.pulseAt(performance.now());
    else this.pulseStart = performance.now();
    this.frozen = value;
  }

  fadeTo(value, duration) {
    this.canvas.style.transition = `opacity ${duration}ms ease`;
    this.canvas.style.opacity = String(value);
  }

  fadeOut() { this.fadeTo(CONFIG.frame.opacityDip, CONFIG.frame.fadeOutMs); }
  fadeIn() { this.fadeTo(1, CONFIG.frame.fadeInMs); }

  render(now) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (!this.regions.length || !this.proj) return;

    const color = this.color || PROJ_STYLE[this.proj].color;
    const label = PROJ_STYLE[this.proj].label;
    const pulse = this.pulseAt(now);

    this.regions.forEach((region, index) => {
      if (region.alpha <= 0.01) return;
      this.drawBox(region, color, pulse, index === 0 ? label : null);
    });
  }

  drawBox(region, color, pulse, label) {
    const alpha = region.alpha;
    const x1 = crisp(region.x1);
    const y1 = crisp(region.y1);
    const x2 = crisp(region.x2);
    const y2 = crisp(region.y2);

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 1;

    this.ctx.globalAlpha = alpha * (FRAME_STYLE.lineAlpha + FRAME_STYLE.breatheAlpha * Math.sin(pulse * FRAME_STYLE.breatheSpeed));
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x1, y2);
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.globalAlpha = alpha * FRAME_STYLE.glowAlpha;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = FRAME_STYLE.glowBlur;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;

    this.ctx.globalAlpha = alpha * FRAME_STYLE.cornerAlpha;
    const corner = FRAME_STYLE.cornerSize;
    for (const [cx, cy] of [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]) {
      this.ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, corner, corner);
    }

    this.drawParticles(alpha, pulse, x1, y1, x2, y2);
    if (label) this.drawLabel(alpha, label, x2, y1);
    this.ctx.restore();
  }

  drawParticles(alpha, pulse, x1, y1, x2, y2) {
    const w = Math.max(1, x2 - x1);
    const h = Math.max(1, y2 - y1);
    const perimeter = 2 * (w + h);
    const pointAt = (distance) => {
      let d = ((distance % perimeter) + perimeter) % perimeter;
      if (d < w) return [x1 + d, y1];
      d -= w;
      if (d < h) return [x2, y1 + d];
      d -= h;
      if (d < w) return [x2 - d, y2];
      d -= w;
      return [x1, y2 - d];
    };

    for (let i = 0; i < FRAME_STYLE.particleCount; i++) {
      const [px, py] = pointAt(pulse * FRAME_STYLE.particleSpeed + i * (perimeter / FRAME_STYLE.particleCount));
      const size = i === 0 ? 2 : 1;
      this.ctx.globalAlpha = alpha * (0.24 + 0.22 * (0.5 + 0.5 * Math.sin(pulse * 3 + i)));
      this.ctx.fillRect(Math.round(px) - size / 2, Math.round(py) - size / 2, size, size);
    }
  }

  // The face's name sits over the box's top-right corner, aligned to the corner
  // itself so the label reads outward from the frame instead of into it.
  drawLabel(alpha, label, x2, y1) {
    this.ctx.globalAlpha = alpha * FRAME_STYLE.labelAlpha;
    this.ctx.font = FRAME_STYLE.labelFont;
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "bottom";
    this.ctx.fillText(label, Math.round(x2), Math.round(y1) - FRAME_STYLE.labelOffset);
  }
}

// ── 引擎 ────────────────────────────────────────────────────────────────────
export function createPjlEngine({ root, shadow, data, options }) {
  const opts = options || {};
  const $ = (id) => (shadow && shadow.getElementById ? shadow.getElementById(id) : null);
  const REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // 两种语言的序列就绪（data 可覆盖，options.lang 选一条）。
  const SEQUENCES = {
    zh: (data && data.SEQ_ZH) || SEQ_ZH,
    en: (data && data.SEQ_EN) || SEQ_EN,
  };
  const makeRounds = (sequence) =>
    sequence.map((round, index) => ({
      id: round.proj + "-" + (index + 1),
      proj: round.proj,
      rows: round.rows,
    }));
  // 一步要投的面：序列就是时间线，面从这一步读，而不是另一个轮回。
  const roundProj = (round) => (round && PROJECTIONS.indexOf(round.proj) >= 0 ? round.proj : "raw");

  let LANG = opts.lang === "en" ? "en" : "zh";
  let ROUNDS = makeRounds(SEQUENCES[LANG]);
  const forcedProj = PROJECTIONS.indexOf(opts.proj) >= 0 ? opts.proj : null;
  let PROJ = forcedProj || roundProj(ROUNDS[0]);
  const clampStep = (n) => Math.max(0, Math.min(ROUNDS.length - 1, Math.round(Number(n) || 0)));

  // ── FORMULA：公式行（raw = container[mark + tag] + content），点亮当前面 ──
  const FORMULA = {
    cells: null,
    init() {
      this.cells = Array.from(shadow.querySelectorAll("#formula .fc"));
      for (const cell of this.cells) {
        const face = cell.dataset.face;
        cell.style.setProperty("--face", PROJ_STYLE[face].color);
        const b = cell.querySelector("b");
        if (b) b.textContent = face;
        cell.onclick = () => {
          stage.setProj(face, true);
          FORMULA.refresh();
        };
      }
      this.refresh();
    },
    refresh() {
      if (!this.cells) return;
      for (const cell of this.cells) cell.classList.toggle("active", cell.dataset.face === PROJ);
    },
    detach() {
      if (!this.cells) return;
      for (const cell of this.cells) cell.onclick = null;
      this.cells = null;
    },
  };

  // ── REEL：轮盘（5 份复制；拖动 scrub；tap glide；look 透视）──
  const REEL = {
    itemW: 78,
    // 复制份数：窗口永远走不到条带尽头，轮盘两侧总有邻居。
    copies: 5,
    middle: 2,
    // 轮盘位置（以项为单位）：连续、无界，一项一轮。
    index: 0,
    // 屏上那轮对应的整数项号。
    anchor: 0,

    init() {
      this.reel = $("reel");
      this.track = $("reelTrack");
      if (!this.reel || !this.track) return;
      this.itemW = parseFloat(getComputedStyle(this.reel).getPropertyValue("--reel-w")) || 78;

      // 拖动就是 scrub 时间线：手指的 x 对应“轮 + 进度”，轮盘和舞台是同一时间线的同一点。
      this.onPointerDown = (event) => {
        const item = event.target.closest(".reel-item");
        if (!item || event.button !== 0) return;
        const count = ROUNDS.length || 1;
        this.dragBias = this.anchor - stage.current;
        // 标签落在中线的哪一侧。方向按这一侧决定，不按最短路。
        const itemBox = item.getBoundingClientRect();
        const reelBox = this.reel.getBoundingClientRect();
        const side = Math.sign(itemBox.left + itemBox.width / 2 - (reelBox.left + reelBox.width / 2));
        this.drag = {
          x: event.clientX,
          position: stage.position(),
          at: Number(item.dataset.at) % count,
          side,
          moved: false,
        };
        try {
          this.reel.setPointerCapture(event.pointerId);
        } catch (e) {
          // 合成指针或已释放的指针无法 capture；window 监听照样覆盖拖动。
        }
        // 移动/释放挂在 window 上，指针离开轮盘（或窗口）拖动也不断。
        this.bindDrag();
        // 手按住时时间线也按住：循环不能在手下走，当前帧就是 scrub 点。
        // scrub 不翻转播放/暂停状态：只有明确的播放控件才做那件事。
        this.resumeAfterInteraction = !stage.paused;
        stage.pause();
        this.scrub(this.drag.position);
      };
      // 悬停标签微抬（屏上那个仍最大）。
      this.onPointerOver = (event) => { this.hover = event.target.closest(".reel-item"); };
      this.onPointerOut = (event) => {
        if (event.target.closest(".reel-item") === this.hover) this.hover = null;
      };
      this.reel.addEventListener("pointerdown", this.onPointerDown);
      this.reel.addEventListener("pointerover", this.onPointerOver);
      this.reel.addEventListener("pointerout", this.onPointerOut);
    },

    bindDrag() {
      this.unbindDrag();
      this.onDragMove = (event) => {
        if (!this.drag) return;
        // 鼠标丢了按键而浏览器没发 release。
        if (event.pointerType === "mouse" && event.buttons === 0) { this.endDrag(); return; }
        const dx = event.clientX - this.drag.x;
        if (Math.abs(dx) > 3) this.drag.moved = true;
        this.scrub(this.drag.position - dx / this.itemW);
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
      if (!this.drag) return;
      this.unbindDrag();
      const drag = this.drag;
      this.drag = null;
      const count = ROUNDS.length || 1;
      if (!drag.moved) {
        // tap 不直接切轮：轮盘与舞台沿同一时间线滑过去，只是快。
        this.glideTo(drag.at, drag.side);
        return;
      }
      // 拖动落在手松开的地方。
      const landed = Math.round(this.dragPosition);
      const round = ((landed % count) + count) % count;
      this.index = this.dragBias + landed;
      stage.scrubEnd();
      stage.setCurrent(round);
      if (this.resumeAfterInteraction) stage.play();
      this.resumeAfterInteraction = false;
    },

    // 滚到某一轮而不是跳过去：时间线在短促的缓和滑动里从这儿到那儿，中间面的切换都看得见。
    glideTo(at, side) {
      const count = ROUNDS.length || 1;
      const from = stage.position();
      let delta = (((at - from) % count) + count) % count;
      if (side < 0 && delta > 0) delta -= count;
      if (Math.abs(delta) < 0.01) {
        stage.scrubEnd();
        stage.setCurrent(at);
        if (this.resumeAfterInteraction) stage.play();
        this.resumeAfterInteraction = false;
        return;
      }
      this.glide = {
        from,
        delta,
        bias: this.anchor - stage.current,
        start: performance.now(),
        duration: Math.min(460, 160 + Math.abs(delta) * 80),
      };
    },

    // 轮盘与舞台放到同一时间线的同一点：一轮一项，项间比例就是切换进度。
    scrub(position) {
      this.dragPosition = position;
      this.renderWheel(this.dragBias + position);
      stage.scrubTo(position);
    },

    // 项号可以是任意大：始终在中间那份副本里显示，条带两侧永远有邻居，转一圈也看不出来。
    renderWheel(index) {
      const count = ROUNDS.length || 1;
      this.index = index;
      const display = ((index % count) + count) % count + count * this.middle;
      this.moveTo(this.reel.clientWidth / 2 - (display + 0.5) * this.itemW);
    },

    // 轮次变化时调用：轮盘不动，重锚定让中线下的项就是屏上那轮。
    resync() {
      const count = ROUNDS.length || 1;
      const base = Math.round(this.index);
      this.anchor = stage.current + count * Math.round((base - stage.current) / count);
    },

    // 轮盘短标签，从屏上的形状读：h1/h2/h3、blt、ol、bq、code、cmt。
    markName(mark) {
      const text = (mark || "").trim();
      if (!text) return "";
      if (text.startsWith("`")) return "code";
      if (text.startsWith("<!--")) return "cmt";
      if (/^#{1,6}$/.test(text)) return "h" + text.length;
      if (/^\d+\.$/.test(text)) return "ol";
      if (/^[-*+]$/.test(text)) return "blt";
      if (text === ">") return "bq";
      return text;
    },

    // 一轮可含多种行（`1.` 与 `-` 并列），标签按出现顺序列出所有 marker。
    label(round, index) {
      const names = [];
      for (const row of round.rows || []) {
        // 有序列表的 mark 是点，所以按形状命名（`1.` 是 ol），不按点本身。
        const name = numbersFirst(row) ? "ol" : this.markName(row.mark);
        if (name && names.indexOf(name) < 0) names.push(name);
      }
      return names.length ? names.join("&") : "r" + (index + 1);
    },

    signature() {
      return ROUNDS.map((round, index) => this.label(round, index)).join("|");
    },

    build() {
      if (!this.track) return;
      const count = ROUNDS.length;
      this.sig = this.signature();
      this.track.textContent = "";
      this.items = [];
      const loop = this.signature().split("|");
      for (let copy = 0; copy < this.copies; copy++) {
        for (let index = 0; index < count; index++) {
          const item = document.createElement("button");
          item.className = "reel-item";
          item.type = "button";
          item.textContent = loop[index];
          item.dataset.at = String(copy * count + index);
          item.tabIndex = -1;
          this.track.appendChild(item);
          this.items.push(item);
        }
      }
      this.anchor = stage.current + count * this.middle;
      this.index = this.anchor;
      this.renderWheel(this.index);
      // 这里也先评一次：不跑循环的冻结视图（park 的 t=0）也要有可读的轮盘。
      this.look();
    },

    moveTo(offset) {
      this.offset = offset;
      if (this.track) this.track.style.transform = "translate3d(" + offset + "px,0,0)";
    },

    // 每帧由 stage 调用。轮盘读时间线，跟着切换一起起步/停止、用同一条 easing；
    // 拖动时由拖动自己写位置。
    frame() {
      if (!this.items || this.sig !== this.signature()) this.build();
      if (!this.items || !this.items.length) return;
      if (this.glide) {
        // 点标签：把时间线从这儿快速 scrub 到那儿。
        const glide = this.glide;
        const t = clamp01((performance.now() - glide.start) / glide.duration);
        const position = glide.from + glide.delta * easeInOutCubic(t);
        this.renderWheel(glide.bias + position);
        stage.scrubTo(position);
        if (t >= 1) {
          const count = ROUNDS.length || 1;
          const target = glide.from + glide.delta;
          const round = ((Math.round(target) % count) + count) % count;
          this.glide = null;
          stage.scrubEnd();
          stage.setCurrent(round);
          if (this.resumeAfterInteraction) stage.play();
          this.resumeAfterInteraction = false;
        }
        this.look();
        return;
      }
      if (!this.drag) {
        const position = stage.position();
        this.renderWheel(this.anchor + (position - stage.current));
      }
      this.look();
    },

    // 按标签离中线的距离评级：这才让它读作轮盘而不是一行；评级读实时 transform，拖也跟手。
    look() {
      if (!this.items || !this.items.length || !this.reel) return;
      const reelRect = this.reel.getBoundingClientRect();
      const trackRect = this.track.getBoundingClientRect();
      const centre = reelRect.left + reelRect.width / 2 - trackRect.left;
      for (const item of this.items) {
        const at = Number(item.dataset.at);
        const distance = Math.abs((at + 0.5) * this.itemW - centre) / this.itemW;
        const near = Math.max(0, 1 - distance);
        // 中线上的标签是当前轮、最大；悬停别的标签只微抬，不会超过中线。
        // 中线用墨色，往外变灰；悬停把灰提亮。
        let scale = 0.82 + near * 0.34;
        let color = distance < 0.5 ? PALETTE.reel.centre : PALETTE.reel.rest;
        let opacity = 0.55 + near * 0.45;
        if (item === this.hover && distance > 0.4) {
          scale = Math.min(1.1, scale + 0.14);
          color = PALETTE.reel.hover;
          opacity = Math.min(1, opacity + 0.25);
        }
        item.style.opacity = opacity.toFixed(3);
        item.style.transform = "scale(" + scale.toFixed(3) + ")";
        item.style.color = color;
      }
    },

    detach() {
      if (this.reel) {
        this.reel.removeEventListener("pointerdown", this.onPointerDown);
        this.reel.removeEventListener("pointerover", this.onPointerOver);
        this.reel.removeEventListener("pointerout", this.onPointerOut);
      }
      this.unbindDrag();
      this.items = null;
      this.glide = null;
      this.drag = null;
    },
  };

  // ── STAGE：时间线导演（一步一轮；一步自带它的面）──
  const stage = {
    host: $("lineWindow"),
    line: new FieldLine($("lineCanvas"), ROUNDS),
    frame: new FrameOverlay($("frameCanvas")),
    // 正被离开的面的定格，让面切换溶解而不是切。
    mix: $("mixCanvas"),
    mixCtx: $("mixCanvas") ? $("mixCanvas").getContext("2d") : null,
    current: 0,
    transition: null,
    projMorph: null,
    frozenView: null,
    timer: 0,
    fadeInTimer: 0,
    raf: 0,
    ro: null,
    paused: false,
    autoProj: opts.auto !== false,
    projIndex: 0,
    projHeld: 0,
    onRoundChange: null,

    init() {
      this.current = clampStep(opts.step);
      // 投影不再是单独的轮回：屏上这一步命名它的面，第一帧从这一步的投影开始。
      if (!forcedProj) PROJ = roundProj(ROUNDS[this.current]);
      const cycle = CONFIG.projection.cycle;
      this.projIndex = Math.max(0, cycle.findIndex((entry) => entry.proj === PROJ));
      this.projHeld = 0;
      this.resize();

      if (opts.t != null) {
        this.frozenView = {
          from: this.current,
          to: (this.current + 1) % ROUNDS.length,
          t: clamp01(opts.t),
        };
        this.frame.setFrozen(true);
        this.render(performance.now());
        // 冻结视图是定格：不 schedule；循环仍启动，按播放才能离开定格。
        this.startLoop();
        this.watchResize();
        return;
      }

      this.render(performance.now());
      this.schedule();
      // 帧循环即使 reduced motion 也跑：它负责步进后的重绘和轮盘跟手；
      // reduced motion 只去掉动画本身（advance() 直接切），不去掉循环。
      this.startLoop();
      this.watchResize();
    },

    startLoop() {
      if (this.raf) return;
      this.tickFixed = this.tickFixed || ((now) => this.tick(now));
      this.raf = requestAnimationFrame(this.tickFixed);
    },

    watchResize() {
      if (typeof ResizeObserver !== "function" || !this.host) return;
      this.ro = new ResizeObserver(() => {
        this.resize();
        this.render(performance.now());
      });
      this.ro.observe(this.host);
    },

    resize() {
      if (!this.host) return;
      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.line.rounds = ROUNDS;
      this.line.resize(width, height, dpr);
      this.frame.resize(width, height, dpr);
      this.placeBoard();
    },

    // 句子和舞台是一整块（board），按普通文档流排：画布第一行落在宿主中线，公式在它上方
    // formulaGapSteps 行步 + formulaGapPx 像素；画布再高也只能把 board 往下推。
    placeBoard() {
      const board = this.board || (this.board = $("board"));
      const stageEl = this.stageEl || (this.stageEl = $("stage"));
      const formula = this.formulaEl || (this.formulaEl = $("formula"));
      if (!board || !stageEl || !formula || !this.host || !root) return;
      const firstBaseline = this.line.baselines()[0];
      const gap = CONFIG.layout.formulaGapSteps * this.line.rowStep + (CONFIG.layout.formulaGapPx || 0);
      // 公式盒与画布盒之间的间距：想要的间距减去画布第一行上方的留白。画布第一行上方
      // 是透明的，这段可以是负数——空顶滑到公式下面，任何字号都保持“一句话一步远”。
      const margin = Math.round(gap - firstBaseline);
      board.style.setProperty("--chapter-gap", margin + "px");

      const stageRect = stageEl.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const centerY = rootRect.top + rootRect.height / 2 - stageRect.top;
      const boardTop = centerY - (formula.offsetHeight + margin + firstBaseline);
      board.style.marginTop = Math.max(0, Math.round(boardTop)) + "px";

      // 轮盘挂在最后一个行槽下方固定距离，不挂在画布盒下方：盒子在槽下留了空尾。
      const geo = this.line.geometry();
      const baselines = this.line.baselines();
      const lastBottom = baselines[baselines.length - 1] + geo.descent + geo.padY;
      const reelGap = 22 - (this.host.clientHeight - lastBottom);
      board.style.setProperty("--reel-gap", Math.round(reelGap) + "px");
    },

    render(now) {
      let from = ROUNDS[this.current];
      let to = from;
      let t = 1;
      if (this.frozenView) {
        from = ROUNDS[this.frozenView.from];
        to = ROUNDS[this.frozenView.to];
        t = this.frozenView.t;
      } else if (this.transition) {
        from = ROUNDS[this.transition.from];
        to = ROUNDS[this.transition.to];
        t = easeInOutCubic((now - this.transition.start) / CONFIG.transition.durationMs);
      }
      if (!from) return;
      if (!to) to = from;

      // 面切换骑在同一次切换上：框从旧面的区 morph 到新面的区，文字颜色同时过渡。
      const morph = this.projMorph;
      const { regions, color } = morph
        ? this.line.draw(from, to, t, morph.from, morph.to, t)
        : this.line.draw(from, to, t, PROJ);
      // 框的几何就是插值后的投影区本身，框和清晰区不会分家；颜色同样带着混合色。
      this.frame.setTarget(regions, PROJ, color);
      this.frame.render(now);
    },

    tick(now) {
      if (this.transition) {
        const t = (now - this.transition.start) / CONFIG.transition.durationMs;
        if (t >= 1) this.finishTransition();
      }
      this.render(now);
      REEL.frame();
      this.raf = requestAnimationFrame(this.tickFixed);
    },

    schedule() {
      clearTimeout(this.timer);
      if (this.paused || this.frozenView) return;
      // 同一个时钟：reduced motion 去掉动画，不去掉节奏。
      this.timer = setTimeout(() => this.advance(), CONFIG.sequence.dwellMs);
    },

    advance() {
      if (this.transition || this.paused) return;
      const next = (this.current + 1) % ROUNDS.length;

      if (REDUCED) {
        const from = this.current;
        this.current = next;
        this.frame.setFrozen(false);
        this.frame.fadeTo(1, 0);
        this.render(performance.now());
        this.schedule();
        if (this.onRoundChange) this.onRoundChange();
        this.noteStep(from, next);
        return;
      }

      // 这一步要的面。不是当前面就让同一次切换带上它（框 morph、颜色混色），
      // 而不是切换完再补一次溶解。
      const nextProj = this.autoProj ? roundProj(ROUNDS[next]) : PROJ;
      if (nextProj !== PROJ) {
        this.projMorph = { from: PROJ, to: nextProj };
        PROJ = nextProj;
        FORMULA.refresh();
      } else {
        this.projMorph = null;
      }

      this.transition = {
        from: this.current,
        to: next,
        start: performance.now(),
      };
      this.frame.setFrozen(true);
      this.frame.fadeOut();
      this.fadeInTimer = setTimeout(() => this.frame.fadeIn(), CONFIG.frame.fadeInDelayMs);
    },

    finishTransition() {
      const from = this.transition.from;
      const to = this.transition.to;
      this.current = to;
      this.transition = null;
      this.projMorph = null;
      this.frame.setFrozen(false);
      this.frame.fadeTo(1, 0);
      this.schedule();
      if (this.onRoundChange) this.onRoundChange();
      this.noteStep(from, to);
    },

    // 投影跟着序列走：这一轮的句子指明这一步投哪个面，时间线和句子一起走。
    noteStep(from, to) {
      if (from === to) return;
      if (!this.autoProj) return;
      const next = roundProj(ROUNDS[to]);
      if (next === PROJ) return;
      this.setProj(next);
    },

    // manual = 手选（点公式里的词）。手选停下自动循环，投影交回鼠标。
    setProj(proj, manual = false) {
      if (PROJECTIONS.indexOf(proj) < 0) return;
      const previous = PROJ;
      PROJ = proj;
      const index = CONFIG.projection.cycle.findIndex((entry) => entry.proj === proj);
      if (index >= 0) {
        this.projIndex = index;
        this.projHeld = 0;
      }
      if (manual) this.autoProj = false;
      if (previous && previous !== proj) this.dissolve();
      this.render(performance.now());
      FORMULA.refresh();
    },

    // 把屏上现帧（正被离开的面）拍下来，让定格在刚画好的新面之上淡出：溶解而不是切。
    dissolve() {
      if (REDUCED || !this.mixCtx || !this.host) return;
      const width = this.host.clientWidth;
      const height = this.host.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.mix.width = Math.round(width * dpr);
      this.mix.height = Math.round(height * dpr);
      this.mixCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.mixCtx.clearRect(0, 0, width, height);
      this.mixCtx.drawImage(this.line.canvas, 0, 0, width, height);
      this.mixCtx.drawImage(this.frame.canvas, 0, 0, width, height);
      this.mix.style.transition = "none";
      this.mix.style.opacity = "1";
      void this.mix.offsetWidth;
      this.mix.style.transition = "opacity " + CONFIG.transition.projMs + "ms ease";
      this.mix.style.opacity = "0";
    },

    // 舞台是一条时间线：一轮一个单位，两个单位间的比例就是切换进度。
    // 循环一单位一单位地走；轮盘直接 scrub 这个值，拖过两轮真的就是快进两次切换。
    position() {
      if (!this.transition) return this.current;
      const raw = clamp01((performance.now() - this.transition.start) / CONFIG.transition.durationMs);
      return this.transition.from + easeInOutCubic(raw);
    },

    // 把舞台定格在时间线的任意一点：比例直接当作切换进度，手指下的 x 就是动画。
    scrubTo(position) {
      const count = ROUNDS.length || 1;
      const whole = Math.floor(position);
      const from = ((whole % count) + count) % count;
      this.transition = null;
      this.projMorph = null;
      this.frozenView = { from, to: (from + 1) % count, t: position - whole };
      this.frame.setFrozen(true);
      this.render(performance.now());
    },

    scrubEnd() {
      this.frozenView = null;
      this.frame.setFrozen(false);
      this.frame.fadeTo(1, 0);
    },

    setCurrent(index) {
      this.transition = null;
      this.projMorph = null;
      this.current = clampStep(index);
      if (this.autoProj) PROJ = roundProj(ROUNDS[this.current]);
      this.frame.setFrozen(false);
      this.frame.fadeTo(1, 0);
      this.render(performance.now());
      FORMULA.refresh();
      if (this.onRoundChange) this.onRoundChange();
    },

    pause() {
      this.paused = true;
      clearTimeout(this.timer);
      // 播放状态变了就通知外面（循环按钮的字、步进播放条随 paused 换）。
      if (this.onPlayStateChange) this.onPlayStateChange();
    },

    play() {
      this.paused = false;
      // 冻结的 scrub 点（park 的 t，或没松手的拖动）不能钉住舞台：按播放就是播放。
      if (this.frozenView) {
        this.frozenView = null;
        this.frame.setFrozen(false);
        this.frame.fadeTo(1, 0);
        this.render(performance.now());
      }
      this.frame.setFrozen(false);
      // 启动在冻结视图上的页面从没开过循环；播放得把它拉回来，否则排下的步永远走不完。
      this.startLoop();
      this.schedule();
      if (this.onPlayStateChange) this.onPlayStateChange();
    },

    togglePlay() {
      if (this.paused) this.play();
      else this.pause();
    },

    // 换语言的新序列：清过渡、重新适配字号、再画、再排。
    switchRounds(next, keep) {
      this.transition = null;
      this.projMorph = null;
      this.frozenView = null;
      this.current = Math.max(0, Math.min(next.length - 1, keep));
      this.line.rounds = next;
      if (this.autoProj) PROJ = roundProj(next[this.current]);
      this.resize();
      this.render(performance.now());
      this.schedule();
      FORMULA.refresh();
      if (this.onRoundChange) this.onRoundChange();
    },

    // 定格：把舞台放到某一步（可带切换进度 t）并画出来，供冻结帧/像素对照。
    // park(step, t) —— t=0 是这一步的静止帧；0<t<1 是这一步切到下一步的中途。
    park(step = 0, t = 0, proj = null) {
      this.pause();
      const index = Math.max(0, Math.min(ROUNDS.length - 1, Math.round(Number(step) || 0)));
      // 不给 proj 就投这一步自己的面（公式高亮该面的词）。
      PROJ = PROJECTIONS.indexOf(proj) >= 0 ? proj : roundProj(ROUNDS[index]);
      this.projMorph = null;
      this.transition = null;
      this.current = index;
      this.frozenView = t > 0
        ? { from: index, to: (index + 1) % ROUNDS.length, t: clamp01(Number(t) || 0) }
        : null;
      // 框的脉冲由时钟喂；定格在 0，同一个定格每次都一样。
      this.frame.frozen = true;
      this.frame.pulseBase = 0;
      this.frame.fadeTo(1, 0);
      this.render(performance.now());
      FORMULA.refresh();
      // 定格后轮盘也要跟着定格：先把轮盘重锚到这一步，再评级。
      REEL.resync();
      REEL.frame();
      return { step: index, proj: PROJ, steps: ROUNDS.length };
    },

    dispose() {
      this.paused = true;
      clearTimeout(this.timer);
      clearTimeout(this.fadeInTimer);
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
      if (this.ro) { try { this.ro.disconnect(); } catch (e) { /* ignore */ } this.ro = null; }
      REEL.unbindDrag();
    },
  };

  // ── 接线：循环按钮 / 语言按钮 / 初始帧 ──
  const loopToggle = $("loopToggle");
  const langToggle = $("langToggle");
  const syncPlay = () => {
    if (loopToggle) loopToggle.textContent = stage.paused ? "▶" : "⏸";
  };
  const applyLangChrome = () => {
    const labels = LABELS[LANG] || LABELS.zh;
    const headline = shadow.querySelector(".top h1");
    if (headline) headline.textContent = labels.headline;
    if (langToggle) {
      langToggle.textContent = labels.switchLang;
      langToggle.setAttribute("aria-label", labels.langAria);
    }
    if (loopToggle) loopToggle.setAttribute("aria-label", labels.loopAria);
  };
  const togglePlay = () => { stage.togglePlay(); syncPlay(); };

  // ── STEP_CONTROLS：轮次下方的安静播放条（暂停/播放两枚 SVG，CSS 用 .paused 切显隐）──
  const STEP_CONTROLS = {
    init() {
      this.root = $("stepControls");
      if (!this.root) return;
      this.toggle = this.root.querySelector('[data-step="toggle"]');
      this.onClick = (event) => {
        const button = event.target.closest("button[data-step]");
        if (!button || button.dataset.step !== "toggle") return;
        stage.togglePlay();
        syncPlay();
        this.sync();
      };
      this.root.addEventListener("click", this.onClick);
      this.sync();
    },

    sync() {
      if (!this.root) return;
      const paused = stage.paused;
      this.root.classList.toggle("paused", paused);
      if (this.toggle) this.toggle.setAttribute("aria-label", LANG === "en" ? (paused ? "play" : "pause") : (paused ? "播放" : "暂停"));
    },

    detach() {
      if (this.root && this.onClick) this.root.removeEventListener("click", this.onClick);
      this.onClick = null;
    },
  };

  // 舞台无论被谁按了暂停/播放（按钮、轮盘拖动、park），两处控件都同步。
  stage.onPlayStateChange = () => {
    syncPlay();
    STEP_CONTROLS.sync();
  };
  if (loopToggle) loopToggle.onclick = togglePlay;
  if (langToggle) {
    langToggle.onclick = () => { setLang(LANG === "en" ? "zh" : "en"); };
  }
  syncPlay();

  // ── 语言：换一条同长度的序列，轮次/面向保持，句子和页头一起换 ──
  // （原页用 `?lang=` 重载；这里不重载，直接换数据并重画。）
  function setLang(lang) {
    const next = lang === "en" ? "en" : "zh";
    if (next === LANG) { applyLangChrome(); return LANG; }
    LANG = next;
    const keep = stage.current;
    ROUNDS = makeRounds(SEQUENCES[LANG]);
    stage.switchRounds(ROUNDS, keep);
    REEL.frame();
    applyLangChrome();
    syncPlay();
    return LANG;
  }

  stage.onRoundChange = () => {
    FORMULA.refresh();
    REEL.resync();
  };

  FORMULA.init();
  REEL.init();
  stage.init();
  // 步进播放条在舞台就绪后接上（暂停/播放两枚 SVG 的显隐靠 .paused）。
  STEP_CONTROLS.init();
  // init 可能把投影改成起始那一步的面（options.step），公式高亮要随之刷新。
  FORMULA.refresh();
  // 先建/评级一次轮盘：冻结视图（options.t / park t=0）不跑 stage 循环，轮盘不能是空条。
  REEL.frame();
  applyLangChrome();
  syncPlay();

  // 对外把手：view 挂在 host.__owEngine 上，控制台可 park 冻结帧验证。
  return {
    dispose() {
      stage.dispose();
      REEL.detach();
      FORMULA.detach();
      STEP_CONTROLS.detach();
      if (loopToggle) loopToggle.onclick = null;
      if (langToggle) langToggle.onclick = null;
    },
    pause() { stage.pause(); syncPlay(); },
    resume() { stage.play(); syncPlay(); },
    setLang,
    setTheme(theme) {
      // 主题纯 CSS 驱动：view 改 host 的 data-theme，:host([data-theme="dark"]) 整体反相；
      // 引擎不重绘，只接住参数（教学页壳切主题时调用，不能抛错）。
      this.theme = theme;
    },
    park(step, t, proj) { return stage.park(step, t, proj); },
    get stepIndex() { return stage.current; },
    get steps() { return ROUNDS.length; },
    get proj() { return PROJ; },
    get rounds() { return ROUNDS; },
    get stage() { return stage; },
  };
}
```

