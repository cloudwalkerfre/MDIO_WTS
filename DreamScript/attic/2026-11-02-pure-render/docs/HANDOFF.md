# HANDOFF —— mdio_ui appview 路由 / 认领（读我，回到轨道）

> 用途：**任何一次 context 丢失 / compact / 换人接手之后，先读这一页**，再动手。
> 本文是**索引 + 纪律 + 现状**，不是新权威。权威顺序：**实现（代码）> note（研究流水）> 本文**；三者冲突时以先两者为准，并回头改本文。
> 本文**可被重写**（它是活的）；note `/docs/路由研究.md` 是 **append-only**，只追加。

## 0. 60 秒版（现在就该知道的）
- **我在哪**：mdio_ui 的 appview 路由/认领机制。研究阶段（阶段 A）已完成；现在是**阶段 B**：按新 ui.md 范式升级 + 给 BASIC_RENDER/std 加默认组件（左栏 md docview）+ 借机研究 router 怎么写。
- **三条不许违反**：① `## mods` 一字不动（业主锚点）② 一个 scope 只能一个 app（排他）③ 指针（当前在哪）永远在 URL，URL 组合权归壳。
- **两件最容易被带偏的事**：`## router` 规范**业主明确未约定**（只给一个 path 占位，内容 router 自己定）；docview 是**认领 app 的内部组件**，不是框架/DocPane 的壳。
- **当前代码是干净的**（我上一轮的错误实现已全部清退；wt 切换器的回归已修复，见 T-G）；判据（隔离串行实测）：check-router **54/54**（含真点击换树）· MODULES **16/16** · cdp-devview **43/43** · judge.mjs 绿（51 源文件）；**e2e 5 红 · vis 9 红 = 陈旧 harness**（§7 第 8 条）。
- **下一步**（§9）：先把 app 认领表（scope→app）做出来，再谈 docview。

## 0.5 两条主线（先分清，再动手）
**主线 1 · 计划设想**（业主拍板的目标形态）：框架面 = mods（锚点）+ **app 表（scope→app，排他）** + router（**未约定**，只给一个 path 占位）；每个 app 有**私有区**（框架不解析）；BASIC_RENDER 认领渲染权；node 级可见性＝std 内部 router；**docview 是认领 app 的内部组件**；URL 两段（壳段 + 页内段）且**组合权归壳**；wt 切换归壳 header。
**主线 2 · 代码路径**（今天真正执行的链路）：
- 读声明：`extractDecl`(uiMd.js:458) 只认 mods / match / visibility；以 mod 名为名的私有区的 match 小节走 `modSectionOf`(:402) → `compileModMatch`(:677) → `matchOf`(:709)。
- 编译判定：`compileMatchTable`(:597) / `compileVisTable`(:637) → `uiStore`（Claim:28 / VisEntry:21 / activeClaims:104 / activeVis:110 / gates:128 / docScope:162 / docVisible:172）。
- 派发渲染：`NodeView`（claim/visible :133-135，renderNode :152，modMatch :153，use :154）→ `compFor`（compTable.jsx:23-34，兜底 modOf(std) :33）→ 件；节壳认领即封闭(:168)；`std.js` 的 `renderChild`(:329) 用**自己**的 trait 表。
- 壳与 URL：`APP_DOC`(entry.client.ts:51) → `initialDoc`(:401，过 docScope) → DevView → DocPane；`switchWt`(entry.client.ts:448)＝注册表清册（**不再查任何声明**）；sessionStorage 记忆；`appRouter`(appRouter.js:19) 给 hash/path + layerHost。
**两线对照（缺口就是待办）**：
| 计划设想 | 代码路径 | 状态 |
|---|---|---|
| mods 锚点 | extractDecl 读 mods | ✓ 一致 |
| **app 表 scope→app 排他** | **无任何消费者**（grep `decl.app` / `## app` 命中 0） | ✗ **最大缺口** |
| trait（mod 私有 match，可选） | modSectionOf/compileModMatch/matchOf + props + std 消费 | ✓ 已落地 |
| `_HIDDEN` 宏 | 已落地（样板 A 判据含 h4 不画） | ✓ |
| router 未约定 | **无任何消费者**（`entry` 私货已删，三棵树声明的 `## router` 节也一并删掉） | ✓ 与「未约定」一致 |
| 篇级可见性归属 | 只有 docScope（且只作用产品面） | ◐ 部分 |
| wt 切换归壳 | switchWt + 注册表（`entryOf` 已删） | ✓ 真点击实测通过（T-G 结案，两个根因已修）；模式与指针仍待解耦 |
| docview 在 app 内部 | 已清退，不存在 | ✗ 待做（且必须在 app 内部） |
| 三棵测试 wt 全迁 | exp_scripts ✓ · exp_pages ✓ · **exp_swap 仍是旧写法（顶层 match 3 行）** | ◐ 与「已全迁」的说法不符 |

