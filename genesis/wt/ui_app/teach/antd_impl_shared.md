# ANTD_SHARED

## 实现

```jsx@node
import { createElement as h } from "react";

/** 主题 tokens（两件共用，保持 antd ConfigProvider 一致）。 */
export const THEME_TOKENS = { colorPrimary: "#6b62f2", borderRadius: 10, colorBgContainer: "#161616", colorBgElevated: "#1d1d1d", colorBorder: "rgba(255,255,255,0.12)", colorText: "#ededed", colorTextSecondary: "#b2b2b2" };

const TRUE_VALUES = new Set(["true", "on", "open", "1", "yes"]);
const FALSE_VALUES = new Set(["false", "off", "closed", "0", "no"]);
const STATUS_TAGS = new Set(["error", "wait", "process", "finish"]);

export const toBool = (v) => {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  return null;
};

export const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : (d == null ? 0 : d);
};

/** 选项/列表的**唯一**写法：`值:显示名`，可带 `@tag`（tag 是图标名或 status 词）。 */
export function parseOpts(raw) {
  if (!raw) return [];
  const s = String(raw).trim();
  const one = (p) => {
    const t = String(p).trim();
    if (!t) return null;
    const idx = t.indexOf(":");
    const value = idx > 0 ? t.slice(0, idx).trim() : t;
    let label = idx > 0 ? t.slice(idx + 1).trim() : t;
    let tag = "";
    const at = label.indexOf("@");
    if (at >= 0) { tag = label.slice(at + 1).trim(); label = label.slice(0, at).trim(); }
    return { value, label, tag, status: STATUS_TAGS.has(tag) ? tag : "", icon: STATUS_TAGS.has(tag) ? "" : tag };
  };
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((o) => ({ value: String(o.value == null ? o.label : o.value), label: String(o.label == null ? o.value : o.label), tag: "", status: "", icon: "" }));
    } catch (e) { return []; }
  }
  return s.split(",").map(one).filter(Boolean);
}

/** 节点 → `{name, slots, value, chosen, current, write, toggle}`；写回走 mdio 管道（P 帧回到 MST）。 */
export function makeItem(read, env, b, dataDoc, panel, zone, group) {
  const name = String(read.textOf(b) || "").trim().replace(/:$/, "");
  const slots = {};
  const kids = read.kidsOf([b]).filter((x) => x && x.nt === "b");
  for (const s of kids) slots[String(read.textOf(s) || "").trim()] = String(read.contentValueOf(s) || "").trim();
  // 选择器路径段：章节名含空格 / dot 等特殊字符时用引号（mdio skill「路径」条目）。
  // 例：ANTD."COMPONENTS"."Left column"."Input row".BTN1:pressed
  const q = (s) => /^[A-Za-z0-9_-]+$/.test(String(s)) ? String(s) : '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const addr = (slot) => dataDoc + "::ANTD." + q(panel) + "." + q(zone) + (group ? "." + q(group) : "") + "." + q(name) + ":" + slot;
  const write = (slot, v) => env.exec(JSON.stringify(String(v == null ? "" : v)) + " | /> " + addr(slot) + " -pj ct").catch(() => {});
  const item = {
    name, slots,
    value: slots.value == null ? "" : slots.value,
    chosen: slots.chosen == null ? "" : slots.chosen,
    current: slots.current == null ? "" : slots.current,
    write,
    toggle: () => { const on = toBool(item.value) === true; write("value", on ? "off" : "on"); },
  };
  return item;
}

/** 认领件入口：把「节 → 区(h3) → 组(h4) → 条目(b)」摊平成 name → item。版式留在件里，只读数据。
 *  也兼容「区(h3) 下直接挂条目」的老写法（看板就是这样）：此时组名 = ""。 */
export function panelItems(read, env, node, dataDoc) {
  const panel = String(read.textOf(node) || "").trim();
  const map = new Map();
  const kidsOf = (n) => read.kidsOf([n]).filter((x) => x && typeof x.nt === "string");
  const add = (b, zoneName, groupName) => {
    if (!b || b.nt !== "b") return;
    const it = makeItem(read, env, b, dataDoc, panel, zoneName, groupName);
    if (it.name) map.set(it.name, it);
  };
  for (const zone of kidsOf(node)) {
    if (zone.nt !== "h") continue;
    const zoneName = String(read.textOf(zone) || "").trim();
    for (const child of kidsOf(zone)) {
      if (child.nt === "h") {
        const groupName = String(read.textOf(child) || "").trim();
        for (const b of kidsOf(child)) add(b, zoneName, groupName);
      } else if (child.nt === "b") {
        add(child, zoneName, "");
      }
    }
  }
  const empty = (name) => ({ name, slots: {}, value: "", chosen: "", current: "", write() {}, toggle() {} });
  return { panel, item: (name) => map.get(name) || empty(name), names: Array.from(map.keys()) };
}

/** 图标：名字 → antd icons 组件。 */
export const iconOf = (ICONS, name, style) => (ICONS && name && ICONS[name] ? h(ICONS[name], style ? { style } : null) : null);
```
