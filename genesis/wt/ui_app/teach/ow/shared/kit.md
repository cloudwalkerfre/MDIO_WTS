# OW_SHARED_KIT

## 实现

```jsx@node
/** 通用工具：纯函数，不 import react / mobx-state-tree。
 *  两个引擎共用；改这里两页同时生效。 */

export const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
export const lerp = (a, b, t) => a + (b - a) * t;

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function hexToRgb(hex) {
  const s = String(hex || "").replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb) {
  const p = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + p(rgb[0]) + p(rgb[1]) + p(rgb[2]);
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)]);
}

export function font(size, family, weight) {
  return (weight == null ? 700 : weight) + " " + size + "px " + (family || "monospace");
}

/** 逻辑像素对齐到半像素，避免 1px 线糊。 */
export const crisp = (v) => Math.round(v) + 0.5;

/** 把 canvas 按 CSS 尺寸 × dpr 放大并返回 2d ctx；调用方负责在 resize 时重跑。 */
export function fitCanvas(canvas, cssW, cssH, dpr) {
  const r = dpr == null ? (window.devicePixelRatio || 1) : dpr;
  canvas.width = Math.max(1, Math.round(cssW * r));
  canvas.height = Math.max(1, Math.round(cssH * r));
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return ctx;
}

export const reduceMotion = () =>
  !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/** 离屏暂停：view 用它包 engine.pause/resume（多 demo 同页时避免一起空转）。 */
export function observeVisibility(el, cb) {
  if (!el || typeof IntersectionObserver !== "function") return () => {};
  const io = new IntersectionObserver((entries) => {
    const e = entries && entries[0];
    if (e) cb(!!e.isIntersecting);
  }, { rootMargin: "120px 0px" });
  io.observe(el);
  return () => io.disconnect();
}

/** 教学页当前语言：壳层（fe.md）写 window.__teachLang 并派发 "dsh:lang"；
 *  demo / 页面组件用它拿语言并订阅切换。默认 zh，其次浏览器语言。 */
export const TEACH_LANG_KEY = "mdio-teach-lang";
export function getTeachLang() {
  try {
    const v = globalThis.__teachLang;
    if (v === "zh" || v === "en") return v;
  } catch (e) { /* ignore */ }
  try {
    const saved = localStorage.getItem(TEACH_LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch (e) { /* ignore */ }
  try {
    const nav = navigator && (navigator.language || (navigator.languages && navigator.languages[0]));
    if (nav) return /^zh/i.test(String(nav)) ? "zh" : "en";
  } catch (e) { /* ignore */ }
  return "zh";
}
export function onTeachLang(cb) {
  if (typeof window === "undefined" || !cb) return () => {};
  const handler = (ev) => {
    const v = ev && ev.detail;
    cb(v === "en" ? "en" : "zh");
  };
  window.addEventListener("dsh:lang", handler);
  try { cb(getTeachLang()); } catch (e) { /* ignore */ }
  return () => window.removeEventListener("dsh:lang", handler);
}

/** 教学页当前主题：宿主 ui.css 的明暗开关就是 body 的 .dark 类；默认 dark。 */
export function getShellTheme() {
  try {
    return document.body && document.body.classList.contains("dark") ? "dark" : "light";
  } catch (e) { return "dark"; }
}

/** 订阅教学页主题：body class 变化时回调 "dark" | "light"，返回取消函数。 */
export function onShellTheme(cb) {
  if (typeof window === "undefined" || !cb) return () => {};
  const read = () => { try { cb(getShellTheme()); } catch (e) { /* ignore */ } };
  let obs = null;
  try {
    if (typeof MutationObserver === "function" && document.body) {
      obs = new MutationObserver(read);
      obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) { /* ignore */ }
  read();
  return () => { try { if (obs) obs.disconnect(); } catch (e) { /* ignore */ } };
}
```
