# session

```jsx@session
import { useState } from "react";
import { observer } from "mobx-react-lite";

export default observer(function SessionRail({ app, onSelect, onNew, onSettings, onRename, onRemove }) {
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState("");
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState("");
  const sessions = app.sessions;
  const shown = sessions.filter((s) => ((s.name || s.sid) + "").toLowerCase().indexOf(q.toLowerCase()) >= 0);
  const commitRename = (sid) => {
    const v = draft.trim();
    if (v) onRename(sid, v);
    setRenaming("");
    setDraft("");
  };
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r" style={{ borderColor: "var(--chat-border)", background: "var(--chat-bg)" }}>
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <span className="text-[15px] font-medium tracking-[-0.01em] text-[#ededed]">chat <span className="text-[#6b62f2]">·</span> mdio</span>
        <button type="button" onClick={onNew} className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ background: "var(--chat-fg)", color: "var(--chat-bg)" }}>新建</button>
      </div>
      <div className="px-5 pb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索会话…"
          className="w-full rounded-[10px] border px-3 py-2 text-[12px] outline-none" style={{ boxSizing: "border-box", borderColor: "var(--chat-border)", background: "var(--chat-card)", color: "var(--chat-fg)" }} />
      </div>
      <nav className="chat-scroll flex-1 overflow-y-auto px-3 pb-4">
        {shown.map((s) => (
          <div key={s.sid} className="chat-rail-item" onClick={() => onSelect(s.sid)}
            style={{ background: app.sid === s.sid ? "var(--chat-muted)" : "transparent" }}>
            {renaming === s.sid ? (
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(s.sid); if (e.key === "Escape") { setRenaming(""); setDraft(""); } }}
                className="chat-rail-input" />
            ) : (
              <div>
                <div className="chat-rail-name">{s.name || s.sid}</div>
                <div className="chat-rail-meta">
                  <span>{s.wt}</span><span>{s.created ? String(s.created).slice(5, 10) : ""}</span>
                </div>
              </div>
            )}
            {confirming === s.sid ? (
              <div className="chat-rail-confirm" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="chat-rail-mini" onClick={() => { onRemove(s.sid); setConfirming(""); }}>删除</button>
                <button type="button" className="chat-rail-mini" onClick={() => setConfirming("")}>取消</button>
              </div>
            ) : (
              <div className="chat-rail-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="chat-rail-icon" title="改名" aria-label="改名" onClick={() => { setRenaming(s.sid); setDraft(s.name || s.sid); setConfirming(""); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button type="button" className="chat-rail-icon" title="删除" aria-label="删除" onClick={() => { setConfirming(s.sid); setRenaming(""); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <div className="px-3 py-6 text-center text-[11px] leading-relaxed opacity-45">没有匹配的会话<br/>点「新建」开始</div>}
      </nav>
      <div className="border-t px-5 py-4" style={{ borderColor: "var(--chat-border)" }}>
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] opacity-45">
          <span className="chat-status-dot" style={app.busy ? { background: "var(--chat-live)", animation: "chat-pulse 2s var(--chat-ease) infinite" } : undefined} />
          {app.busy ? "thinking…" : "dev · DEEPSEEK_V4F"}
        </div>
        <button type="button" className="chat-btn w-full text-left" onClick={onSettings}>设置</button>
      </div>
    </aside>
  );
});
```
