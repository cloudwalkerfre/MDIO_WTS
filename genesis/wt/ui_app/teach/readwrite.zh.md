# READ AND WRITE

## 演示

（hs-writes：读写演示，内嵌动画。）

## 选择器

选择器 = **路径 + block_type + 投影（-pj）**

- `:tag` 是 `[.tag == "tag"][0] -pj ct` 的语法糖。

- **路径**
  - `.NAME`：钻取，取当前层 tag=NAME 的子节点（例 `项目.配置`）
  - `.*`：当前层全部子节点
  - `..NAME`：递归钻取，全部后代中 tag=NAME 的节点
  - `..*`：递归通配，全部后代
  - `:tag`：标识匹配，返回匹配节点的 content/value
  - `[filter]`：过滤 / 切片，作用在当前集合

- 路径演示
  - 钻取到配置节 → 看整节原文
    > $ /demo.md::项目.配置 -pj raw
  - 当前层全部子节点 → 看直接子节点的 tag
    > $ /demo.md::项目.配置.* -pj tag
  - 递归取所有标题 → 看整篇章节名
    > $ /demo.md::..*[h] -pj tag
  - `:tag` 取值 → 取 bullet 的 value
    > $ /demo.md::项目.配置:端口

- **跨文件寻址**：两段式 `文件地址::文档内选择器`。
  - 定位到某节的值
    > $ /demo.md::项目.配置:端口
  - 省略文档内选择器 → 读整篇
    > $ /demo.md::

- **类型（全写 / 简写）× 投影**

raw = container + content

| 类型 | 全写 | 简写 / 别名 | raw | container | mark | tag | content | 可写层 |
|---|---|---|---|---|---|---|---|---|
| head | `[head]` | `[h]`、`[h1]`–`[h6]`、`[head1]`–`[head6]` | 标题 + 节体 | `## 标题` | `#`–`######` | 标题文本 | 节体 | tag / content |
| bullet | `[bullet]` | `[b]`、`[blt]` | `- KEY: value` | `- KEY: ` | `-` | KEY | value | tag / content |
| code | `[code]` | `[c]`、`[codeblock]` | fence + 代码体 | fence 行 | 三个反引号 | 语言 | 代码体 | tag / content |
| bq | `[bq]` | `[blockquote]` | `> 文本` | `> ` | `>` | 空 | 引用文本 | content |
| ol | `[ol]` | `[o]`、`[orderlist]` | `N. item` | `N. ` | `N.` | 编号 | item | tag / content |
| tb | `[tb]` | `[table]` | 表格行 | 竖线 | 竖线 | 空 | 单元格文本 | content |
| comment | `[comment]` | 无 | `<!-- 注释 -->` | `<!--` | `<!--` | 空 | 注释体 | content |
| p | `[p]` | `[paragraph]` | 正文 | 无 | 无 | 空 | 正文 | content |

- 别名：`r` raw、`ctn` container、`m` mark、`t` tag、`ct` content。

- 同一投影，不同 block_type
  - 标题的 tag → 标题文本
    > $ /demo.md::..*[h] -pj tag
  - 代码块的 tag → 代码语言
    > $ /demo.md::..*[c] -pj tag
  - 表格的 ct → 单元格文本
    > $ /demo.md::..*[tb] -pj ct

- **`_nt`：路径类型标记（选择器语法的一部分）**
  - 约定：`_` + 节点类型简写，**挂在路径段后面**；它不是一个独立的命令，也不是过滤条件，而是“路径本身只匹配这种节点”。
  - 常用简写：`_b` bullet、`_h` 标题（任意级别）、`_h1`–`_h6` 指定级别、`_c` code、`_bq` 引用、`_ol` 有序列表、`_tb` 表格、`_comment` 注释、`_p` 段落。
  - 位置规则：
    - `HEAD._b`：HEAD 的**直接** bullet 子节点；
    - `HEAD.._b`：HEAD 下**递归**所有 bullet；
    - `HEAD.._b:port`：递归 bullet 中 tag=port 的节点，读它的 value；
    - `.._b` 与 `..*_b` 等价；`.` 是直接子节点，`..` 是递归后代。
  - 为什么需要它：同名 tag 可能同时是标题、bullet、代码块；只用 `HEAD.NAME` 会一起命中，`_nt` 在**路径层**就把类型定死。
  - 和 filter 的关系：`_nt` 管“节点类型”，`[filter]` 管“节点内容”；可叠加，如 `.._b[b.ct.has("文档")]`。

