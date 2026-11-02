# OW_SHARED_THEME

## 实现

```jsx@node
/** 平台共用 tokens：原页五面色 + 字体/基础尺寸。
 *  每个 demo 在 data.md 里只覆盖自己的差异（例如 writes 的 raw 面是 #93c5fd）。 */
export const FACES = Object.freeze({
  container: "#67e8f9",
  mark: "#fbbf24",
  tag: "#c4b5fd",
  content: "#34d399",
});

export const FACE_KEYS = Object.freeze(["raw", "container", "mark", "tag", "content"]);

export const FONTS = Object.freeze({
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});

/** 各 demo 的「画布外」底色；目前两页都是 #050506，留 token 便于以后统一。 */
export const SURFACE = Object.freeze({ bg: "#050506", text: "#f2f4f7" });

/** 样式统一 pass 的共享边框/圆角/间距 tokens：所有 demo 的 :host 外层统一成
 *  「卡片框」——圆角 14、1px 分隔线、上下 24px 间距；深浅色 demo 都适用。
 *  各 style.md 目前各自写死；统一 pass 时把这些值换成 var(--ow-frame-*)（或在
 *  style 里直接引用 FRAME），只改 style.md，不动 view/engine。 */
export const FRAME = Object.freeze({
  radius: 14,
  border: "1px solid rgba(127,127,127,.28)",
  gutterY: 24,
  css: `:host{display:block;width:100%;border-radius:14px;border:1px solid rgba(127,127,127,.28);overflow:hidden;margin:24px 0}`,
});

export function paletteWith(raw) {
  return Object.freeze(Object.assign({}, FACES, { raw: raw }));
}
```
