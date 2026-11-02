# app

```jsx@app
import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { types, getEnv } from "mobx-state-tree";
import { observable } from "mobx";
import { Composer } from "@app/COMPOSER";

// ===== HISTORY CORE BEGIN =====
// history core (pure, no React/MST imports)
function hcKids(node) {
  if (!node) return [];
  if (Array.isArray(node.kids)) return node.kids;
  if (Array.isArray(node.ct)) return node.ct;
  return [];
}
function hcText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(hcText).join("");
  if (typeof value !== "object") return String(value);
  if (typeof value.ct === "string") return value.ct;
  if (Array.isArray(value.ct)) return value.ct.map(hcText).join("");
  if (typeof value.t === "string") return value.t;
  if (Array.isArray(value.t)) return value.t.map(hcText).join("");
  if (typeof value.cd === "string") return value.cd;
  return "";
}
function hcTag(node) {
  if (!node) return "";
  const t = hcText(node.t);
  return t;
}
function hcMark(node) {
  if (!node) return "";
  return String(node.mark == null ? "" : node.mark).trim();
}
function hcValueOfBullet(node) {
  const kids = hcKids(node);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k && k.nt === "p") return hcText(k);
  }
  return hcText(node);
}
function hcIsIdBullet(node) { return node && node.nt === "b" && hcTag(node) === "id"; }
function hcBulletList(node) {
  const out = [];
  const kids = hcKids(node);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k) continue;
    if (k.nt === "bl" || k.nt === "od") {
      const items = hcKids(k);
      for (let j = 0; j < items.length; j++) {
        const b = items[j];
        if (b && (b.nt === "b" || b.nt === "ol" || b.nt === "x")) out.push(b);
      }
    }
  }
  return out;
}
function hcDirectHeadings(node) {
  const out = [];
  const kids = hcKids(node);
  for (let i = 0; i < kids.length; i++) {
    if (kids[i] && kids[i].nt === "h") out.push(kids[i]);
  }
  return out;
}
function hcFindHisNode(doc) {
  if (!doc) return null;
  function walk(node) {
    const kids = hcKids(node);
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (!k) continue;
      if (k.nt === "h" && hcTag(k) === "HIS") return k;
      const found = walk(k);
      if (found) return found;
    }
    return null;
  }
  if (doc.nt === "h" && hcTag(doc) === "HIS") return doc;
  return walk(doc);
}
function hcHeadingName(node) { return hcTag(node); }
function hcControlOfBullet(b) {
  const mark = hcMark(b);
  const c = { node: b, tag: hcTag(b), mark, type: "", next: 0, path: "", summaryNodes: [] };
  const kids = hcKids(b);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k) continue;
    if (k.nt === "bl") {
      const fields = hcKids(k);
      for (let j = 0; j < fields.length; j++) {
        const f = fields[j];
        if (!f || f.nt !== "b") continue;
        const tag = hcTag(f);
        const val = hcValueOfBullet(f);
        if (tag === "type") c.type = val.trim();
        else if (tag === "next") c.next = Number(val.trim()) || 0;
        else if (tag === "path") c.path = val.trim();
      }
    } else if (k.nt === "bq") {
      c.summaryNodes = hcKids(k);
    }
  }
  if (!c.type) return null;
  if (!c.mark) c.mark = (c.type === "branch" || c.type === "join") ? "+" : "*";
  return c;
}
function hcRecordMeta(node) {
  const meta = { node, role: hcTag(node), fields: {}, controls: [] };
  const kids = hcKids(node);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k || k.nt !== "bl") continue;
    const items = hcKids(k);
    for (let j = 0; j < items.length; j++) {
      const b = items[j];
      if (!b || b.nt !== "b") continue;
      const c = hcControlOfBullet(b);
      if (c) { meta.controls.push(c); continue; }
      const tag = hcTag(b);
      if (tag === "name" || tag === "id" || tag === "tool" || tag === "status") {
        meta.fields[tag] = hcValueOfBullet(b).trim();
      }
    }
  }
  return meta;
}
function hcRecordSnippet(node) {
  const kids = hcKids(node);
  let out = "";
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k) continue;
    if (k.nt === "bq") out += hcText(k);
  }
  return out.replace(/\s+/g, " ").trim();
}
function hcBuildBaseIndex(hisNode) {
  const index = { hisNode, headings: [], byKey: {}, main: null, branches: [] };
  if (!hisNode) return index;
  const top = hcDirectHeadings(hisNode);
  function visit(h, key, parentKey, level, kind) {
    const name = hcHeadingName(h);
    const entry = { key, name, parentKey, level, kind, label: "", records: [], count: 0, node: h };
    const bullets = hcBulletList(h);
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b) continue;
      if (hcControlOfBullet(b)) continue;
      entry.records.push(b);
    }
    entry.count = entry.records.length;
    index.headings.push(entry);
    index.byKey[key] = entry;
    if (kind === "main" && !index.main) index.main = entry;
    if (kind === "branch" && level === 1) index.branches.push(entry);
    const nested = hcDirectHeadings(h);
    for (let i = 0; i < nested.length; i++) {
      const nh = nested[i];
      const nkey = key + "." + hcHeadingName(nh);
      visit(nh, nkey, key, level + 1, "branch");
    }
  }
  for (let i = 0; i < top.length; i++) {
    const h = top[i];
    const name = hcHeadingName(h);
    if (name === "main") visit(h, "main", "", 1, "main");
    else visit(h, name, "", 1, "branch");
  }
  return index;
}
function hcSeg(entry, from, to, kind, label) {
  return { headingKey: entry.key, from, to, count: Math.max(0, to - from), kind: kind || entry.kind, label: label || entry.label || "" };
}
function hcMachineSeg(entry) { return hcSeg(entry, 0, entry.count, entry.kind, entry.label); }
function hcWalkSubtree(index, entry, out) {
  out.push(entry);
  for (let i = 0; i < index.headings.length; i++) {
    const h = index.headings[i];
    if (h.parentKey === entry.key) hcWalkSubtree(index, h, out);
  }
  return out;
}
function hcFindDirection(index, wl) {
  const w = String(wl || "").trim();
  if (!w || !index || !index.hisNode) return null;
  const all = index.headings;
  for (let hi = 0; hi < all.length; hi++) {
    const h = all[hi];
    for (let i = 0; i < h.records.length; i++) {
      const meta = hcRecordMeta(h.records[i]);
      for (let j = 0; j < meta.controls.length; j++) {
        const c = meta.controls[j];
        if (c.tag === w) return { heading: h, index: i, record: h.records[i], control: c };
      }
    }
  }
  return null;
}
function hcResolveTarget(index, path) {
  if (!index || !path) return null;
  let p = String(path).trim();
  const cut = p.indexOf("::");
  if (cut >= 0) p = p.slice(cut + 2);
  // 门的 path 可能是 $current_path.md::..*HIS.b_x 或 /doc.md::HIS.b_x；星号/点前缀与 HIS
  // 前缀都要剥掉，否则 hcResolveTarget 找不到目标，view 会退回 main（切了线仍显示旧线）。
  p = p.replace(/\*/g, "").replace(/^\.+/, "").replace(/^HIS\.?/, "").replace(/^\.*/, "");
  const parts = p.split(".").filter(Boolean);
  if (!parts.length) return null;
  let key = parts[0];
  let entry = index.byKey[key] || null;
  for (let i = 1; entry && i < parts.length; i++) key = key + "." + parts[i], entry = index.byKey[key] || null;
  return entry;
}
function hcWorldlines(index) {
  // 世界线菜单：wl = gate tag；label = gate tag · 目标 branch 地址。
  // branch 只是 path 目标；branch id 概念已删除，不参与 wl。
  const out = [{ wl: "", label: "主时间线", target: "main", gate: "", targetCount: index && index.main ? index.main.count : 0 }];
  if (!index) return out;
  const seen = {};
  for (let hi = 0; hi < index.headings.length; hi++) {
    const h = index.headings[hi];
    for (let ri = 0; ri < h.records.length; ri++) {
      const meta = hcRecordMeta(h.records[ri]);
      for (let ci = 0; ci < meta.controls.length; ci++) {
        const c = meta.controls[ci];
        if (c.type !== "branch" && c.type !== "join") continue;
        const target = hcResolveTarget(index, c.path);
        const targetName = target ? target.name : "";
        if (!targetName) continue;
        const key = c.tag + "|" + targetName;
        if (seen[key]) continue;
        seen[key] = true;
        const src = h.records[ri] || null;
        const srcMeta = src ? hcRecordMeta(src) : { role: "" };
        const tRecs = target ? target.records : [];
        const first = tRecs.length ? tRecs[0] : null;
        const last = tRecs.length ? tRecs[tRecs.length - 1] : null;
        out.push({
          wl: c.tag, label: c.tag + " · " + targetName, target: targetName,
          targetKey: target ? target.key : "", sourceKey: h.key, gate: c.tag, type: c.type,
          sourceRole: srcMeta.role || "", sourceText: src ? hcRecordSnippet(src) : "",
          targetCount: target ? target.count : 0,
          firstRole: first ? hcRecordMeta(first).role : "",
          firstText: first ? hcRecordSnippet(first) : "",
          lastRole: last ? hcRecordMeta(last).role : "",
          lastText: last ? hcRecordSnippet(last) : ""
        });
      }
    }
  }
  return out;
}
function hcEdgeMarkers(index) {
  const out = [];
  if (!index) return out;
  for (let hi = 0; hi < index.headings.length; hi++) {
    const h = index.headings[hi];
    for (let ri = 0; ri < h.records.length; ri++) {
      const rec = h.records[ri];
      const meta = hcRecordMeta(rec);
      for (let ci = 0; ci < meta.controls.length; ci++) {
        const c = meta.controls[ci];
        if (c.type !== "compact" && c.type !== "prune") continue;
        out.push({
          key: h.key + "|" + ri + "|" + ci, headingKey: h.key, headingName: h.name,
          kind: c.type, label: c.tag, next: c.next, role: meta.role,
          text: hcRecordSnippet(rec), index: ri
        });
      }
    }
  }
  return out;
}
function hcWlOpen(label, wl) {
  const w = String(wl || "").trim();
  const lab = String(label || "").trim();
  if (!w || !lab) return false;
  return lab === w || w.indexOf(lab + "_") === 0;
}
function hcSelectView(index, wl) {
  // 与 arrow_handoff.walk 的 branch/join 部分同语义：祖先前缀开集（子线自动打开祖先门），branch 甩尾，
  // join 压栈后回到 main 尾部；compact/prune 只影响 marker 展示（后续再做归约）。
  const out = { currentWL: String(wl || ""), segments: [], totalCount: 0 };
  if (!index || !index.main) return out;
  const w = String(wl || "").trim();
  const trace = [];
  if (!w) {
    const main = index.main;
    for (let i = 0; i < main.count; i++) trace.push({ key: "main", index: i });
  } else {
    const frames = [{ key: "main", idx: 0, alive: true }];
    let matched = false;
    let guard = 0;
    while (frames.length) {
      guard += 1;
      if (guard > 200000) break;
      const fr = frames[frames.length - 1];
      const entry = index.byKey[fr.key];
      const recs = entry ? entry.records : [];
      if (!fr.alive || fr.idx >= recs.length) { frames.pop(); continue; }
      const meta = hcRecordMeta(recs[fr.idx]);
      let moved = false;
      for (let ci = 0; ci < meta.controls.length; ci++) {
        const c = meta.controls[ci];
        if (!hcWlOpen(c.tag, w)) continue;
        if (c.type !== "branch" && c.type !== "join") continue;
        const target = hcResolveTarget(index, c.path);
        if (!target) continue;
        if (c.type === "branch") fr.alive = false;
        else fr.idx += 1;
        frames.push({ key: target.key, idx: 0, alive: true });
        matched = true;
        moved = true;
        break;
      }
      if (moved) continue;
      trace.push({ key: fr.key, index: fr.idx });
      fr.idx += 1;
    }
    // 无命中的 wl = 基线（与后端空开集一致）；命中但目标为空则保持空
    if (!matched && !trace.length) {
      const main = index.main;
      for (let i = 0; i < main.count; i++) trace.push({ key: "main", index: i });
    }
  }
  // 把 trace 压成连续段；join 回跳后同一 heading 可能出现不连续索引，必须拆段。
  let cur = null;
  function flush() {
    if (!cur) return;
    const entry = index.byKey[cur.key];
    if (entry) {
      const seg = hcSeg(entry, cur.from, cur.to, entry.kind, "");
      if (seg.count > 0) out.segments.push(seg);
    }
    cur = null;
  }
  for (let i = 0; i < trace.length; i++) {
    const t = trace[i];
    if (cur && cur.key === t.key && t.index === cur.to) { cur.to += 1; continue; }
    flush();
    cur = { key: t.key, from: t.index, to: t.index + 1 };
  }
  flush();
  out.totalCount = out.segments.reduce(function (n, s) { return n + s.count; }, 0);
  return out;
}
// 编辑落点：view seq → (段, 段内记录下标) → 可建线的父 wl。
// 与后端一致：branch 门挂在 host 记录上，walk 读到门时甩掉当前段（host 不进子线消息），
// 所以“编辑第 seq 条”= 在该记录处开新线，把编辑后的消息写进新线；旧线保留原记录。
function hcViewRecordAt(view, seq) {
  const n = Number(seq);
  if (!view || !Array.isArray(view.segments) || !Number.isFinite(n) || n < 0) return null;
  let pos = 0;
  for (let i = 0; i < view.segments.length; i++) {
    const s = view.segments[i];
    if (n < pos + s.count) return { headingKey: s.headingKey, localIndex: s.from + (n - pos) };
    pos += s.count;
  }
  return null;
}
function hcSectionLine(branches, currentWL, headingKey) {
  if (headingKey === "main") return { wl: "" };
  const cur = String(currentWL || "");
  let best = null;
  for (let i = 0; i < (branches || []).length; i++) {
    const b = branches[i];
    if (!b || b.type !== "branch") continue;   // join 段的写目标不一定是该段，不拿来做 host
    if (String(b.targetKey || "") !== String(headingKey)) continue;
    const wl = String(b.wl || "");
    if (!hcWlOpen(wl, cur)) continue;
    if (!best || wl.length > String(best.wl || "").length) best = { wl: wl };
  }
  return best;
}
function hcNewChildWl(parentWl, taken) {
  const prefix = parentWl ? parentWl + "_e" : "e";
  for (let i = 0; i < 16; i++) {
    const t = Math.random().toString(16).slice(2, 10);
    if (t.length === 8 && !taken[prefix + t]) return prefix + t;
  }
  return prefix + Date.now().toString(16);
}
function hcEditPlan(index, view, branches, currentWL, seq) {
  const hit = hcViewRecordAt(view, seq);
  if (!hit) return { error: "找不到要编辑的消息（视图已变化，请重试）" };
  const entry = index && index.byKey ? index.byKey[hit.headingKey] : null;
  if (!entry) return { error: "消息所在的段不存在" };
  const rec = entry.records[hit.localIndex];
  if (!rec) return { error: "找不到要编辑的记录" };
  const meta = hcRecordMeta(rec);
  if (meta.role !== "user") return { error: "只能编辑 user 消息" };
  const line = hcSectionLine(branches, currentWL, hit.headingKey);
  if (!line) return { error: "这条消息属于汇入/不可建线段，暂不支持编辑" };
  const taken = {};
  for (let i = 0; i < (branches || []).length; i++) taken[String(branches[i].wl || "")] = true;
  return { parentWl: line.wl, wl: hcNewChildWl(line.wl, taken), headingKey: hit.headingKey, localIndex: hit.localIndex };
}
function hcWindowView(view, spec) {
  const v = view || { segments: [], totalCount: 0 };
  const total = v.segments.reduce(function (n, s) { return n + s.count; }, 0);
  const sp = spec || {};
  let start = 0, end = total;
  if (sp.tail != null) { const n = Math.max(0, Math.min(total, Number(sp.tail) || 0)); start = total - n; }
  else if (sp.start != null || sp.end != null) {
    start = Math.max(0, Number(sp.start) || 0);
    end = Math.max(start, Number(sp.end != null ? sp.end : total) || 0);
    if (end > total) end = total;
  }
  if (start <= 0 && end >= total) return { segments: v.segments.map(function (s) { return s; }), startRecord: 0, endRecord: total, totalCount: total };
  const segments = [];
  let pos = 0;
  for (let i = 0; i < v.segments.length; i++) {
    const s = v.segments[i];
    const a = pos, b = pos + s.count;
    const from = Math.max(a, start), to = Math.min(b, end);
    if (to > from) segments.push({ headingKey: s.headingKey, from: s.from + (from - a), to: s.from + (to - a), count: to - from, kind: s.kind, label: s.label });
    pos = b;
  }
  return { segments, startRecord: start, endRecord: end, totalCount: total };
}
function hcBuildRenderView(win, index, opts) {
  const rows = [];
  if (!win || !win.segments) return { rows, startRecord: 0, endRecord: 0 };
  let group = null;
  function flush() {
    if (group) { rows.push(group); group = null; }
  }
  function pushRecord(seg, localIndex, record, meta, seq) {
    for (let ci = 0; ci < meta.controls.length; ci++) {
      const c = meta.controls[ci];
      rows.push({ kind: "marker", subtype: c.type, mark: c.mark, tag: c.tag, controlNode: c.node, recordNode: record, summaryNodes: c.summaryNodes || [], key: "marker:" + seg.headingKey + ":" + localIndex + ":" + ci, headingKey: seg.headingKey, seq: seq });
    }
    if (meta.role === "tool_call" || meta.role === "tool_result") {
      if (!group) group = { kind: "tools", key: "tools:" + seg.headingKey + ":" + localIndex, calls: [] };
      if (meta.role === "tool_call") group.calls.push({ callNode: record, resultNode: null, id: meta.fields.id || "" });
      else {
        const last = group.calls.length ? group.calls[group.calls.length - 1] : null;
        const myId = meta.fields.id || "";
        if (last && !last.resultNode && (!last.id || !myId || last.id === myId)) last.resultNode = record;
        else group.calls.push({ callNode: null, resultNode: record, id: myId });
      }
      return;
    }
    flush();
    rows.push({ kind: meta.role, key: seg.headingKey + ":" + localIndex, recordNode: record, headingKey: seg.headingKey, seq: seq });
  }
  // seq 是 view 的全量序号（不是窗口内序号）：编辑/分叉按它定位，窗口只影响渲染范围。
  let recordSeq = Number(win.startRecord || 0) || 0;
  for (let si = 0; si < win.segments.length; si++) {
    const seg = win.segments[si];
    const entry = index.byKey[seg.headingKey];
    if (!entry) continue;
    for (let i = seg.from; i < seg.to; i++) {
      const record = entry.records[i];
      if (!record) continue;
      const meta = hcRecordMeta(record);
      pushRecord(seg, i, record, meta, recordSeq);
      recordSeq += 1;
    }
  }
  flush();
  return { rows, startRecord: win.startRecord, endRecord: win.endRecord };
}
// ===== HISTORY CORE END =====

// 店只装会话面状态；消息不是店的副本 —— 消息永远从活树来（HIS 认领件自己读节点）。
export const Store = types
  .model("ChatStore", {
    sid: types.optional(types.string, ""),
    route: types.optional(types.string, "/"),
    docId: types.optional(types.number, 0),
    busy: types.optional(types.boolean, false),
    slow: types.optional(types.boolean, false),
    railOpen: types.optional(types.boolean, false),
    err: types.optional(types.string, ""),
    ready: types.optional(types.boolean, false),
    alias: types.optional(types.string, ""),
    currentWL: types.optional(types.string, ""),
    windowSpec: types.optional(types.frozen(), { tail: 50 }),
    renderOpts: types.optional(types.frozen(), {}),
  })
  .volatile(() => ({
    sessionsBox: observable.box([], { deep: false }),
  }))
  .views((self) => ({
    get sessions() { return self.sessionsBox.get(); },
    get cur() { return self.sessions.find((s) => s.sid === self.sid) || null; },
    get hisNode() {
      const env = getEnv(self) || {};
      const client = env.client;
      if (!client || !self.docId) return null;
      try { return hcFindHisNode(client.md(self.docId)); } catch (e) { return null; }
    },
    get baseIndex() { return hcBuildBaseIndex(self.hisNode); },
    get branches() { return hcWorldlines(self.baseIndex); },
    get edgeMarkers() { return hcEdgeMarkers(self.baseIndex); },
    get view() { return hcSelectView(self.baseIndex, self.currentWL); },
    get viewWindow() { return hcWindowView(self.view, self.windowSpec); },
    get renderView() { return hcBuildRenderView(self.viewWindow, self.baseIndex, self.renderOpts); },
  }))
  .actions((self) => ({
    setSessions(v) { self.sessionsBox.set(v); },
    setSid(v) { self.sid = String(v || ""); },
    setRoute(v) { self.route = String(v || "/"); },
    setDocId(v) { self.docId = Number(v) || 0; },
    setBusy(v) { self.busy = !!v; },
    setSlow(v) { self.slow = !!v; },
    setRailOpen(v) { self.railOpen = !!v; },
    setErr(v) { self.err = String(v || ""); },
    setReady(v) { self.ready = !!v; },
    setAlias(v) { self.alias = String(v || ""); },
    setCurrentWL(v) { self.currentWL = String(v || ""); },
    setWindowSpec(v) { self.windowSpec = v || { tail: 50 }; },
    setRenderOpts(v) { self.renderOpts = v || {}; },
  }));



function kidsOf(node) {
  if (!node) return [];
  if (Array.isArray(node.ct)) return node.ct;
  if (Array.isArray(node.kids)) return node.kids;
  return [];
}

// 文档已到但 HIS 还没有记录 ⇒ 走欢迎空态（记录数从活树读，不维护副本）。
function hasHisRecords(root) {
  const kids = kidsOf(root);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k || k.nt !== "h" || String(k.t || "") !== "HIS") continue;
    const l1 = kidsOf(k);
    for (let a = 0; a < l1.length; a++) {
      const m = l1[a];
      if (!m || m.nt !== "h" || String(m.t || "") !== "main") continue;
      const l2 = kidsOf(m);
      for (let b = 0; b < l2.length; b++) {
        const bl = l2[b];
        if (bl && bl.nt === "bl" && kidsOf(bl).length > 0) return true;
      }
    }
  }
  return false;
}

const WELCOME_SUGGESTIONS = [
  "用 mdio 读一下 /app.md 的标题结构",
  "把这个工作树里最近的改动总结成三条",
  "解释 /README.md 里说的三件事",
];

function EmptyState({ onSend }) {
  return (
    <div className="chat-empty">
      <div className="chat-empty-mark" />
      <h2>我们在做什么？</h2>
      <p>发一条消息开始 —— 每条提问都会写进这个会话的 HIS。</p>
      <div className="chat-empty-chips">
        {WELCOME_SUGGESTIONS.map(function (s) {
          return <button key={s} type="button" className="chat-chip" onClick={function () { onSend(s); }}>{s}</button>;
        })}
      </div>
    </div>
  );
}

function TimelineMapSvg({ branches, current, onPick, onClose }) {
  const [sel, setSel] = useState(null);
  const entries = (Array.isArray(branches) ? branches : []).slice();
  const byWl = {};
  const byTarget = {};
  entries.forEach(function (b) { byWl[b.wl || ""] = b; if (b.targetKey) byTarget[b.targetKey] = b; });
  const parent = {};
  entries.forEach(function (b) {
    const k = b.wl || "";
    if (!k) return;
    const p = b.sourceKey ? byTarget[b.sourceKey] : null;
    parent[k] = p ? (p.wl || "") : "";
  });
  const keyId = function (wl) { return "k:" + (wl || ""); };
  const intId = function (wl) { return "i:" + (wl || ""); };
  const rootEntry = byWl[""] || { wl: "", label: "主时间线", target: "main", targetCount: 0 };
  const reg = {};
  reg[keyId("")] = { id: keyId(""), kind: "key", wl: "", entry: rootEntry, role: "", text: "", count: rootEntry.targetCount || 0 };
  entries.forEach(function (b) {
    const wl = b.wl || "";
    if (!wl) return;
    const p = parent[wl] || "";
    reg[keyId(wl)] = {
      id: keyId(wl), kind: "key", wl: wl, parent: keyId(p), entry: b,
      role: b.sourceRole || "", text: b.sourceText || "", count: b.targetCount || 0
    };
    reg[intId(wl)] = {
      id: intId(wl), kind: "interval", wl: wl, parent: keyId(wl), entry: b, count: b.targetCount || 0
    };
  });
  const children = {};
  Object.keys(reg).forEach(function (id) {
    const n = reg[id];
    if (!n.parent) return;
    (children[n.parent] = children[n.parent] || []).push(id);
  });
  let cursor = 0;
  let maxDepth = 0;
  const pos = {};
  function layout(id, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children[id] || [];
    if (!kids.length) {
      pos[id] = { x: cursor, y: depth };
      cursor += 1;
      return pos[id].x;
    }
    const xs = kids.map(function (c) { return layout(c, depth + 1); });
    const x = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    pos[id] = { x: x, y: depth };
    return x;
  }
  layout(keyId(""), 0);
  const cols = Math.max(1, cursor);
  const rowH = 108;
  const colW = 196;
  const width = Math.max(480, cols * colW + 80);
  const height = Math.max(260, (maxDepth + 1) * rowH + 80);
  function px(id) { return 40 + ((pos[id] || { x: 0 }).x) * colW; }
  function py(id) { return height - 40 - ((pos[id] || { y: 0 }).y) * rowH; }
  function dims(n) { return n.kind === "interval" ? [96, 30] : [156, 48]; }
  function snippet(s, n) { const v = String(s || "").replace(/\s+/g, " ").trim(); return v.length > n ? v.slice(0, n - 1) + "…" : v; }
  const cur = String(current || "");
  const edges = [];
  Object.keys(reg).forEach(function (id) {
    const n = reg[id];
    if (n.parent) edges.push({ from: n.parent, to: id });
  });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ width: "min(860px, 95vw)", maxHeight: "88vh", overflow: "auto", background: "var(--chat-bg)", border: "1px solid var(--chat-border-strong)", borderRadius: 16, padding: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>世界线</div>
          <span className="text-[11px] opacity-45">虚拟视图：卡片 = 关键消息，小卡 = 区间统计；不逐条列消息</span>
          <button type="button" className="chat-btn" style={{ marginLeft: "auto" }} onClick={onClose}>关闭</button>
        </div>
        <div className="text-[11px] opacity-55" style={{ marginBottom: 8 }}>当前：{cur || "主时间线"} · 点卡片切换；悬停看区间/首末</div>
        <svg width="100%" viewBox={"0 0 " + width + " " + height} style={{ display: "block", overflow: "visible" }}>
          {edges.map(function (e, i) {
            const a = reg[e.from], b = reg[e.to];
            const aw = dims(a)[0], bw = dims(b)[0];
            const ah = dims(a)[1], bh = dims(b)[1];
            const x1 = px(e.from), y1 = py(e.from) + ah / 2, x2 = px(e.to), y2 = py(e.to) - bh / 2;
            const my = (y1 + y2) / 2;
            return <path key={"e" + i} d={"M " + x1 + " " + y1 + " C " + x1 + " " + my + ", " + x2 + " " + my + ", " + x2 + " " + y2} fill="none" stroke="var(--chat-border-strong)" strokeWidth="1.2" />;
          })}
          {Object.keys(reg).map(function (id) {
            const n = reg[id];
            const x = px(id), y = py(id);
            const on = (n.wl || "") === cur;
            if (n.kind === "interval") {
              const w = 96, h = 30;
              return (
                <g key={id} style={{ cursor: "pointer" }} onMouseEnter={function () { setSel(n); }} onClick={function (e) { e.stopPropagation(); if (!on) onPick(n.wl); }}>
                  <title>{n.entry.type === "join" ? "汇入区间" : "分支区间"}: {n.entry.target || ""} · {"+" + (n.count || 0) + " 条"}</title>
                  <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={15} fill="transparent" stroke="var(--chat-border-strong)" strokeDasharray="4 3" />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="var(--chat-muted-fg)">{"+" + (n.count || 0) + " 条"}</text>
                </g>
              );
            }
            const w = 156, h = 48;
            const isRoot = !n.wl;
            return (
              <g key={id} style={{ cursor: "pointer" }} onMouseEnter={function () { setSel(n); }} onClick={function (e) { e.stopPropagation(); if (on) onClose(); else onPick(isRoot ? "" : n.wl); }}>
                <title>{isRoot ? "主时间线" : (n.role || "message") + "「" + n.text + "」"}</title>
                <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={9} fill={on ? "color-mix(in oklab, var(--chat-live) 18%, var(--chat-bg))" : "var(--chat-card)"} stroke={on ? "var(--chat-live)" : "var(--chat-border-strong)"} strokeWidth={on ? 2 : 1} />
                <text x={x - w / 2 + 10} y={y - 8} fontSize="9" fill="var(--chat-muted-fg)" opacity="0.8">{isRoot ? "主时间线" : (n.role || "message")}</text>
                <text x={x - w / 2 + 10} y={y + 8} fontSize="10" fill="var(--chat-fg)">{isRoot ? ((n.count || 0) + " 条消息") : snippet(n.text, 16)}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--chat-border)", minHeight: 62 }}>
          {sel ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                {sel.kind === "interval" ? "区间卡片" : (!sel.wl ? "根节点" : ((sel.entry && sel.entry.type === "join") ? "汇入节点" : "分叉节点"))}
                {sel.kind === "interval" ? " · +" + (sel.count || 0) + " 条" : (sel.role ? " · " + sel.role + "「" + (sel.text || "") + "」" : "")}
              </div>
              <div className="text-[11px] opacity-55">
                {sel.kind === "interval"
                  ? "目标：" + ((sel.entry && sel.entry.target) || "") + " · 首 " + ((sel.entry && sel.entry.firstRole) || "") + "「" + ((sel.entry && sel.entry.firstText) || "").slice(0, 24) + "」 · 末 " + ((sel.entry && sel.entry.lastRole) || "") + "「" + ((sel.entry && sel.entry.lastText) || "").slice(0, 24) + "」"
                  : "后续区间：" + ((sel.entry && sel.entry.target) || "") + " · " + ((sel.entry && sel.entry.targetCount) || 0) + " 条"}
              </div>
            </div>
          ) : (
            <div className="text-[11px] opacity-45">悬停卡片查看：关键消息角色/内容，或区间条数与首末</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineMapLoading({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "var(--chat-bg)", border: "1px solid var(--chat-border-strong)", borderRadius: 16, padding: 20, fontSize: 13 }}>
        世界线加载中…
        <button type="button" className="chat-btn" style={{ marginLeft: 12 }} onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

function ReactFlowTimelineMapLegacy({ rf, branches, current, onPick, onClose }) {
  const [sel, setSel] = useState(null);
  const RF = rf.ReactFlow;
  const RFBackground = rf.Background;
  const RFControls = rf.Controls;
  const RFMiniMap = rf.MiniMap;
  const RFVariant = rf.BackgroundVariant;
  useEffect(function () {
    try {
      const host = document.getElementById("app");
      const root = host && host.shadowRoot ? host.shadowRoot : document.head;
      if (root && !root.querySelector("link[data-rf-style]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/@xyflow/react@12.8.2/dist/style.css";
        link.setAttribute("data-rf-style", "1");
        root.appendChild(link);
      }
    } catch (e) { /* ignore */ }
  }, []);
  const nodeTypes = useMemo(function () {
    const RFHandle = rf.Handle;
    const RFPosition = rf.Position;
    function MessageNode(props) {
      const d = props.data || {};
      return (
        <div style={{ width: 168, minHeight: 52, padding: "7px 10px", boxSizing: "border-box", background: "var(--chat-card)", border: "1px solid " + (d.current ? "var(--chat-live)" : "var(--chat-border-strong)"), borderRadius: 10, boxShadow: d.current ? "inset 0 0 0 1px var(--chat-live)" : "none" }}>
          <RFHandle type="target" position={RFPosition.Top} />
          <div style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", opacity: .55 }}>{d.role || "timeline"}</div>
          <div style={{ fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.text}</div>
          <div style={{ fontSize: 9, opacity: .45, marginTop: 3 }}>{d.sub || ""}</div>
          <RFHandle type="source" position={RFPosition.Bottom} />
        </div>
      );
    }
    function IntervalNode(props) {
      const d = props.data || {};
      return (
        <div style={{ width: 92, height: 30, border: "1px dashed var(--chat-border-strong)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--chat-muted-fg)" }}>
          <RFHandle type="target" position={RFPosition.Top} />
          +{d.count || 0} 条
          <RFHandle type="source" position={RFPosition.Bottom} />
        </div>
      );
    }
    return { msg: MessageNode, interval: IntervalNode };
  }, [rf]);
  const built = useMemo(function () {
    const entries = (Array.isArray(branches) ? branches : []).slice();
    const byWl = {}; const byTarget = {};
    entries.forEach(function (b) { byWl[b.wl || ""] = b; if (b.targetKey) byTarget[b.targetKey] = b; });
    const parent = {};
    entries.forEach(function (b) {
      const k = b.wl || "";
      if (!k) return;
      const t = b.sourceKey ? byTarget[b.sourceKey] : null;
      parent[k] = t ? (t.wl || "") : "";
    });
    const kids = {};
    entries.forEach(function (b) {
      const k = b.wl || "";
      if (!k) return;
      const par = parent[k] || "";
      (kids[par] = kids[par] || []).push(k);
    });
    let cursor = 0; let maxDepth = 0; const pos = {};
    function layout(id, depth) {
      maxDepth = Math.max(maxDepth, depth);
      const cs = kids[id] || [];
      let x;
      if (!cs.length) { x = cursor++; }
      else { const xs = cs.map(function (c) { return layout(c, depth + 1); }); x = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2; }
      pos[id] = { x: x, y: depth };
      return x;
    }
    layout("", 0);
    const nodes = []; const edges = [];
    const rootEntry = byWl[""] || { targetCount: 0 };
    nodes.push({
      id: "msg:main", type: "msg", position: { x: (pos[""] ? pos[""].x : 0) * 260, y: (pos[""] ? pos[""].y : 0) * 190 },
      data: { role: "timeline", text: "主时间线", sub: (rootEntry.targetCount || 0) + " 条消息", current: String(current || "") === "", wl: "" }
    });
    entries.forEach(function (b) {
      const wl = b.wl || "";
      if (!wl) return;
      const p = parent[wl] || "";
      const pp = pos[wl] || { x: 0, y: 1 };
      nodes.push({
        id: "msg:" + wl, type: "msg", position: { x: pp.x * 260, y: pp.y * 190 },
        data: { role: b.sourceRole || "message", text: b.sourceText || b.label || wl, sub: "关键消息", current: String(wl) === String(current || ""), wl: wl }
      });
      edges.push({ id: "e-" + wl, source: "msg:" + (p || "main"), target: "msg:" + wl, type: "smoothstep", style: { stroke: "var(--chat-border-strong)", strokeWidth: 1.2 } });
      nodes.push({
        id: "int:" + wl, type: "interval", position: { x: pp.x * 260, y: pp.y * 190 + 88 },
        data: { count: b.targetCount || 0 }
      });
      edges.push({ id: "ei-" + wl, source: "msg:" + wl, target: "int:" + wl, type: "straight", style: { stroke: "var(--chat-border-strong)", strokeWidth: 1, strokeDasharray: "3 3" } });
    });
    return { nodes: nodes, edges: edges };
  }, [branches, current]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ width: "min(1060px, 96vw)", maxHeight: "90vh", overflow: "auto", background: "var(--chat-bg)", border: "1px solid var(--chat-border-strong)", borderRadius: 16, padding: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>世界线</div>
          <span className="text-[11px] opacity-45">React Flow · 卡片=关键消息，虚线卡=区间统计</span>
          <button type="button" className="chat-btn" style={{ marginLeft: "auto" }} onClick={onClose}>关闭</button>
        </div>
        <div className="tl-flow" style={{ height: 540, border: "1px solid var(--chat-border)", borderRadius: 12, overflow: "hidden", background: "var(--chat-bg)" }}>
          <RF nodes={built.nodes} edges={built.edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.14, maxZoom: 0.95 }} minZoom={0.2} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} panOnScroll onNodeClick={function (e, n) { setSel(n); }} onNodeDoubleClick={function (e, n) { if (n.data && !n.data.current && n.data.wl != null) onPick(n.data.wl); }}>
            <RFBackground variant={RFVariant.Dots} gap={20} size={1} color="#34353a" />
            <RFControls />
            <RFMiniMap pannable zoomable nodeColor="#3a3b3e" maskColor="rgba(0,0,0,.35)" />
          </RF>
        </div>
        <div style={{ marginTop: 8, minHeight: 44, fontSize: 11, color: "var(--chat-muted-fg)" }}>
          {sel ? (
            <span>
              {sel.type === "msg" ? ((sel.data.role || "timeline") + "「" + (sel.data.text || "") + "」") : ("区间 · +" + (sel.data.count || 0) + " 条")}
              {sel.type === "msg" && sel.data.wl && !sel.data.current ? <button type="button" className="chat-btn" style={{ marginLeft: 10 }} onClick={function () { onPick(sel.data.wl); }}>切换到此时间线</button> : null}
            </span>
          ) : "单击卡片查看详情，双击消息卡切换时间线；滚轮缩放/拖拽平移"}
        </div>
      </div>
    </div>
  );
}

function WorldlineMergePath({ segments }) {
  const segs = Array.isArray(segments) ? segments : [];
  if (!segs.length) return null;
  const cardW = 112, cardH = 38, gap = 48;
  const topMain = 8, topBranch = 84;
  const laneY = function (s) { return s.headingKey === "main" ? topMain : topBranch; };
  const xOf = function (i) { return 12 + i * (cardW + gap); };
  const width = 12 + segs.length * (cardW + gap) + 16;
  const height = 134;
  const mainIdx = [];
  segs.forEach(function (s, i) { if (s.headingKey === "main") mainIdx.push(i); });
  const mainDashed = [];
  for (let k = 0; k + 1 < mainIdx.length; k++) {
    if (mainIdx[k + 1] > mainIdx[k] + 1) mainDashed.push([mainIdx[k], mainIdx[k + 1]]);
  }
  return (
    <div className="tl-merge">
      <span className="tl-merge-label">世界线归并</span>
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        {mainDashed.map(function (pair, di) {
          const a = pair[0], b = pair[1];
          const y = topMain + cardH / 2;
          return <path key={"md" + di} d={"M " + (xOf(a) + cardW) + " " + y + " L " + xOf(b) + " " + y} fill="none" stroke="var(--chat-border-strong)" strokeWidth="1.3" strokeDasharray="4 4" opacity="0.7" />;
        })}
        {segs.map(function (s, i) {
          if (i === 0) return null;
          const prev = segs[i - 1];
          const x1 = xOf(i - 1) + cardW, y1 = laneY(prev) + cardH / 2;
          const x2 = xOf(i), y2 = laneY(s) + cardH / 2;
          const cross = laneY(prev) !== laneY(s);
          return <path key={"e" + i} d={"M " + x1 + " " + y1 + " C " + (x1 + gap / 2) + " " + y1 + ", " + (x2 - gap / 2) + " " + y2 + ", " + x2 + " " + y2} fill="none" stroke={cross ? "var(--chat-live)" : "var(--chat-border-strong)"} strokeWidth={cross ? 1.8 : 1.2} />;
        })}
        {segs.map(function (s, i) {
          const isMain = s.headingKey === "main";
          const x = xOf(i), y = laneY(s);
          return (
            <g key={"s" + i}>
              <rect x={x} y={y} width={cardW} height={cardH} rx="9" fill={isMain ? "var(--chat-card)" : "color-mix(in oklab, var(--chat-live) 10%, var(--chat-card))"} stroke={isMain ? "var(--chat-border-strong)" : "color-mix(in oklab, var(--chat-live) 55%, var(--chat-border))"} />
              <text x={x + 10} y={y + 17} fontSize="10" fill="var(--chat-fg)">{String(s.headingKey || "main")}</text>
              <text x={x + 10} y={y + 30} fontSize="9" fill="var(--chat-muted-fg)">{(s.count || 0) + " 条"}</text>
              {i > 0 && laneY(segs[i - 1]) !== laneY(s) ? <text x={x - 24} y={y - 5} fontSize="9" fill="var(--chat-muted-fg)" opacity="0.7">{isMain ? "join" : "branch"}</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReactFlowTimelineMapV2({ rf, branches, edgeMarkers, current, view, onPick, onClose }) {
  const [sel, setSel] = useState(null);
  const [selPos, setSelPos] = useState(null);
  const [selWl, setSelWl] = useState(current ? String(current) : null);
  const canvasRef = useRef(null);
  const currentEntry = (Array.isArray(branches) ? branches : []).filter(function (b) { return String(b.wl || "") === String(current || ""); })[0];
  const currentLabel = currentEntry ? (currentEntry.label || currentEntry.wl || "主时间线") : (current ? String(current) : "主时间线");
  const RF = rf.ReactFlow;
  const RFBackground = rf.Background;
  const RFControls = rf.Controls;
  const RFMiniMap = rf.MiniMap;
  const RFVariant = rf.BackgroundVariant;
  const RFHandle = rf.Handle;
  const RFPosition = rf.Position;
  const RFBaseEdge = rf.BaseEdge;
  const RFEdgeLabelRenderer = rf.EdgeLabelRenderer;
  const RFSmoothStep = rf.getSmoothStepPath;
  useEffect(function () {
    try {
      const host = document.getElementById("app");
      const root = host && host.shadowRoot ? host.shadowRoot : document.head;
      if (root && !root.querySelector("link[data-rf-style]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/@xyflow/react@12.8.2/dist/style.css";
        link.setAttribute("data-rf-style", "1");
        root.appendChild(link);
      }
    } catch (e) { /* ignore */ }
  }, []);
  const nodeTypes = useMemo(function () {
    function ControlNode(props) {
      const d = props.data || {};
      const border = d.selected ? "var(--chat-live)" : d.onPath ? "color-mix(in oklab, var(--chat-live) 55%, var(--chat-border))" : "var(--chat-border-strong)";
      const bg = d.selected ? "color-mix(in oklab, var(--chat-live) 20%, var(--chat-card))" : d.onPath ? "color-mix(in oklab, var(--chat-live) 7%, var(--chat-card))" : "var(--chat-card)";
      return (
        <div style={{ width: 142, minHeight: 42, padding: "5px 8px", boxSizing: "border-box", background: bg, border: "1px solid " + border, borderRadius: 9, opacity: d.dim ? 0.34 : 1, boxShadow: d.selected ? "0 0 0 1px var(--chat-live), 0 6px 20px rgba(0,0,0,.25)" : "none", transition: "opacity .15s ease, border-color .15s ease, background .15s ease" }}>
          <RFHandle type="target" position={RFPosition.Top} style={{ opacity: 0, width: 6, height: 6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", opacity: .55 }}>
            <span>{d.role || "timeline"}</span>
            {d.current ? <span style={{ color: "var(--chat-live)", opacity: 1 }}>• current</span> : null}
          </div>
          <div style={{ fontSize: 10.5, lineHeight: 1.35, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.text}</div>
          <div style={{ fontSize: 8, opacity: .4, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.sub || ""}</div>
          <RFHandle type="source" position={RFPosition.Bottom} style={{ opacity: 0, width: 6, height: 6 }} />
        </div>
      );
    }
    function EdgeNode(props) {
      const d = props.data || {};
      return (
        <div className="tl-edge-node" title={d.kind + " " + (d.label || "") + " · " + (d.heading || "")}>
          {d.kind === "compact" ? "⊟" : "⌫"} {d.label || d.kind}
        </div>
      );
    }
    return { control: ControlNode, edge: EdgeNode };
  }, [rf]);
  const edgeTypes = useMemo(function () {
    function IntervalEdge(props) {
      const [edgePath, labelX, labelY] = RFSmoothStep(props);
      const d = props.data || {};
      const active = !!d.onPath;
      return (
        <>
          <RFBaseEdge path={edgePath} style={{ stroke: active ? "var(--chat-live)" : "var(--chat-border-strong)", strokeWidth: active ? 2 : 1.2, opacity: active ? 1 : 0.75 }} />
          {d.count ? (
            <RFEdgeLabelRenderer>
              <div className={"tl-edge-pill" + (active ? " is-on" : "")} style={{ position: "absolute", transform: "translate(-50%, -50%) translate(" + labelX + "px, " + labelY + "px)", pointerEvents: "none" }}>{"+" + d.count + " 条"}</div>
            </RFEdgeLabelRenderer>
          ) : null}
        </>
      );
    }
    return { interval: IntervalEdge };
  }, [rf]);
  const built = useMemo(function () {
    const entries = (Array.isArray(branches) ? branches : []).slice();
    const byWl = {}; const byTarget = {};
    entries.forEach(function (b) { byWl[b.wl || ""] = b; if (b.targetKey) byTarget[b.targetKey] = b; });
    const parent = {};
    entries.forEach(function (b) {
      const k = b.wl || "";
      if (!k) return;
      const t = b.sourceKey ? byTarget[b.sourceKey] : null;
      parent[k] = t ? (t.wl || "") : "";
    });
    const kids = {};
    entries.forEach(function (b) {
      const k = b.wl || "";
      if (!k) return;
      const par = parent[k] || "";
      (kids[par] = kids[par] || []).push(k);
    });
    let cursor = 0; const pos = {};
    function layout(id, depth) {
      const cs = kids[id] || [];
      let x;
      if (!cs.length) { x = cursor++; }
      else { const xs = cs.map(function (c) { return layout(c, depth + 1); }); x = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2; }
      pos[id] = { x: x, y: depth };
      return x;
    }
    layout("", 0);
    const provOf = function (wl) {
      const out = [];
      let cur = wl || "";
      while (cur) { out.unshift(cur); cur = parent[cur] || ""; }
      out.unshift("main");
      return out.join(" › ");
    };
    // 选中的不是“截断后的 HIS”，而是该 control node 创建的世界线：节点本身 + 它的后代 control nodes。
    const onLine = {};
    if (selWl !== null) {
      if (selWl === "") {
        onLine["msg:main"] = true;
        entries.forEach(function (b) { if (b.wl) onLine["msg:" + b.wl] = true; });
      } else {
        onLine["msg:" + selWl] = true;
        entries.forEach(function (b) {
          const wl = b.wl || "";
          if (!wl) return;
          let cur = wl;
          while (cur) {
            if ((parent[cur] || "") === selWl) { onLine["msg:" + wl] = true; break; }
            cur = parent[cur] || "";
          }
        });
      }
    }
    const nodes = []; const edges = [];
    const rootEntry = byWl[""] || { targetCount: 0 };
    const rootId = "msg:main";
    nodes.push({
      id: rootId, type: "control", position: { x: (pos[""] ? pos[""].x : 0) * 300, y: (pos[""] ? pos[""].y : 0) * 190 },
      data: { role: "timeline", text: "主时间线", sub: (rootEntry.targetCount || 0) + " 条消息", current: String(current || "") === "", wl: "", count: rootEntry.targetCount || 0, selected: selWl === "", onPath: !!onLine[rootId], dim: selWl !== null && !onLine[rootId], provenance: "main" }
    });
    entries.forEach(function (b) {
      const wl = b.wl || "";
      if (!wl) return;
      const p = parent[wl] || "";
      const pp = pos[wl] || { x: 0, y: 1 };
      const id = "msg:" + wl;
      const onPath = !!onLine[id];
      const dim = selWl !== null && !onPath;
      const onEdge = onPath && !!onLine["msg:" + (p || "main")];
      nodes.push({
        id: id, type: "control", position: { x: pp.x * 300, y: pp.y * 190 },
        data: { role: b.sourceRole || "message", text: b.sourceText || b.label || wl, sub: b.target || "main", current: String(wl) === String(current || ""), wl: wl, count: b.targetCount || 0, selected: selWl === wl, onPath: onPath, dim: dim, provenance: provOf(wl) }
      });
      edges.push({
        id: "e-" + wl, source: "msg:" + (p || "main"), target: id, type: "interval",
        data: { count: b.targetCount || 0, wl: wl, onPath: onEdge }
      });
      const pparent = pos[p] || { x: 0, y: 0 };
      const ms = (Array.isArray(edgeMarkers) ? edgeMarkers : []).filter(function (m) { return m.headingKey === b.targetKey; });
      ms.forEach(function (m, mi) {
        const t = 0.34 + mi * 0.18;
        nodes.push({
          id: "edge:" + wl + ":" + m.key, type: "edge", selectable: true,
          position: {
            x: (pparent.x + (pp.x - pparent.x) * t) * 300,
            y: (pparent.y + (pp.y - pparent.y) * t) * 190
          },
          data: { kind: m.kind, label: m.label, heading: m.headingName, text: m.text, role: m.kind, wl: "", edgeOf: wl }
        });
      });
    });
    return { nodes: nodes, edges: edges };
  }, [branches, edgeMarkers, current, selWl]);
  function onNodeClick(e, n) {
    setSel(n);
    if (!n || n.type !== "edge") {
      const wl = n && n.data && n.data.wl != null ? n.data.wl : "";
      setSelWl(wl);
    }
    try {
      const r = canvasRef.current.getBoundingClientRect();
      setSelPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    } catch (err) { setSelPos({ x: 24, y: 24 }); }
  }
  const segs = view && Array.isArray(view.segments) ? view.segments : [];
  const segName = function (s) { return String(s && s.headingKey ? s.headingKey : "main"); };
  const arrowOf = function (i) {
    if (i <= 0) return null;
    const prev = segs[i - 1], cur = segs[i];
    if (!prev || !cur) return "→";
    if (cur.headingKey === "main" && prev.headingKey !== "main") return "↩ 回主线";
    if (prev.headingKey === "main" && cur.headingKey !== "main") return "↳";
    return "→";
  };
  const cw = canvasRef.current ? canvasRef.current.clientWidth : 800;
  const chh = canvasRef.current ? canvasRef.current.clientHeight : 500;
  const popLeft = selPos ? Math.max(8, Math.min(selPos.x + 14, cw - 286)) : 12;
  const popTop = selPos ? Math.max(8, Math.min(selPos.y + 10, chh - 190)) : 12;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ width: "80vw", height: "80vh", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--chat-bg)", border: "1px solid var(--chat-border-strong)", borderRadius: 16, padding: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.45)" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>世界线</div>
          <span className="text-[11px]" style={{ color: "var(--chat-live)" }}>当前：{currentLabel}</span>
          <span className="text-[11px] opacity-45">节点 = 关键消息；线上标签 = 区间消息数；点节点高亮该节点之后的整条世界线（不截断 HIS），双击切换</span>
          <button type="button" className="chat-btn" style={{ marginLeft: "auto" }} onClick={onClose}>关闭</button>
        </div>
        <WorldlineMergePath segments={segs} />
        <div ref={canvasRef} className="tl-flow" style={{ position: "relative", flex: 1, minHeight: 0, border: "1px solid var(--chat-border)", borderRadius: 12, overflow: "hidden", background: "var(--chat-bg)" }}>
          <RF style={{ width: "100%", height: "100%" }} nodes={built.nodes} edges={built.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.18, maxZoom: 1.0 }} minZoom={0.2} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} panOnScroll onNodeClick={onNodeClick} onPaneClick={function () { setSel(null); setSelWl(null); setSelPos(null); }} onNodeDoubleClick={function (e, n) { if (n.data && !n.data.current && n.data.wl != null) onPick(n.data.wl); }}>
            <RFBackground variant={RFVariant.Dots} gap={20} size={1} color="#34353a" />
            <RFControls />
            <RFMiniMap pannable zoomable nodeColor="#3a3b3e" maskColor="rgba(0,0,0,.35)" />
          </RF>
          {sel ? (
            <div className="tl-popover" onClick={function (e) { e.stopPropagation(); }} style={{ left: popLeft, top: popTop }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "var(--chat-muted-fg)", textTransform: "uppercase", letterSpacing: ".08em" }}>{sel.data.role || "timeline"}</span>
                <span style={{ fontSize: 10, color: "var(--chat-muted-fg)", opacity: .55 }}>{sel.data.selected ? "已选中" : ""}</span>
                <button type="button" className="chat-btn" style={{ marginLeft: "auto", padding: "1px 6px" }} onClick={function () { setSel(null); setSelWl(null); }}>×</button>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>{sel.data.text || "主时间线"}</div>
              {sel.type === "edge" ? (
                <div style={{ marginTop: 6, fontSize: 10, opacity: .5 }}>
                  {sel.data.kind === "compact" ? "compact 边缘" : "prune 边缘"} · {sel.data.heading || ""}
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 6, fontSize: 10, opacity: .5 }}>来源：{sel.data.provenance || "main"}</div>
                  <div style={{ marginTop: 3, fontSize: 10, opacity: .5 }}>
                    {sel.data.wl ? ("世界线 " + sel.data.wl + " · 后续 " + (sel.data.count || 0) + " 条") : ("主时间线 · " + (sel.data.count || 0) + " 条消息")}
                  </div>
                  {sel.data.wl != null ? <button type="button" className="chat-btn" style={{ marginTop: 8 }} onClick={function () { onPick(sel.data.wl); }}>{sel.data.wl ? "切换到此世界线" : "切换回主时间线"}</button> : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimelineMap({ branches, edgeMarkers, current, view, onPick, onClose, rfNs }) {
  if (!rfNs || !rfNs.ReactFlow) return <TimelineMapSvg branches={branches} current={current} onPick={onPick} onClose={onClose} />;
  return <ReactFlowTimelineMapV2 rf={rfNs} branches={branches} edgeMarkers={edgeMarkers} current={current} view={view} onPick={onPick} onClose={onClose} />;
}



const ChatApp = observer(function ChatApp({ app }) {
  const env = app ? (getEnv(app) || {}) : {};
  const client = env.client;
  const appRouter = env.appRouter;
  const mainRoot = typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const decl = mainRoot && mainRoot.decl ? mainRoot.decl : null;
  const nsOf = (name) => { const r = decl && decl.modOf ? decl.modOf(name) : null; return r && r.ns; };
  const flowNs = nsOf("REACT_FLOW");
  const core = nsOf("CORE");
  const SessionRail = nsOf("SESSION") ? nsOf("SESSION").default : null;
  const SettingsPane = nsOf("SETTINGS") ? nsOf("SETTINGS").default : null;

  // 世界线：分支列表 + 当前 wl 都在 ChatStore（store views/actions），UI 不另存副本。
  const branches = app.branches;
  const wl = app.currentWL;
  const [timelineMapOpen, setTimelineMapOpen] = useState(false);
  // 快捷设置：模型别名列表 + 每 session 的 LLM 设置由 session doc state 持有。
  const [aliases, setAliases] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);
  const appliedRef = useRef(null);
  const ctxNames = (function () {
    const out = ["genesis"];
    try {
      const w = mainRoot && mainRoot.wts && mainRoot.wts.wts;
      if (w && typeof w.keys === "function") {
        const ks = Array.from(w.keys());
        for (let i = 0; i < ks.length; i++) if (out.indexOf(ks[i]) < 0) out.push(ks[i]);
      }
    } catch (e) { /* wts 未就绪时只留 genesis */ }
    return out;
  })();

  // 会话文档的店（MD 自己就是 root 节点）：按 sid 解析 docId → 「我要这篇」→ 帧到即画。
  const md = app.docId && client && typeof client.md === "function" ? client.md(app.docId) : null;
  const docKids = md && Array.isArray(md.kids) ? md.kids : [];


  const refresh = async () => {
    if (!core) return;
    try {
      const sids = await core.lsSessions(client);
      const list = [];
      for (let i = 0; i < sids.length; i++) {
        const st = await core.readState(client, sids[i]).catch(() => null);
        list.push({ sid: sids[i], name: (st && st.name) || sids[i], wt: (st && st.wt) || "genesis", wl: (st && st.wl) || "", model: (st && st.model) || "", reasoning: (st && st.reasoning) || "", created: (st && st.created) || "" });
      }
      app.setSessions(list);
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  // 选会话 = 换 sid（+ URL 投影）；文档经 docId 通道装载，不写壳的文档指针。
  const nav = (nextSid) => {
    if (!core || !nextSid) return;
    app.setErr("");
    app.setRailOpen(false);
    app.setSid(nextSid);
    if (appRouter && typeof appRouter.push === "function") appRouter.push(core.docPath(nextSid));
  };

  const create = async () => {
    if (!core) return;
    const sid = "s" + Date.now().toString(36);
    try {
      await core.mkSession(client, sid, "新会话", "genesis");
      await refresh();
      nav(sid);
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  // 侧栏：改名（写 state.name）/ 删除（先离开当前文档，再 rm 掉会话文档）。
  const rename = async (sid, name) => {
    if (!core || !sid) return;
    try {
      await core.writeState(client, sid, "name", name);
      await refresh();
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  const remove = async (sid) => {
    if (!core || !sid) return;
    try {
      const rest = app.sessions.filter((s) => s.sid !== sid);
      if (app.sid === sid) {
        app.setDocId(0);
        if (rest.length) nav(rest[0].sid);
        else await create();   // 删掉最后一个会话 ⇒ 自动开一个新对话，不停在空页
      }
      await core.delSession(client, sid);
      await refresh();
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  // 每 session 的快捷设置：写 session doc state；apply-on-send 到全局 agent/alias（单 agent、串行）。
  const updateSessionSetting = async (key, val) => {
    if (!core || !app.sid) return;
    try {
      await core.writeState(client, app.sid, key, val);
      appliedRef.current = null;
      if (key === "wl") app.setCurrentWL(String(val || ""));
      await refresh();
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  const applySessionLLM = async () => {
    if (!core || !app.cur) return;
    const cur = app.cur;
    // wl 不进 key：世界线是每次请求的 -wl 参数，不需要 apply-on-send 写全局配置。
    const key = JSON.stringify([cur.model || "", cur.reasoning || "", app.alias || ""]);
    if (appliedRef.current === key) return;
    const r = await core.applySessionSettings(client, {
      model: cur.model || "",
      reasoning: cur.reasoning || ""
    }, app.alias || core.ALIAS);
    appliedRef.current = key;
    if (r && r.alias) app.setAlias(r.alias);
  };

  // 发送 = 一条命令（stream 逐 chunk 写 HIS，整轮收尾后返回）；**不轮询、不读副本** —— 记录由补丁帧推进 HisPane。
  const send = async (msg) => {
    if (!core || !app.sid || app.busy) return;
    const wl = String(app.currentWL || "");
    app.setBusy(true);
    app.setErr("");
    try {
      const cur = app.cur;
      if (cur && (!cur.name || cur.name === "新会话")) {
        const t = String(msg || "").trim().split(String.fromCharCode(10))[0].slice(0, 24);
        if (t) {
          try { await core.writeState(client, app.sid, "name", t); await refresh(); } catch (e) { /* 改名失败不阻塞发送 */ }
        }
      }
      await applySessionLLM();
      await core.setHis(client, app.sid);
      // 发送永远写“当前查看的线”：-wl 作为本次 run 落点，不依赖全局指针。
      const r = await core.sendMsg(client, msg, (app.cur && app.cur.wt) || "genesis", wl);
      if (String(r).indexOf("mdio_error") >= 0) throw new Error(String(r).slice(0, 300));
    } catch (e) {
      app.setErr(String((e && e.message) || e));
    } finally {
      app.setBusy(false);
    }
  };

  const stop = async () => {
    if (!core) return;
    try { await core.stopAgent(client, (app.cur && app.cur.wt) || "genesis"); } catch (e) { /* 停止失败不阻塞 */ }
  };

  // 重新生成：空输入跑一轮（不追加 user 记录，只追加新的 assistant 记录）。
  const regen = async () => {
    if (!core || !app.sid || app.busy) return;
    app.setBusy(true);
    app.setErr("");
    try {
      await applySessionLLM();
      await core.setHis(client, app.sid);
      // 空输入没有 run-scoped 落点：先把当前线钉到 config 指针，再重生成。
      await core.setWl(client, String(app.currentWL || ""));
      const r = await core.regenMsg(client, (app.cur && app.cur.wt) || "genesis");
      if (String(r).indexOf("mdio_error") >= 0) throw new Error(String(r).slice(0, 300));
    } catch (e) {
      app.setErr(String((e && e.message) || e));
    } finally {
      app.setBusy(false);
    }
  };

  // 世界线切换 = 纯视图：本地换 view（View/RenderView 立即重算），并把“当前线”记进 session state；
  // 不写 agent 配置、不触发重生成。下一次发送再把该 wl 作为 -wl 传给后端。
  const switchWl = async (expr) => {
    if (!core || !app.sid || app.busy) return;
    const next = String(expr || "");
    app.setCurrentWL(next);
    app.setErr("");
    try {
      await updateSessionSetting("wl", next);
    } catch (e) { app.setErr(String((e && e.message) || e)); }
  };

  // 就地编辑 = 零复制建线：以该 user 记录的 host 位开新 branch
  // （-wl <child> -branch <idx>），旧线原记录保留；编辑后的消息作为新线第一条 user 写入并生成 assistant。
  const edit = async (seq, text) => {
    if (!core || !app.sid || app.busy) return;
    const v = String(text || "").trim();
    if (!v || typeof seq !== "number" || seq < 0) return;
    const plan = hcEditPlan(app.baseIndex, app.view, app.branches, app.currentWL, seq);
    if (plan.error) { app.setErr(plan.error); return; }
    app.setBusy(true);
    app.setErr("");
    try {
      await applySessionLLM();
      await core.setHis(client, app.sid);
      const bc = await core.branchCreate(client, plan.wl, plan.localIndex);
      if (String(bc).indexOf("mdio_error") >= 0) throw new Error("建线失败: " + String(bc).slice(0, 300));
      await updateSessionSetting("wl", plan.wl);
      const r = await core.sendMsg(client, v, (app.cur && app.cur.wt) || "genesis", plan.wl);
      if (String(r).indexOf("mdio_error") >= 0) throw new Error(String(r).slice(0, 300));
    } catch (e) {
      app.setErr(String((e && e.message) || e));
    } finally {
      app.setBusy(false);
    }
  };

  // 认领件（HisPane）→ app 的最小通道：DOM 自定义事件（无全局变量、可清理）。
  useEffect(function () {
    const onEvt = function (e) {
      const d = e && e.detail ? e.detail : {};
      if (d.action === "regen") regen();
      if (d.action === "edit") edit(d.seq, d.text);
    };
    document.addEventListener("mdio-chat", onEvt);
    return function () { document.removeEventListener("mdio-chat", onEvt); };
  }, [app.sid, app.busy, core, client]);

  // 慢响应提示：busy 超过 2 分钟说明模型/网络可能卡住（可停止重试）。
  useEffect(function () {
    app.setSlow(false);
    if (!app.busy) return undefined;
    const t = setTimeout(function () { app.setSlow(true); }, 120000);
    return function () { clearTimeout(t); app.setSlow(false); };
  }, [app.busy]);

  // 运行态广播：让认领件在「重新生成」（没有新 user 记录）时也能出 typing 行。
  // 同时写 documentElement 属性：HisPane 可能在 busy 变化之后才挂载（新会话首条），
  // 挂载时先读属性补状态，避免漏掉唯一一次事件。
  useEffect(function () {
    try {
      document.documentElement.setAttribute("data-chat-busy", app.busy ? "1" : "0");
      document.dispatchEvent(new CustomEvent("mdio-chat-busy", { detail: { busy: app.busy } }));
    } catch (e) { /* 忽略 */ }
  }, [app.busy]);

  // 错误条的重试：重新对齐 agent（必要时重建）并把 his 指回本会话。
  const retry = async () => {
    app.setErr("");
    try {
      if (!core) return;
      await core.initAgent(client, app.alias || core.ALIAS);
      if (app.sid) await core.setHis(client, app.sid);
    } catch (e) {
      app.setErr(String((e && e.message) || e));
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let alias = core ? core.ALIAS : "";
        if (core && typeof core.readModelAlias === "function") {
          try { alias = (await core.readModelAlias(client)) || alias; } catch (e) { /* 用常量兜底 */ }
        }
        if (alive && alias) app.setAlias(alias);
        if (core && typeof core.agentReady === "function") {
          const ok = await core.agentReady(client);
          if (!ok) await core.initAgent(client, alias);
        }
        if (!alive) return;
        app.setReady(true);
        await refresh();
        if (!alive) return;
        // 「当前打开会话」在清单刷新后统一校验：URL 深链可能指向已删会话，不能停在空页、
        // 也不能去开一篇不存在的文档。没有有效的当前会话（无深链 / 深链失效）⇒ 直接新建一个对话。
        const known = function (sid) { return !!sid && app.sessions.some(function (s) { return s.sid === sid; }); };
        if (!known(app.sid)) {
          // 「当前打开会话」= hash 路由里的 /chat/<sid>.md；shell 自己的默认文档（如 /README.md）
          // 不算打开会话。没有有效会话（空 hash / 深链失效）⇒ 进页面直接新建一个对话。
          const routeNow = appRouter && typeof appRouter.route === "function" ? String(appRouter.route() || "") : "";
          const want = core ? core.sidOf(routeNow) : "";
          if (known(want)) app.setSid(want);
          else if (routeNow !== "/settings") await create();
        }
      } catch (e) {
        app.setErr(String((e && e.message) || e));
        app.setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // URL（hash）⇒ 会话：可深链；挂载后补发一次当前值。
  useEffect(() => {
    if (!appRouter || typeof appRouter.subscribe !== "function" || !core) return undefined;
    const sync = (r) => {
      const p = String(r || "/");
      app.setRoute(p);
      const s = core.sidOf(p);
      if (s) app.setSid(s);
    };
    const un = appRouter.subscribe(sync);
    try { if (typeof appRouter.route === "function") sync(appRouter.route()); } catch (e) { /* 初始补发失败不阻塞 */ }
    return un;
  }, [appRouter, core]);

  // sid ⇒ docId ⇒ 工作树店「我要这篇」；到帧由店的三态盒推进（observer 重算），不轮询。
  useEffect(() => {
    let alive = true;
    if (!core || !app.sid) { app.setDocId(0); return undefined; }
    (async () => {
      try {
        const id = await core.docIdOf(client, app.sid);
        if (!alive || id == null) return;
        app.setDocId(Number(id));
        core.observeDoc(client, Number(id));
      } catch (e) {
        if (alive) app.setErr(String((e && e.message) || e));
      }
    })();
    return () => { alive = false; };
  }, [app.sid, core, client]);

  // 让壳/左栏 Monaco 跟着会话文档走：HIS 写回的就是这篇（开发者模式下能实时看到更新）。
  useEffect(function () {
    if (!appRouter || typeof appRouter.setDocPointer !== "function") return;
    if (!core) return;
    if (app.sid) appRouter.setDocPointer(core.docPath(app.sid));
  }, [app.sid, core, appRouter]);

  // 模型别名列表（快捷设置下拉的数据源）。
  useEffect(function () {
    let alive = true;
    (async function () {
      if (!core) return;
      try {
        const list = await core.listAliases(client);
        if (alive) setAliases(Array.isArray(list) ? list : []);
      } catch (e) { /* 别名读不到时用当前 alias 兜底 */ }
    })();
    return function () { alive = false; };
  }, [core, client]);

  // 推理强度选项：按当前 alias 的 provider 能力位生成（provider 不支持时为空，composer 用旧默认）。
  useEffect(function () {
    let alive = true;
    (async function () {
      if (!core) return;
      try {
        const cfg = await core.readConfig(client);
        const meta = await core.readProviders(client);
        const name = (app.cur && app.cur.model) || app.alias || "";
        const entry = (cfg.aliases && cfg.aliases[name]) || {};
        const prov = String(entry.provider || "");
        const caps = prov && meta[prov] ? (meta[prov].capabilities || {}) : {};
        const ok = caps.reasoning === true || caps.reasoning === "true";
        if (alive) setReasonOptions(ok ? ["auto", "none", "low", "high", "max"] : []);
      } catch (e) { if (alive) setReasonOptions([]); }
    })();
    return function () { alive = false; };
  }, [core, client, app.alias, app.cur && app.cur.model]);

  // 每 session 的 wl 来自 session doc state；切会话/改设置后同步给 ChatStore 的视图。
  useEffect(function () {
    if (!app.cur) return;
    app.setCurrentWL(app.cur.wl || "");
    appliedRef.current = null;
  }, [app.sid, app.cur && app.cur.wl]);

  return (
    <div data-app="chat" className="relative flex h-full flex-col">
      {app.route.indexOf("/settings") === 0 ? (
        SettingsPane ? <SettingsPane app={{ ...app, core }} client={client} onBack={() => { if (appRouter && appRouter.push) appRouter.push("/"); }} /> : null
      ) : (
        <div className="flex min-h-0 flex-1">
          {app.railOpen ? <button type="button" className="chat-rail-backdrop" aria-label="关闭会话列表" onClick={() => app.setRailOpen(false)} /> : null}
          {SessionRail ? (
            <div className={"chat-rail-wrap" + (app.railOpen ? " is-open" : "")}>
              <SessionRail app={app} onSelect={nav} onNew={create} onRename={rename} onRemove={remove} onSettings={() => { if (appRouter && appRouter.push) appRouter.push("/settings"); }} />
            </div>
          ) : null}
          <main className="flex h-full min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b px-6 py-3" style={{ borderColor: "var(--chat-border)" }}>
              <button type="button" className="chat-rail-toggle" aria-label="会话列表" onClick={() => app.setRailOpen(!app.railOpen)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
              </button>
              <h1 className="truncate text-[15px] font-medium tracking-[-0.01em]">{app.cur ? (app.cur.name || app.cur.sid) : "新会话"}</h1>
              <span className="chat-sid shrink-0 font-mono text-[10px] tracking-[0.08em] opacity-45">{app.sid ? (app.cur ? String(app.cur.wt || "genesis") + " · " : "") + app.sid : ""}</span>
              <span className="chat-header-meta">
                <span className="chat-status-dot" style={app.busy ? { background: "var(--chat-live)", animation: "chat-pulse 2s var(--chat-ease) infinite" } : undefined} />
                <span>dev</span>
                <span>·</span>
                <span>{app.cur && app.cur.model ? app.cur.model : (app.alias || (core ? core.ALIAS : ""))}</span>
                <span className="chat-wt-badge">{app.cur ? String(app.cur.wt || "genesis") : "genesis"}</span>
              </span>
            </header>
            <div className="chat-doc min-h-0 flex-1">
              {docKids.length === 0 ? (
                app.sid ? (
                  <div className="chat-skeleton">
                    {[0, 1, 2].map(function (i) {
                      return (
                        <div key={i} className="chat-skeleton-row">
                          <div className="chat-skeleton-bar" style={{ width: i === 1 ? "62%" : "38%" }} />
                          <div className="chat-skeleton-bar" style={{ width: "100%" }} />
                          <div className="chat-skeleton-bar" style={{ width: "76%" }} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-[12px] opacity-45">开始一个新会话 —— 工地由会话文档的 state.wt 决定</div>
                )
              ) : hasHisRecords(md) ? (
                <div className="mdio-doc mdio-std">
                  {docKids.map((n) => env.renderNode(n))}
                </div>
              ) : (
                <EmptyState onSend={send} />
              )}
            </div>
            {app.err ? (
              <div className="chat-error-wrap">
                <div className="chat-error" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                  <div className="chat-error-body">
                    <p className="chat-error-title">运行出错</p>
                    <p className="chat-error-detail">{app.err}</p>
                  </div>
                  <button type="button" className="chat-error-retry" onClick={retry}>重试</button>
                </div>
              </div>
            ) : null}
            {app.busy && app.slow ? (
              <div className="chat-slow-hint">模型响应较慢（已超过 2 分钟）—— 可按停止后重试</div>
            ) : null}
            <Composer busy={app.busy} onSend={send} onStop={stop} focusKey={app.sid}
              wl={app.currentWL} branches={branches}
              model={(app.cur && app.cur.model) || app.alias || ""} aliases={aliases}
              reasoning={(app.cur && app.cur.reasoning) || ""}
              reasoningOptions={reasonOptions}
              ctx={(app.cur && app.cur.wt) || "genesis"} ctxNames={ctxNames}
              onWorldline={function () { setTimelineMapOpen(true); }}
              onSetting={updateSessionSetting} />
          </main>
        </div>
      )}
      {!app.ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--chat-bg) 70%, transparent)" }}><span className="animate-pulse text-[12px] opacity-60">connecting…</span></div>}
      {timelineMapOpen ? (<TimelineMap branches={branches} edgeMarkers={app.edgeMarkers} current={wl} view={app.view} rfNs={flowNs} onClose={function () { setTimelineMapOpen(false); }} onPick={function (v) { setTimelineMapOpen(false); if (String(v) !== String(wl || "")) switchWl(v); }} />) : null}
    </div>
  );
});

export default ChatApp;
```