- **过滤器**
  - 字段：`.tag` / `.content` / `.raw` / `.container` / `.mark`
  - 方法：`.has("text")` / `.re("regex")` / `.eq("value")` / `.empty`
  - 证据过滤 `.by[...]`：判断节点内部**是否包含**指定类型/形状的子节点，是存在性过滤；不匹配当前节点的 tag/文字。
    - 内容含表格的 h2
      > $ /demo.md::..*[h2.by[tb]] -pj tag
    - 内容含 bullet 列表的 h2
      > $ /demo.md::..*[h2.by[blt]] -pj tag
    - 内容含代码块的 h2
      > $ /demo.md::..*[h2.by[c]] -pj tag
    - 必须挂在类型/字段后；裸 `.by` → P001
      > $ /demo.md::..*[.by[tb]] -pj tag
  - 字段/内容匹配
    - content 包含子串
      > $ /demo.md::..*_b[b.ct.has("文档")] -pj raw
    - raw 包含子串
      > $ /demo.md::..*_b[b.r.has("端口")] -pj raw
    - container 包含标记
      > $ /demo.md::..*_b[b.ctn.has("-")] -pj raw
    - mark 精确匹配
      > $ /demo.md::..*_b[b.m=="-"] -pj raw
    - content 精确匹配
      > $ /demo.md::..*_b[b.ct.eq("dev")] -pj raw
    - content 为空
      > $ /demo.md::..*_b[b.ct.empty] -pj raw
  - tag/正则匹配
    - tag 正则
      > $ /demo.md::..*_b[b.tag.re("端口|环境")] -pj raw
    - 类型自身 tag 精确匹配
      > $ /demo.md::..*[c.t=="python"]
  - 逻辑组合
    - 或：两个 tag 任一命中
      > $ /demo.md::..*_b[b.tag=="端口" || b.tag=="环境"]
    - 非：content 不为空
      > $ /demo.md::..*_b[!(b.ct.empty)] -pj raw
    - 与：tag 命中且 content 非空
      > $ /demo.md::..*_b[(b.tag=="端口" || b.tag=="环境") && !(b.ct.empty)]
  - 切片
    - 第一个
      > $ /demo.md::..*_b[0] -pj raw
    - 前两个
      > $ /demo.md::..*_b[0:2] -pj raw
    - 最后一个
      > $ /demo.md::..*_b[-1] -pj raw
    - 前 6 个、步长 2
      > $ /demo.md::..*_b[0:6:2] -pj raw
    - 指定下标列表
      > $ /demo.md::..*_b[1,3,5] -pj raw
    - 前 3 个再倒序
      > $ /demo.md::..*_b[0:3, ::-1] -pj raw
  - 过滤器必须挂在集合后（`.*` / `..*`），不能裸写 `[filter]`。
  - 字段方法要带类型或字段：`[b.ct.has(...)]` ✅，`[.content.has(...)]` ❌（P001）；裸字段只支持 `.re`。
  - **过滤器后面不能再接 `..*`**：要再过滤就换起点（先钻到目标节，再 `.*[filter]`）。
  - `:tag` 是懒搜索（只取第一个命中）；要全部命中用 `..*_b[b.tag=="KEY"]`；`:tag` 永远最后。
- **组合**：`文件::路径 + 类型 + 过滤 + 投影`。

## 操作符

- `$` 读 VFS
  - 普通目标默认 raw
    > $ /demo.md::项目.配置 -pj raw
  - `:tag` 目标默认 content
    > $ /demo.md::项目.配置:端口
- `$$` 读管道/内存 md
  - 把管道文本当文档在内存解析，不读 VFS
    > $ /demo.md:: | $$ ..*[c.ct.re("print")]
  - 对上一段 md 的引用节点做选择
    > $ /demo.md::日志 | $$ ..*[bq.ct.re("记录")]
- `+>` 追加
  - 默认追加 content 到目标末尾
    > "- 新增: 测试\n" | +> /demo.md::项目.任务
  - `-pj raw` 追加到锚点节点之后
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
  - 根级节点用 `-pj raw` 追加新节
    > "\n## 新节\n- 新键: 新值" | +> /demo.md:: -pj raw
