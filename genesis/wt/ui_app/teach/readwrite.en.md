# READ AND WRITE

## Demo

（hs-writes: read/write animation, embedded.）

## Selector

Selector = **path + block_type + projection (-pj)**

- `:tag` is syntactic sugar for `[.tag == "tag"][0] -pj ct`.

- **Path**
  - `.NAME`: drill down and take child nodes with tag=NAME at the current level (e.g. `项目.配置`)
  - `.*`: all child nodes at the current level
  - `..NAME`: recursive drill-down, nodes with tag=NAME among all descendants
  - `..*`: recursive wildcard, all descendants
  - `:tag`: identity match, returns the content/value of the matched node
  - `[filter]`: filter / slice, applied to the current set

- Path demos
  - Drill down to the config section → show the whole section raw
    > $ /demo.md::项目.配置 -pj raw
  - All child nodes at the current level → show tags of direct children
    > $ /demo.md::项目.配置.* -pj tag
  - Recursively fetch all headings → show all section names in the document
    > $ /demo.md::..*[h] -pj tag
  - `:tag` value fetch → take the bullet's value
    > $ /demo.md::项目.配置:端口

- **Cross-file addressing**: two-part form `文件地址::文档内选择器`.
  - Locate the value of a section
    > $ /demo.md::项目.配置:端口
  - Omit the in-document selector → read the whole document
    > $ /demo.md::

- **Type (full form / short form) × projection**

raw = container + content

| type | full form | short form / alias | raw | container | mark | tag | content | writable layers |
|---|---|---|---|---|---|---|---|---|
| head | `[head]` | `[h]`, `[h1]`–`[h6]`, `[head1]`–`[head6]` | heading + section body | `## 标题` | `#`–`######` | heading text | section body | tag / content |
| bullet | `[bullet]` | `[b]`, `[blt]` | `- KEY: value` | `- KEY: ` | `-` | KEY | value | tag / content |
| code | `[code]` | `[c]`, `[codeblock]` | fence + code body | fence line | three backticks | language | code body | tag / content |
| bq | `[bq]` | `[blockquote]` | `> 文本` | `> ` | `>` | empty | quote text | content |
| ol | `[ol]` | `[o]`, `[orderlist]` | `N. item` | `N. ` | `N.` | number | item | tag / content |
| tb | `[tb]` | `[table]` | table row | pipe | pipe | empty | cell text | content |
| comment | `[comment]` | none | `<!-- 注释 -->` | `<!--` | `<!--` | empty | comment body | content |
| p | `[p]` | `[paragraph]` | body text | none | none | empty | body text | content |

- Aliases: `r` raw, `ctn` container, `m` mark, `t` tag, `ct` content.

- Same projection, different block_type
  - Heading's tag → heading text
    > $ /demo.md::..*[h] -pj tag
  - Code block's tag → code language
    > $ /demo.md::..*[c] -pj tag
  - Table's ct → cell text
    > $ /demo.md::..*[tb] -pj ct

- **`_nt`: path type marker (part of selector syntax)**
  - Convention: `_` + node type shorthand, **appended after a path segment**; it is not a standalone command, nor a filter condition — rather, "the path itself only matches this node type".
  - Common shorthands: `_b` bullet, `_h` heading (any level), `_h1`–`_h6` specific level, `_c` code, `_bq` blockquote, `_ol` ordered list, `_tb` table, `_comment` comment, `_p` paragraph.
  - Position rules:
    - `HEAD._b`: **direct** bullet children of HEAD;
    - `HEAD.._b`: **recursive** all bullets under HEAD;
    - `HEAD.._b:port`: the node with tag=port among recursive bullets; reads its value;
    - `.._b` is equivalent to `..*_b`; `.` is a direct child, `..` is a recursive descendant.
  - Why it is needed: the same tag may simultaneously be a heading, a bullet, and a code block; `HEAD.NAME` alone matches them all, while `_nt` fixes the type at the **path level**.
  - Relation to filter: `_nt` governs "node type" while `[filter]` governs "node content"; they can be combined, e.g. `.._b[b.ct.has("文档")]`.

