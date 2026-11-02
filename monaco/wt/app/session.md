# session

```jsx@session
// monaSession —— Monaco × CRDT 会话（从 ui_devview/devkit/monaSession.js 移植，行为逐条照搬）。
export const MONA = {
  OpenDoc: 0x01, CloseDoc: 0x02, LocalInsert: 0x03, LocalDelete: 0x04,
  UndoReq: 0x05, RedoReq: 0x06, CursorMove: 0x07,
  ImeInsert: 0x08, ImeDelete: 0x09, ExplicitUndoRecord: 0x0a,
  ImeBegin: 0x0b, ImeCommit: 0x0c, ImeCancel: 0x0d,
};
export const MODE_MONACO = 0b01;
const HEADER_SIZE = 13;
let _mcSeq = 0;

export function createMonaSession(peerId, docId, editor, monaco, client, onEdit) {
  const model = editor.getModel();
  const disposables = [];
  const state = { isProcessingRemote: false, lastSendAt: 0 };

  const applyEdit = (range, text) => {
    if (!model || model.isDisposed()) return;
    try {
      state.isProcessingRemote = true;
      model.pushEditOperations([], [{ range, text }], () => []);
    } finally {
      state.isProcessingRemote = false;
    }
  };
  const encodeInsert = (line, col, text) => {
    const tb = new TextEncoder().encode(text);
    const payload = new Uint8Array(12 + tb.length);
    const dv = new DataView(payload.buffer);
    dv.setUint32(0, line - 1, true);
    dv.setUint32(4, col - 1, true);
    dv.setUint32(8, tb.length, true);
    payload.set(tb, 12);
    return payload;
  };
  const encodeDelete = (l1, c1, l2, c2) => {
    const payload = new Uint8Array(16);
    const dv = new DataView(payload.buffer);
    dv.setUint32(0, l1 - 1, true);
    dv.setUint32(4, c1 - 1, true);
    dv.setUint32(8, l2 - 1, true);
    dv.setUint32(12, c2 - 1, true);
    return payload;
  };
  disposables.push(model.onDidChangeContent((e) => {
    if (state.isProcessingRemote) return;
    for (const change of e.changes) {
      const r = change.range;
      const isDelete = r.startLineNumber !== r.endLineNumber || r.startColumn !== r.endColumn;
      const isInsert = change.text.length > 0;
      if (isDelete) {
        if (onEdit) onEdit("MC_UP: del L" + r.startLineNumber + ":" + r.startColumn + "→L" + r.endLineNumber + ":" + r.endColumn);
        send(MONA.LocalDelete, encodeDelete(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn));
      }
      if (isInsert) {
        _mcSeq += 1;
        if (onEdit) onEdit("MC_UP: ins #" + _mcSeq + " \"" + String(change.text).replace(/\n/g, "\\n").slice(0, 24) + "\"");
        send(MONA.LocalInsert, encodeInsert(r.startLineNumber, r.startColumn, change.text));
      }
    }
  }));
  const send = (tag, payload) => { state.lastSendAt = Date.now(); client.sendPayload(peerId, docId, tag, payload); };
  editor.addAction({ id: "crdt-undo-" + docId, label: "CRDT Undo", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ], run: () => send(MONA.UndoReq, new Uint8Array(0)) });
  editor.addAction({ id: "crdt-redo-" + docId, label: "CRDT Redo", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY], run: () => send(MONA.RedoReq, new Uint8Array(0)) });

  const ta = editor.getDomNode() && editor.getDomNode().querySelector("textarea");
  if (ta) {
    let imeStart = null;
    let imeSel = null;
    const onStart = () => {
      const p = editor.getPosition();
      imeStart = p ? { line: p.lineNumber, col: p.column } : null;
      const s = editor.getSelection();
      imeSel = s && !s.isEmpty() ? { line: s.startLineNumber, col: s.startColumn, endCol: s.endColumn } : null;
      send(MONA.ImeBegin, new Uint8Array(0));
    };
    const onEnd = (e) => {
      const text = (e && e.data) || "";
      const at = imeStart || (() => { const p = editor.getPosition(); return p ? { line: p.lineNumber, col: p.column } : null; })();
      if (text && at) {
        send(MONA.ImeCommit, encodeInsert(at.line, at.col, text));
        if (imeSel && imeSel.line === at.line && typeof imeSel.endCol === "number") {
          const shift = text.length;
          send(MONA.LocalDelete, encodeDelete(imeSel.line, imeSel.col + shift, imeSel.line, imeSel.endCol + shift));
        }
      } else if (!text) {
        send(MONA.ImeCancel, new Uint8Array(0));
      }
      imeStart = null;
      imeSel = null;
    };
    ta.addEventListener("compositionstart", onStart);
    ta.addEventListener("compositionend", onEnd);
    disposables.push({ dispose: () => { ta.removeEventListener("compositionstart", onStart); ta.removeEventListener("compositionend", onEnd); } });
  }
  return {
    _peerId: peerId,
    docId,
    get lastSendAt() { return state.lastSendAt; },
    dispose() { for (const d of disposables) { try { d.dispose(); } catch (e) { /* ignore */ } } disposables.length = 0; },
    handleMessage(tag, data) {
      if ((tag & 0x80) !== 0) return;
      if (data.length < HEADER_SIZE + 1) return;
      const subTag = data[HEADER_SIZE];
      const off = HEADER_SIZE + 1;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (subTag === 1) {
        const line = dv.getUint32(off, true);
        const col = dv.getUint32(off + 4, true);
        const text = new TextDecoder().decode(data.subarray(off + 8));
        if (onEdit) onEdit("MC_DN: ins L" + line + ":" + col + " \"" + String(text).replace(/\n/g, "\\n").slice(0, 24) + "\"");
        if (line === 1 && col === 1 && model.getValueLength() > 0) {
          const cur = model.getValue();
          if (text === cur) return;
          const overlap = cur.startsWith(text) || text.startsWith(cur) || Math.abs(text.length - cur.length) <= Math.max(8, cur.length * 0.1);
          if (text.length > 200 && overlap) applyEdit(new monaco.Range(1, 1, model.getLineCount() + 1, 1), "");
        }
        applyEdit(new monaco.Range(line, col, line, col), text);
      } else if (subTag === 2) {
        const l1 = dv.getUint32(off, true), c1 = dv.getUint32(off + 4, true);
        const l2 = dv.getUint32(off + 8, true), c2 = dv.getUint32(off + 12, true);
        if (onEdit) onEdit("MC_DN: del L" + l1 + ":" + c1 + "→L" + l2 + ":" + c2);
        applyEdit(new monaco.Range(l1, c1, l2, c2), "");
      } else if (subTag === 5) {
        const text = new TextDecoder().decode(data.subarray(off));
        if (onEdit) onEdit("MC_DN: replace_all " + text.length + "b");
        if (model.getValue() !== text) {
          state.isProcessingRemote = true;
          try { model.setValue(text); } finally { state.isProcessingRemote = false; }
        }
      }
    },
  };
}
```