> 判断纪律：**每当要动手，先问「我在改哪条主线」**。在主线 2 里给主线 1 补洞（例如在 DocPane 里包壳），就是之前跑偏的根因。

## 1. 环境与常用命令（照抄）
- 端口：mdio 网关 **8011** · 宿主 dev **5178** · 无头 CDP **9223** · 业主的浏览器 **9222（绝对不许碰）** · SOP 截图用的 GUI Chrome **9224**。
- wt uid：`genesis`（根）· `czUR8zxu`＝exp_scripts（**试验田/研究 note 所在树**）· `c7Sw4p00`＝exp_swap · `c8Page01`＝exp_pages。
- 起宿主：`cd mdio_ui/demo && node --no-warnings --experimental-vm-modules --experimental-import-meta-resolve --experimental-strip-types ./node_modules/@esmx/core/dist/cli/index.mjs dev`（先 `pkill -f 'esmx/core/dist/cli/index.mjs dev'`）。
- 构建 mod（改 `lib/mods/*` 后必须）：`node mdio_ui/demo/scripts/build-wt-ui.mjs mdio_ui/lib/mods/<mod> --force` ⇒ **断言 `ok = true`**；然后重启宿主。
- 判据：`node mdio_ui/demo/scripts/judge.mjs`（源规则）· `node exp_scripts/check-router.mjs`（路由 **54**）· `node .tmp/arena/run-modules.mjs`（模块层 16 套）· `cd mdio_ui/demo && CDP_URL=http://127.0.0.1:9223 node test/cdp-devview.mjs`（43）· 完整 SOP 见仓库根 `UI_TEST_SOP.md`（其 `sop-run` 需 GUI Chrome 9224）。
- mdio 读取（**必须带 wt_uid，否则拿不到那棵树**）：`curl -s -X POST http://127.0.0.1:8011/exec -H 'content-type: application/json' -d '{"code":"$ /docs/HANDOFF.md::","active_doc":"/","wt_uid":"czUR8zxu"}'`。
- mdio 写入：`JSON.stringify(text) + ' | /> <path> -pj r'`（覆盖）· `+>`（追加）· 新文件先 `mk -f <path>` · 小查询校验：`find -q "<片段>" -p <path>`。
- 取回自己的历史（会话日志）：`~/.dsh/sessions/--Users-asigen-MDIO_NEO--/<session-id>/session.v4.jsonl.zstd`（`zstd -dc` 流式解；只取 `type==="user/message"` 的 content 文本）。本会话 id＝`session-56a90b95-…`。

