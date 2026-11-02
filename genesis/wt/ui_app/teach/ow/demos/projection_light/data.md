# OW_PJL_DATA

## 实现

```jsx@node
/** projection-light 的全部可变数据与参数：照原页（ow/projection-light.html §script 头段）逐项搬，
 *  字段顺序与数值不变。engine 只读这里；改序列/时长/配色不改引擎。 */

export const FONT_FAMILY = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** 浅色五面：与深色版同一组色相，纸白上加深。raw/container/mark/tag/content 依次。 */
export const PALETTE = {
  face: {
    raw: "#475569",
    container: "#0e7490",
    mark: "#b45309",
    tag: "#6d28d9",
    content: "#047857",
  },
  // 还没选面时整块的底色：灰墨，比它不属于的那个面更淡。
  outside: "#6b7480",
  // 轮盘的标签：中线、静止、悬停。
  reel: { centre: "#0f1218", rest: "#5b6675", hover: "#14171c" },
};

// 一个面 = 颜色 + 名字；名字就是 key，两者不会互相说谎。
export const PROJ_STYLE = Object.fromEntries(
  Object.entries(PALETTE.face).map(([key, color]) => [key, { color, label: key }])
);
export const PROJECTIONS = Object.keys(PROJ_STYLE);

/** 20 步中文序列：一步 = { proj（这一步讲哪个面，只作标签，不画） , rows（这一步显示的 Markdown） }。
 *  五面轮转：raw ×2 → mark ×6 → content ×5 → tag ×4 → container ×3。 */
export const SEQ_ZH = [
  { proj: "raw", rows: [{ mark: "#", tag: "header" }, { body: "MDIO 用一套投影" }] },
  { proj: "raw", rows: [{ mark: "#", tag: "header" }, { body: "统一所有 Markdown 元素" }] },
  { proj: "mark", rows: [{ mark: "#", tag: "header" }, { body: "mark 指代所有 marker" }] },
  { proj: "mark", rows: [{ mark: "##", tag: "header" }, { body: "mark 指代所有 marker" }] },
  { proj: "mark", rows: [{ mark: "###", tag: "header" }, { body: "mark 指代所有 marker" }] },
  { proj: "mark", rows: [{ mark: ".", tag: "1", content: "mark 指代所有 marker" }, { mark: "-", content: "mark 指代所有 marker" }] },
  { proj: "mark", rows: [{ mark: ".", tag: "2", content: "mark 指代所有 marker" }, { mark: ">", content: "mark 指代所有 marker" }] },
  { proj: "mark", rows: [{ mark: "```", tag: "mdio" }, { body: "mark 指代所有 marker" }, { mark: "```" }] },
  { proj: "content", rows: [{ mark: "```", tag: "mdio" }, { body: "content 指代所有内容" }, { mark: "```" }] },
  { proj: "content", rows: [{ mark: "-", content: "content 指代所有内容" }] },
  { proj: "content", rows: [{ mark: ".", tag: "1", content: "content 指代所有内容" }] },
  { proj: "content", rows: [{ mark: "<!--", tag: "", content: "content 指代所有内容", suffix: " -->", close: { start: 1, end: 4 } }] },
  { proj: "content", rows: [{ mark: "###", tag: "header" }, { body: "content 指代所有内容" }] },
  { proj: "tag", rows: [{ mark: "###", tag: "header" }, { body: "tag 指代所有 name、info、language" }] },
  { proj: "tag", rows: [{ mark: "```", tag: "mdio" }, { body: "tag 指代所有 name、info、language" }, { mark: "```" }] },
  { proj: "tag", rows: [{ mark: "-", tag: "tag", content: "指代所有 name、info、language" }] },
  { proj: "tag", rows: [{ mark: ".", tag: "1", content: "tag 指代所有 name、info、language" }] },
  { proj: "container", rows: [{ mark: "```", tag: "mdio" }, { body: "container = mark + tag" }, { mark: "```" }] },
  { proj: "container", rows: [{ mark: "###", tag: "header" }, { body: "container = mark + tag" }] },
  { proj: "container", rows: [{ mark: "<!--", tag: "", content: "container = mark + tag", suffix: " -->", close: { start: 1, end: 4 } }] },
];

/** 20 步英文序列：句子换语言，面名不换（raw/mark/content/tag/container 保持原样）。 */
export const SEQ_EN = [
  { proj: "raw", rows: [{ mark: "#", tag: "header" }, { body: "MDIO, one projection" }] },
  { proj: "raw", rows: [{ mark: "#", tag: "header" }, { body: "for all Markdown blocks" }] },
  { proj: "mark", rows: [{ mark: "#", tag: "header" }, { body: "mark for markers" }] },
  { proj: "mark", rows: [{ mark: "##", tag: "header" }, { body: "mark for markers" }] },
  { proj: "mark", rows: [{ mark: "###", tag: "header" }, { body: "mark for markers" }] },
  { proj: "mark", rows: [{ mark: ".", tag: "1", content: "mark for markers" }, { mark: "-", content: "mark for markers" }] },
  { proj: "mark", rows: [{ mark: ".", tag: "2", content: "mark for markers" }, { mark: ">", content: "mark for markers" }] },
  { proj: "mark", rows: [{ mark: "```", tag: "mdio" }, { body: "mark for markers" }, { mark: "```" }] },
  { proj: "content", rows: [{ mark: "```", tag: "mdio" }, { body: "content for everything inside" }, { mark: "```" }] },
  { proj: "content", rows: [{ mark: "-", content: "content for everything inside" }] },
  { proj: "content", rows: [{ mark: ".", tag: "1", content: "content for everything inside" }] },
  { proj: "content", rows: [{ mark: "<!--", tag: "", content: "content for everything inside", suffix: " -->", close: { start: 1, end: 4 } }] },
  { proj: "content", rows: [{ mark: "###", tag: "header" }, { body: "content for everything inside" }] },
  { proj: "tag", rows: [{ mark: "###", tag: "header" }, { body: "tag for name, info, language..." }] },
  { proj: "tag", rows: [{ mark: "```", tag: "mdio" }, { body: "tag for name, info, language..." }, { mark: "```" }] },
  { proj: "tag", rows: [{ mark: "-", tag: "tag", content: "for name, info, language..." }] },
  { proj: "tag", rows: [{ mark: ".", tag: "1", content: "tag for name, info, language..." }] },
  { proj: "container", rows: [{ mark: "```", tag: "mdio" }, { body: "container = mark + tag" }, { mark: "```" }] },
  { proj: "container", rows: [{ mark: "###", tag: "header" }, { body: "container = mark + tag" }] },
  { proj: "container", rows: [{ mark: "<!--", tag: "", content: "container = mark + tag", suffix: " -->", close: { start: 1, end: 4 } }] },
];

// 一行由这些字段排版；space / join 是推导出来的分隔符，不是手打的。
export const ROW_KEYS = ["mark", "space", "tag", "join", "content", "suffix"];

// ── 所有可调参数集中在这里 ──────────────────────────────────────────────────
export const CONFIG = {
  font: FONT_FAMILY,
  // 颜色那半份配置：五个面、框外灰墨、轮盘标签，全在 PALETTE 里。
  palette: PALETTE,
  layout: {
    // 第一行落在屏幕中线上；公式在这条线上方 formulaGapSteps 个行步。
    // formulaGapPx 是固定像素微调，字号变了节奏也不变。
    formulaGapSteps: 1.0,
    formulaGapPx: 25,
  },
  reel: {
    // 点中的标签按它在中线的哪一侧决定时间线往前走还是往回走；itemWidth 是标签宽。
    itemWidth: 78,
  },
  sequence: {
    // 一步只有一个数：一步多长（起-起）。切换动画占 motionShare，停留占剩下的。
    stepMs: 1120,
    // 1120 × 0.554 ≈ 620ms 的切换，其余是停留（原先两个手填数字的节奏）。
    motionShare: 0.554,
    // 由 syncStepTiming() 从上面两个数推导；不手填。
    dwellMs: 500,
  },
  projection: {
    // 手动点面/面板选面时的五面轮回顺序（按步骤播放时不读它）。
    cycle: [
      { proj: "raw", steps: 1 },
      { proj: "container", steps: 1 },
      { proj: "mark", steps: 2 },
      { proj: "tag", steps: 2 },
      { proj: "content", steps: 2 },
    ],
  },
  transition: {
    // 由 syncStepTiming() 从 stepMs × motionShare 推导。
    durationMs: 616,
    // 一次面切换的溶解时长（只有手动换面用；一步自带的面变化骑在步切换上）。
    projMs: 260,
    // 切换里行滚进/滚出所占的比例。
    rollSpan: 0.45,
  },
  line: {
    blurPx: 0.2,
    // 投影之外的排字：灰墨，比不属于它的那个面更淡。
    outsideColor: PALETTE.outside,
    outsideAlpha: 0.72,
    // 浅色页比深色页小三个点；位移加在适配后的字号上（见 measureFontSize）。
    sizeShift: -3,
    maxFontSize: 112,
    // null = 自动适配最宽一行；数字 = 手动字号。
    fontSizeOverride: null,
    // 保留的行槽与基线间距，单位都是字号。一轮最多四行：项目符号 + 缩进内容（围栏要三行）。
    slots: 3,
    rowGap: 1.5,
    heightFit: 0.86,
    widthFit: 0.82,
    padXRatio: 0.12,
    padYRatio: 0.16,
    // 有序列表 `1` 和 `.` 的框用自己更小的内边距。
    olPadPx: 4,
    clipInset: 2,
  },
  frame: {
    fadeOutMs: 220,
    opacityDip: 0.6,
    fadeInDelayMs: 300,
    fadeInMs: 320,
    // 切换里出现/消失的区配“存活边”飞进/飞出：轮廓先保持，文字先褪色。
    regionFrameSpan: 0.45,
    regionCrispLeave: 0.3,
    regionCrispEnter: 0.72,
    style: {
      // 纸白上光晕会糊成一片，框保留自己的线、把大部分光晕去掉。
      lineAlpha: 0.62,
      breatheAlpha: 0.022,
      breatheSpeed: 2.4,
      glowAlpha: 0.08,
      glowBlur: 7,
      cornerSize: 5,
      cornerAlpha: 0.95,
      particleCount: 5,
      particleSpeed: 42,
      labelAlpha: 0.9,
      labelFont: "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      labelOffset: 8,
    },
  },
};

export const LINE_STYLE = CONFIG.line;
export const FRAME_STYLE = CONFIG.frame.style;

/** 步长是一个时钟：1120ms 一步 = 616ms 切换 + 504ms 停留（取整后 620 + 500）。
 *  切换与调度都读这两个推导值，改步长或改动画占比，两者一起动。 */
export function syncStepTiming() {
  const step = Math.max(240, CONFIG.sequence.stepMs);
  const share = Math.min(0.9, Math.max(0.2, CONFIG.sequence.motionShare));
  CONFIG.transition.durationMs = Math.max(120, Math.round(step * share));
  CONFIG.sequence.dwellMs = Math.max(0, step - CONFIG.transition.durationMs);
}
// 原页在脚本加载时就同步一次；这里同样在数据件加载时同步。
syncStepTiming();

/** 公式行（view 的 DOM 只按这张表建 span，不换结构）。 */
export const FORMULA = [
  { kind: "face", face: "raw" },
  { kind: "op", text: "=" },
  { kind: "face", face: "container" },
  { kind: "op", text: "[" },
  { kind: "face", face: "mark" },
  { kind: "op", text: "+" },
  { kind: "face", face: "tag" },
  { kind: "op", text: "]" },
  { kind: "op", text: "+" },
  { kind: "face", face: "content" },
];

/** 文案：原页 LANG_TITLE / LANG_HEADLINE / 语言按钮三处。
 *  switchLang 是“按下去会切到的那门语言”，不是当前语言（原页行为）。 */
export const LABELS = {
  zh: {
    title: "MDIO — 给 Markdown 一个投影",
    headline: "给 Markdown 一个投影",
    switchLang: "EN",
    langAria: "切换语言 / switch language",
    loopAria: "暂停 / 播放",
    reelAria: "轮次",
    formulaAria: "raw = container[mark + tag] + content",
  },
  en: {
    title: "MDIO — one projection for Markdown",
    headline: "One projection for Markdown",
    switchLang: "中文",
    langAria: "switch language / 切换语言",
    loopAria: "pause / play",
    reelAria: "rounds",
    formulaAria: "raw = container[mark + tag] + content",
  },
};
```