- **Filters**
  - Fields: `.tag` / `.content` / `.raw` / `.container` / `.mark`
  - Methods: `.has("text")` / `.re("regex")` / `.eq("value")` / `.empty`
  - Evidence filter `.by[...]`: checks whether a node **contains** child nodes of the given type/shape; it is an existence filter and does not match the current node's tag/text.
    - h2 whose content contains a table
      > $ /demo.md::..*[h2.by[tb]] -pj tag
    - h2 whose content contains a bullet list
      > $ /demo.md::..*[h2.by[blt]] -pj tag
    - h2 whose content contains a code block
      > $ /demo.md::..*[h2.by[c]] -pj tag
    - Must be attached after the type/field; bare `.by` → P001
      > $ /demo.md::..*[.by[tb]] -pj tag
  - Field/content matching
    - content contains a substring
      > $ /demo.md::..*_b[b.ct.has("文档")] -pj raw
    - raw contains a substring
      > $ /demo.md::..*_b[b.r.has("端口")] -pj raw
    - container contains a mark
      > $ /demo.md::..*_b[b.ctn.has("-")] -pj raw
    - mark exact match
      > $ /demo.md::..*_b[b.m=="-"] -pj raw
    - content exact match
      > $ /demo.md::..*_b[b.ct.eq("dev")] -pj raw
    - content is empty
      > $ /demo.md::..*_b[b.ct.empty] -pj raw
  - tag/regex matching
    - tag regex
      > $ /demo.md::..*_b[b.tag.re("端口|环境")] -pj raw
    - exact match on the type's own tag
      > $ /demo.md::..*[c.t=="python"]
  - Logical combinations
    - OR: either of the two tags matches
      > $ /demo.md::..*_b[b.tag=="端口" || b.tag=="环境"]
    - NOT: content is not empty
      > $ /demo.md::..*_b[!(b.ct.empty)] -pj raw
    - AND: tag matches and content is non-empty
      > $ /demo.md::..*_b[(b.tag=="端口" || b.tag=="环境") && !(b.ct.empty)]
  - Slices
    - First
      > $ /demo.md::..*_b[0] -pj raw
    - First two
      > $ /demo.md::..*_b[0:2] -pj raw
    - Last
      > $ /demo.md::..*_b[-1] -pj raw
    - First 6, step 2
      > $ /demo.md::..*_b[0:6:2] -pj raw
    - Explicit index list
      > $ /demo.md::..*_b[1,3,5] -pj raw
    - First 3, then reversed
      > $ /demo.md::..*_b[0:3, ::-1] -pj raw
  - A filter must be attached after a set (`.*` / `..*`); it cannot be written bare as `[filter]`.
  - Field methods must carry a type or field: `[b.ct.has(...)]` ✅, `[.content.has(...)]` ❌ (P001); bare fields support only `.re`.
  - **A filter cannot be followed by `..*` again**: to filter again, change the starting point (drill down to the target section first, then `.*[filter]`).
  - `:tag` is a lazy search (takes only the first hit); to get all hits use `..*_b[b.tag=="KEY"]`; `:tag` always comes last.
- **Composition**: `文件::路径 + 类型 + 过滤 + 投影`.

## Operators

- `$` read VFS
  - Normal targets default to raw
    > $ /demo.md::项目.配置 -pj raw
  - `:tag` targets default to content
    > $ /demo.md::项目.配置:端口
- `$$` read pipeline/in-memory md
  - Parse the pipeline text as a document in memory without reading VFS
    > $ /demo.md:: | $$ ..*[c.ct.re("print")]
  - Select over the reference nodes of the previous md segment
    > $ /demo.md::日志 | $$ ..*[bq.ct.re("记录")]
- `+>` append
  - By default append content to the end of the target
    > "- 新增: 测试\n" | +> /demo.md::项目.任务
  - `-pj raw` appends after the anchor node
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
  - For root-level nodes use `-pj raw` to append a new section
    > "\n## 新节\n- 新键: 新值" | +> /demo.md:: -pj raw
