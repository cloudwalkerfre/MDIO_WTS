# core

```jsx@core
import { inlineTextOf, contentValueOf } from "ui_core/uiMd";
// 会话核心：纯逻辑、零 UI。通信全走 ws（client.exec 显式 wt_uid）。
const NL = String.fromCharCode(10);
// 会话文档住在**本 app 当前所在的 wt**（uid 由 ?wt= 给；重新注册会变 ⇒ 不写死）。
// 取不到活树时回落到 genesis（会话文档落在根树，功能不崩）。
export const CHAT_WT_FALLBACK = "genesis";
export function chatWt(client) {
  try { const w = client && typeof client.wt === "function" ? client.wt() : null; return (w && w.uid) || CHAT_WT_FALLBACK; } catch (e) { return CHAT_WT_FALLBACK; }
}
export const AGENT = "dev";
export const ALIAS = "DEEPSEEK_V4F";
export const SYS_DEFAULT = "你是 mdio 开发助手。先读 /DEMO/guide_app.md，按它的规则在 mdio 里写 app。写之前先读现状，写完读回验证。";

export function docPath(sid) {
  return "/chat/" + sid + ".md";
}

export function sidOf(path) {
  const p = String(path || "");
  if (p.indexOf("/chat/") !== 0) return "";
  const rest = p.slice(6);
  if (rest.length < 4) return "";
  if (rest.slice(rest.length - 3) !== ".md") return "";
  return rest.slice(0, rest.length - 3);
}

export async function execW(client, code, wt) {
  return String(await client.exec(code, { wt_uid: wt || chatWt(client) }));
}

// 会话文档不在壳的启动文件表里也能取到：先查活树索引，再回落到网关文件树，最后拿到 docId。
export async function docIdOf(client, sid) {
  const path = docPath(sid);
  const wt = client && typeof client.wt === "function" ? client.wt() : null;
  const viaTree = wt && wt.byPath ? wt.byPath[path] : null;
  if (viaTree != null) return Number(viaTree);
  const tree = await client.fullTree(chatWt(client));
  const list = Array.isArray(tree) ? tree : [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e && String(e.path) === path) return Number(e.id);
  }
  return null;
}

// 「我要这篇」：把 docId 交给工作树店（幂等）。到帧由店的三态盒推进，组件经 observer 重算 —— 不轮询。
export function observeDoc(client, id) {
  const wt = client && typeof client.wt === "function" ? client.wt() : null;
  if (!wt || typeof wt.observe !== "function" || !id) return null;
  try { return wt.observe(Number(id)); } catch (e) { return null; }
}

function words(text) {
  const out = [];
  const rows = String(text || "").split(NL);
  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(" ");
    for (let j = 0; j < cols.length; j++) {
      const w = cols[j].trim();
      if (w) out.push(w);
    }
  }
  return out;
}

export async function lsSessions(client) {
  const raw = await execW(client, "ls -p /chat", chatWt(client));
  if (String(raw).indexOf("mdio_error") >= 0) return [];
  const out = [];
  const ws = words(raw);
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (w.length > 3 && w.slice(w.length - 3) === ".md") out.push(w.slice(0, w.length - 3));
  }
  return out;
}

export async function readState(client, sid) {
  const raw = await execW(client, "$ " + docPath(sid) + "::state -pj ct", chatWt(client));
  const out = { name: sid, wt: "genesis", wl: "", model: "", reasoning: "", created: "" };
  const rows = String(raw).split(NL);
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim();
    if (line.indexOf("- ") !== 0) continue;
    const body = line.slice(2);
    const k = body.indexOf(":");
    if (k < 0) continue;
    const key = body.slice(0, k).trim();
    if (key === "name" || key === "wt" || key === "wl" || key === "model" || key === "reasoning" || key === "created") out[key] = body.slice(k + 1).trim();
  }
  return out;
}

export function writeState(client, sid, key, val) {
  return execW(client, JSON.stringify(String(val)) + " | /> " + docPath(sid) + "::state._b:" + key, chatWt(client));
}

export function delSession(client, sid) {
  return execW(client, "rm -f " + docPath(sid), chatWt(client));
}

export async function mkSession(client, sid, name, wt) {
  const body = "## state" + NL + "- name: " + name + NL + "- wt: " + wt + NL +
    "- wl:" + NL + "- model:" + NL + "- reasoning:" + NL +
    "- created: " + new Date().toISOString() + NL + "## HIS" + NL;
  await execW(client, "mk -f " + docPath(sid), chatWt(client));
  await execW(client, JSON.stringify(body) + " | /> " + docPath(sid) + "::", chatWt(client));
}

export async function agentReady(client) {
  const s = await execW(client, "@LLM." + AGENT, "genesis");
  return String(s).indexOf("## " + AGENT) >= 0 && String(s).indexOf("mdio_error") < 0;
}

export async function initAgent(client, alias) {
  const r = await execW(client, "@LLM." + AGENT + ".init -m " + JSON.stringify(alias || ALIAS) + " -sysp " + JSON.stringify(SYS_DEFAULT) + " -tool true", "genesis");
  return String(r).indexOf("mdio_error") < 0 || String(r).indexOf("already exists") >= 0;
}

// ── 世界线（chat ↔ LLM）：branch 只是 HIS 的直接子标题（path 目标地址）——
// wl 匹配的是 gate tag；branch 地址/branch id 标注不参与 wl。
export async function listBranches(client, sid) {
  const raw = await execW(client, "$ " + docPath(sid) + "::HIS._h -pj tag", chatWt(client));
  if (String(raw).indexOf("mdio_error") >= 0) return [];
  const out = [];
  const heads = String(raw).split(NL).map(function (s) { return s.trim(); }).filter(Boolean);
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (h === "main") continue;
    out.push({ name: h, label: h });
  }
  return out;
}

// 当前 agent 的 wl（空 = 主线，不启用世界线选择）。配置住在 genesis /.mds/llm.md::AGENTS.dev。
export async function readWl(client) {
  // raw（不是 ct）：要把 `- wl: <expr>` 行连同前缀读回来；配置更新会追加多条，取最后一条。
  const raw = await execW(client, "$ /.mds/llm.md::AGENTS." + AGENT + "..wl -pj raw", "genesis");
  if (String(raw).indexOf("mdio_error") >= 0) return "";
  const rows = String(raw).split(NL);
  let last = "";
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].trim();
    if (t.indexOf("- wl:") === 0) last = t.slice(5).trim();
  }
  return last;
}

export function setWl(client, expr) {
  return execW(client, "@LLM." + AGENT + " -wl " + JSON.stringify(String(expr || "")), "genesis");
}

// 零复制建线：以父线当前写段第 idx 条记录为 host，挂 branch 门并建目标段（不复制记录）。
// wl 命名与父线前缀由调用方算好：root 线 => e<hex>；子线 => <parent>_e<hex>。
export function branchCreate(client, wl, idx) {
  return execW(client, "@LLM." + AGENT + " -wl " + JSON.stringify(String(wl || "")) + " -branch " + String(Number(idx) || 0), "genesis");
}

// 当前模型别名（AGENTS.dev.m）。模型选择写这里；别名 → model/base_url 在 LLM_CONFIG 节。
export async function readModelAlias(client) {
  const raw = await execW(client, "$ /.mds/llm.md::AGENTS." + AGENT + "._b:m -pj ct", "genesis");
  const v = String(raw).split(NL)[0].trim();
  return (v && String(raw).indexOf("mdio_error") < 0) ? v : ALIAS;
}

export function writeModelAlias(client, alias) {
  return execW(client, JSON.stringify(String(alias || "")) + " | /> /.mds/llm.md::AGENTS." + AGENT + "._b:m", "genesis");
}

export async function listAliases(client) {
  const raw = await execW(client, "$ /.mds/llm_config.md", "genesis");
  const out = [];
  const rows = String(raw).split(NL);
  for (let i = 0; i < rows.length; i++) {
    const line = String(rows[i]).trim();
    if (line.indexOf("## ") === 0) out.push(line.slice(3).trim());
  }
  return out;
}

export function writeReasoning(client, alias, val) {
  return execW(client, JSON.stringify(String(val || "")) + " | /> /.mds/llm_config.md::LLM_CONFIG." + alias + "._b:reasoning_effort", "genesis");
}

// 每次发送前把“本 session 的 LLM 快捷设置”（模型/推理强度）落到全局 agent/alias 配置。
// 世界线 wl 不再写 config：发送时按 -wl 传本次落点（run-scoped），只有空输入的重生成才用 setWl 钉指针。
export async function applySessionSettings(client, st, fallbackAlias) {
  const s = st || {};
  const alias = String(s.model || fallbackAlias || ALIAS);
  if (alias) await writeModelAlias(client, alias);
  if (s.reasoning != null) await writeReasoning(client, alias, String(s.reasoning || "auto"));
  return { alias, wl: String(s.wl || ""), reasoning: String(s.reasoning || "") };
}

export function setHis(client, sid) {
  return execW(client, "@LLM." + AGENT + ".run -his " + chatWt(client) + ":" + docPath(sid) + "::HIS", "genesis");
}

export function sendMsg(client, msg, wt, wl) {
  // .stream = 字面意义的追加：每 chunk 一次 +> 进 bq ct，格式永远在 bq 内。
  // 带输入时 -wl 是本次 run 的落点（run-scoped，不写 config）；主时间线显式传 main。
  return execW(client, JSON.stringify(msg) + " | @LLM." + AGENT + ".stream -wl " + JSON.stringify(String(wl || "main")), wt || "genesis");
}

export function regenMsg(client, wt) {
  // 空输入 = 不追加 user 记录，按现有 HIS 重新跑一轮（线性会话的「重新生成」）。
  // -wl 只在有输入时是 run-scoped；空输入仍读 config 指针，调用方先 setWl 钉住当前线。
  return execW(client, "@LLM." + AGENT + ".stream", wt || "genesis");
}

// ── 停止通道 ────────────────────────────────────────────────────────────────
// 主 client 的 exec 走 wasm/LPPB 通路，与进行中的 .stream 共用一条串行通道：
// stream 没结束，@LLM.close 就发不出去（点了停止也没反应）。
// 停止另开一条裸 WS，走网关 0x05 主线程直连 exec 通道（SOP 通道），与 stream 连接互不阻塞。
let _ctlWs = null;
let _ctlSeq = 0;
const _ctlPending = new Map();
function _ctlUrl() {
  return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/gateway/genesis";
}
function _ctlEnsure() {
  if (_ctlWs && _ctlWs.readyState <= 1) return _ctlWs;
  const ws = new WebSocket(_ctlUrl());
  ws.binaryType = "arraybuffer";
  ws.onmessage = function (ev) {
    try {
      const buf = ev.data;
      if (!buf || !buf.byteLength) return;
      const dv = new DataView(buf);
      if (dv.getUint8(0) !== 0x85) return;   // 只关心 DN_EXEC
      const len = dv.getUint32(1, true);
      const text = new TextDecoder().decode(new Uint8Array(buf, 13, len));
      const first = _ctlPending.keys().next();
      if (first.done) return;
      const fn = _ctlPending.get(first.value);
      _ctlPending.delete(first.value);
      if (fn) fn(text);
    } catch (e) { /* 控制通道失败不阻塞 UI */ }
  };
  _ctlWs = ws;
  return ws;
}
export function controlExec(code, wt) {
  return new Promise(function (resolve, reject) {
    const ws = _ctlEnsure();
    const enc = new TextEncoder().encode(JSON.stringify({ code: code, wt_uid: wt || "genesis" }));
    const frame = new Uint8Array(13 + enc.length);
    const dv = new DataView(frame.buffer);
    dv.setUint8(0, 0x05);
    dv.setUint32(1, enc.length, true);
    dv.setUint32(5, 0, true);
    dv.setUint32(9, 0, true);
    frame.set(enc, 13);
    const id = ++_ctlSeq;
    _ctlPending.set(id, resolve);
    const send = function () {
      try { ws.send(frame); } catch (e) { _ctlPending.delete(id); reject(e); }
    };
    if (ws.readyState === 1) send();
    else ws.addEventListener("open", send, { once: true });
  });
}

// ── 设置页数据层：tojson 信封 → 扁平对象（唯一归一点）────────────────
function isNode(v) { return v && typeof v === "object" && typeof v.nt === "string"; }
function kidsOf(node) { return Array.isArray(node && node.ct) ? node.ct : []; }
function parseBullets(bl) {
  const out = [];
  for (const b of kidsOf(bl)) {
    if (!isNode(b) || b.nt !== "b") continue;
    const key = inlineTextOf(b.t).trim();
    if (!key) continue;
    const val = contentValueOf(b);
    out.push({ key: key, value: val == null ? inlineTextOf(b.ct).trim() : String(val).trim() });
  }
  return out;
}
function parseSection(node) {
  const out = { title: inlineTextOf(node.t).trim(), level: node.lv, bullets: [], sections: [] };
  for (const c of kidsOf(node)) {
    if (!isNode(c)) continue;
    if (c.nt === "h") out.sections.push(parseSection(c));
    else if (c.nt === "bl") out.bullets.push.apply(out.bullets, parseBullets(c));
  }
  return out;
}
function findSection(root, title) {
  for (const h of kidsOf(root)) {
    if (isNode(h) && h.nt === "h" && h.lv === 1 && inlineTextOf(h.t).trim() === title) return parseSection(h);
  }
  return null;
}
function kvOf(section) {
  const out = {};
  for (const b of (section && section.bullets) || []) out[b.key] = b.value;
  return out;
}
function boolOf(v) { return v === true || String(v).trim() === "true"; }
function qsel(s) { return JSON.stringify(String(s)); }
async function readTree(client, code) {
  const raw = await execW(client, code, "genesis");
  try { return JSON.parse(raw); } catch (e) { return null; }
}

export async function readConfig(client) {
  const env = await readTree(client, "$ /.mds/llm_config.md | tojson");
  const cfg = findSection(env, "LLM_CONFIG");
  const prov = findSection(env, "PROVIDERS");
  const aliases = {};
  const providers = {};
  for (const sec of (cfg && cfg.sections) || []) aliases[sec.title] = kvOf(sec);
  for (const sec of (prov && prov.sections) || []) providers[sec.title] = kvOf(sec);
  return { aliases: aliases, providers: providers };
}

export async function readProviders(client) {
  const env = await readTree(client, "@LLM -provider | tojson");
  const prov = findSection(env, "PROVIDERS");
  const out = {};
  for (const sec of (prov && prov.sections) || []) {
    const item = kvOf(sec);
    const caps = (sec.sections || []).filter(function (s) { return s.title === "capabilities"; })[0];
    item.capabilities = caps ? kvOf(caps) : {};
    out[sec.title] = item;
  }
  return out;
}

export async function readBalance(client, provider) {
  const env = await readTree(client, "@LLM -provider " + provider + " -balance | tojson");
  const root = findSection(env, "BALANCE");
  const sec = root && (root.sections || [])[0];
  if (!sec) return { supported: false };
  const out = kvOf(sec);
  out.supported = boolOf(out.supported);
  out.is_available = boolOf(out.is_available);
  out.balances = [];
  const balances = (sec.sections || []).filter(function (s) { return s.title === "balances"; })[0];
  for (const cur of (balances && balances.sections) || []) {
    const row = kvOf(cur);
    row.currency = cur.title;
    out.balances.push(row);
  }
  return out;
}

export async function checkAlias(client, alias) {
  const env = await readTree(client, "@LLM -check " + alias + " | tojson");
  const root = findSection(env, "CHECK");
  const sec = root && (root.sections || [])[0];
  const msgs = (root && (root.sections || []).filter(function (s) { return s.title === "messages"; })[0]);
  return {
    config: sec ? kvOf(sec) : {},
    messages: (msgs && msgs.bullets ? msgs.bullets.map(function (b) { return b.value; }) : [])
  };
}

export function writeConfigField(client, kind, name, key, val) {
  const path = "/.mds/llm_config.md::" + qsel(kind) + "." + qsel(name) + "._b:" + key;
  return execW(client, qsel(String(val)) + " | /> " + path, "genesis");
}

export function appendSection(client, kind, name, fields) {
  const lines = ["", "## " + name];
  Object.keys(fields || {}).forEach(function (k) { lines.push("- " + k + ": " + String(fields[k])); });
  const path = "/.mds/llm_config.md::" + qsel(kind);
  return execW(client, qsel(lines.join(NL)) + " | +> " + path, "genesis");
}

export async function removeSection(client, kind, name) {
  const raw = await execW(client, "$ /.mds/llm_config.md -pj raw", "genesis");
  const lines = String(raw).split(NL);
  const out = [];
  const head = "## " + name;
  let skip = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!skip && line.trim() === head) { skip = true; continue; }
    if (skip) {
      if (line.indexOf("## ") === 0 || line.indexOf("# ") === 0) { skip = false; }
      else continue;
    }
    out.push(line);
  }
  const clean = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i].trim() === "" && clean.length && clean[clean.length - 1].trim() === "") continue;
    clean.push(out[i]);
  }
  while (clean.length && clean[0].trim() === "") clean.shift();
  while (clean.length && clean[clean.length - 1].trim() === "") clean.pop();
  const text = kind ? clean.join(NL) + NL : clean.join(NL);
  await execW(client, qsel(text) + " | /> /.mds/llm_config.md", "genesis");
}

export async function readAgent(client) {
  const raw = await execW(client, "$ /.mds/llm.md::\"AGENTS\".\"dev\" -pj raw", "genesis");
  const out = {};
  const rows = String(raw || "").split(NL);
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim();
    if (line.indexOf("- ") !== 0) continue;
    const body = line.slice(2);
    const k = body.indexOf(":");
    if (k < 0) continue;
    const key = body.slice(0, k).trim();
    if (!key) continue;
    out[key] = body.slice(k + 1).trim();
  }
  return out;
}

export function writeAgentField(client, key, val) {
  const path = "/.mds/llm.md::" + qsel("AGENTS") + "." + qsel("dev") + "._b:" + key;
  return execW(client, qsel(String(val)) + " | /> " + path, "genesis");
}

export async function readModels(client, provider) {
  const env = await readTree(client, "@LLM -provider " + provider + " -models | tojson");
  const root = findSection(env, "MODELS");
  const sec = root && (root.sections || [])[0];
  if (!sec) return { supported: false, models: [] };
  const out = kvOf(sec);
  out.supported = boolOf(out.supported);
  const models = (sec.sections || []).filter(function (s) { return s.title === "models"; })[0];
  out.models = (models && models.bullets ? models.bullets.map(function (b) { return b.value; }) : []);
  return out;
}

export function stopAgent(client, wt) {
  return controlExec("@LLM." + AGENT + ".close", wt || "genesis");
}

export default { execW, lsSessions, readState, writeState, delSession, mkSession, docPath, sidOf, docIdOf, observeDoc, agentReady, initAgent, listBranches, readWl, setWl, branchCreate, readModelAlias, writeModelAlias, setHis, sendMsg, regenMsg, stopAgent, readConfig, readProviders, readBalance, checkAlias, writeConfigField, appendSection, removeSection, readAgent, writeAgentField, readModels, chatWt, CHAT_WT_FALLBACK, AGENT, ALIAS, SYS_DEFAULT };
```