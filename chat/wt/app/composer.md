# composer

```jsx@composer
import { useEffect, useRef, useState } from "react";

function QuickMenu({ label, icon, display, value, options, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(function () {
    if (!open) return;
    const onDoc = function (e) {
      try {
        const p = e.composedPath ? e.composedPath() : [];
        if (boxRef.current && p.indexOf(boxRef.current) >= 0) return;
      } catch (err) { /* 忽略 */ }
      setOpen(false);
    };
    const onKey = function (e) { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    return function () {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const list = options || [];
  return (
    <div className="chat-qsel-wrap" ref={boxRef}>
      <button type="button" className={"chat-qsel" + (open ? " is-open" : "")}
        onClick={function () { if (!disabled) setOpen(!open); }}
        disabled={disabled} aria-label={label + "：" + (display || value || "")} aria-haspopup="listbox" aria-expanded={open} title={label + "：" + (display || value || "")}>
        {icon ? <span className="chat-qsel-ic" aria-hidden="true">{icon}</span> : null}
        <span className="chat-qsel-v">{display || value || "—"}</span>
        <svg className="chat-qsel-chev" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open ? (
        <div className="chat-qmenu" role="listbox">
          {list.map(function (o) {
            return (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value}
                className={"chat-qitem" + (o.value === value ? " is-on" : "")}
                onClick={function () { setOpen(false); onPick(o.value); }}>
                <span>{o.label}</span>
                {o.value === value ? <span className="chat-qcheck">✓</span> : null}
              </button>
            );
          })}
          {list.length === 0 ? <span className="chat-qempty">无可选项</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Qi({ name }) {
  if (name === "branch") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5" r="2" /><circle cx="18" cy="12" r="2" /><path d="M6 7v5a3 3 0 0 0 3 3h7" /><path d="M6 12h2" /></svg>;
  if (name === "folder") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
  if (name === "spark") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.3 6.3 2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" /></svg>;
  return null;
}

function Composer({ busy, onSend, onStop, focusKey, wl, branches, model, aliases, reasoning, reasoningOptions, ctx, ctxNames, onSetting, onWorldline }) {
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const hostRef = useRef(null);
  const monoRef = useRef(null);          // { ed, monaco, composing, disposers }
  const submitRef = useRef(null);
  const histRef = useRef({ hist: [], hi: -1 });
  histRef.current = { hist: hist, hi: hi };

  // 高度：1 行起、最多 192px；宽度由容器决定（automaticLayout 在 0 高容器上会挂，手动 layout）。
  const applyHeight = function () {
    const m = monoRef.current;
    const host = hostRef.current;
    if (!m || !m.ed || !host) return;
    const width = Math.max(1, host.clientWidth || 1);
    const h = Math.max(38, Math.min(192, m.ed.getContentHeight()));
    if (host.style.height !== h + "px") host.style.height = h + "px";
    m.ed.layout({ width: width, height: h });
  };

  const submit = function () {
    const m = monoRef.current;
    if (!m || !m.ed || busy) return;
    const v = String(m.ed.getValue() || "").trim();
    if (!v) return;
    setHist(function (h) { return (h.length > 40 ? h.slice(1) : h).concat([v]); });
    setHi(-1);
    m.ed.setValue("");
    setDraft("");
    onSend(v);
    applyHeight();
    try { m.ed.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
  };
  submitRef.current = submit;

  // Monaco composer：懒加载 ui_base/monaco（系统级供给），失败时留空壳不阻塞应用。
  useEffect(function () {
    let alive = true;
    (async function () {
      try {
        const mod = await import("ui_base/monaco");
        if (!alive || !hostRef.current) return;
        mod.installMonacoEnvironment();
        const monaco = mod.monaco;
        // 字体跟宿主完全一致（appview 继承链），字号/行高对齐 .chat-md（16/1.625）。
        let uiFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
        try {
          const cs = getComputedStyle(hostRef.current);
          if (cs && cs.fontFamily) uiFont = cs.fontFamily;
        } catch (e) { /* 忽略 */ }
        // 自定义主题：背景透明、光标/选区跟随 chat 的前景色，不引入 Monaco 默认蓝。
        try {
          monaco.editor.defineTheme("mdio-chat", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#00000000",
              "editor.lineHighlightBackground": "#00000000",
              "editor.lineHighlightBorder": "#00000000",
              "editor.selectionBackground": "#ffffff2e",
              "editor.inactiveSelectionBackground": "#ffffff1a",
              "editor.selectionHighlightBackground": "#ffffff14",
              "editorCursor.foreground": "#ededed",
              "editorIndentGuide.background1": "#00000000",
              "editorOverviewRuler.border": "#00000000",
              "scrollbar.shadow": "#00000000"
            }
          });
        } catch (e) { /* 主题定义失败则回落 vs-dark */ }
        const ed = monaco.editor.create(hostRef.current, {
          value: "",
          language: "plaintext",
          theme: "mdio-chat",
          automaticLayout: false,
          wordWrap: "on",
          lineNumbers: "off",
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          glyphMargin: false,
          folding: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          scrollbar: { vertical: "hidden", horizontal: "hidden", alwaysConsumeMouseWheel: false },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          renderLineHighlight: "none",
          renderWhitespace: "none",
          contextmenu: false,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: "off",
          tabCompletion: "off",
          hover: { enabled: false },
          unicodeHighlight: { ambiguousCharacters: false },
          fixedOverflowWidgets: true,
          fontSize: 16,
          lineHeight: 26,
          fontFamily: uiFont,
          padding: { top: 6, bottom: 6 },
          ariaLabel: "消息输入：Enter 发送，Shift+Enter 换行"
        });
        const state = { ed: ed, monaco: monaco, composing: false };
        monoRef.current = state;
        setReady(true);
        applyHeight();

        // IME 组字窗口：组字期间 Enter 只提交候选，不发消息。
        // 0.57 走 EditContext：composition 事件可能落在 .native-edit-context 或隐藏 textarea 上，
        // 所以在编辑器的 DOM 根上做 capture 监听（覆盖两种实现）。
        const compTargets = [];
        try {
          const dn = ed.getDomNode();
          if (dn) {
            compTargets.push(dn);
            const inner = dn.querySelectorAll("textarea, .native-edit-context");
            for (let i = 0; i < inner.length; i++) compTargets.push(inner[i]);
          }
        } catch (e) { /* 忽略 */ }
        const onCompStart = function () { state.composing = true; };
        const onCompEnd = function () { state.composing = false; };
        compTargets.forEach(function (t) {
          t.addEventListener("compositionstart", onCompStart, true);
          t.addEventListener("compositionend", onCompEnd, true);
        });

        ed.onDidChangeModelContent(function () {
          setDraft(ed.getValue());
          applyHeight();
        });

        const modelOf = function () { return ed.getModel(); };
        const cursorAtEnd = function () {
          const model = modelOf();
          const pos = ed.getPosition();
          return !!model && !!pos && pos.lineNumber === model.getLineCount() && pos.column === model.getLineMaxColumn(model.getLineCount());
        };
        const cursorAtStart = function () {
          const pos = ed.getPosition();
          return !!pos && pos.lineNumber === 1 && pos.column === 1;
        };
        const hasSelection = function () {
          const sel = ed.getSelection();
          return !!sel && !sel.isEmpty();
        };
        const putHistory = function (text) {
          ed.setValue(text);
          const model = modelOf();
          if (model) ed.setPosition({ lineNumber: model.getLineCount(), column: model.getLineMaxColumn(model.getLineCount()) });
        };

        ed.onKeyDown(function (e) {
          const be = e.browserEvent;
          if (!be) return;
          if (state.composing || be.isComposing || be.keyCode === 229) return;   // IME 中不抢键
          const key = be.key;
          const shift = !!be.shiftKey;
          const ctrl = !!(be.ctrlKey || be.metaKey);
          if (key === "Enter" && !shift && !ctrl) {
            be.preventDefault();
            be.stopPropagation();
            submitRef.current && submitRef.current();
            return;
          }
          if (key === "Enter" && shift) return;   // Shift+Enter 交给 Monaco 插换行
          if (key === "ArrowUp" && !shift && !ctrl && !hasSelection() && cursorAtStart()) {
            const h = histRef.current;
            if (h.hi >= h.hist.length - 1) return;
            be.preventDefault();
            be.stopPropagation();
            const nh = h.hi + 1;
            setHi(nh);
            putHistory(h.hist[h.hist.length - 1 - nh] || "");
            return;
          }
          if (key === "ArrowDown" && !shift && !ctrl && !hasSelection() && cursorAtEnd()) {
            const h = histRef.current;
            if (h.hi < 0) return;
            be.preventDefault();
            be.stopPropagation();
            const nh = h.hi - 1;
            setHi(nh);
            putHistory(nh < 0 ? "" : (h.hist[h.hist.length - 1 - nh] || ""));
          }
        });

        let ro = null;
        try {
          ro = new ResizeObserver(function () { applyHeight(); });
          ro.observe(hostRef.current);
        } catch (e) { ro = null; }

        state.disposers = [
          function () { if (ro) ro.disconnect(); },
          function () {
            compTargets.forEach(function (t) {
              t.removeEventListener("compositionstart", onCompStart, true);
              t.removeEventListener("compositionend", onCompEnd, true);
            });
          }
        ];
      } catch (e) {
        if (alive) console.error("[chat] composer monaco load failed:", e);
      }
    })();
    return function () {
      alive = false;
      const m = monoRef.current;
      monoRef.current = null;
      if (m) {
        (m.disposers || []).forEach(function (f) { try { f(); } catch (e) { /* 忽略 */ } });
        try { m.ed.dispose(); } catch (e) { /* 忽略 */ }
      }
    };
  }, []);

  // 切会话/挂载后把焦点放回编辑器（不滚页面）。
  useEffect(function () {
    const m = monoRef.current;
    if (m && m.ed) { try { m.ed.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
  }, [focusKey, ready]);

  const wlOptions = [{ value: "", label: "主时间线" }].concat((branches || []).map(function (b) { return { value: b.wl != null ? b.wl : b.label, label: b.label }; }));
  const currentLine = (branches || []).filter(function (b) { return String(b.wl || "") === String(wl || ""); })[0];
  const wlDisplay = currentLine ? (currentLine.label || currentLine.wl || "主时间线") : (wl || "主时间线");
  if (wl && !wlOptions.some(function (o) { return o.value === wl; })) wlOptions.push({ value: wl, label: wl });
  const modelOptions = [{ value: "", label: "默认" }].concat((aliases || []).map(function (a) { return { value: a, label: a }; }));
  if (model && !modelOptions.some(function (o) { return o.value === model; })) modelOptions.push({ value: model, label: model });
  const thinkBase = Array.isArray(reasoningOptions) && reasoningOptions.length
    ? reasoningOptions
    : ["", "low", "medium", "high"];
  const thinkOptions = thinkBase.map(function (v) { return { value: v, label: v || "默认" }; });
  if (reasoning && !thinkOptions.some(function (o) { return o.value === reasoning; })) thinkOptions.push({ value: reasoning, label: reasoning });
  const ctxOptions = (ctxNames && ctxNames.length ? ctxNames : ["genesis"]).map(function (n) { return { value: n, label: n }; });
  if (ctx && !ctxOptions.some(function (o) { return o.value === ctx; })) ctxOptions.push({ value: ctx, label: ctx });
  const focusEditor = function () {
    const m = monoRef.current;
    if (m && m.ed) { try { m.ed.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
  };
  const pick = function (key, val) {
    onSetting(key, val);
    setTimeout(focusEditor, 0);
  };

  return (
    <div className="px-6 pb-5 pt-3">
      <div className="chat-composer">
        <div className="chat-mono">
          <div ref={hostRef} className="chat-mono-host" />
          {!draft ? <div className="chat-mono-placeholder" aria-hidden="true">给 dev 发消息…</div> : null}
        </div>
        <div className="chat-composer-bar">
          <div className="chat-qcluster">
            <button type="button" className="chat-qsel" onClick={onWorldline} disabled={!onWorldline} aria-label={"世界线：" + (wlDisplay || "主时间线")} title={"世界线：" + (wlDisplay || "主时间线")}>
              <span className="chat-qsel-ic" aria-hidden="true"><Qi name="branch" /></span>
              <span className="chat-qsel-v">世界线</span>
            </button>
            <QuickMenu label="执行上下文" icon={<Qi name="folder" />} display={ctx || "genesis"} value={ctx || "genesis"} options={ctxOptions} disabled={busy} onPick={function (v) { pick("wt", v); }} />
          </div>
          <span className="chat-qsep" aria-hidden="true" />
          <div className="chat-qcluster">
            <QuickMenu label="模型" display={model || "默认"} value={model || ""} options={modelOptions} disabled={busy} onPick={function (v) { pick("model", v); }} />
            <QuickMenu label="推理强度" icon={<Qi name="spark" />} display={reasoning || "默认"} value={reasoning || ""} options={thinkOptions} disabled={busy} onPick={function (v) { pick("reasoning", v); }} />
          </div>
          <div className="chat-composer-actions">
            {busy ? (
              <button type="button" className="chat-send" onClick={onStop} aria-label="停止运行" title="停止">
                <span className="chat-stop-square" />
              </button>
            ) : (
              <button type="button" className="chat-send" onClick={submit} disabled={!draft.trim()} aria-label="发送消息" title="发送">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export { Composer };
```