- `/>` 覆盖
  - 默认只换 content，保留 container
    > "9090" | /> /demo.md::项目.配置:端口
  - `-pj raw` 整段替换
    > "9090" | /> /demo.md::项目.配置:端口 -pj raw
- `->` 删除
  - 整节点删除
    > -> /demo.md::项目.配置.*[b.t=="模式"]
  - `:key` 只清值、保留容器
    > -> /demo.md::项目.配置:环境
- `~>` 补丁
  - 两种输入格式：JSON 数组、Aider diff
  - JSON 数组补丁，按 old→new 替换
    > [{"old":"9090","new":"7070"}] | ~> /demo.md::项目.配置:端口
  - Aider diff 补丁：`<<<<` / `====` / `>>>>` 三段
    ~~~text
    """<<<<
    > 记录一
    ====
    > 记录一（已归档）
    >>>>""" | ~> /demo.md::项目.日志
    ~~~
- 写文件不存在
  - 写操作不自动建文件；先 `mk -f`
    > mk -f /tmp/new.md ; "正文" | /> /tmp/new.md:: -pj r
- `-f` 自动接骨
  - 概念：按目标路径补缺失节点；只补节点、不猜层级、不建文件；默认 true
  - 根级路径补出 h1
    > "- x: 1" | +> /demo.md::新节
  - 嵌套路径补出对应层级
    > "- x: 1" | +> /demo.md::项目.新节
  - 关闭接骨时明确失败
    > "- x: 1" | +> /demo.md::X.新节 -f false
- `-l` 自动层级
  - 概念：只对 head payload 生效；payload 层级 + 目标深度，上限 6
  - 在 h2 节下写 h1 payload，自动落成 h3
    > "\n# NewSection\n- item: 1" | +> /demo.md::项目.配置 -l true
- `-pt` 流透传
  - 概念：写操作默认返回 mdio_success；`-pt true` 保留原 payload 继续流
  - 准备两个文件，作为同一份数据的两个落点
    > mk -f /tmp/pt_a.md ; mk -f /tmp/pt_b.md
  - 同一数据写两处：a、b 都变成 NEW
    > "NEW" | /> /tmp/pt_a.md::P.节:键 -pt true | /> /tmp/pt_b.md::P.节:键
- `-pj r`
  - 写 raw：`-pj raw` 的简写，表示整段替换
    > "9090" | /> /demo.md::项目.配置:端口 -pj r

## 实验台

## 示例

先 `mk -f /demo.md`，写入下面内容；以下读写命令会修改它，按顺序跑或先复制一份。

````md
# 项目

## 配置

- 端口: 8080
- 环境: dev
- 模式: local
- 空值:

## 任务

- 待办: 写文档
- 完成: false

### 子任务

- 子项: 测试

## 说明

1. 先启动服务
<!-- 备注 -->
普通段落文本

## 日志

> 记录一
> 记录二

```python
print("hi")
```

| 列A | 列B |
| --- | --- |
| a | 1 |
| b | 2 |

# 标记

- 同样tag: 短横
+ 同样tag: 加号
* 同样tag: 星号

# 路由

- target: /demo.md::项目.配置:端口
- base: /demo.md
````

- 读
  - 所有标题
    > $ /demo.md::..*[h] -pj tag
  - 一个值
    > $ /demo.md::项目.配置:端口
  - 配置节原文
    > $ /demo.md::项目.配置 -pj raw
  - 过滤 bullet
    > $ /demo.md::..*_b[b.tag.re("端口|环境")] -pj raw
  - 代码 → 取代码语言
    > $ /demo.md::..*[c] -pj tag
  - 表格 → 取单元格文本
    > $ /demo.md::..*[tb] -pj ct
  - 同 tag、不同 mark
    - 三行全取 → raw 保留各自 mark
      > $ /demo.md::标记.*[b.tag=="同样tag"] -pj raw
    - 只取 mark → 得到 - + *
      > $ /demo.md::标记.*[b.tag=="同样tag"] -pj m
    - 按 mark 过滤 → 只留 + 行
      > $ /demo.md::标记.*[b.tag=="同样tag" && b.m=="+"] -pj raw
  - 全文
    > $ /demo.md::
