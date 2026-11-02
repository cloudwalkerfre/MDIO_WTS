# app 计划 —— 新架构下把 script wt 做成正经 app

> 状态：**推演稿**（不是规范、不是决定）。权威顺序：**实现 > note > HANDOFF > 本文**。
> 来源等级：〔码〕代码核实 ·〔话〕业主原话 ·〔测〕实测 ·〔推〕我的推演。
> 配套：同目录 `推演笔记.md`（推演方法与发现）· `/docs/HANDOFF.md`（回轨页）· `/docs/路由研究.md`（研究流水，append-only）。
> 冲突时以实现为准，并回头改本文。

## 0 一句话
**归属、指针、渲染权三件事分开**：声明只回答“这块地归谁”（`## router` 里一行 `- appview: <mods 里的名字>`）；URL 回答“此刻在哪”（壳段 `?wt&app` + 页内段）；被认领的那个件内部回答“md 怎么投成视图”。〔话+推〕

## 1 现状（代码事实，带位置）
- 框架只认三节 mods / match / visibility（`extractDecl` uiMd.js:458）；**`## router` 零消费者**；四棵树（genesis 9 行 · czUR8zxu 27 行 · c8Page01 15 行 · c7Sw4p00 14 行）都没有这一节。〔测〕
- 壳是**路由中立**：两处壳级 URL 写点（`switchWt` entry.client.ts:454 · `toggleDevMode` DevView.jsx:119）＋一个页内段能力 `appRouter`（hash/path + `layerHost`，appRouter.js:19/70）。〔码〕
- 归属入口今天是 `App: (p) => h(DocPane, p)`（entry.client.ts:412-425）；`DevView` 只给 App `{ui, exec}`（DevView.jsx:41）。〔码〕
- **剧本 app 早已存在**：`DOC`＋`SCRIPT` 在 `/render/实现.md`（`jsx@doc` / `jsx@script`，都有 default）。坏在两处：① 声明路径写成不存在的 `/实现.md`；② 它只是 node 级 trait，不是“整块地”的 owner。〔测〕
- `exp_scripts/check.mjs` 的期望（`.sd-*` 上屏 + “没有节点掉回 std”）**正是修好之后的状态**。〔码+推〕
- 判据基线〔本轮实测〕：`check-router` **54/54** · `judge.mjs` **绿（51 源文件）** · `check-dev-provider` **全绿**。未复核（都需“写”）：MODULES 16/16 · cdp-devview 43/43 · SOP 143/143 · e2e 5 红。

## 2 目标形态（五层 + 九个词）
- **L0 数据面**：mdio VFS + 网关 F/P 帧 → client → `MD` 店（**店即 root 节点**）。
- **L1 声明面**：`## mods`（锚点，不动）+ `## match` / `## visibility` + **`## router` 一行**。
- **L2 壳**：壳段与页内段 · **唯一 URL 写入者**（归一）· 面板容器 · `App` 注入。
- **L3 归属层（新增）**：把 appview 这块地交给指名件；**校验它必须能画**；不下节点树。
- **L4 被认领件内部**：md→视图投影（`std` 的 trait）· 清单 · 页内路由 · 私有区（框架不解析）。

**九个词（业主词汇，不改）**：`mods` · `appview` · 被认领件 · `BASIC_RENDER` · `std` · `match` trait/impl · `_HIDDEN` · `docview` · `appRouter`。
（“归属件 / 节点件 / 交接契约 / 两层签名 / 阶段 0–3”是本文的用法，标〔推〕，不是业主词汇。）

## 3 剧本 wt 的前后对照（改动清单）
**今天**：`/.mds/ui.md` 27 行；`## mods` 的 `DOC/SCRIPT/SCREEN` 指向不存在的 `/实现.md` ⇒ 三件加载失败；顶层 `## match` 三行桥行（PAPER/RAPP/MINA）；`## std ### match` 三行 trait **在编译但从未生效**；无 `## router`。产品面 `?wt=czUR8zxu&app=/剧本2.md` 靠 PAPER 桥行。

**方案后（改动只有 3 行 + 2 行 + 1 个新件）**：
1. **修 3 行路径**：`.md::/实现.md::…` → `.md::/render/实现.md::…` ⇒ `DOC`/`SCRIPT` 第一次真正上屏（`.sd-*` 就是剧本 app 本体）；`SCREEN` 是 CSS 件，只作样式。
2. **加 2 行**：`## router` + `- appview: SCRIPTS_APP`。
3. **加 1 个新件**（薄壳，约 20 行）：左边栏 + `content`。
4. 顶层桥行与 `## std ### match` **一个字不改**（桥行仍管别的篇，trait 仍管篇内逐节点）。

