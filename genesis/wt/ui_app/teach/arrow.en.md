# ARROW

## Demo

（hs-arrow: the query-arrow animation, embedded.）

## Lab

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

arrow is the SQL stage of MDIO: it turns selected documents into relations, hands them to DuckDB for querying, and by default renders the hit nodes back to md.

- **Entry points**
  - Single document: the left-hand md serves as `input`, and SQL queries its blocks/sections directly
    > $ /demo.md:: -pj raw | arrow -duckdb "select path, node, section, type from blocks where type = 'bullet' limit 3"
  - Multiple documents: use the `docs` relation to select documents (the result must include path)
    > arrow -duckdb "
    >   with doc as (select path from docs where path = '/demo.md')
    >   select b.path, b.node, b.section
    >   from blocks b join doc on doc.path = b.path
    >   where b.type = 'bullet'
    >   limit 3
    > "
- **Views**
  - `docs` documents, `sections` HS, `blocks` semantic blocks, `nodes` full projection, `pj` five facets, `children` parent/child, `span` ranges, `outline` lightweight sections, `section_member` node membership, `meta` metadata.
  - The result must include `node` (and `path` for multiple documents); by default md output renders the selected nodes.
  - `-rows` outputs a row table: the most direct way to see column values
    > arrow -duckdb "select path, section, heading, node from sections where path = '/demo.md' limit 3" -rows
  - `-json` outputs JSON: for programs to consume
    > arrow -duckdb "select path, section, heading, node from sections where path = '/demo.md' limit 3" -json
- **Common queries**
  - List documents: query `docs` for path/name/folder, used to build a document inventory
    > arrow -duckdb "select path, folder, name, stem from docs where path like '/dir/%' order by path" -rows
  - Section tree: query `sections` for hierarchy/heading/node, used to reconstruct the table of contents
    > arrow -duckdb "select path, section, parent_section, level, heading, start_line, end_line, node from sections where path like '/dir/%' order by path, start_line" -rows
  - Section skeleton: query `outline` for lightweight sections only, good for a quick look at the table of contents
    > arrow -duckdb "select path, section, level, heading from outline where path = '/demo.md' order by start_line" -rows
  - Direct parent-child edges: query `children` for parent/child/pos, used for tree operations
    > arrow -duckdb "select path, parent, child, pos from children where path like '/dir/%' order by path, parent, pos" -rows
  - Node membership: query `section_member` to see which section each node belongs to
    > arrow -duckdb "select path, node, section from section_member where path = '/demo.md' order by node limit 6" -rows
  - Line ranges: query `span` for start_line/end_line, used to locate the source text
    > arrow -duckdb "select path, node, start_line, end_line from span where path = '/demo.md' limit 3" -rows
  - Find blocks by content: do like on `blocks.content`, used for full-text content filtering
    > arrow -duckdb "select path, node, section, content from blocks where path like '/dir/%' and content like '%TODO%'" -rows
  - Find sections by heading: do like on `sections.heading`, used to locate by heading
    > arrow -duckdb "select path, section, level, heading, node from sections where path like '/dir/%' and heading like '%配置%'" -rows
  - Find nodes by tag: query `nodes.tag`, used to find bullets/headings by key
    > arrow -duckdb "select path, node from nodes where path like '/dir/%' and tag = '端口'" -rows
  - Find nodes by tag projection: query the long `pj` five-facet table, good for unified cross-facet filtering
    > arrow -duckdb "select path, node, value from pj where path like '/dir/%' and pj = 'tag' and value = '端口'" -rows
  - Leaf section: anti-join `sections`, used to find terminal sections without subsections
    > arrow -duckdb "select s.path, s.section, s.heading, s.node from sections s where s.path like '/dir/%' and not exists (select 1 from sections c where c.path = s.path and c.parent_section = s.section)" -rows
  - Stats/ranking: count grouped by section, used to find the sections with the most content
    > arrow -duckdb "select section, any_value(node) as node, count(*) as n from blocks where path = '/demo.md' group by section order by n desc" -rows
  - Full-text hits: query `search.hits` for the hit node/score
    > arrow -duckdb "select path, node, score from search.hits('写文档') where path like '/dir/%'" -rows
  - Full-text results: query `search.results` for match details
    > arrow -duckdb "select path, section, node, score, matched from search.results('写文档') where path like '/dir/%'" -rows
  - Full-text blocks: query `search.blocks` for type/text
    > arrow -duckdb "select path, node, type, text from search.blocks where path = '/demo.md' limit 5" -rows
  - Metadata: query `meta` for version/stats and other metadata
    > arrow -duckdb "select * from meta" -rows
- **Boundaries**: FTS only indexes content value, not tag/key; for tag use `nodes` / `pj`; in pipe mode the search path is `input`; when `nodes` returns multiple projection facets at once it reports `ARROW_INVALID_RESULT`.

## Advanced usage

- Problem: count the section with the most blocks across documents
  - Explanation: group `blocks`, keep `node` in the result
  - Group by section, count, take the first
    > arrow -duckdb "select section, any_value(node) as node, count(*) as n from blocks group by section order by n desc limit 3" -rows