## styles

```css@app
/* ── assistant-ui 吸收清单 P0：单色 + 透明填充、hairline、无阴影无玻璃 ── */
[data-app="chat"] {
  --chat-bg: oklch(0.17 0.003 106);
  --chat-fg: oklch(0.985 0.002 106);
  --chat-muted: oklch(0.275 0.004 106);
  --chat-muted-fg: oklch(0.708 0.004 106);
  --chat-card: oklch(0.215 0.003 106);
  --chat-border: oklch(0.985 0.002 106 / 10%);
  --chat-border-strong: oklch(0.985 0.002 106 / 25%);
  --chat-live: oklch(0.62 0.19 258);
  --chat-radius: 1rem;
  --chat-ease: cubic-bezier(.32, .72, 0, 1);
  --chat-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  background: var(--chat-bg);
  color: var(--chat-fg);
  font-family: var(--chat-font);
}

.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
}
.chat-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.chat-scroll::-webkit-scrollbar-track { background: transparent; }
.chat-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
.chat-scroll:hover {
  scrollbar-color: oklch(0.985 0.002 106 / 18%) transparent;
}
.chat-scroll:hover::-webkit-scrollbar-thumb { background: oklch(0.985 0.002 106 / 18%); }

/* 认领件 = 会话文档的唯一可见节（state 由 visibility 排除）⇒ 拿到整个文档高度 */
.tl-flow .react-flow__controls,
.tl-flow .react-flow__controls-button { background: var(--chat-card) !important; border-color: var(--chat-border) !important; color: var(--chat-fg) !important; fill: var(--chat-fg) !important; }
.tl-flow .react-flow__minimap { background: var(--chat-card) !important; border: 1px solid var(--chat-border) !important; }
.tl-flow .react-flow__minimap-mask { fill: rgba(0,0,0,0.45) !important; }
.tl-flow .react-flow__attribution { background: transparent !important; color: var(--chat-muted-fg) !important; }
.tl-edge-pill { background: var(--chat-bg); border: 1px solid var(--chat-border-strong); border-radius: 999px; padding: 1px 7px; font-size: 9px; color: var(--chat-muted-fg); white-space: nowrap; }
.tl-edge-pill.is-on { border-color: var(--chat-live); color: var(--chat-fg); background: color-mix(in oklab, var(--chat-live) 12%, var(--chat-bg)); }
.tl-merge { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 4px 0 10px; overflow-x: auto; white-space: nowrap; }
.tl-merge-label { color: var(--chat-muted-fg); opacity: .6; font-size: 10px; }
.tl-trace { display: flex; align-items: center; gap: 5px; padding: 0 0 8px; overflow-x: auto; white-space: nowrap; font-size: 10px; }
.tl-trace-label { color: var(--chat-muted-fg); opacity: .6; margin-right: 2px; }
.tl-trace-empty { color: var(--chat-muted-fg); opacity: .45; }
.tl-trace-seg { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border: 1px solid var(--chat-border-strong); border-radius: 999px; background: var(--chat-card); color: var(--chat-fg); }
.tl-trace-arrow { color: var(--chat-muted-fg); opacity: .65; font-size: 10px; }
.tl-edge-node { display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 6px; border: 1px dashed var(--chat-border-strong); border-radius: 999px; background: var(--chat-bg); color: var(--chat-muted-fg); font-size: 9px; line-height: 20px; white-space: nowrap; }
.tl-popover { position: absolute; z-index: 20; width: 270px; max-height: 240px; overflow: auto; background: var(--chat-card); border: 1px solid var(--chat-border-strong); border-radius: 12px; padding: 10px 12px; box-shadow: 0 16px 48px rgba(0,0,0,.5); }

.chat-doc { overflow: hidden; }
.chat-doc > .mdio-doc { height: 100%; display: flex; flex-direction: column; min-height: 0; }

/* ── 列与节奏：44rem、消息组 24px / 组间 56px ── */
.chat-thread {
  width: 100%;
  max-width: 44rem;
  margin: 0 auto;
  padding: 24px 20px 96px;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  line-height: 1.625;
}
.chat-md-block + .chat-md-block { margin-top: 12px; }
.chat-md > div > :first-child { margin-top: 0; }
.chat-md > div > :last-child { margin-bottom: 0; }
.chat-md { color: var(--chat-fg); font-size: 16px; line-height: 1.625; }
.chat-md p { margin: 12px 0; }
.chat-md h1 { font-size: 20px; line-height: 1.4; font-weight: 600; margin: 20px 0 8px; }
.chat-md h2 { font-size: 18px; line-height: 1.45; font-weight: 600; margin: 18px 0 8px; }
.chat-md h3 { font-size: 16px; line-height: 1.5; font-weight: 600; margin: 16px 0 6px; }
.chat-md ul, .chat-md ol { margin: 10px 0; padding-inline-start: 1.35rem; }
.chat-md li { margin: 4px 0; }
.chat-md blockquote { margin: 12px 0; padding-inline-start: 1rem; border-inline-start: 2px solid var(--chat-border-strong); color: var(--chat-muted-fg); }
.chat-md pre { margin: 12px 0; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--chat-border); background: var(--chat-card); font-size: 13px; line-height: 1.6; overflow-x: auto; }
.chat-md code { font-size: 0.85em; }
.chat-md :not(pre) > code { background: var(--chat-muted); border-radius: 6px; padding: 2px 6px; }
.chat-md table { margin: 12px 0; border-collapse: collapse; font-size: 14px; }
.chat-md th, .chat-md td { border: 1px solid var(--chat-border); padding: 6px 10px; text-align: left; }
.chat-md th { background: var(--chat-card); font-weight: 500; }

/* ── user：右对齐 bg-muted 气泡；assistant：裸文本（无气泡） ── */
.chat-user-row { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 56px; }
.chat-user-row:first-child { margin-top: 0; }
.chat-user-actions { display: flex; opacity: 0; transition: opacity .15s var(--chat-ease); }
.chat-user-row:hover .chat-user-actions { opacity: 1; }
.chat-user-line { display: flex; align-items: center; justify-content: flex-end; gap: 6px; max-width: 88%; }
.chat-user-line .chat-user-bubble { max-width: 100%; }
.chat-user-edit { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 88%; margin-left: auto; padding: 8px; border: 1px solid var(--chat-border-strong); border-radius: 16px; background: color-mix(in oklab, var(--chat-muted) 30%, transparent); }
.chat-user-edit .chat-input { min-height: 36px; }
.chat-user-edit-bar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.chat-user-edit-hint { margin-right: auto; font-size: 11px; color: var(--chat-muted-fg); opacity: .8; }
.chat-btn-primary { border-color: transparent; background: var(--chat-fg); color: var(--chat-bg); }
.chat-btn-primary:hover { background: var(--chat-fg); opacity: .9; }
.chat-user-bubble {
  max-width: 80%;
  background: var(--chat-muted);
  color: var(--chat-fg);
  border-radius: var(--chat-radius);
  padding: 8px 16px;
}
.chat-user-bubble .chat-md p { margin: 0; }
.chat-user-bubble .chat-md-block + .chat-md-block { margin-top: 8px; }

.chat-assistant { margin-top: 20px; }
.chat-assistant + .chat-reasoning, .chat-assistant + .chat-tool-group { margin-top: 8px; }
.chat-assistant-footer {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding-inline-start: 2px;
  opacity: 0;
  transition: opacity .15s var(--chat-ease);
}
.chat-assistant:hover .chat-assistant-footer, .chat-assistant-footer.is-on { opacity: 1; }
.chat-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--chat-muted-fg);
  cursor: pointer;
  transition: background .15s var(--chat-ease), color .15s var(--chat-ease);
}
.chat-icon-btn:hover { background: oklch(0.985 0.002 106 / 5%); color: var(--chat-fg); }
.chat-timing { display: inline-flex; align-items: center; height: 24px; margin-left: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--chat-muted-fg); opacity: .7; }

/* ── reasoning：默认折叠一行；流式/末尾自动展开一次 ── */
.chat-reasoning { margin-top: 20px; color: var(--chat-muted-fg); }
.chat-reasoning > summary, .chat-tool-group > summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 20px;
  list-style: none;
  cursor: pointer;
  user-select: none;
}
.chat-reasoning > summary::-webkit-details-marker, .chat-tool-group > summary::-webkit-details-marker, .chat-tool-row > summary::-webkit-details-marker { display: none; }
.chat-reasoning[open] > summary .chat-chevron, .chat-tool-group[open] > summary .chat-chevron, .chat-tool-row[open] > summary .chat-chevron { transform: rotate(180deg); }
.chat-chevron { opacity: .7; transition: transform .2s var(--chat-ease); }
.chat-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--chat-muted-fg); opacity: .7; display: inline-block; }
.chat-dot-live { background: var(--chat-live); opacity: 1; animation: chat-pulse 2s var(--chat-ease) infinite; }
.chat-stream-caret { display: inline-block; width: 7px; height: 13px; margin: 2px 0 0 2px; vertical-align: text-bottom; border-radius: 2px; background: var(--chat-fg); opacity: .75; animation: chat-caret-blink 1s steps(2, start) infinite; }
.chat-reasoning-text {
  max-height: 16rem;
  overflow-y: auto;
  padding: 4px 0 6px 24px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--chat-muted-fg);
}
.chat-reasoning-text .chat-md p { margin: 6px 0; }

/* ── tool：单调用一行，连续调用聚合成组 ── */
.chat-tool-group { margin-top: 20px; color: var(--chat-muted-fg); }
.chat-tool-list { display: flex; flex-direction: column; gap: 3px; padding: 2px 0 4px 24px; }
.chat-tool-row > summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  list-style: none;
  cursor: pointer;
  color: var(--chat-muted-fg);
}
.chat-tool-name { color: var(--chat-fg); opacity: .9; }
.chat-tool-id { font-size: 10px; opacity: .45; }
.chat-tool-body { margin: 2px 0 8px; padding-inline-start: 12px; border-inline-start: 1px solid var(--chat-border); }
.chat-tool-label { margin-bottom: 2px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--chat-muted-fg); opacity: .6; }
.chat-tool-body .chat-md { font-size: 13px; line-height: 1.6; }
.chat-tool-body .chat-md pre { font-size: 12px; }

[data-app="chat"] aside button { background-color: transparent; }
[data-app="chat"] aside nav button { border: 0; }
[data-app="chat"] aside button:hover { background-color: oklch(0.985 0.002 106 / 4%); }
[data-app="chat"] aside button[style*="var(--chat-muted)"]:hover { background-color: var(--chat-muted); }

/* ── 空态（shell 负责，带可点击建议） ── */
/* ── 会话切换骨架屏（assistant-ui：加载历史时出骨架，不闪欢迎） ── */
.chat-skeleton { width: 100%; max-width: 44rem; margin: 0 auto; padding: 32px 20px; display: flex; flex-direction: column; gap: 28px; }
.chat-skeleton-row { display: flex; flex-direction: column; gap: 10px; }
.chat-skeleton-bar { height: 12px; border-radius: 6px; background: oklch(0.985 0.002 106 / 6%); animation: chat-pulse 2s var(--chat-ease) infinite; }

.chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; padding: 0 24px; text-align: center; }
.chat-empty-mark { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--chat-border-strong); }
.chat-empty h2 { margin: 6px 0 0; font-size: 24px; line-height: 32px; font-weight: 500; }
.chat-empty p { margin: 0; font-size: 14px; color: var(--chat-muted-fg); }
.chat-empty-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px; }
.chat-chip { border: 1px solid var(--chat-border); background: transparent; color: var(--chat-fg); border-radius: 999px; padding: 8px 16px; font-size: 13px; line-height: 19px; cursor: pointer; transition: background .15s var(--chat-ease), border-color .15s var(--chat-ease); }
.chat-chip:hover { background: oklch(0.985 0.002 106 / 4%); border-color: var(--chat-border-strong); }

/* ── 会话列表项（hover 出改名/删除；删除二次确认） ── */
.chat-rail-item { position: relative; margin-bottom: 2px; padding: 8px 12px; border-radius: 10px; cursor: pointer; transition: background .15s var(--chat-ease); }
.chat-rail-item:hover { background: oklch(0.985 0.002 106 / 4%); }
.chat-rail-name { font-size: 13px; font-weight: 500; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-rail-meta { display: flex; gap: 8px; margin-top: 2px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .08em; opacity: .45; }
.chat-rail-actions { position: absolute; top: 6px; right: 8px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s var(--chat-ease); }
.chat-rail-item:hover .chat-rail-actions { opacity: 1; }
.chat-rail-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: var(--chat-muted-fg); cursor: pointer; }
.chat-rail-icon:hover { background: oklch(0.985 0.002 106 / 8%); color: var(--chat-fg); }
.chat-rail-input { width: 100%; padding: 4px 8px; border: 1px solid var(--chat-border-strong); border-radius: 8px; background: var(--chat-bg); color: var(--chat-fg); font-size: 13px; line-height: 18px; outline: none; }
.chat-rail-confirm { position: absolute; top: 6px; right: 8px; display: flex; gap: 4px; }
.chat-rail-mini { border: 1px solid var(--chat-border); border-radius: 7px; padding: 3px 8px; background: var(--chat-card); color: var(--chat-fg); font-size: 11px; line-height: 16px; cursor: pointer; }
.chat-rail-mini:hover { border-color: var(--chat-border-strong); }

/* ── header 右侧 meta（agent · model · 工地） ── */
.chat-header-meta { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .08em; opacity: .55; }
.chat-wl { display: inline-flex; align-items: center; flex: none; }
.chat-wl-select { appearance: none; -webkit-appearance: none; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .06em; line-height: 16px; color: var(--chat-fg); background: transparent; border: 1px solid var(--chat-border); border-radius: 999px; padding: 3px 9px; cursor: pointer; opacity: .8; }
.chat-wl-select:hover { opacity: 1; }
.chat-wl-select:disabled { opacity: .35; cursor: default; }
.chat-wt-badge { border: 1px solid var(--chat-border); border-radius: 6px; padding: 1px 6px; }

/* ── 窄屏：侧栏变抽屉，header 出菜单钮 ── */
.chat-rail-wrap { flex: 0 0 auto; }
.chat-rail-toggle { display: none; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid var(--chat-border); border-radius: 8px; background: transparent; color: var(--chat-fg); cursor: pointer; }
.chat-rail-backdrop { display: none; }
@media (max-width: 820px) {
  .chat-rail-toggle { display: inline-flex; }
  .chat-rail-wrap { position: fixed; top: 0; bottom: 0; left: 0; z-index: 30; transform: translateX(-100%); transition: transform .2s var(--chat-ease); }
  .chat-rail-wrap.is-open { transform: none; }
  .chat-rail-wrap aside { box-shadow: 0 0 0 1px var(--chat-border); }
  .chat-rail-backdrop { display: block; position: fixed; inset: 0; z-index: 20; border: 0; background: rgb(0 0 0 / 45%); }
  .chat-sid { display: none; }
  .chat-thread { padding: 20px 14px 88px; }
  .chat-user-line { max-width: 100%; }
}

/* ── 焦点可见性（assistant-ui ring 的等价物） ── */
[data-app="chat"] button:focus-visible, [data-app="chat"] textarea:focus-visible, [data-app="chat"] input:focus-visible {
  outline: 2px solid var(--chat-border-strong);
  outline-offset: 1px;
}
.chat-send:disabled { opacity: .4; cursor: default; }
.chat-send:disabled:hover { background: transparent; color: var(--chat-muted-fg); }

/* ── markdown 细节：链接 / hr ── */
.chat-md a { color: var(--chat-fg); text-decoration: underline; text-underline-offset: 2px; text-decoration-color: oklch(0.985 0.002 106 / 35%); }
.chat-md a:hover { text-decoration-color: currentColor; }
.chat-md hr { border: 0; border-top: 1px solid var(--chat-border); margin: 20px 0; }

/* ── 通用小按钮 + 状态点 ── */
.chat-btn { border: 1px solid var(--chat-border); background: transparent; color: var(--chat-fg); border-radius: 10px; padding: 5px 10px; font-size: 12px; line-height: 18px; cursor: pointer; transition: background .15s var(--chat-ease), border-color .15s var(--chat-ease); }
.chat-btn:hover { border-color: var(--chat-border-strong); background: oklch(0.985 0.002 106 / 4%); }
.chat-status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 999px; background: var(--chat-border-strong); }

.chat-slow-hint { width: 100%; max-width: 44rem; margin: 0 auto; padding: 8px 20px 0; font-size: 12px; line-height: 18px; color: var(--chat-muted-fg); opacity: .8; }

/* ── 错误条（assistant-ui error-state 观感：静默红条 + 重试） ── */
.chat-error-wrap { width: 100%; max-width: 44rem; margin: 0 auto; padding: 0 20px 8px; }
.chat-error { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid oklch(0.62 0.19 25 / 45%); background: oklch(0.62 0.19 25 / 8%); border-radius: 12px; color: oklch(0.86 0.07 25); font-size: 13px; line-height: 20px; }
.chat-error svg { flex: none; margin-top: 3px; }
.chat-error-body { flex: 1; min-width: 0; }
.chat-error-title { margin: 0; font-weight: 500; }
.chat-error-detail { margin: 2px 0 0; opacity: .8; overflow-wrap: anywhere; }
.chat-error-retry { flex: none; border: 1px solid oklch(0.86 0.07 25 / 35%); background: transparent; color: inherit; border-radius: 8px; padding: 3px 10px; font-size: 12px; line-height: 18px; cursor: pointer; }
.chat-error-retry:hover { background: oklch(0.86 0.07 25 / 10%); }

/* ── 设置页 ── */
.chat-settings-wrap { width: 100%; max-width: 44rem; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.chat-settings-card { border: 1px solid var(--chat-border); background: var(--chat-card); border-radius: 16px; padding: 16px; }
.chat-settings-title { margin-bottom: 10px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--chat-muted-fg); }
.chat-settings-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.chat-settings-key { flex: none; width: 96px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--chat-muted-fg); }
.chat-settings-value { flex: 1; min-width: 0; text-align: left; padding: 6px 10px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--chat-fg); font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.chat-settings-value:hover { border-color: var(--chat-border); }
.chat-settings-input { flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--chat-border-strong); border-radius: 10px; background: var(--chat-bg); color: var(--chat-fg); font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 18px; outline: none; }
.chat-settings-show { flex: none; font-size: 11px; color: var(--chat-muted-fg); background: transparent; border: 0; cursor: pointer; }
.chat-settings-select { flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--chat-border-strong); border-radius: 10px; background: var(--chat-bg); color: var(--chat-fg); font-family: ui-monospace, Menlo, monospace; font-size: 12px; line-height: 18px; outline: none; cursor: pointer; }
.chat-settings-hint { margin-top: 8px; font-size: 11px; line-height: 16px; color: var(--chat-muted-fg); opacity: .75; }
.chat-settings-msg { padding: 8px 12px; border: 1px solid var(--chat-border); border-radius: 10px; font-size: 12px; color: var(--chat-muted-fg); }

/* ── worldline marker（compact/prune/branch/join）── */
.chat-marker { display: flex; align-items: center; gap: 8px; margin: 18px 0 10px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; letter-spacing: .06em; color: var(--chat-muted-fg); }
.chat-marker-dot { width: 4px; height: 4px; flex: none; border-radius: 999px; background: currentColor; opacity: .55; }
.chat-marker-label { opacity: .8; }
.chat-marker-more { margin-inline-start: auto; font-family: inherit; }
.chat-marker-more > summary { cursor: pointer; list-style: none; opacity: .65; }
.chat-marker-summary { margin-top: 8px; padding: 8px 10px; border: 1px solid var(--chat-border); border-radius: 8px; background: var(--chat-card); color: var(--chat-fg); font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; letter-spacing: 0; }

/* ── 运行中：三连点（末尾是 user/tools 时出现，assistant 一到就消失） ── */
.chat-typing { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; font-size: 14px; line-height: 20px; color: var(--chat-muted-fg); }
.chat-typing-dots { display: inline-flex; gap: 3px; }
.chat-typing-dots i { width: 4px; height: 4px; border-radius: 999px; background: var(--chat-muted-fg); animation: chat-bounce 1.2s infinite ease-in-out; }
.chat-typing-dots i:nth-child(2) { animation-delay: .15s; }
.chat-typing-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes chat-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-3px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .chat-typing-dots i { animation: none; } }

/* ── 代码块：assistant-ui 式 header（语言 + 复制）+ 纯文本回退 ── */
.chat-codeblock { margin: 12px 0; border: 1px solid var(--chat-border); border-radius: 12px; overflow: hidden; }
.chat-code-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 4px 12px; background: var(--chat-card); border-bottom: 1px solid var(--chat-border); font-family: ui-monospace, Menlo, monospace; font-size: 11px; line-height: 20px; color: var(--chat-muted-fg); }
.chat-codeblock pre { margin: 0; padding: 12px 16px; border: 0; border-radius: 0; background: var(--chat-card); font-size: 13px; line-height: 1.6; overflow-x: auto; }
.chat-codeblock code { font-size: 13px; }

/* ── 空态 + 跳底 pill ── */
.chat-jump {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--chat-border);
  border-radius: 999px;
  background: var(--chat-card);
  color: var(--chat-fg);
  font-size: 12px;
  cursor: pointer;
  transition: border-color .15s var(--chat-ease);
}
.chat-jump:hover { border-color: var(--chat-border-strong); }

/* ── composer：1rem + 8px + muted 30% 混合底；focus-within 边框加深 ── */
.chat-composer {
  width: 100%;
  max-width: 44rem;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: color-mix(in oklab, var(--chat-muted) 30%, transparent);
  border: 1px solid var(--chat-border);
  border-radius: var(--chat-radius);
  padding: 10px 10px 8px;
  transition: border-color .15s var(--chat-ease);
}
.chat-composer:focus-within { border-color: var(--chat-border-strong); }
.chat-composer-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding-top: 4px; }
.chat-qcluster { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; min-width: 0; }
.chat-qsep { width: 1px; height: 12px; margin: 0 2px; background: oklch(0.985 0.002 106 / 8%); }
.chat-qsel-wrap { position: relative; }
.chat-qsel {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 7px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--chat-muted-fg);
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
  transition: background .15s var(--chat-ease), color .15s var(--chat-ease);
}
.chat-qsel:hover, .chat-qsel.is-open { background: oklch(0.985 0.002 106 / 6%); color: var(--chat-fg); }
.chat-qsel:focus-visible { outline: 1px solid var(--chat-border-strong); outline-offset: 1px; }
.chat-qsel:disabled { opacity: .45; cursor: default; }
.chat-qsel-ic { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; opacity: .55; }
.chat-qsel-v { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--chat-fg); opacity: .9; }
.chat-qsel-chev { opacity: .35; }
.chat-qmenu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  z-index: 40;
  min-width: 150px;
  padding: 4px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-card);
}
.chat-qitem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-fg);
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}
.chat-qitem:hover { background: oklch(0.985 0.002 106 / 6%); }
.chat-qitem.is-on { background: oklch(0.985 0.002 106 / 8%); }
.chat-qcheck { color: var(--chat-muted-fg); font-size: 11px; }
.chat-qempty { display: block; padding: 6px 8px; color: var(--chat-muted-fg); font-size: 12px; }
.chat-composer-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.chat-mono { position: relative; flex: 1; min-width: 0; padding-left: 8px; }
.chat-mono-host { width: 100%; min-height: 38px; overflow: hidden; color: var(--chat-fg); }
.chat-mono-host .monaco-editor,
.chat-mono-host .monaco-editor .overflow-guard,
.chat-mono-host .monaco-editor .monaco-scrollable-element,
.chat-mono-host .monaco-editor .monaco-editor-background,
.chat-mono-host .monaco-editor .margin { background: transparent !important; }
.chat-mono-host .monaco-editor .scroll-decoration { display: none; }
.chat-mono-host,
.chat-mono-host *,
.chat-mono-host .monaco-editor.focused,
.chat-mono-host .monaco-editor:focus,
.chat-mono-host .monaco-editor:focus-visible,
.chat-mono-host .monaco-editor .native-edit-context:focus,
.chat-mono-host .monaco-editor .native-edit-context:focus-visible { outline: none !important; }
.chat-mono-placeholder {
  position: absolute;
  left: 8px;
  top: 6px;
  font-family: inherit;
  font-size: 16px;
  line-height: 26px;
  color: color-mix(in oklab, var(--chat-muted-fg) 65%, transparent);
  pointer-events: none;
}
.chat-input {
  flex: 1;
  border: 0;
  min-height: 40px;
  max-height: 12rem;
  overflow-y: auto;
  resize: none;
  background: transparent;
  padding: 4px 10px;
  font-family: var(--chat-font);
  font-size: 16px;
  line-height: 26px;
  color: var(--chat-fg);
  outline: none;
}
.chat-input::placeholder { color: color-mix(in oklab, var(--chat-muted-fg) 65%, transparent); }
.chat-user-edit .chat-input { outline: none !important; }
.chat-user-edit:focus-within { border-color: var(--chat-border-strong); }
.chat-send {
  flex: 0 0 auto;
  display: inline-flex;
  padding: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid oklch(0.708 0.004 106 / 15%);
  background: transparent;
  color: var(--chat-muted-fg);
  cursor: pointer;
  transition: background .15s var(--chat-ease), color .15s var(--chat-ease);
}
.chat-send:hover { background: oklch(0.985 0.002 106 / 6%); color: var(--chat-fg); }
.chat-send:not(:disabled) { color: var(--chat-fg); border-color: var(--chat-border-strong); }
.chat-stop-square { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }

@keyframes chat-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes chat-caret-blink { 0%, 49% { opacity: .75; } 50%, 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .chat-dot-live, .chat-stream-caret { animation: none; } }

/* @wts-tailwind:start */
/*! tailwindcss v0.0.0-insiders.fa81d69 | MIT License | https://tailwindcss.com */
@layer properties;
:root, :host {
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  --spacing: 0.25rem;
  --font-weight-medium: 500;
  --leading-relaxed: 1.625;
  --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.pointer-events-none {
  pointer-events: none;
}
.absolute {
  position: absolute;
}
.relative {
  position: relative;
}
.inset-0 {
  inset: 0px;
}
.mb-3 {
  margin-bottom: calc(var(--spacing) * 3);
}
.flex {
  display: flex;
}
.h-full {
  height: 100%;
}
.min-h-0 {
  min-height: 0px;
}
.w-\[260px\] {
  width: 260px;
}
.w-full {
  width: 100%;
}
.min-w-0 {
  min-width: 0px;
}
.flex-1 {
  flex: 1;
}
.shrink-0 {
  flex-shrink: 0;
}
.animate-pulse {
  animation: var(--animate-pulse);
}
.flex-col {
  flex-direction: column;
}
.flex-wrap {
  flex-wrap: wrap;
}
.items-baseline {
  align-items: baseline;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.justify-center {
  justify-content: center;
}
.gap-2 {
  gap: calc(var(--spacing) * 2);
}
.gap-3 {
  gap: calc(var(--spacing) * 3);
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overflow-y-auto {
  overflow-y: auto;
}
.rounded-\[10px\] {
  border-radius: 10px;
}
.rounded-full {
  border-radius: calc(infinity * 1px);
}
.border {
  border-style: var(--tw-border-style);
  border-width: 1px;
}
.border-t {
  border-top-style: var(--tw-border-style);
  border-top-width: 1px;
}
.border-r {
  border-right-style: var(--tw-border-style);
  border-right-width: 1px;
}
.border-b {
  border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
}
.px-3 {
  padding-inline: calc(var(--spacing) * 3);
}
.px-5 {
  padding-inline: calc(var(--spacing) * 5);
}
.px-6 {
  padding-inline: calc(var(--spacing) * 6);
}
.py-1 {
  padding-block: var(--spacing);
}
.py-2 {
  padding-block: calc(var(--spacing) * 2);
}
.py-3 {
  padding-block: calc(var(--spacing) * 3);
}
.py-4 {
  padding-block: calc(var(--spacing) * 4);
}
.py-6 {
  padding-block: calc(var(--spacing) * 6);
}
.pt-3 {
  padding-top: calc(var(--spacing) * 3);
}
.pt-6 {
  padding-top: calc(var(--spacing) * 6);
}
.pb-4 {
  padding-bottom: calc(var(--spacing) * 4);
}
.pb-5 {
  padding-bottom: calc(var(--spacing) * 5);
}
.text-center {
  text-align: center;
}
.text-left {
  text-align: left;
}
.font-mono {
  font-family: var(--font-mono);
}
.text-\[10px\] {
  font-size: 10px;
}
.text-\[11px\] {
  font-size: 11px;
}
.text-\[12px\] {
  font-size: 12px;
}
.text-\[15px\] {
  font-size: 15px;
}
.leading-relaxed {
  --tw-leading: var(--leading-relaxed);
  line-height: var(--leading-relaxed);
}
.font-medium {
  --tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
}
.tracking-\[-0\.01em\] {
  --tw-tracking: -0.01em;
  letter-spacing: -0.01em;
}
.tracking-\[0\.08em\] {
  --tw-tracking: 0.08em;
  letter-spacing: 0.08em;
}
.text-\[\#6b62f2\] {
  color: #6b62f2;
}
.text-\[\#ededed\] {
  color: #ededed;
}
.opacity-35 {
  opacity: 35%;
}
.opacity-45 {
  opacity: 45%;
}
.opacity-50 {
  opacity: 50%;
}
.opacity-55 {
  opacity: 55%;
}
.opacity-60 {
  opacity: 60%;
}
.opacity-80 {
  opacity: 80%;
}
.outline-none {
  --tw-outline-style: none;
  outline-style: none;
}
@property --tw-border-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}
@property --tw-leading {
  syntax: "*";
  inherits: false;
}
@property --tw-font-weight {
  syntax: "*";
  inherits: false;
}
@property --tw-tracking {
  syntax: "*";
  inherits: false;
}
@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
@layer properties {
  @supports ((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b)))) {
    *, ::before, ::after, ::backdrop {
      --tw-border-style: solid;
      --tw-leading: initial;
      --tw-font-weight: initial;
      --tw-tracking: initial;
    }
  }
}
/* @wts-tailwind:end */
```