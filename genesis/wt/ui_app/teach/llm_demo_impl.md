# LLM_DEMO_IMPL

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { useEffect, useState } from "react";

const NL = String.fromCharCode(10);
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const C = {
  card: { border: "1px solid var(--ui-demo-bd)", background: "var(--ui-demo-bg)", borderRadius: 14, padding: "16px 18px" },
  code: { fontSize: 12.5, lineHeight: 1.6, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  btn: { appearance: "none", border: "1px solid var(--ui-demo-bd)", background: "transparent", color: "var(--c-bone)", fontFamily: MONO, fontSize: 12, borderRadius: 9, padding: "5px 12px", cursor: "pointer", flex: "0 0 auto" },
  input: { flex: "1 1 260px", minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: "var(--c-bone)", background: "rgba(127,127,127,.10)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "7px 11px", outline: "none" },
  out: { margin: 0, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--c-ash)", background: "rgba(127,127,127,.08)", border: "1px solid var(--ui-demo-bd)", borderRadius: 10, padding: "8px 12px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 260, overflow: "auto" },
  hint: { fontSize: 12, lineHeight: 1.7, color: "var(--c-slate)" },
};

const T = {
  zh: {
    lead: "这里可选地配置 DeepSeek 并试跑一次真实问答（只支持 deepseek）。两种方式任选其一：",
    a: "A · 直接粘贴 key：会写入 genesis 的 `/.mds/llm_config.md`（明文，仅本机；模型 deepseek-flash）",
    b: "B · 用环境变量：启动网关前 `export DEEPSEEK_API_KEY=...`，然后点「用 env 试跑」（配置写 `env:DEEPSEEK_API_KEY`，不落明文 key）",
    saveRun: "保存并试跑", envRun: "用 env 试跑", clean: "清理 demo agent",
    running: "运行中…", placeholder: "粘贴 DeepSeek API key（sk-…）",
    needKey: "先填写 key，或改用「用 env 试跑」",
    donePrefix: "↦ 模型回答：",
  },
  en: {
    lead: "Optionally configure DeepSeek and run one real question (deepseek only). Two ways, pick one:",
    a: "A · paste the key: it is written to genesis `/.mds/llm_config.md` (plain text, local only; model deepseek-flash)",
    b: "B · use an env var: `export DEEPSEEK_API_KEY=...` before starting the gateway, then click “Run with env” (stores `env:DEEPSEEK_API_KEY`, no literal key written)",
    saveRun: "Save & run", envRun: "Run with env", clean: "Clean demo agent",
    running: "Running…", placeholder: "paste DeepSeek API key (sk-…)",
    needKey: "fill the key first, or use “Run with env”",
    donePrefix: "↦ model answer: ",
  },
};

const q = (v) => JSON.stringify(String(v));
const field = (path, sel, v) => q(v) + " | /> " + path + "::" + sel;
function configCmds(secret) {
  const cfg = "/.mds/llm_config.md";
  const prov = q("PROVIDERS") + "." + q("deepseek");
  const def = q("LLM_CONFIG") + "." + q("DEFAULT");
  return [
    "mk -f " + cfg,
    "mk -f /.mds/llm.md",
    field(cfg, prov + "._b:api_key", secret),
    field(cfg, prov + "._b:timeout", "180"),
    field(cfg, def + "._b:provider", "deepseek"),
    field(cfg, def + "._b:model", "deepseek-flash"),
    field(cfg, def + "._b:reasoning_effort", "max"),
    field(cfg, def + "._b:extra_body", '{"thinking": {"type": "enabled"}}'),
  ];
}

export default observer(function LlmDemo({ node, read }) {
  const env = getEnv(node);
  const lang = (typeof globalThis !== "undefined" && globalThis.__teachLang === "en") ? "en" : "zh";
  const t = T[lang];
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState([]);
  const [conf, setConf] = useState("");

  // 走连接上下文（= genesis），且不经过 env.exec 的日志壳，避免 key 被打进 EXEC 日志
  const gexec = (code) => env.client.exec(code).then((raw) => String(raw == null ? "" : raw));
  const push = (s) => setLines((prev) => prev.concat([s]).slice(-14));

  useEffect(() => {
    let alive = true;
    gexec("$ /.mds/llm_config.md").then((txt) => {
      if (!alive) return;
      if (txt.indexOf("mdio_error") >= 0) { setConf(lang === "en" ? "not configured yet" : "尚未配置"); return; }
      if (/api_key:\s*env:/.test(txt)) setConf(lang === "en" ? "configured: env:DEEPSEEK_API_KEY" : "已配置：env:DEEPSEEK_API_KEY");
      else if (/api_key:\s*\S/.test(txt)) setConf(lang === "en" ? "configured: saved key (hidden)" : "已配置：已保存 key（不显示）");
      else setConf(lang === "en" ? "not configured yet" : "尚未配置");
    }).catch(() => { if (alive) setConf(lang === "en" ? "not configured yet" : "尚未配置"); });
    return () => { alive = false; };
  }, []);

  const runFlow = async (secret) => {
    setBusy(true);
    setLines([]);
    push("① " + (lang === "en" ? "write /.mds/llm_config.md (provider=deepseek, model=deepseek-flash)" : "写入 /.mds/llm_config.md（provider=deepseek，model=deepseek-flash）"));
    try {
      for (const c of configCmds(secret)) await gexec(c);
      push("✓ " + (lang === "en" ? "config written" : "配置已写入"));
      let initOut = "";
      try {
        initOut = await gexec('@LLM.demo.init -m "DEFAULT" -sysp "你是 DeepSeek 助手；用一句话回答。" -tool false');
      } catch (e) {
        initOut = "ERR " + String((e && e.message) || e);
      }
      if (initOut.indexOf("already exists") >= 0) push("② @LLM.demo 已存在（复用）");
      else if (initOut.indexOf("ERR ") === 0 || initOut.indexOf("mdio_error") >= 0) push("✗ " + initOut.slice(0, 200));
      else push("② @LLM.demo.init → " + initOut.slice(0, 120));
      push("③ " + (lang === "en" ? 'run: "用一句话介绍 MDIO" | @LLM.demo' : '试跑："用一句话介绍 MDIO" | @LLM.demo'));
      let ans = "";
      try {
        ans = await gexec('"用一句话介绍 MDIO" | @LLM.demo');
      } catch (e) {
        ans = "ERR " + String((e && e.message) || e);
      }
      if (ans.indexOf("ERR ") === 0 || ans.indexOf("- mdio_error") >= 0) push("✗ " + ans.slice(0, 300));
      else push(t.donePrefix + String(ans).trim());
    } catch (e) {
      push("✗ " + String((e && e.message) || e).slice(0, 300));
    }
    setBusy(false);
  };

  const clean = async () => {
    setBusy(true);
    try { await gexec("@LLM.demo.close"); } catch (e) { /* 没 agent 也无所谓 */ }
    push(lang === "en" ? "demo agent closed (config kept)" : "demo agent 已关闭（配置保留）");
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={C.hint}>{t.lead}</div>
      <div style={Object.assign({}, C.card, { display: "flex", flexDirection: "column", gap: 10 })}>
        <div style={C.hint}>{t.a}</div>
        <div style={C.hint}>{t.b}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input type="password" style={C.input} value={key} placeholder={t.placeholder} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <button type="button" style={C.btn} disabled={busy} onClick={() => { if (!key.trim()) { push(t.needKey); return; } runFlow(key.trim()); }}>{busy ? t.running : t.saveRun}</button>
          <button type="button" style={C.btn} disabled={busy} onClick={() => runFlow("env:DEEPSEEK_API_KEY")}>{t.envRun}</button>
          <button type="button" style={C.btn} disabled={busy} onClick={clean}>{t.clean}</button>
        </div>
        <div style={C.hint}>{conf}</div>
        {lines.length ? <pre style={C.out}>{lines.join(NL)}</pre> : null}
      </div>
    </div>
  );
});
```