## 4 框架侧改动（4 项 + 3 小改，含落点）
1. **读取 `router` 节**：`uiMd.js` 的 `extractDecl`（:458 那段）多认一节，产出 `decl.router = { appview }`；**未知键红灯**（写错 `appveiw` 必报）。
2. **装配点按值解析 + 校验 + 缺省回退**：`entry.client.ts` 的 `App: (p) => h(DocPane, p)`（:412-425）→ 命中则渲染指名件，失败/未写则回退 `DocPane`。
3. **`appRouter` 一处所有者**：把模块级单例从 `NodeView.jsx:13` 挪进 `appRouter.js`；`subscribe(fn)` 回调**带来源**（`push|replace|pop`，约 5 行，不新增导出键）。现有两个消费者（RAPP、PAPER）忽略多余参数 ⇒ 向后兼容〔码〕。
4. **壳订阅页内段 → 开档 → 归一**：壳读页内段里的篇名 ⇒ 走 `DevView.open` 的路径开档（**不碰形态**）⇒ 把篇名搬进 `?app=`，页内段只留“页”。

**3 小改**：a 形态最小解耦（默认取“保持现状”＝零改动）；b 四条源规则进 `judge.mjs`（今天全绿，已 grep 验证 0 违规）；c `provides` 两处 / `fetch` 白名单一致性。

## 5 交接契约（两层签名 + 通道 + 两条硬约束）
- **节点件**收 `{node, exec, snap, renderNode, read, appRouter, modMatch, use}`（NodeView.jsx:161）。
- **归属件**收 `{ui, exec}`（DevView.jsx:41）＋拟加 `read` / `renderNode`(`content`) / `appRouter` / `use` / `modMatch`。
- **投递通道**：`ui`/`exec`/`read`/`renderNode`/`use`/`modMatch`/`own` 全走 props；`appRouter` 源头＝模块单例、投递＝props；指针与清单原料（`mdPath`/`activeClaims`/`docVisible`）**不需要新通道**。
- **硬约束**：① 入口级件**自己要 `observer`**（DevView 只给 `memo`）；② 构件**身份要稳**（与 `memoOf` 同款纪律）；③ **`ui` 不下放、`node` 不上提**。

## 6 app 怎么写
```jsx
export default observer(function ScriptApp({ ui, exec, content, appRouter }) {
  const cur = ui.mdPath;                       // 当前篇
  const pages = listScripts(ui);               // 清单：目录约定 + 并入当前篇
  return h('div', { className: 'app-scripts' },
    h('aside', null, pages.map((p) => h('a', {
      key: p, className: p === cur ? 'on' : '',
      href: appRouter.href('#/edit/' + encodeURIComponent(p)),   // 页内段只表达“要哪篇”
    }, stripMd(p)))),
    h('main', null, content));                 // 文档体仍由 DOC/SCRIPT 渲染
});
```
要点：入口件必须自己 `observer`；左栏只写页内段、**不拼壳段**；**不自做逐节点分派**——那件事交给 `std` 已有的 trait。

## 7 迁移面（四棵树）
- **czUR8zxu**：修三行路径 + 加 `## router` 两行 + 新件（本方案主场）。
- **c8Page01**：有 `## visibility` 与 `## std ### match`，缺 `## router` ⇒ 由“缺省＝回退 `DocPane`”决定要不要补（默认可不补）。
- **c7Sw4p00**：仍是旧写法（顶层 match 3 行未迁 trait）；与槽位无耦合，欠账独立。
- **genesis**：mods + match，缺 `## router` ⇒ 同上。
- 降风险事实〔码〕：**桥行不搬也能跑**（槽位只决定这块地归谁，`content` 里仍走框架认领表）⇒ 可分两步。

## 8 判据与验收
**J1** 换值即换 app · **J2** 一个 scope 一个认领 · **J3′** 换页/换篇**不改 `?wt`、不改形态**（`?app=` 的值可变）· **J4** 可缺省（无声明＝今天行为）。
基线〔实测〕：`check-router` 54/54 · `judge` 绿 51 源文件 · `check-dev-provider` 全绿。
**新增判据必须做“关掉功能看它是否变红”**——否则可能是恒真断言（与“用改判据掩盖回归”是一体两面）。

**8 条源规则草案**：4 条今天全绿可立即引入（全局口收紧 · URL 写点白名单 · `provides` 三处一致 · `fetch` 白名单不悬空）；4 条需棘轮（树内件禁用自建身份表 · 声明节名集合 · `check-dev-provider` 补强（只对 prod 断言）· 读面键集冻结）。