## 2. 业主的原始要求（原话，别转述）
**阶段 A（研究，已完成）**：
- 「拿剧本当做实验田，开始研究 —— 别忘了先网上好好查 mst router 轮子，看仔细，这是基石」
- 「结合当前实际代码，别猜」·「时不时记录 note，尤其是 compact 前后，一定要读」
**阶段 B（当前）**：
- 「记录 note → 确认 mdio_ui 提交状态 → 开始升级 ⇒ 测试（别忘了新 ui.md 范式也要配合改，几个测试 wt）。这个过程免不了要顺带研究 router 如何使用，**给 BASIC_RENDER/std 加一个默认组件：左边栏的 md docview（注意，这不是开发者模式的 fileview，是 appview 内 app 自己的 docview ⇒ 列表 md，配合新 router 做 app 内渲染切换的）**，借此机会顺便研究清楚 **router 应该如何写、ui.md 内的 router 应该放什么**。」
**关键拍板（后出者覆盖前者）**：
- 「我建议 **router 保持未约定状态，不要现在规定什么，保持开放性，就给 router 一个 ui.md 里的 path 即可，放什么 router 自己定** —— 因为还没有一个真正的 app 用到 router，需要什么还不知道。每个 wt 的 ui 都是配合 wt 写的……一个 app 页面不同部分可以来自不同 md，这是 app 自己操心的，因此 router 如何写，那也是这个 wt 自己的事。」
- 「**一个 wt 只能一个认领**（怎么可能前端同时存在两个 app）」⇒ 排他；`wrap`（外层再包一层）被否。
- 「`entry` 以后归路由，路由内部自己约定；`default: std` 这个问题**混杂了 app 和 router** —— app 负责 appview，内部用 router 自己负责 md ⇒ **appview 投影**。」
- 「BASIC_RENDER 是 app 认领，即渲染；`### match` 等类似 **trait/implementation**，提供给 app 级/类 mods，**可选使用**。」·「约定个宏 `- _HIDDEN: path` ⇒ 意为无 comps 认领，即为隐藏。」

## 3. 渐进线（六层 —— 不要跳层）
1. **基础**：esmx-router 可行性与选型。
2. **概念与手段**：appview 作为独立接入点（微前端）+ 分段 URL / 嵌套 / 层。
3. **底层支持**：壳与框架提供什么（appRouter、层容器、逐节点 props、switchWt、跨 wt 记忆）。
4. **uimd 规范**：mods + app 表 + app 私有区 + `_HIDDEN` + trait 小节。
5. **BASIC_RENDER/std 重确认**：BASIC_RENDER＝认领的渲染权；node 级可见性＝std 内部 router。
6. **第一个实验**：docview。
⇒ docview 的问题**必须用第 4、5 层的结论回答**（app 认领 + app 内部投影），**不许回到第 3 层的壳里打补丁**。

## 4. 各主题「最后确认版」（防跑偏锚；与 note §74.2 同源）
| 主题 | 最后确认版 | 已被推翻、别再引用 |
|---|---|---|
| esmx-router 选型 | `@esmx/router` + `@esmx/router-react` 3.0.0-rc.123（同版本线、React 19、微前端原生 base/children/layer）；MST 系全死；备用 react-router 8 | 「先自管、不引库」中间稿 |
| `## router` 规范 | **保持未约定**：只给 ui.md 一个 path 占位 | §18 的 `root:`/`children:`/`entry:` 三行；§43「router 节」；§60.1「app 表叫 router」 |
| app 认领 | **排他**：一个 scope 一个 app；行按 scope（`/` 整树 · `/a.md` 一篇 · `/a.md::sel` node） | 「`wrap: NAV: /` 与外层并列」 |
| BASIC_RENDER/std | BASIC_RENDER＝认领的渲染权（app）；std＝它指向的件；`### match`＝trait/impl 可选；`_HIDDEN`＝不画 | 「std 是框架硬编码兜底名字」的旧说法 |
| 可见性 | node 级＝std_app 内部 router（要改就换 std_app）；篇级归清单/壳 | §44 起「三档同一张表」中间稿 |
| URL 分段 | 壳段 `?wt&app` + 页内段（app 的 hash/path）；**组合器归壳**（三次独立复现）；运行期位置永远在 URL；第二跳不进框架面 | 任何「app 自己拼整条 URL」 |
| wt 切换 | 归**壳 header**：清册来自 `/.mds/worktrees.md`、壳调 `switchWt`（**每树 entry 自报已否并删除**） | `entry` 与「自动入口」那套说法 |
| docview | **app 内部组件**：BASIC_RENDER 认领整树后长在它内部 | 「DocPane 包壳」＝被否掉的 wrap |