- `/>` replace
  - By default replace only content, keeping the container
    > "9090" | /> /demo.md::项目.配置:端口
  - `-pj raw` replaces the whole segment
    > "9090" | /> /demo.md::项目.配置:端口 -pj raw
- `->` delete
  - Delete the whole node
    > -> /demo.md::项目.配置.*[b.t=="模式"]
  - `:key` clears only the value, keeping the container
    > -> /demo.md::项目.配置:环境
- `~>` patch
  - Two input formats: JSON array, Aider diff
  - JSON array patch, replacing by old→new
    > [{"old":"9090","new":"7070"}] | ~> /demo.md::项目.配置:端口
  - Aider diff patch: three parts `<<<<` / `====` / `>>>>`
    ~~~text
    """<<<<
    > 记录一
    ====
    > 记录一（已归档）
    >>>>""" | ~> /demo.md::项目.日志
    ~~~
- Writing to a nonexistent file
  - Write operations do not create files automatically; run `mk -f` first
    > mk -f /tmp/new.md ; "正文" | /> /tmp/new.md:: -pj r
- `-f` auto-splicing
  - Concept: fill missing nodes along the target path; only adds nodes, does not guess levels, does not create files; default true
  - Root-level paths get an h1 spliced in
    > "- x: 1" | +> /demo.md::新节
  - Nested paths get the corresponding levels spliced in
    > "- x: 1" | +> /demo.md::项目.新节
  - Fails explicitly when splicing is disabled
    > "- x: 1" | +> /demo.md::X.新节 -f false
- `-l` auto leveling
  - Concept: applies only to head payloads; payload level + target depth, capped at 6
  - Writing an h1 payload under an h2 section lands as h3 automatically
    > "\n# NewSection\n- item: 1" | +> /demo.md::项目.配置 -l true
- `-pt` stream passthrough
  - Concept: write operations return mdio_success by default; `-pt true` keeps the original payload flowing
  - Prepare two files as two sinks for the same data
    > mk -f /tmp/pt_a.md ; mk -f /tmp/pt_b.md
  - Write the same data to two places: both a and b become NEW
    > "NEW" | /> /tmp/pt_a.md::P.节:键 -pt true | /> /tmp/pt_b.md::P.节:键
- `-pj r`
  - Write raw: shorthand for `-pj raw`, meaning replace the whole segment
    > "9090" | /> /demo.md::项目.配置:端口 -pj r

## Lab

## Examples

First run `mk -f /demo.md` and write the content below; the read/write commands below will modify it — run them in order or make a copy first.

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

- Read
  - All headings
    > $ /demo.md::..*[h] -pj tag
  - One value
    > $ /demo.md::项目.配置:端口
  - Config section raw
    > $ /demo.md::项目.配置 -pj raw
  - Filter bullets
    > $ /demo.md::..*_b[b.tag.re("端口|环境")] -pj raw
  - Code → take the code language
    > $ /demo.md::..*[c] -pj tag
  - Table → take cell text
    > $ /demo.md::..*[tb] -pj ct
  - Same tag, different mark
    - Take all three lines → raw keeps each mark
      > $ /demo.md::标记.*[b.tag=="同样tag"] -pj raw
    - Take only mark → get - + *
      > $ /demo.md::标记.*[b.tag=="同样tag"] -pj m
    - Filter by mark → keep only the + line
      > $ /demo.md::标记.*[b.tag=="同样tag" && b.m=="+"] -pj raw
  - Whole document
    > $ /demo.md::
- Write
  - Replace value
    > "9090" | /> /demo.md::项目.配置:端口
  - Append at the end
    > "- 新增: 测试\n" | +> /demo.md::项目.任务
  - Insert after anchor
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
  - Add a new section at the root end
    > "\n## 新节\n- 新键: 新值" | +> /demo.md:: -pj raw
  - Delete the whole node
    > -> /demo.md::项目.配置.*[b.t=="模式"]
  - Patch-replace value
    > [{"old":"9090","new":"7070"}] | ~> /demo.md::项目.配置:端口
