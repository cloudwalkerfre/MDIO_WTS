# OW_SHARED_MD

## 实现

```jsx@node
/** md 数据读取的共用小工具（纯函数，read 面由 NodeView 传入）。
 *  现在 data 还是 JS 常量；将来 ROUNDS / STEPS 迁成 md 数据时，在各自 data.md 里
 *  用 parseSlots/parseOpts 把节点读成普通对象，engine 契约不变。 */

/** bullet 树 → 槽位表：`- NAME:` 下面 `- slot: value`。 */
export function parseSlots(read, bullet) {
  const out = {};
  if (!read || !bullet) return out;
  const kids = read.kidsOf(bullet) || [];
  for (const k of kids) {
    if (!k || k.nt !== "b") continue;
    const t = String(read.textOf(k) || "").trim();
    const i = t.indexOf(":");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/** 选项写法：`值:显示名@tag`，逗号分隔。 */
export function parseOpts(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return [];
  return s.split(",").map((part) => {
    const t = part.trim();
    const i = t.indexOf(":");
    const value = i > 0 ? t.slice(0, i).trim() : t;
    let label = i > 0 ? t.slice(i + 1).trim() : t;
    let tag = "";
    const at = label.indexOf("@");
    if (at >= 0) { tag = label.slice(at + 1).trim(); label = label.slice(0, at).trim(); }
    return { value, label, tag };
  });
}

export function slotOf(slots, key, dflt) {
  const v = slots ? slots[key] : "";
  return v == null || v === "" ? (dflt == null ? "" : dflt) : v;
}

export const OW_MD_DATA = Object.freeze({ version: 0, note: "占位：md 数据化时在此扩展" });
```
