# UI_FIELD

## 实现

```jsx@node
import { useMemo, useState } from "react";

// exec 的写地址要带文档路径：当前 doc 指针不是 ui_demos.md，相对地址会报「缺省寻址」
const PICK = [["Wildcard"], ["TYPECHECK", "bullet"]];
const hitList = (read, node) => {
  const r = read.apply([node], PICK);
  return r && !r.gate ? r.hits : [];
};

export default function FieldDemo({ node, snap, exec, read }) {
  const en = typeof window !== "undefined" && window.__teachLang === "en";
  const SEC = "UI_DEMOS." + (en ? "Demos" : "演示") + ".field";
  const SEC_ADDR = "/ui_app/teach/ui_demos" + (en ? ".en" : "") + ".md::" + SEC;
  const SCHEMA = en
    ? [{ key: "Table", list: false }, { key: "Primary key", list: false }, { key: "Index", list: true }, { key: "Note", list: false }]
    : [{ key: "表", list: false }, { key: "主键", list: false }, { key: "索引", list: true }, { key: "说明", list: false }];
  const L = en
    ? { tag: "List field · repeated tag → array · append action", table: "Table", pk: "Primary key: ",
        idxCount: (n) => "Indexes: " + n, filter: "Filter (V-layer state, no fetch)", noMatch: "no matches",
        newIdx: "New index name (written to md)", append: "Append row", other: "Other",
        needName: "enter an index name first", appended: (addr) => "appended to " + addr + " ⇒ frame comes back ⇒ one more row",
        writes: "writes via +> " }
    : { tag: "列表字段 · 同名 tag 多行 · 追加型 action", table: "字段", pk: "主键：",
        idxCount: (n) => "索引 " + n + " 条", filter: "过滤（V 层状态，不取数）", noMatch: "没有匹配项",
        newIdx: "新索引名（写进 md）", append: "追加一行", other: "其它",
        needName: "先写一个索引名", appended: (addr) => "已追加到 " + addr + " ⇒ 帧回来 ⇒ 列表多一行",
        writes: "写用 +> " };
  const [q, setQ] = useState("");
  const [nv, setNv] = useState("");
  const [msg, setMsg] = useState("");
  const F = useMemo(() => {
    const out = { [L.other]: [] };
    const push = (key, val) => {
      const spec = SCHEMA.find((f) => f.key === key);
      if (!spec) { out[L.other].push({ k: key, v: val }); return; }
      if (spec.list) { (out[key] = out[key] || []).push(val); return; }
      out[key] = val;
    };
    for (const n of hitList(read, node)) push(read.textOf(n) || "", read.contentValueOf(n) ?? "");
    return out;
  }, [snap, en]);
  const idx = F[en ? "Index" : "索引"] || [];
  const shown = idx.filter((s) => String(s).toLowerCase().includes(q.toLowerCase()));
  // 换行用 charCode 在运行时造：exec 载荷会多反转义一层
  const LF = String.fromCharCode(10);
  const addIndex = async () => {
    const v = nv.trim();
    if (!v) { setMsg(L.needName); return; }
    try {
      await exec(JSON.stringify("- " + (en ? "Index" : "索引") + ": " + v + LF) + " | +> " + SEC_ADDR);
      setNv(""); setMsg(L.appended(SEC_ADDR));
    } catch (e) { setMsg("failed: " + String((e && e.message) || e).slice(0, 80)); }
  };
  const inputStyle = { background: "transparent", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "7px 12px", color: "var(--c-bone)", fontSize: 13 };
  return (
    <div data-page="fields" style={{ padding: "8px 2px 6px" }}>
      <div style={{ border: "1px solid rgba(245,158,11,.45)", background: "var(--ui-demo-bg)", borderRadius: 20, padding: "24px 26px" }}>
        <div style={{ display: "inline-block", marginBottom: 10, borderRadius: 999, padding: "2px 10px", fontSize: 11, letterSpacing: ".06em", background: "#f59e0b", color: "#fff" }}>{L.tag}</div>
        <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 650, lineHeight: 1.3, color: "var(--c-bone)" }}>{F[en ? "Table" : "表"] || L.table}</h3>
        <div style={{ marginBottom: 10, fontSize: 13, color: "var(--c-ash)" }}>{L.pk}<span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{F[en ? "Primary key" : "主键"]}</span> · {L.idxCount(idx.length)}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.filter} style={{ ...inputStyle, display: "block", width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((s) => (
            <div key={s} style={{ border: "1px solid var(--ui-demo-bd)", borderRadius: 12, padding: "9px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: "var(--c-ash)" }}>{s}</div>
          ))}
          {shown.length === 0 && <div style={{ fontSize: 12, color: "var(--c-slate)" }}>{L.noMatch}</div>}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <input value={nv} onChange={(e) => setNv(e.target.value)} placeholder={L.newIdx} style={{ ...inputStyle, flex: 1 }} />
          <button style={{ background: "#f59e0b", color: "#fff", border: 0, borderRadius: 10, padding: "7px 15px", fontSize: 13, cursor: "pointer" }} onClick={addIndex}>{L.append}</button>
        </div>
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "var(--c-slate)" }}>{msg || (L.writes + SEC_ADDR)}</div>
      </div>
    </div>
  );
}
```