## 5. 架构现状（代码事实 · 带位置）
- **声明面**：`/.mds/ui.md`。框架只认三节：mods / match / visibility（`extractDecl` uiMd.js:458；`findSection`:404 只下探两层；`bulletsOf`:427 子节报错）。**`## router` 没有任何消费者**（此前宿主 `entryOf` 读 `- entry:` 是私货，已删：`entryOf` 全库 0 命中）。
- **mod 私有区（trait，已落地）**：以 mod 名为名的节 + `### match`；`modSectionOf`(uiMd.js:402) 取节 → `compileModMatch`(:677) 编译 → `matchOf`(:709) 判定（复用 `claimMatches`:838 / `matchPath`:756）。发布袋 `ui_core/services/modMatch.js` + store 通道 `uiStore.modMatchBox`:64。可选：不写小节＝不用。
- **渲染**：`NodeView` 每节点算 claim/visible（:133-135），`renderNode` 交回入口（:152），能力经 props 给件：`modMatch`:153 · `use`:154 · `Comp`:161；节壳认领即封闭（:168）。`compFor`（compTable.jsx:23-34）未命中落在 mods 里的 `std`，再无则 null（无兜底）。
- **std 转正（部分）**：`ui_std/src/std.js` 的 `Block`/`Std` 先问自己的 trait 表（`:329 renderChild`），命中就换件 / `_HIDDEN` 不画 / 未命中交回框架。exp_scripts 的三条 node 规则已从顶层 match 搬进 `## std ### match`。
- **壳**：URL 两段 `?wt&app`；`switchWt`（entry.client.ts:448）＝换树（清册＝mdio 注册表）· **`ROOT_WT` 开机算一次**（entry.client.ts:49；换树是就地重跑，内联 `#mdio-wt-chain` 是旧值，重算会让切换清单塌掉）；跨 wt 记忆＝sessionStorage；`appRouter`(appRouter.js:19) 给 hash/path + layerHost。
- **能力**：`ui_core/services/appRouter.js`（`createAppRouter`:19）给 hash/path 视图 + `layerHost`；层容器 `#mdio-layer-host` 归壳。
- **三棵测试 wt**：exp_scripts（std trait 3 条 + MINA 样板 + PAPER/RAPP/MINA 桥行）· exp_pages（顶层 match 已删、node 规则进 `## std ### match`）· **exp_swap 仍是旧写法（顶层 match 3 行），尚未迁**。

## 6. 我已清退的错误实现（别再走）
- 内容：`DocPane` 加 `Shell` 槽 + 按篇 `activeClaims.length===0` 才包；`ui_std/src/docview.jsx`（左栏列表）+ 它的 CSS 块 + `ui_std/package.json` 的 `./docview` 导出；`entry.client.ts` 的 `DECL_DOCS` / `App` 包壳 / `switchDoc`；`appRouter` 的 `openDoc` + `setOpenDocHandler`；相应地判据里两组 docview 断言；实验 doc `/hub.md` `/brsrc.md` 与声明里的 `BR`。**以上已全部删除/回退，判据复跑全绿（§0）。**
- 为何错：它＝「外层再包一层」，正是业主当场否掉的 `wrap`（两个认领者）；后果必然是三连症：**只在指定篇生效**、**点击切出去开发者模式**（换篇顺手写了整条 URL，把产品面形态强加给开发面）、**产品面切换器失灵**。

