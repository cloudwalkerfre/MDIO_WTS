// WTS 发布物自带的 tailwind utility 生成器（WTS 项目自己的工具，不属于 mdio_ui）。
//
// 背景：mdio_ui 的 tailwind 平台 CSS 是 host 构建时按自己的 @source 生成的静态产物；
// WTS 是运行时被 mdio load 进来的内容，host 构建时不知道它，因此**不能**指望 host
// 扫到 WTS 的类。esmx 的样式契约同样是「每个远程自己拥有 CSS」——所以 WTS 自己把
// 它 md/jsx 里用到的 tailwind 类编译成 CSS，塞进各 app 的 ```css@app 块；
// mdio 装载 app 时由 cssAdopt 把这段 CSS 直接采纳进该 app 的影子根。
//
// 用法（需要一份 tailwindcss v4 安装目录，设为 TAILWIND_DIR；不绑定任何主机项目路径）：
//   TAILWIND_DIR=/path/to/node_modules/tailwindcss node tools/gen-app-css.mjs
//
// 产物是「生成物」：每个 app 的 css@app 里由 @wts-tailwind:start/end 标记包住；
// 重跑只替换标记之间的内容，不动手写样式。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WTS = path.resolve(process.env.WTS_ROOT || path.join(path.dirname(new URL(import.meta.url).pathname), ".."));
const TW_DIR = process.env.TAILWIND_DIR;
if (!TW_DIR) {
  console.error("缺少 TAILWIND_DIR（指向 node_modules/tailwindcss）");
  process.exit(2);
}
const { compile } = await import(pathToFileURL(path.join(TW_DIR, "dist/lib.mjs")).href);

const START = "/* @wts-tailwind:start */";
const END = "/* @wts-tailwind:end */";

/** app 文档 → 扫描它的哪一棵 wt（相对 WTS 根）。 */
const TARGETS = [
  { doc: "genesis/wt/ui_app/fe.md", root: "genesis/wt" },
  { doc: "chat/wt/app/app.md", root: "chat/wt" },
  { doc: "DreamScript/wt/appscript.md", root: "DreamScript/wt" },
];

function walk(dir, out = []) {
  for (const de of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, de.name);
    if (de.name === "node_modules" || de.name.startsWith(".")) continue;
    if (de.isDirectory()) walk(p, out);
    else if (/\.(md|jsx|tsx|js|ts)$/.test(de.name)) out.push(p);
  }
  return out;
}

function candidatesOfFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const set = new Set();
  const re = /\bclass(?:Name)?\s*[=:]\s*(?:\{\s*)?["'`]([^"'`]*)["'`]/g;
  let m;
  while ((m = re.exec(text))) for (const t of m[1].split(/\s+/)) if (t) set.add(t);
  return set;
}

function loadStylesheetFor(tailwindDir) {
  return async (id, base) => {
    const p = id === "tailwindcss"
      ? path.join(tailwindDir, "index.css")
      : id.startsWith("tailwindcss/")
        ? path.join(tailwindDir, id.slice("tailwindcss/".length))
        : path.resolve(base, id);
    if (!fs.existsSync(p)) throw new Error("css not found: " + p);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, "utf8") };
  };
}

async function buildCss(rootRel) {
  const root = path.join(WTS, rootRel);
  const cands = new Set();
  for (const f of walk(root)) for (const c of candidatesOfFile(f)) cands.add(c);
  const list = [...cands].filter((c) => /^[A-Za-z0-9_!:\-\[\]\/.,%()#]+$/.test(c));
  const compiled = await compile(
    '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css";\n',
    { base: TW_DIR, loadStylesheet: loadStylesheetFor(TW_DIR) },
  );
  const css = compiled.build(list);
  return { css, count: list.length };
}

function inject(docRel, css) {
  const p = path.join(WTS, docRel);
  const src = fs.readFileSync(p, "utf8");
  const body = START + "\n" + css.trimEnd() + "\n" + END;
  const fence = /```css@app\n([\s\S]*?)\n```/;
  const m = fence.exec(src);
  if (!m) throw new Error("找不到 css@app 块: " + docRel);
  const block = m[1];
  const nextBlock = block.indexOf(START) >= 0 && block.indexOf(END) > block.indexOf(START)
    ? block.slice(0, block.indexOf(START)).replace(/\s+$/, "") + "\n\n" + body
    : block.replace(/\s+$/, "") + "\n\n" + body;
  const next = src.slice(0, m.index) + "```css@app\n" + nextBlock + "\n```" + src.slice(m.index + m[0].length);
  fs.writeFileSync(p, next);
  return { docRel, bytes: css.length };
}

let ok = 0;
for (const t of TARGETS) {
  const { css, count } = await buildCss(t.root);
  const r = inject(t.doc, css);
  console.log(`- ${t.doc}: ${r.bytes} B css（候选 ${count}）`);
  ok += 1;
}
console.log(`done: ${ok}/${TARGETS.length} app css 已更新`);
