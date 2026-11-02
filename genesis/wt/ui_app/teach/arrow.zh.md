# ARROW

## 演示

（hs-arrow：查询箭头演示，内嵌动画。）

## 实验台

- docs: `arrow -duckdb "select path, folder, name, stem from docs where path like '/home/%' order by path" -rows`
- sections: `arrow -duckdb "select path, section, level, heading from sections where path like '/home/%' order by path, start_line limit 8" -rows`
- outline: `arrow -duckdb "select path, section, level, heading from outline where path = '/home/pjl.md' order by start_line" -rows`
- blocks: `arrow -duckdb "select path, node, section, type from blocks where path like '/home/%' and type = 'bullet' limit 5" -rows`
- nodes: `arrow -duckdb "select path, node from nodes where tag = '端口' limit 5" -rows`
- pj: `arrow -duckdb "select path, node, value from pj where pj = 'tag' and value = '端口' limit 5" -rows`
- content: `arrow -duckdb "select path, node, section, content from blocks where content like '%写文档%' limit 4" -rows`
- search: `arrow -duckdb "select path, node, score from search.hits('写文档') where path like '/home/%'" -rows`
- children: `arrow -duckdb "select path, parent, child from children where path = '/home/pjl.md' limit 6" -rows`
- leaf: `arrow -duckdb "select s.path, s.section, s.heading, s.node from sections s where s.path like '/home/%' and not exists (select 1 from sections c where c.path = s.path and c.parent_section = s.section)" -rows`
- mdout: `arrow -duckdb "select path, section, heading, node from sections where path = '/home/pjl.md' limit 3"`
- single: `$ /home/pjl.md:: -pj raw | arrow -duckdb "select path, node, section, type from blocks where type = 'bullet' limit 3" -rows`

## arrow

arrow 是 MDIO 的 SQL 阶段：把已选文档变成关系，交给 DuckDB 查询，默认把命中的 node 渲染回 md。

- **入口**
  - 单文档：左侧 md 作为 `input`，SQL 里直接查它的 blocks/sections
    > $ /demo.md:: -pj raw | arrow -duckdb "select path, node, section, type from blocks where type = 'bullet' limit 3"
  - 多文档：用 `docs` 关系选文档（结果必须带 path）
    > arrow -duckdb "
    >   with doc as (select path from docs where path = '/demo.md')
    >   select b.path, b.node, b.section
    >   from blocks b join doc on doc.path = b.path
    >   where b.type = 'bullet'
    >   limit 3
    > "
- **视图**
  - `docs` 文档、`sections` HS、`blocks` 语义块、`nodes` 全投影、`pj` 五面、`children` 父子、`span` 区间、`outline` 轻量章节、`section_member` 节点归属、`meta` 元信息。
  - 结果必须包含 `node`（多文档还要 `path`）；默认 md 输出选中的节点。
  - `-rows` 输出行表：看列值最直接
    > arrow -duckdb "select path, section, heading, node from sections where path = '/demo.md' limit 3" -rows
  - `-json` 输出 JSON：给程序消费
    > arrow -duckdb "select path, section, heading, node from sections where path = '/demo.md' limit 3" -json
- **常用查询**
  - 列出文档：查 `docs` 得到 path/name/folder，用来做文档清单
    > arrow -duckdb "select path, folder, name, stem from docs where path like '/dir/%' order by path" -rows
  - 章节树：查 `sections` 得到层级/标题/节点，用来还原目录结构
    > arrow -duckdb "select path, section, parent_section, level, heading, start_line, end_line, node from sections where path like '/dir/%' order by path, start_line" -rows
  - 章节骨架：查 `outline` 只取轻量章节，适合快速看目录
    > arrow -duckdb "select path, section, level, heading from outline where path = '/demo.md' order by start_line" -rows
  - 直接父子边：查 `children` 得到 parent/child/pos，用来做树操作
    > arrow -duckdb "select path, parent, child, pos from children where path like '/dir/%' order by path, parent, pos" -rows
  - 节点归属：查 `section_member` 得到每个 node 属于哪节
    > arrow -duckdb "select path, node, section from section_member where path = '/demo.md' order by node limit 6" -rows
  - 行号区间：查 `span` 得到 start_line/end_line，用来定位原文
    > arrow -duckdb "select path, node, start_line, end_line from span where path = '/demo.md' limit 3" -rows
  - 按内容找 block：在 `blocks.content` 做 like，用来全文筛内容
    > arrow -duckdb "select path, node, section, content from blocks where path like '/dir/%' and content like '%TODO%'" -rows
  - 按标题找节：在 `sections.heading` 做 like，用来按标题定位
    > arrow -duckdb "select path, section, level, heading, node from sections where path like '/dir/%' and heading like '%配置%'" -rows
  - 按 tag 找节点：查 `nodes.tag`，用来按 key 找 bullet/标题
    > arrow -duckdb "select path, node from nodes where path like '/dir/%' and tag = '端口'" -rows
  - 按 tag 的投影找节点：查 `pj` 五面长表，适合跨面统一筛
    > arrow -duckdb "select path, node, value from pj where path like '/dir/%' and pj = 'tag' and value = '端口'" -rows
  - 叶子 section：anti-join `sections`，用来找没有子节的末端章节
    > arrow -duckdb "select s.path, s.section, s.heading, s.node from sections s where s.path like '/dir/%' and not exists (select 1 from sections c where c.path = s.path and c.parent_section = s.section)" -rows
  - 统计/排名：按 section 分组计数，用来找内容最多的章节
    > arrow -duckdb "select section, any_value(node) as node, count(*) as n from blocks where path = '/demo.md' group by section order by n desc" -rows
  - 全文检索命中：查 `search.hits` 拿命中的 node/score
    > arrow -duckdb "select path, node, score from search.hits('写文档') where path like '/dir/%'" -rows
  - 全文检索结果：查 `search.results` 拿 match 细节
    > arrow -duckdb "select path, section, node, score, matched from search.results('写文档') where path like '/dir/%'" -rows
  - 全文检索 block：查 `search.blocks` 拿 type/text
    > arrow -duckdb "select path, node, type, text from search.blocks where path = '/demo.md' limit 5" -rows
  - 元信息：查 `meta` 看版本/统计等元数据
    > arrow -duckdb "select * from meta" -rows
- **边界**：FTS 只索引内容 value，不索引 tag/key；按 tag 用 `nodes` / `pj`；pipe 模式搜索的 path 是 `input`；`nodes` 一次返回多个投影面会报 `ARROW_INVALID_RESULT`。

## 高级用法

- 问题：跨文档统计 block 最多的 section
  - 讲解：`blocks` 分组，结果保留 `node`
  - 按 section 分组计数取第一
    > arrow -duckdb "select section, any_value(node) as node, count(*) as n from blocks group by section order by n desc limit 3" -rows
