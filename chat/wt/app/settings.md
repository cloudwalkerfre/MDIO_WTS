# settings

```jsx@settings
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";

// 可定制 provider 清单：键 = any-llm provider id，值 = 显示名。
const PROVIDER_CHOICES = { deepseek: "deepseek", moonshot: "kimi", zai: "glm", openai: "openai", gemini: "google" };
function providerLabel(id) { return PROVIDER_CHOICES[id] || id; }
function resolveProviderId(name) {
  const t = String(name || "").trim().toLowerCase();
  if (!t) return "";
  if (PROVIDER_CHOICES[t]) return t;
  const ids = Object.keys(PROVIDER_CHOICES);
  for (let i = 0; i < ids.length; i++) { if (String(PROVIDER_CHOICES[ids[i]]).toLowerCase() === t) return ids[i]; }
  return "";
}
function autoAliasName(provider, model) {
  const base = String(model).toLowerCase().indexOf(String(provider).toLowerCase() + "-") === 0 ? String(model) : (provider + "_" + model);
  return base.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}
function money(v) { return String(v == null ? "" : v).replace(/^"|"$/g, ""); }
function JsonOk(text) { try { const v = JSON.parse(String(text || "{}")); return v && typeof v === "object" && !Array.isArray(v); } catch (e) { return false; } }

function Row(props) {
  return <div className="chat-settings-row"><span className="chat-settings-key">{props.label}</span>{props.children}</div>;
}
function Input(props) {
  return <input className="chat-settings-input" style={{ flex: 1, minWidth: 0 }} type={props.type || "text"} value={props.value == null ? "" : String(props.value)} placeholder={props.placeholder || ""} spellCheck={false} onChange={function (e) { props.onChange(e.target.value); }} />;
}
function Select(props) {
  return (
    <select className="chat-settings-input" style={{ flex: 1, minWidth: 0 }} value={props.value == null ? "" : String(props.value)} onChange={function (e) { props.onChange(e.target.value); }}>
      {(props.options || []).map(function (o) { return <option key={o} value={o}>{(props.labels && props.labels[o]) || o || "(空)"}</option>; })}
    </select>
  );
}

export default observer(function SettingsPane({ app, client, onBack }) {
  const core = app.core;
  const [meta, setMeta] = useState({});
  const [providers, setProviders] = useState({});
  const [aliases, setAliases] = useState({});
  const [balances, setBalances] = useState({});
  const [balBusy, setBalBusy] = useState("");
  const [models, setModels] = useState({});
  const [modelsBusy, setModelsBusy] = useState("");
  const [drafts, setDrafts] = useState({});
  const [checks, setChecks] = useState({});
  const [showKey, setShowKey] = useState({});
  const [confirmDel, setConfirmDel] = useState("");
  const [newProv, setNewProv] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async function () {
    if (!core) return;
    try {
      const cfg = await core.readConfig(client);
      setProviders(cfg.providers || {});
      setAliases(cfg.aliases || {});
      try { setMeta(await core.readProviders(client)); } catch (e) { setMeta({}); }
    } catch (e) { setErr(String((e && e.message) || e)); }
  };

  const refreshBalance = async function (name) {
    if (!core) return;
    setBalBusy(name);
    try {
      const b = await core.readBalance(client, name);
      setBalances(function (prev) { const next = Object.assign({}, prev); next[name] = b; return next; });
    } catch (e) { setErr(String((e && e.message) || e)); }
    finally { setBalBusy(""); }
  };

  const refreshModels = async function (provider) {
    if (!provider) return;
    setModelsBusy(provider);
    try {
      const r = await core.readModels(client, provider);
      setModels(function (prev) { const next = Object.assign({}, prev); next[provider] = r; return next; });
    } catch (e) { setErr(String((e && e.message) || e)); }
    finally { setModelsBusy(""); }
  };

  useEffect(function () { load(); }, []);
  useEffect(function () { Object.keys(providers).forEach(function (name) { refreshBalance(name); }); }, [providers]);

  const dkey = function (scope, name, key) { return scope + "." + name + "." + key; };
  const origOf = function (scope, name, key) {
    const src = scope === "PROVIDERS" ? providers : aliases;
    const cfg = (src && src[name]) || {};
    const text = cfg[key] == null ? "" : String(cfg[key]);
    return key === "reasoning_effort" ? (text || "auto") : text;
  };
  const draftOf = function (scope, name, key) { const k = dkey(scope, name, key); return Object.prototype.hasOwnProperty.call(drafts, k) ? drafts[k] : origOf(scope, name, key); };
  const setDraft = function (scope, name, key, value) { const k = dkey(scope, name, key); setDrafts(function (prev) { const next = Object.assign({}, prev); next[k] = value; return next; }); };
  const dirtyKeysOf = function (scope, name) {
    const prefix = dkey(scope, name, "");
    return Object.keys(drafts).filter(function (k) {
      if (k.indexOf(prefix) !== 0) return false;
      const key = k.slice(prefix.length);
      const draft = String(drafts[k] == null ? "" : drafts[k]);
      const norm = key === "reasoning_effort" ? (draft || "auto") : draft;
      return norm !== origOf(scope, name, key);
    });
  };
  const dirtyOf = function (scope, name) { return dirtyKeysOf(scope, name).length > 0; };

  const applyFields = async function (scope, name) {
    const prefix = dkey(scope, name, "");
    const keys = dirtyKeysOf(scope, name);
    if (!keys.length) return;
    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i].slice(prefix.length);
        if (key === "extra_body" && !JsonOk(drafts[keys[i]])) { setErr(name + " · extra_body 不是合法 JSON object"); return; }
        await core.writeConfigField(client, scope, name, key, drafts[keys[i]]);
      }
      setDrafts(function (prev) { const next = Object.assign({}, prev); Object.keys(next).forEach(function (k) { if (k.indexOf(prefix) === 0) delete next[k]; }); return next; });
      setErr(""); setMsg("已保存 " + name + " · " + keys.length + " 项");
      await load();
      if (scope === "LLM_CONFIG") {
        try { const res = await core.checkAlias(client, name); setChecks(function (prev) { const next = Object.assign({}, prev); next[name] = res; return next; }); } catch (e) { /* 忽略 */ }
      }
    } catch (e) { setErr(String((e && e.message) || e)); }
  };

  const startNewProvider = function () { setNewProv({ kind: "", name: "", base_url: "", api_key: "", timeout: "180", envKey: "", available: true }); };
  const createProvider = async function () {
    if (!newProv) return;
    const id = resolveProviderId(newProv.name) || newProv.kind || "";
    const typed = String(newProv.name || "").trim();
    const canonical = id || typed;
    if (!canonical) { setErr("provider 名不能为空"); return; }
    if (providers[canonical] || providers[typed]) { setErr("provider 已存在: " + (providers[canonical] ? canonical : typed)); return; }
    const mm = id ? (meta[id] || {}) : {};
    const base = String(newProv.base_url || mm.api_base || "").trim();
    if (!base) { setErr("base_url 为空：请选择 provider（自动填 URL）或手填 base_url"); return; }
    try {
      await core.appendSection(client, "PROVIDERS", canonical, { base_url: base, api_key: newProv.api_key || "", timeout: newProv.timeout || "180" });
      setNewProv(null); setErr(""); setMsg("已新建 provider " + canonical); await load();
    } catch (e) { setErr(String((e && e.message) || e)); }
  };
  const fillProviderDefaults = async function (name) {
    const id = resolveProviderId(name) || name;
    const mm = meta[id] || meta[name] || {};
    const base = String(mm.api_base || "");
    if (!base) { setErr("没有可用的默认 base_url（该 provider 元数据不可得）"); return; }
    try { await core.writeConfigField(client, "PROVIDERS", name, "base_url", base); await load(); setMsg("已补默认 base_url: " + base); }
    catch (e) { setErr(String((e && e.message) || e)); }
  };
  const createAliasFromModel = async function (provider, model) {
    const aliasName = autoAliasName(provider, model);
    if (aliases[aliasName]) { setMsg("别名已存在: " + aliasName); return; }
    try { await core.appendSection(client, "LLM_CONFIG", aliasName, { provider: provider, model: model, extra_body: "{}" }); await load(); setMsg("已自动创建别名 " + aliasName); }
    catch (e) { setErr(String((e && e.message) || e)); }
  };
  const deleteItem = async function (kind, name) {
    if (kind === "PROVIDERS") {
      const target = resolveProviderId(name) || name;
      const used = Object.keys(aliases).filter(function (a) { const p = String(aliases[a].provider || ""); return (resolveProviderId(p) || p) === target; });
      if (used.length) { setErr("该 provider 仍被别名使用：" + used.join(", ") + "；请先删除或修改这些别名"); return; }
    }
    try { await core.removeSection(client, kind, name); setConfirmDel(""); setErr(""); setMsg("已删除 " + name); await load(); }
    catch (e) { setErr(String((e && e.message) || e)); }
  };

  const providerNames = Object.keys(meta).sort();
  const availProviders = providerNames.filter(function (p) { return (meta[p].available === "true" || meta[p].available === true); });
  const aliasNames = Object.keys(aliases).sort();
  const firstAlias = aliasNames[0] || "";
  const firstProv = firstAlias ? String(aliases[firstAlias].provider || "") : "";
  const firstBal = firstProv ? balances[firstProv] : null;
  const provKeyOf = function (name) {
    const raw = String((aliases[name] && aliases[name].provider) || "");
    return resolveProviderId(raw) || raw || "(未指定)";
  };
  const orderedAliasNames = aliasNames.slice().sort(function (a, b) {
    const pa = provKeyOf(a), pb = provKeyOf(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const groupCounts = {};
  orderedAliasNames.forEach(function (n) { const k = provKeyOf(n); groupCounts[k] = (groupCounts[k] || 0) + 1; });

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3" style={{ borderColor: "var(--chat-border)" }}>
        <button type="button" onClick={onBack} className="chat-btn">← 返回</button>
        <h1 className="text-[15px] font-medium tracking-[-0.01em]">设置</h1>
        <span className="font-mono text-[10px] tracking-[0.08em] opacity-45">genesis /.mds/llm_config.md</span>
        <span className="chat-header-meta" style={{ marginLeft: "auto", opacity: 0.7 }}>
          {firstAlias ? <span>{firstAlias} · {firstProv || "?"} / {aliases[firstAlias].model || "?"}</span> : null}
          {firstBal && firstBal.balances && firstBal.balances.length ? <span>{firstBal.balances.map(function (b) { return b.currency + " " + money(b.total_balance); }).join(" · ")}</span> : null}
          <button type="button" className="chat-btn" onClick={function () { load(); }}>刷新</button>
        </span>
      </header>
      <div className="chat-scroll flex-1 overflow-y-auto px-6 py-6">
        <div className="chat-settings-wrap">
          <div className="chat-settings-card">
            <div className="chat-settings-title">PROVIDERS · 连接</div>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              {newProv ? null : <button type="button" className="chat-btn" onClick={startNewProvider}>+ 新建 provider</button>}
            </div>
            {newProv ? (
              <div className="chat-settings-card" style={{ marginTop: 8, background: "transparent" }}>
                <Row label="provider"><Select value={newProv.kind} options={Object.keys(PROVIDER_CHOICES).filter(function (id) { return !providers[id]; })} labels={PROVIDER_CHOICES} onChange={function (v) { const mm = meta[v] || {}; setNewProv(Object.assign({}, newProv, { kind: v, name: v || "", base_url: mm.api_base || "", envKey: mm.env_key || "", available: mm.available })); }} /></Row>
                <Row label="名称"><Input value={newProv.name} onChange={function (v) { const id = resolveProviderId(v); const mm = id ? (meta[id] || {}) : {}; setNewProv(Object.assign({}, newProv, { name: v, kind: id || newProv.kind, base_url: (id && !newProv.base_url) ? (mm.api_base || "") : newProv.base_url, envKey: (id && mm.env_key) ? mm.env_key : newProv.envKey })); }} placeholder="openai / kimi / glm" /></Row>
                <Row label="base_url"><Input value={newProv.base_url} onChange={function (v) { setNewProv(Object.assign({}, newProv, { base_url: v })); }} placeholder="https://api.openai.com/v1" /></Row>
                <Row label="api_key"><Input value={newProv.api_key} onChange={function (v) { setNewProv(Object.assign({}, newProv, { api_key: v })); }} placeholder={newProv.envKey ? ("env:" + newProv.envKey + " 或字面 key") : "api_key"} /></Row>
                <Row label="timeout"><Input value={newProv.timeout} placeholder="180" onChange={function (v) { setNewProv(Object.assign({}, newProv, { timeout: v })); }} /></Row>
                {newProv.available === false || newProv.available === "false" ? (<div className="text-[11px]" style={{ color: "oklch(0.78 0.14 85)" }}>该 provider 的 SDK 未安装（元数据不可得），base_url 需手填。</div>) : null}
                <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                  <button type="button" className="chat-btn" onClick={createProvider}>创建</button>
                  <button type="button" className="chat-btn" onClick={function () { setNewProv(null); }}>取消</button>
                </div>
              </div>
            ) : null}
            {Object.keys(providers).sort().map(function (name) {
              const cfg = providers[name] || {};
              const m = meta[name] || {};
              const bal = balances[name];
              const caps = m.capabilities || {};
              const modelList = (models[name] && models[name].models) || [];
              return (
                <div key={"p-" + name} className="chat-settings-card" style={{ marginTop: 12, background: "transparent" }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--chat-border)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--chat-fg)", textTransform: "none" }}>{providerLabel(name)}</span>
                      {providerLabel(name) !== name ? <span style={{ fontSize: 11, opacity: 0.45, fontFamily: "ui-monospace, Menlo, monospace" }}>{name}</span> : null}
                    </div>
                    <span style={{ marginLeft: "auto" }}>
                      {confirmDel === "p:" + name ? (<span className="flex items-center gap-2 text-[11px]">确认删除？<button type="button" className="chat-btn" onClick={function () { deleteItem("PROVIDERS", name); }}>确认</button><button type="button" className="chat-btn" onClick={function () { setConfirmDel(""); }}>取消</button></span>) : (<button type="button" className="chat-btn" onClick={function () { setConfirmDel("p:" + name); }}>删除</button>)}
                    </span>
                  </div>
                  {!cfg.base_url || !String(cfg.base_url).trim() ? (<div className="flex items-center gap-2" style={{ marginBottom: 6 }}><span className="text-[11px]" style={{ color: "oklch(0.78 0.14 85)" }}>base_url 为空，该 provider 无法调用</span><button type="button" className="chat-btn" onClick={function () { fillProviderDefaults(name); }}>补默认 URL</button></div>) : null}
                  <Row label="base_url"><Input value={draftOf("PROVIDERS", name, "base_url", cfg.base_url)} onChange={function (v) { setDraft("PROVIDERS", name, "base_url", v); }} placeholder="https://api.example.com/v1" /></Row>
                  <Row label="api_key">
                    <Input type={showKey[name] ? "text" : "password"} value={draftOf("PROVIDERS", name, "api_key", cfg.api_key)} onChange={function (v) { setDraft("PROVIDERS", name, "api_key", v); }} placeholder={m.env_key ? ("env:" + m.env_key + " 或字面 key") : "api_key"} />
                    <button type="button" className="chat-btn" onClick={function () { setShowKey(function (prev) { const next = Object.assign({}, prev); next[name] = !prev[name]; return next; }); }}>{showKey[name] ? "隐藏" : "显示"}</button>
                  </Row>
                  {(!cfg.api_key || !String(cfg.api_key).trim()) && m.env_key ? <div className="text-[11px] opacity-50" style={{ marginBottom: 6 }}>未配置 api_key；可用环境变量 {m.env_key}</div> : null}
                  <Row label="timeout"><Input value={draftOf("PROVIDERS", name, "timeout", cfg.timeout)} onChange={function (v) { setDraft("PROVIDERS", name, "timeout", v); }} placeholder="180" /></Row>
                  <Row label="模型">
                    <button type="button" className="chat-btn" disabled={modelsBusy === name} onClick={function () { refreshModels(name); }}>{modelsBusy === name ? "拉取中…" : "拉取"}</button>
                    <span className="flex-1 text-[11px] opacity-60">{models[name] && models[name].error_kind ? ((m.env_key ? ("未配置 api_key（可用 " + m.env_key + "）") : ("拉取失败：" + models[name].error_kind))) : (modelList.length + " 个")}</span>
                  </Row>
                  {modelList.length ? (<div className="flex flex-wrap gap-2" style={{ marginTop: 6 }}>{modelList.slice(0, 12).map(function (mid) { return <button type="button" className="chat-btn" key={"m-" + mid} onClick={function () { createAliasFromModel(name, mid); }}>+ {mid}</button>; })}</div>) : null}
                  <Row label="余额">
                    <span className="flex-1 text-[12px] opacity-80">{bal == null ? "…" : bal.supported === false ? "不可查" : bal.error_kind ? "error: " + bal.error_kind : (bal.balances || []).map(function (b) { return b.currency + " " + money(b.total_balance); }).join(" · ")}</span>
                    <button type="button" className="chat-btn" disabled={balBusy === name} onClick={function () { refreshBalance(name); }}>{balBusy === name ? "查询中…" : "刷新"}</button>
                  </Row>
                  {dirtyOf("PROVIDERS", name) ? (<div className="flex items-center gap-2" style={{ marginTop: 8 }}><button type="button" className="chat-btn" onClick={function () { applyFields("PROVIDERS", name); }}>应用</button><span className="text-[11px] opacity-45">有未保存修改</span></div>) : null}
                </div>
              );
            })}
          </div>

          <div className="chat-settings-card">
            <div className="chat-settings-title">LLM_CONFIG</div>
            {aliasNames.length === 0 ? <div className="text-[12px] opacity-45">还没有别名。</div> : null}
            {orderedAliasNames.map(function (name, idx) {
              const cfg = aliases[name] || {};
              const prov = String(draftOf("LLM_CONFIG", name, "provider", cfg.provider) || "");
              const m = meta[prov] || {};
              const caps = m.capabilities || {};
              const reasoning = draftOf("LLM_CONFIG", name, "reasoning_effort", cfg.reasoning_effort) || "auto";
              const provOptions = [""].concat(Object.keys(providers).sort());
              const modelOptions = (models[prov] && (models[prov].models || []).length) ? models[prov].models : [];
              const check = checks[name];
              const provKey = provKeyOf(name);
              const showGroup = idx === 0 || provKeyOf(orderedAliasNames[idx - 1]) !== provKey;
              return (
                <div key={"a-" + name}>
                  {showGroup ? (
                    <div className="flex items-baseline gap-2" style={{ marginTop: 14, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--chat-border)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--chat-fg)", textTransform: "none" }}>{provKey === "(未指定)" ? "未指定 provider" : providerLabel(provKey)}</span>
                    </div>
                  ) : null}
                  <div className="chat-settings-card" style={{ marginTop: 12, background: "transparent" }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--chat-border)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, overflow: "hidden" }}>
                      <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--chat-fg)", fontFamily: "ui-monospace, Menlo, monospace", textTransform: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(cfg.model || "(no model)")}</span>
                    </div>
                    <span style={{ marginLeft: "auto" }}>
                      {confirmDel === "a:" + name ? (<span className="flex items-center gap-2 text-[11px]">确认删除？<button type="button" className="chat-btn" onClick={function () { deleteItem("LLM_CONFIG", name); }}>确认</button><button type="button" className="chat-btn" onClick={function () { setConfirmDel(""); }}>取消</button></span>) : (<button type="button" className="chat-btn" onClick={function () { setConfirmDel("a:" + name); }}>删除</button>)}
                    </span>
                  </div>
                  <Row label="别名"><span className="font-mono text-[12px]" style={{ opacity: 0.85 }}>{name}</span></Row>
                  <Row label="provider"><Select value={prov} labels={PROVIDER_CHOICES} options={provOptions} onChange={function (v) { setDraft("LLM_CONFIG", name, "provider", v); if (v) refreshModels(v); }} /></Row>
                  <Row label="model">
                    {modelOptions.length ? (<Select value={String(draftOf("LLM_CONFIG", name, "model", cfg.model) || "")} options={[String(draftOf("LLM_CONFIG", name, "model", cfg.model) || "")].concat(modelOptions.filter(function (x) { return x !== String(draftOf("LLM_CONFIG", name, "model", cfg.model) || ""); }))} onChange={function (v) { setDraft("LLM_CONFIG", name, "model", v); }} />) : (<Input value={draftOf("LLM_CONFIG", name, "model", cfg.model)} onChange={function (v) { setDraft("LLM_CONFIG", name, "model", v); }} placeholder="deepseek-flash" />)}
                    <button type="button" className="chat-btn" disabled={modelsBusy === prov} onClick={function () { refreshModels(prov); }}>{modelsBusy === prov ? "…" : "拉取"}</button>
                  </Row>
                  <Row label="推理强度">{caps.reasoning === true || caps.reasoning === "true" ? (<Select value={reasoning} options={["auto", "none", "low", "high", "max"]} onChange={function (v) { setDraft("LLM_CONFIG", name, "reasoning_effort", v); }} />) : (<span className="flex-1 text-[12px] opacity-50">该 provider 未声明 reasoning 能力</span>)}</Row>
                  <Row label="extra_body"><input className="chat-settings-input" style={{ flex: 1, minWidth: 0 }} value={draftOf("LLM_CONFIG", name, "extra_body", cfg.extra_body)} spellCheck={false} onChange={function (e) { setDraft("LLM_CONFIG", name, "extra_body", e.target.value); }} /></Row>
                  {dirtyOf("LLM_CONFIG", name) ? (<div className="flex items-center gap-2" style={{ marginTop: 8 }}><button type="button" className="chat-btn" onClick={function () { applyFields("LLM_CONFIG", name); }}>应用</button><span className="text-[11px] opacity-45">有未保存修改</span></div>) : null}
                  {check ? (<div className="text-[11px] opacity-60" style={{ marginTop: 6 }}>api_key_source: {(check.config && check.config.api_key_source) || "?"}{(check.messages || []).length ? " · " + check.messages.join(" · ") : " · 预检无预警"}</div>) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {err ? <div className="chat-settings-msg" style={{ color: "oklch(0.7 0.16 25)" }}>{err}</div> : null}
          {msg ? <div className="chat-settings-msg">{msg}</div> : null}
          <div className="text-[11px] opacity-35" style={{ paddingBottom: 24, textAlign: "center" }}>provider 元数据来自 any-llm · 余额按 provider 单独取</div>
        </div>
      </div>
    </section>
  );
});
```