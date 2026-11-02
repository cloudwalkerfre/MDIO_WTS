# his

```jsx@his
import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";

// 记录层 → 消息流；内容层 → std renderNode。
// 样式按 assistant-ui 吸收清单 P0：单色 + 透明填充、无阴影无玻璃、44rem 列、
// assistant 裸文本、user 气泡 bg-muted / 1rem 圆角、reasoning 与 tool 折叠成一行。

function childrenOf(node) {
  if (!node) return [];
  if (Array.isArray(node.ct)) return node.ct;
  if (Array.isArray(node.kids)) return node.kids;
  return [];
}

// 空节点判定：用于跳过历史坏数据里的空 bq（流式 bug 留下的空引用块）。
function nodeIsBlank(node) {
  if (!node) return true;
  // 只判「没有子节点且没有文本」的叶子 bq；有子节点一律交给 std（宁可多画不可误删）。
  if (childrenOf(node).length > 0) return false;
  return String(node.content || node.t || "").trim() === "";
}

function contentNodesOf(rec) {
  const out = [];
  const kids = childrenOf(rec);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k && k.nt === "bq") {
      const inner = childrenOf(k);
      for (let j = 0; j < inner.length; j++) if (inner[j]) out.push(inner[j]);
    }
  }
  return out;
}

function fieldsOf(rec, read) {
  const out = {};
  const kids = childrenOf(rec);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (!k || k.nt !== "bl") continue;
    const fs = childrenOf(k);
    for (let j = 0; j < fs.length; j++) {
      const f = fs[j];
      if (!f || f.nt !== "b") continue;
      let val = "";
      try { val = String(read.contentValueOf(f) || ""); } catch (e) { val = ""; }
      out[String(f.t || "")] = val.trim();
    }
  }
  return out;
}

// 块级代码：bq 下的 fence 在交付树里 content 还带着 "> " 行前缀（引擎 bq-under-bullet 的已知口子），
// 这里统一重建纯文本；顺带补 assistant-ui 式 CodeHeader（语言名 + 复制）。
function codeTextOf(node, read) {
  let code = "";
  try { code = String(read.readField(node, ".content", "raw") || ""); } catch (e) { code = ""; }
  if (!code) code = String(node.cd || node.ct || "");
  const lines = code.split(String.fromCharCode(10));
  if (!(lines.length && String(lines[0]).charAt(0) === ">")) return null;   // 未被 bq 污染：交回 std（shiki / mermaid）
  {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      let l = String(lines[i]);
      if (l.charAt(0) === ">") l = l.slice(1).replace(/^ /, "");
      out.push(l);
    }
    while (out.length) {
      const last = String(out[out.length - 1]).trim();
      if (last === "" || last.indexOf("\`\`\`") === 0 || last.indexOf("~~~") === 0) out.pop();
      else break;
    }
    return out.join(String.fromCharCode(10));
  }
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = function () {
    try { if (navigator.clipboard) navigator.clipboard.writeText(code); } catch (e) { /* 忽略 */ }
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 2000);
  };
  return (
    <div className="chat-codeblock">
      <div className="chat-code-head">
        <span>{lang || "text"}</span>
        <button type="button" className="chat-icon-btn" onClick={copy} aria-label="Copy code" title={copied ? "已复制" : "复制"}>
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function Content({ nodes, renderNode, read }) {
  if (!nodes || !nodes.length) return null;
  return (
    <div className="chat-md">
      {nodes.map(function (n, i) {
        const nt = n && n.nt;
        if (nt === "bq" && nodeIsBlank(n)) return null;   // 历史空引用块：不占高度
        if (nt === "c" || nt === "ic" || nt === "code") {
          const fixed = codeTextOf(n, read);
          if (fixed !== null) return <div key={i} className="chat-md-block"><CodeBlock code={fixed} lang={String(n.t || "")} /></div>;
        }
        return <div key={i} className="chat-md-block">{renderNode(n)}</div>;
      })}
    </div>
  );
}

// 纯文本还原（复制/编辑回填用）：txt 节点正文在 ct 上，cd/ic 是行内码，块级补换行。
function textOfNodes(nodes, read) {
  const parts = [];
  const push = function (s) { if (s != null && s !== "") parts.push(String(s)); };
  const walk = function (n) {
    if (!n) return;
    if (typeof n === "string") { push(n); return; }
    if (Array.isArray(n)) { for (let i = 0; i < n.length; i++) walk(n[i]); return; }
    if (typeof n !== "object") return;
    const nt = n.nt;
    if (nt === "txt") { push(n.ct); return; }
    if (nt === "lb") { parts.push(String.fromCharCode(10)); return; }
    if (nt === "sb") { push(" "); return; }
    if (nt === "cd" || nt === "ic") {
      let v = "";
      try { v = read && read.readField ? read.readField(n, ".content") : ""; } catch (e) { v = ""; }
      if (!v) v = n.ct || n.cd || "";
      push(v);
      return;
    }
    if (nt === "code" || nt === "c") { push(n.ct || ""); return; }
    const ch = childrenOf(n);
    if (ch.length) {
      for (let i = 0; i < ch.length; i++) walk(ch[i]);
      if (nt === "p" || nt === "h" || nt === "b" || nt === "li" || nt === "bl" || nt === "od") parts.push(String.fromCharCode(10));
      return;
    }
    let v = n.ct;
    if (v == null || v === "") { try { v = read && read.contentValueOf ? read.contentValueOf(n) : ""; } catch (e) { v = ""; } }
    push(v);
  };
  walk(nodes);
  return parts.join("").trim();
}

function Chevron() {
  return (
    <svg className="chat-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function fmtSec(sec) {
  if (!sec) return "";
  if (sec < 1) return "<1s";
  if (sec < 60) return sec.toFixed(1) + "s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return m + "m " + s + "s";
}

function AssistantActions({ nodes, read, always, timing, canRegen, onRegen }) {
  const [copied, setCopied] = useState(false);
  const copy = function () {
    try {
      const text = textOfNodes(nodes, read);
      if (navigator.clipboard && text) navigator.clipboard.writeText(text);
    } catch (e) { /* 剪贴板不可用不阻塞 */ }
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 2000);
  };
  return (
    <div className={"chat-assistant-footer" + (always ? " is-on" : "")}>
      <button type="button" className="chat-icon-btn" onClick={copy} aria-label="Copy response" title={copied ? "已复制" : "复制"}>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        )}
      </button>
      {canRegen ? (
        <button type="button" className="chat-icon-btn" onClick={onRegen} aria-label="Regenerate" title="重新生成">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
        </button>
      ) : null}
      {timing ? <span className="chat-timing">{fmtSec(timing)}</span> : null}
    </div>
  );
}

function EditComposer({ text, onCancel, onSubmit }) {
  const [draft, setDraft] = useState(text || "");
  const taRef = useRef(null);
  useEffect(function () {
    const el = taRef.current;
    if (!el) return;
    el.focus();
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 192) + "px";
  }, [draft]);
  const submit = function () {
    const v = draft.trim();
    if (v) onSubmit(v);
  };
  return (
    <div className="chat-user-edit">
      <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent && e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onCancel();
        }}
        className="chat-input" />
      <div className="chat-user-edit-bar">
        <span className="chat-user-edit-hint">会从这条消息开一条新时间线；旧时间线保留</span>
        <button type="button" className="chat-btn" onClick={onCancel}>取消</button>
        <button type="button" className="chat-btn chat-btn-primary" onClick={submit}>开新时间线</button>
      </div>
    </div>
  );
}

function UserCopy({ nodes, read }) {
  const [copied, setCopied] = useState(false);
  const copy = function () {
    try {
      const text = textOfNodes(nodes, read);
      if (navigator.clipboard && text) navigator.clipboard.writeText(text);
    } catch (e) { /* 忽略 */ }
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 2000);
  };
  return (
    <button type="button" className="chat-icon-btn" onClick={copy} aria-label="Copy message" title={copied ? "已复制" : "复制"}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

// details 自动展开/收起：默认跟随「是否最后一条」；用户手动点过后不再自动干预。
function useAutoOpen(defaultOpen) {
  const ref = useRef(null);
  const touched = useRef(false);
  useEffect(function () {
    const el = ref.current;
    if (!el || touched.current) return;
    const want = !!defaultOpen;
    if (el.open !== want) el.open = want;
  }, [defaultOpen]);
  return { ref: ref, markTouched: function () { touched.current = true; } };
}

function Reasoning({ rec, renderNode, read, defaultOpen, live }) {
  const auto = useAutoOpen(defaultOpen);
  const textRef = useRef(null);
  const [pinned, setPinned] = useState(true);

  // 流式 reasoning 期间自动跟到最底；用户手动上滚后暂停，回到底部后恢复。
  useEffect(function () {
    if (!live || !pinned) return;
    const el = textRef.current;
    const details = auto.ref.current;
    if (el && details && details.open) el.scrollTop = el.scrollHeight;
  }, [rec, live, pinned]);

  const onScroll = function () {
    const el = textRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== pinned) setPinned(atBottom);
  };

  return (
    <details ref={auto.ref} className="chat-reasoning">
      <summary onClick={auto.markTouched}>
        <span className={"chat-dot" + (live ? " chat-dot-live" : "")} />
        <span>Reasoning</span>
        <Chevron />
      </summary>
      <div ref={textRef} onScroll={onScroll} className="chat-reasoning-text">
        <Content nodes={rec.contentNodes} renderNode={renderNode} read={read} />
      </div>
    </details>
  );
}

function ToolGroup({ group, renderNode, read, defaultOpen, live }) {
  const auto = useAutoOpen(defaultOpen);
  const n = group.calls.length;
  return (
    <details ref={auto.ref} className="chat-tool-group">
      <summary onClick={auto.markTouched}>
        <span className={"chat-dot" + (live ? " chat-dot-live" : "")} />
        <span>{n} tool call{n === 1 ? "" : "s"}</span>
        <Chevron />
      </summary>
      <div className="chat-tool-list">
        {group.calls.map(function (c, j) {
          const call = c.call;
          const result = c.result;
          const name = (call && call.fields.name) || (result && result.fields.name) || "tool";
          const id = String((call && call.fields.id) || (result && result.fields.id) || "");
          const shortId = id.length > 8 ? id.slice(id.length - 8) : id;
          return (
            <details key={j} className="chat-tool-row">
              <summary>
                <span className="chat-tool-name">{name}</span>
                {shortId ? <span className="chat-tool-id">{shortId}</span> : null}
              </summary>
              {call && call.contentNodes.length > 0 ? <div className="chat-tool-body"><div className="chat-tool-label">request</div><Content nodes={call.contentNodes} renderNode={renderNode} /></div> : null}
              {result ? <div className="chat-tool-body"><div className="chat-tool-label">result</div><Content nodes={result.contentNodes} renderNode={renderNode} /></div> : null}
            </details>
          );
        })}
      </div>
    </details>
  );
}

function recOfNode(node, read) {
  return { role: String(node && node.t || ""), fields: fieldsOf(node, read), contentNodes: contentNodesOf(node, read), node };
}

function seqOfKey(key) {
  const s = String(key || "");
  const i = s.lastIndexOf(":");
  const n = i >= 0 ? Number(s.slice(i + 1)) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function itemsFromRenderView(rv, read) {
  const out = [];
  const rows = rv && Array.isArray(rv.rows) ? rv.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (row.kind === "marker") {
      out.push({ kind: "marker", subtype: row.subtype, tag: row.tag, controlNode: row.controlNode, recordNode: row.recordNode, summaryNodes: row.summaryNodes || [], key: row.key });
      continue;
    }
    if (row.kind === "tools") {
      const calls = (row.calls || []).map(function (c) {
        return {
          call: c.callNode ? recOfNode(c.callNode, read) : null,
          result: c.resultNode ? recOfNode(c.resultNode, read) : null
        };
      });
      out.push({ kind: "tools", calls: calls });
      continue;
    }
    if (row.recordNode) out.push({ kind: row.kind, rec: recOfNode(row.recordNode, read), seq: typeof row.seq === "number" ? row.seq : (row.headingKey === "main" ? seqOfKey(row.key) : -2), row: row });
  }
  return out;
}

export default observer(function HisPane({ node, snap, renderNode, read }) {
  const app = (function () {
    try { return getEnv(node).getMainRoot().app || null; } catch (e) { return null; }
  })();
  const rv = app ? app.renderView : null;
  const items = useMemo(function () {
    return rv ? itemsFromRenderView(rv, read) : [];
  }, [snap, read, app, rv]);
  const lastItem = items.length ? items[items.length - 1] : null;
  const boxRef = useRef(null);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);
  // busy 初值从 documentElement 属性补：新会话首条消息时 HisPane 可能晚于
  // busy=true 的那一刻才挂载，会漏掉唯一一次 mdio-chat-busy 广播。
  const [busy, setBusy] = useState(function () {
    try { return document.documentElement.getAttribute("data-chat-busy") === "1"; } catch (e) { return false; }
  });
  const [timings, setTimings] = useState({});
  const [editingSeq, setEditingSeq] = useState(-1);
  const userAtRef = useRef(0);
  const lastIdx = items.length - 1;

  // 运行态（app 广播）：空输入「重新生成」时没有新 user 记录，也要出 typing 行。
  useEffect(function () {
    const onBusy = function (e) { setBusy(!!(e && e.detail && e.detail.busy)); };
    document.addEventListener("mdio-chat-busy", onBusy);
    return function () { document.removeEventListener("mdio-chat-busy", onBusy); };
  }, []);

  // 计时：user 出现 → assistant 到达的间隔，记在这条回答的 index 上（仅本会话生命周期）。
  useEffect(function () {
    if (!items.length) return;
    const last = items[items.length - 1];
    if (last.kind === "user") { userAtRef.current = Date.now(); return; }
    if (last.kind === "assistant" && userAtRef.current) {
      const sec = Math.max(0.1, (Date.now() - userAtRef.current) / 1000);
      userAtRef.current = 0;
      setTimings(function (prev) { const next = Object.assign({}, prev); next[items.length - 1] = sec; return next; });
    }
  }, [snap]);

  // 等待态：最后一条还不是「流式中的 assistant」时显示；assistant 一开始流式，
  // 等待点换到正文末尾的流式光标（两种状态不叠）。
  const typing = !!lastItem && ((busy && lastItem.kind !== "assistant") || lastItem.kind === "user" || lastItem.kind === "tools");
  const emit = function (detail) { try { document.dispatchEvent(new CustomEvent("mdio-chat", { detail: detail })); } catch (e) { /* 忽略 */ } };

  useEffect(function () {
    const el = boxRef.current;
    if (!el) return;
    if (pinned) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen(function (n) { return n + 1; });
    }
  }, [snap]);

  // 有两条以上新消息且用户仍停在上面 ⇒ 2.4s 后自动回底（助手式「不打断但可恢复」）。
  useEffect(function () {
    if (pinned || unseen < 2) return undefined;
    const t = setTimeout(function () {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setPinned(true);
      setUnseen(0);
    }, 2400);
    return function () { clearTimeout(t); };
  }, [unseen, pinned]);

  const onScroll = function () {
    const el = boxRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom !== pinned) setPinned(atBottom);
    if (atBottom && unseen) setUnseen(0);
  };

  const toBottom = function () {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setPinned(true);
    setUnseen(0);
  };

  if (!items.length) return null;   // 空态由 shell 的 EmptyState 负责（它需要 onSend）

  return (
    <div className="chat-his relative flex h-full min-h-0 flex-col">
      <div ref={boxRef} onScroll={onScroll} className="chat-scroll min-h-0 flex-1 overflow-y-auto"
        role="log" aria-live="polite" aria-relevant="additions text" aria-label="对话记录">
        <div className="chat-thread">
          {items.map(function (item, i) {
            if (item.kind === "user") {
              const userText = textOfNodes(item.rec.contentNodes, read);
              return (
                <div key={i} className="chat-user-row">
                  {editingSeq === item.seq ? (
                    <EditComposer text={userText}
                      onCancel={function () { setEditingSeq(-1); }}
                      onSubmit={function (v) { setEditingSeq(-1); emit({ action: "edit", seq: item.seq, text: v }); }} />
                  ) : (
                    <div className="chat-user-line">
                      <div className="chat-user-actions">
                        {item.seq >= 0 ? <button type="button" className="chat-icon-btn" aria-label="Edit message" title="编辑"
                          onClick={function () { setEditingSeq(item.seq); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button> : null}
                        <UserCopy nodes={item.rec.contentNodes} read={read} />
                      </div>
                      <div className="chat-user-bubble"><Content nodes={item.rec.contentNodes} renderNode={renderNode} read={read} /></div>
                    </div>
                  )}
                </div>
              );
            }
            if (item.kind === "assistant") {
              if (!item.rec.contentNodes.length) return null;
              return (
                <div key={i} className="chat-assistant">
                  <Content nodes={item.rec.contentNodes} renderNode={renderNode} read={read} />
                  {busy && i === lastIdx ? <span className="chat-stream-caret" aria-hidden="true" /> : null}
                  <AssistantActions nodes={item.rec.contentNodes} read={read} always={i === lastIdx} timing={timings[i]} canRegen={i === lastIdx && !busy} onRegen={function () { emit({ action: "regen" }); }} />
                </div>
              );
            }
            if (item.kind === "marker") {
              const label = item.subtype === "branch" ? "分支" : item.subtype === "join" ? "汇入" : item.subtype === "compact" ? "已压缩" : "已剪枝";
              return (
                <div key={"m" + i} className={"chat-marker chat-marker-" + item.subtype}>
                  <span className="chat-marker-dot" />
                  <span className="chat-marker-label">{label} · {item.tag}</span>
                  {item.summaryNodes && item.summaryNodes.length ? (
                    <details className="chat-marker-more">
                      <summary>摘要</summary>
                      <div className="chat-marker-summary"><Content nodes={item.summaryNodes} renderNode={renderNode} read={read} /></div>
                    </details>
                  ) : null}
                </div>
              );
            }
            if (item.kind === "thinking") {
              return <Reasoning key={i} rec={item.rec} renderNode={renderNode} read={read} defaultOpen={i === lastIdx} live={busy && i === lastIdx} />;
            }
            return <ToolGroup key={i} group={item} renderNode={renderNode} read={read} defaultOpen={i === lastIdx} live={busy && i === lastIdx} />;
          })}
          {typing ? (
            <div className="chat-typing" role="status" aria-label="助手思考中">
              <span className="chat-typing-dots"><i /><i /><i /></span>
              <span>Thinking</span>
            </div>
          ) : null}
        </div>
      </div>
      {!pinned ? (
        <button type="button" className="chat-jump" onClick={toBottom} aria-label="回到最新消息">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
          {unseen > 0 ? unseen + " 条新消息" : "回到最新"}
        </button>
      ) : null}
    </div>
  );
});
```