## 7. 避坑清单（都是我真实踩过的）
1. **别把探讨当决定**：业主提问 ≠ 授权落地。落地前必须能指出「哪句话构成决定」。
2. **别跳层**：docview 的问题回到壳里打补丁必然错（§3）。
3. **别自己发明语法/词汇**：mods 值只有两种合法形态（裸模块名 / 规范形 locator）；`apps/xxx` 是我编的。
4. **构建失败会静默留旧产物** ⇒ 每次构建断言 `ok = true`，并注意 `.esmx-build.json` 的 `error` 字段可能是旧文本。
5. **发布袋 vs props 双通道**：`publishModMatch` 是模块级，跨实例（import-map 两份）可能取不到 ⇒ 优先 props 通道。
6. **改 UI 必须真看图**（`read_image` 能看）：`declDocs is not defined` 这类错只有截图能抓到。
7. **并发跑判据会互相争抢宿主/CDP** ⇒ 串行跑；`check-print`/`check-dual-dom` 历史上会抖。
8. **`test/e2e.mjs`（5 红）与 `test/vis.mjs`（9 红）是陈旧 harness**（调 `hitSetsOf`/`setDocPath`/`claimOf`/`ui.docPath` 等已删 API），**不是产品坏了**；要修得改 harness。
9. **磁盘上的 md 是滞后镜像**：`/.mds/*` 与 doc 一律以 VFS 为准（读用 8011/exec，别读盘）。
10. **不许碰业主的 Chrome 9222**；要 GUI 就自建 9224。
11. **别把自己的历史遗留当规范**：`- entry:` 就是例子 —— 它只有我写的宿主正则一个消费者；我几次把它塞进「应该长什么样」的草图里，等于用包袱规定未来。
12. **叙述必须标来源等级**：代码核实 / 业主原话 / 我推演 / **摘要转述（最不可信）**。§5/§9 曾把摘要当事实写进本文件（exp_swap「已迁」、`entry`「归路由」）——凡摘要来的句子都必须逐条核。
13. **删代码按符号边界，不按行段**；**失败查到异常为止**（直调入口，别停在「没看到副作用」）；**不许用改判据掩盖回归**——我曾因此弄坏 wt 切换器，并两次错误地给自己免责。
14. **UI 改动必须跑完整用户动作**（切进去 → 看名字/内容/清单 → 再切回来）＋**截图真看**；只验「URL 变了」＝没测（我因此把「切换器修好」误报了一次）。

## 8. 取回历史与 note（命令）
- note：`$ /docs/路由研究.md::`（在 `czUR8zxu` 树）；**关键节点**：§43（统一抽象讨论）· §57-§60（降格为 app / app 表 / 迁移配方 / 正题三步）· §61-§62（app 表＝match、vis 退休、std_app 内部 router）· §63-§64（trait 规范与拍板）· §66-§71（落地与 docview 重做）· **§72-§74（追历史 + 各主题最后确认版）**。
- 会话日志：见 §1 最后一条；本会话 54 次 compaction ⇒ **记忆不可信，以日志原话 + note 时间序 + 代码为准**。
- 小队摘要（当时视野）：`/tmp/team/01-note-digest.md` · `/tmp/team/02-state-audit.md` · `/tmp/team/03-gap-route.md`。

## 9. 待办（按依赖排序；每条写清「落点 / 验收 / 约束」）

**T-A · app 认领表（框架面 · 第一优先 · 最大缺口）**
- 是什么：`scope → app` 的**排他**映射，行按 scope 写（`/` 整树 · `/a.md` 一篇 · `/a.md::sel` node）。
- 为什么：计划主线的枢纽；代码里**一个消费者都没有**（`## app` / `decl.app` grep = 0）；也是 docview 存在的前提。
- 落点：声明解析侧新增「app 表」的编译（框架面）；**消费者＝壳装配点**（entry.client.ts 决定这篇/这棵树交给谁）。注意整树/整篇**不能**走现有节点判定（`isCandidate` 排除 root :223、`matchPath` 要 `chain>=2` :779）。
- 验收：真页面两条（`?wt=czUR8zxu&app=/README.md` 与 `?app=/剧本2.md` 落到不同 app；`BASIC_RENDER: /` 生效）＋ check-router 既有行为判据全绿 ＋ 新增 2–3 条认领判据。
- 约束：mods 不动；排他（**不许 wrap**）；重叠规则待定（T-F）。

**T-B · docview 作为「被认领 app 的内部组件」**
- 依赖 T-A（要先有整树认领，才有「跨篇的 app」）。
- 落点：被认领 app 的组件内部（如 BASIC_RENDER 件自身或其内部组合）；**不是** DocPane、**不是**框架槽。
- 内容：左栏＝该 app 认领/可见的篇（**声明派生**，不是 fileview 全量）；点击＝换指针（URL）；当前篇高亮。
- 验收：真页面 + **截图真看**（列表、当前篇、点切换、壳参数不丢、**开发面不受任何影响**）。
- 约束：不改模式（T-C）；零 inline style（走 CSS 类）。