- Pipes
  - Format tags
    > $ /demo.md::项目.配置.* -pj tag | fmt "- {}"
  - Copy the whole document
    > mk -f /tmp/demo_copy.md ; $ /demo.md:: | /> /tmp/demo_copy.md:: -pj r

## Notes

- File names containing `-`, spaces, or other special characters must be quoted: `/tmp/name-with-dash.md` without quotes is truncated to `/tmp/name.md`; `$ "/tmp/name with space.md"::` works.
- The `.md` extension in paths can be omitted: `/path/file::` is equivalent to `/path/file.md::`.
- Filters and slices can be chained: `..*[o][0:2]` means take the ordered list first, then the first two items.
- Write operations do not create files: run `mk -f` first; `-f` only splices, it does not create nonexistent files.
- A filter cannot be followed by `..*`; `:tag` always comes last; `:tag` value reads ignore `-pj`.
- Bare field methods are invalid: `[b.ct.has(...)]` ✅, `[.content.has(...)]` ❌.
- Read output **deduplicates identical projection lines**; `raw` does not deduplicate — use `raw` to count hits.
- `nodes` returning multiple projection faces at once reports `ARROW_INVALID_RESULT`; use `pj` or split the query for multiple faces.
- FTS/search indexes only content value, not tag/key; to find by tag use `nodes` / `pj`.
- Errors appear with the `- mdio_error:` prefix (P001 / I500 / R201); reading nonexistent content may return empty, which is not necessarily an error.
- After writing you must read back with `$`: `mdio_success` only means the pipeline finished.

## Common Errors

- `:tag` followed by `[0]` → `[P001]`; correct: `项目.配置.*[b.t=="端口"][0]` or take the set first.
- filter followed by `..*` → `[P001]`; correct: drill down to the target section first, then `.*[filter]`.
- `[.content.has("x")]` → `[P001]`; correct: `[b.ct.has("x")]`.
- `+> /no_such.md::` → `[I500]`; correct: run `mk -f /no_such.md` first.
- Reading a nonexistent section may be an empty string, not an error; confirm the section name with `$ /demo.md::..*[h]` first.
- Unquoted file names cause `-` to be truncated; correct: `"/tmp/name-with-dash.md"`.
- Using `:端口 -pj raw` to get the raw → `:tag` is value-target; correct: `.*[b.t=="端口"] -pj raw`.
- Stopping at `mdio_success` → you must read back the target with `$`.
- `nodes` returning multiple projection faces → `ARROW_INVALID_RESULT`; use `pj` or query separately.

## Best Practices

- Problem: change a value without touching the container
  - Explanation: `/>` replaces only content by default; `-pj raw` replaces the whole segment
  - Replace content only by default
    > "9090" | /> /demo.md::项目.配置:端口
  - Replace the whole segment
    > "9090" | /> /demo.md::项目.配置:端口 -pj raw
- Problem: insert a line after a certain bullet
  - Explanation: `+>` lands at the end of the section by default; to insert after an anchor you must use `-pj raw` + anchor
  - Insert after the anchor
    > "- 插入: 锚后" | +> /demo.md::项目.任务.*[b.t=="待办"] -pj raw
- Problem: the target section does not exist
  - Explanation: `-f` splices by default; use `-f false` to fail explicitly; run `mk -f` first if the file does not exist
  - Splice by default
    > "正文" | /> /demo.md::项目.新节
  - Disable splicing
    > "正文" | /> /demo.md::项目.另一节 -f false
- Problem: how to confirm after writing
  - Explanation: `mdio_success` only means the pipeline completed; reading back the target counts as acceptance
  - Read back immediately after writing
    > "9090" | /> /demo.md::项目.配置:端口 ; $ /demo.md::项目.配置:端口
- When to use arrow: for advanced queries, when selectors cannot express cross-document aggregation, join, or ranking.