## 9 落地顺序（四阶段 + 回滚 + 成对提交）
- **阶段 0 只读**：已完成（本文即其产物）。
- **阶段 1 底盘（不可跳过）**：S1.0 先立 4 条源规则 → S1.1 修声明坏点（能看见：`.sd-*` 上屏）→ S1.2 槽位读取 + 替换 App（能看见：换值即换渲染者）→ S1.3 值的红灯 → S1.4 形态最小解耦（默认零改动）。
- **阶段 2 交付物与能力**：S2.1 薄壳 app 本体（左栏 + 内容 + 换篇）→ S2.2 文档体有主 / 形态 3 / `std` 与 `BASIC_RENDER` → S2.3 桥行搬（默认不做）→ S2.4 换篇进店（默认做）→ S2.5 私有区通道（默认不做）。
- **阶段 3 收口**：S3.1 判据全量（隔离串行）+ 修陈旧 harness（`vis` 9 红 / `e2e` 5 红 / `check-edit-dom` 吞绿）+ 统一 CDP 端口（默认 9222 → 9223）→ S3.2 迁移收尾 → S3.3 文档清尾。

**回滚**：贵＝0 条（契约一律“加而不改”）；中＝S1.4 / S2.1 / S2.2 / S2.4；其余便宜。**成对提交**：S1.4 与 S2.1 的代码改动与判据改动必须同一提交，否则不是红就是假绿。

## 10 待拍板：三问 + 默认值表
1. **左栏点着换篇要不要？**〔默认：要 ⇒ 才有第 4 项“壳订阅页内段 + 归一”〕
2. **框架允许知道 `appview` 这一个词吗？**〔默认：允许 ⇒ 解析放框架，写错进现有 `errors` 账〕
3. **app 要不要在文档体内部插手？**〔默认：不要 ⇒ `content` 元素就够，文档体归属与桥行搬都免〕

其余 13 条默认：P2 缺省＝回退 `DocPane` · P3 校验＝“值必须在 mods 里 + 非渲染件红灯” · P4 handoff＝形态 1 · P5 `?app=`＝保持现有语义（值=篇、有无=形态）· P6 形态＝只有 `toggleDevMode` 能增删 + 换树携带 · P7 清单＝目录约定 + 当前篇并入 · P8 私有区通道＝不开 · P9 桥行＝不搬 · P10 槽集合＝只 `appview` · P11 切树落面＝保持现状 · P12 页内段＝由各 app 自定 · P13 `std`/`BASIC_RENDER`＝装配点包一层 · P14「一页」＝目录边界 · P15 换篇＝开（URL-first） · P16 槽的几何＝保持 `.dv-app`。
**否决优先级**：P15 → P1 → P4/P9 → P7 → 其余便宜。

## 11 纪律与不做什么
- 来源等级逐句标；**探讨 ≠ 决定**（落地前必须指出哪句话构成决定）。
- **判据不许放松**：只允许改表述，改动必须单列“改了哪条、为什么、原来是什么”。
- 跑判据前确认它连哪个 CDP 端口（`demo/test` 里 10/11 个套件默认连 **9222**）；跑任何脚本前先审它会不会写 VFS。
- 口径分“复核 / 未复核”，数字带命令与退出码；判据一律**隔离串行**。
- **不做什么**：不动 `## mods`；不发明 router 语法（只那一行）；不扩槽集合（一扩就退回被否的“外层再包一层”）；不做 `DocPane` 包壳；不用改判据换绿。

## 附 A 三个方案包
- **最小包**：宿主解析 + 回退缺省 + 弱校验 + 形态 1 + 清单目录 + 不搬桥行 ⇒ URL 与 F1 一字不动。
- **目标包**：框架解析 + 契约校验 + 形态 2/3 + 文档体有主 + 桥行搬 + 换篇进店 ⇒ 能力最全、半径最大。
- **折中包**：框架解析 + 名义红灯 + `DocPane` 加 `dispatch` ⇒ 底盘立稳、契约留口。

## 附 B 未复核与观察项
- 未复核（需“写”）：MODULES 16/16 · cdp-devview 43/43 · SOP 143/143 · e2e 5 红。
- 观察项（不在本计划范围）：`modMatch` 双通道 · `exp_app/ui/card/src/card.js` 18 行无 default 却被登记 · 平台 dev 产物 `jsxDEV = void 0` · `globalThis.__mdioAdoptSheet` 是判官盲区（R6a 只扫 `window.__`）。
- 未画：三张图（五层 / αβ 二分 / 决策依赖）。