- 写
  - 覆盖值
    > "9090" | /> /demo.md::项目.配置:端口
  - 末尾追加
    > "- 新增: 测试\n" | +> /demo.md::项目.任务
  - 锚后插入
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
  - 根末尾新增一节
    > "\n## 新节\n- 新键: 新值" | +> /demo.md:: -pj raw
  - 删除整节点
    > -> /demo.md::项目.配置.*[b.t=="模式"]
  - 补丁替换值
    > [{"old":"9090","new":"7070"}] | ~> /demo.md::项目.配置:端口
- 管道
  - 格式化标签
    > $ /demo.md::项目.配置.* -pj tag | fmt "- {}"
  - 复制整篇
    > mk -f /tmp/demo_copy.md ; $ /demo.md:: | /> /tmp/demo_copy.md:: -pj r

## 注意事项

- 文件名含 `-`、空格等特殊字符要加引号：`/tmp/name-with-dash.md` 不加引号会被截成 `/tmp/name.md`；`$ "/tmp/name with space.md"::` 正常。
- 路径中的 `.md` 扩展名可省略：`/path/file::` 等价于 `/path/file.md::`。
- 过滤器和切片可链式组合：`..*[o][0:2]` 表示先取有序列表，再取前两项。
- 写操作不建文件：先 `mk -f`；`-f` 只接骨，不创建不存在的文件。
- 过滤器后面不能再接 `..*`；`:tag` 永远最后；`:tag` 读值忽略 `-pj`。
- 裸字段方法不合法：`[b.ct.has(...)]` ✅，`[.content.has(...)]` ❌。
- 读取输出会对**完全相同的投影行去重**；`raw` 不去重，看命中数用 `raw`。
- `nodes` 一次返回多个投影面会报 `ARROW_INVALID_RESULT`；多面用 `pj` 或拆查询。
- FTS/search 只索引内容 value，不索引 tag/key；按 tag 找用 `nodes` / `pj`。
- 错误看 `- mdio_error:` 前缀（P001 / I500 / R201）；读到不存在的内容可能返回空，不一定是错误。
- 写后必须 `$` 读回：`mdio_success` 只表示管道跑完。

## 常见错误

- `:tag` 后接 `[0]` → `[P001]`；正确：`项目.配置.*[b.t=="端口"][0]` 或先取集合。
- filter 后接 `..*` → `[P001]`；正确：先钻到目标节，再 `.*[filter]`。
- `[.content.has("x")]` → `[P001]`；正确：`[b.ct.has("x")]`。
- `+> /no_such.md::` → `[I500]`；正确：先 `mk -f /no_such.md`。
- 读不存在的节可能是空串，不是报错；先 `$ /demo.md::..*[h]` 确认节名。
- 文件名不加引号导致 `-` 被截断；正确：`"/tmp/name-with-dash.md"`。
- 用 `:端口 -pj raw` 想拿原文 → `:tag` 是 value-target；正确：`.*[b.t=="端口"] -pj raw`。
- 看到 `mdio_success` 就结束 → 必须再 `$` 读回目标。
- `nodes` 一次返回多个投影面 → `ARROW_INVALID_RESULT`；改用 `pj` 或分开查。

## 最佳实践

- 问题：改一个值，不想动容器
  - 讲解：`/>` 默认只换 content；`-pj raw` 是整段替换
  - 默认只换 content
    > "9090" | /> /demo.md::项目.配置:端口
  - 整段替换
    > "9090" | /> /demo.md::项目.配置:端口 -pj raw
- 问题：在某个 bullet 后面插一行
  - 讲解：`+>` 默认落到节末尾；要插锚后必须用 `-pj raw` + 锚点
  - 在锚点后插入
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
- 问题：目标节不存在
  - 讲解：默认 `-f` 接骨；要明确失败用 `-f false`；文件不存在先 `mk -f`
  - 默认接骨
    > "正文" | /> /demo.md::项目.新节
  - 关闭接骨
    > "正文" | /> /demo.md::项目.另一节 -f false
- 问题：写完怎么确认
  - 讲解：`mdio_success` 只代表管道完成；读回目标才算验收
  - 写后立刻读回
    > "9090" | /> /demo.md::项目.配置:端口 ; $ /demo.md::项目.配置:端口
- 什么时候用 arrow：高级查询, 选择器表达不了跨文档聚合、join、排名时。
