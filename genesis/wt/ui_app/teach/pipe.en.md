# PIPE

## Pipeline

- Concept: pipe `|` is **str in → str out** — the left output becomes the right input.
- Basic std
  - `fmt` applies a format: fills the left result into `{}`
    > ls -l /demo.md | fmt "- {}"
  - `calc` computes: `_` stands for the piped data
    > "50" | calc -e "_ + 1"
  - `ls` / `mk` / `rm`: list directory / create file / delete file
    > ls -l /demo.md | fmt "- {}"
- String ↔ list
  - `split` splits into a list by a delimiter, `join` joins back into text with a delimiter
    > "a,b,c" | split "," | join "-"
- JSON ↔ value
  - `loads` parses JSON, `dumps` serializes back to JSON
    > "[1,2,3]" | loads | dumps
  - `get` takes a value, `len` takes the length
    > "[1,2,3]" | loads | get 1
    > "[1,2,3]" | loads | len
- `trim`
  - Trims leading and trailing whitespace
    > "  hello  " | trim
- Literals / placeholders
  - Double-quoted single-line string
    > "x" | fmt "prefix: {}"
  - Single-quoted single-line string
    > 'single' | fmt "- {}"
  - Triple-quoted multi-line string
    > """multi\nline""" | fmt "- {}"
  - `r"""..."""` raw multi-line string
    > r"""raw\n""" | fmt "- {}"
  - A number can be pipe input directly
    > 42 | fmt "- {}"
  - `_`: refers to the piped data inside `calc` and other std functions
    > "50" | calc -e "_ + 1"
- tojson
  - Given md text, equivalent to "parse md → output JSON"; the output is an AST JSON envelope shaped like `{"nt":"root","mode":"hs","timestamp":…,"ct":[…]}`
    > """# S\n- k: v""" | tojson
  - Given a selector result, outputs the AST JSON of that subtree
    > $ /demo.md::项目.配置 | tojson
- Chaining
  - `;` separates independent units; if any unit fails, the rest stop, and only the last unit is echoed
    > $ /demo.md::项目.配置:端口 ; $ /demo.md::项目.任务:待办
- Copying a whole document
  - Create the file first, then write the whole document into it
    > mk -f /tmp/demo_copy.md ; $ /demo.md:: | /> /tmp/demo_copy.md:: -pj r
  - Delete it when done
    > rm -f /tmp/demo_copy.md
- Long exec: back up → modify → verify
  - Back up one value
    > $ /note.md::读库.概念:status | +> /backup/status.md::
  - Write a new value
    > "refactor" | /> /note.md::读库.概念:status
  - Read it back to verify
    > $ /note.md::读库.概念:status
- Post-write single-shot verification
  - Read back immediately after writing the value
    > "beta" | /> /d.md::读库.概念:status ; $ /d.md::读库.概念:status
- Dynamic path `$()`
  - Essence: the inner pipeline runs first, and its result becomes the locator/value of the outer operation; in the current implementation `$($inner)` returns the inner result, not a file read
    > $($/demo.md::路由:target)
  - Scenario A: the write target is stored in the config, appended dynamically
    > "A" | +> ($/demo.md::路由:target)
  - Scenario B: the config stores a base; build the full locator with fmt, then overwrite
    > "B" | /> ($/demo.md::路由:base | fmt "{}::项目.配置:端口")
- Boolean: only usable as a parameter/filter condition (e.g. `-f false`), not as standalone pipe input (it reports I404).

## Lab

- fmt: `ls -l /home/pipe.md | fmt "- {}"`
- calc: `"50" | calc -e "_ + 1"`
- split: `"a,b,c" | split "," | join "-"`
- loads: `"[1,2,3]" | loads | dumps`
- get: `"[1,2,3]" | loads | get 1`
- trim: `"  hello  " | trim`
- num: `42 | fmt "- {}"`
- tojson: `$ /home/pipe.md::数据.配置 | tojson`
- chain: `mk -f /tmp/pipe_chain.md ; "chain-ok" | +> /tmp/pipe_chain.md:: ; $ /tmp/pipe_chain.md`
- dynread: `$($/home/pipe.md::数据.路由:target)`
- mk: `mk -f /tmp/pipe_demo.md`
- seed: `"""# 数据\n\n## 配置\n\n- 名称: none""" | /> /tmp/pipe_demo.md:: -pj r`
- append: `"A" | +> ($/home/pipe.md::数据.路由:target)`
- read1: `$ /tmp/pipe_demo.md::数据.配置:名称`
- overwrite: `"B" | /> ($/home/pipe.md::数据.路由:base | fmt "{}::数据.配置:名称")`
- read2: `$ /tmp/pipe_demo.md::数据.配置:名称`
- copy: `mk -f /tmp/pipe_copy.md ; $ /home/pipe.md:: | /> /tmp/pipe_copy.md:: -pj r`

## Advanced usage

- Problem: find config across multi-level sections without writing the full path by hand
  - Explanation: `..NAME` drills down recursively, then narrow by type/filter
  - Drill down recursively to the config section
    > $ /demo.md::..配置 -pj raw
  - Then narrow by heading type
    > $ /demo.md::..*[h2] -pj tag
  - Then filter by content
    > $ /demo.md::..*_b[b.ct.has("测试")] -pj raw
- Problem: process a set of read tags and write them back
  - Explanation: the pipe `fmt` changes text, `/>` writes back; `;` chains multiple units
  - Write back after processing and read it back
    > mk -f /tmp/labels.md ; $ /demo.md::项目.配置.* -pj tag | fmt "- {}" | /> /tmp/labels.md:: -pj r ; $ /tmp/labels.md::