**T-C · 模式与指针解耦**
- 现状问题：换树/换篇写 URL 会把「开发者模式开闭」一起改掉。
- 落点：entry.client.ts 的**唯一 URL 写点** + DevView 的形态判断（形态由 URL 推导，不该被指针动作改）。
- 验收：cdp-devview H3/H4/H5（就地显隐、不重载）保持绿 ＋ 新增「换树/换篇后仍是开发面」判据。

**T-D · 测试 wt 补齐迁移 + 根树旧三行清理**
- 事实：exp_scripts ✓、exp_pages ✓、**exp_swap 仍是旧写法**（顶层 match 3 行 NODE_ANY/NODE_TAG/SWAP，无 `## std ### match`）⇒ 按迁移配方搬进 `## std` 私有区。
- 另：根树的 `## router` 节**已整节删除**（`root:` / `children:` / `entry:` 全是私货）。
- 验收：check-router 的 other-wt 组 ＋ 各树真页面。

**T-E · 陈旧 harness 修复 + 全量 SOP 复跑**
- `test/e2e.mjs`（**5 红**：调已删 API `hitSetsOf` 等；另 1 组因依赖 wt `c6Oe1Gp1` 未挂载而跳过）· `test/vis.mjs`（9 红：调 `setDocPath`/`claimOf`/`ui.docPath`）⇒ 按**现 API** 重写。
- 然后按 `UI_TEST_SOP.md` **整条链**跑绿（含需要 GUI Chrome 9224 的 `sop-run`）。

**T-F（待拍板，先别动手）**
- **〔业主 2026-10-06 指出的缺口〕认领的写法与件的 kind 都没有约定**：归属表节名/形状未定、住树面还是件自报未定、`mods` 里没有 kind 字段（kind 只能由「是否被归属表引用」决定）、css/非渲染件被认领会顶掉渲染（实测事故）。四条候选 A/B/C/D 见 note §76.3。**T-A 开工前必须先拍这一条**（不重叠的最小情形可先按 D 走）。
- app 表重叠时谁胜（更具体者胜 / 声明序后写覆盖）；换树后落哪一面（**`entry` 已删，回到未定**）；篇级可见性住哪（router 节内一行 / 单独清册节）。

**T-G ·（已结案）wt 菜单点击「没反应」→ 两个根因**
- 真因：删 `entryOf` 私货时**整段误删**了跨树记忆的 `WT_MEM_KEY`/`wtMem`/`setWtMem` ⇒ `switchWt` 抛 `setWtMem is not defined` ⇒ 被 DevView 的 `.catch` 静默吞掉。已补回（不恢复 entryOf），真点击实测通过。
- 教训：① 删代码按**符号边界**，不按行段 ② `try/catch` 吞掉的地方必须**直调入口**查异常（fiber 直调）③ **不许用改判据掩盖回归**（我曾把点击断言降级为 URL 驱动）。
- **根因 2**：切进某棵树后 `rootWt` 每次渲染被重算 ⇒ 退化成子 wt ⇒ 外壳读子 wt 那份不存在的注册表 ⇒ 清单塌成 1 条、标题退化成 uid、**切无可切**。修：`ROOT_WT` 开机算一次。
- **验收方式（今后照此）**：完整用户动作往返（切进去 → 看名字/内容/清单 → 再切回 → 再切第三棵）＋ 截图真看；判据含真点击换树。





**不在待办里（明确不做）**：不动 `## mods`；不发明 `## router` 语法；不动无关 mod（`ui_devview` 除 T-C 外不碰）；不做「外层再包一层」。

## 10. 维护规则（对本文自己）
1. 每次「业主拍板 / 清退 / 判据基线变化」都回来改本文对应小节（本文可重写）。
2. 冲突时：先改本文去对齐实现与 note；**不许**反过来让实现去迁就本文。
3. 别把本文写成第二本 note —— 细节进 note，本文只留「回到轨道」需要的东西。
