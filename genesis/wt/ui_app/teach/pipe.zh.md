# PIPE

## 管道

- 概念：管道 `|` 是 **str in → str out**，左边输出作为右边输入。
- 基本 std
  - `fmt` 套格式：把左侧结果填进 `{}`
    > ls -l /demo.md | fmt "- {}"
  - `calc` 计算：`_` 代表管道数据
    > "50" | calc -e "_ + 1"
  - `ls` / `mk` / `rm`：列目录 / 建文件 / 删文件
    > ls -l /demo.md | fmt "- {}"
- 字符串 ↔ 列表
  - `split` 按分隔符拆成列表，`join` 用分隔符合回文本
    > "a,b,c" | split "," | join "-"
- JSON ↔ 值
  - `loads` 解析 JSON，`dumps` 序列化回 JSON
    > "[1,2,3]" | loads | dumps
  - `get` 取值，`len` 取长度
    > "[1,2,3]" | loads | get 1
    > "[1,2,3]" | loads | len
- `trim`
  - 去首尾空白
    > "  hello  " | trim
- 字面量 / 占位符
  - 双引号单行字符串
    > "x" | fmt "prefix: {}"
  - 单引号单行字符串
    > 'single' | fmt "- {}"
  - 三引号多行字符串
    > """multi\nline""" | fmt "- {}"
  - `r"""..."""` 原始多行字符串
    > r"""raw\n""" | fmt "- {}"
  - 数字直接作为管道输入
    > 42 | fmt "- {}"
  - `_`：在 `calc` 等 std 函数里引用管道数据
    > "50" | calc -e "_ + 1"
- tojson
  - 输入 md 文本，等价于「parse md → 输出 JSON」；输出是 AST JSON envelope，形如 `{"nt":"root","mode":"hs","timestamp":…,"ct":[…]}`
    > """# S\n- k: v""" | tojson
  - 输入选择器结果，输出该子树的 AST JSON
    > $ /demo.md::项目.配置 | tojson
- 串联
  - `;` 分隔独立单元；任一单元失败即停止后续，只回显最后一个单元
    > $ /demo.md::项目.配置:端口 ; $ /demo.md::项目.任务:待办
- 复制整篇
  - 先建文件，再把整篇写过去
    > mk -f /tmp/demo_copy.md ; $ /demo.md:: | /> /tmp/demo_copy.md:: -pj r
  - 用完删除
    > rm -f /tmp/demo_copy.md
- 长 exec：备份 → 修改 → 验证
  - 备份一个值
    > $ /note.md::读库.概念:status | +> /backup/status.md::
  - 写入新值
    > "refactor" | /> /note.md::读库.概念:status
  - 读回验证
    > $ /note.md::读库.概念:status
- 写后一发验证
  - 写值后立刻读回
    > "beta" | /> /d.md::读库.概念:status ; $ /d.md::读库.概念:status
- 动态路径 `$()`
  - 本质：先执行内部管道，结果作为外层操作的 locator/值；当前实现 `$($inner)` 返回 inner 结果，不是读文件
    > $($/demo.md::路由:target)
  - 场景 A：配置里存写目标，动态追加
    > "A" | +> ($/demo.md::路由:target)
  - 场景 B：配置里存 base，用 fmt 拼完整 locator 后覆盖
    > "B" | /> ($/demo.md::路由:base | fmt "{}::项目.配置:端口")
- 布尔：只能用于参数/过滤条件（如 `-f false`），不能单独当管道输入（会报 I404）。

## 实验台

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

## 高级用法

- 问题：在多级节里找配置，不想手写完整路径
  - 讲解：`..NAME` 递归钻取，再按类型/过滤收窄
  - 递归钻取配置节
    > $ /demo.md::..配置 -pj raw
  - 再按标题类型收窄
    > $ /demo.md::..*[h2] -pj tag
  - 再按内容过滤
    > $ /demo.md::..*_b[b.ct.has("测试")] -pj raw
- 问题：把一组读出的标签加工后写回
  - 讲解：管道 `fmt` 改文本，`/>` 写回；`;` 串多个单元
  - 加工后写回并读回
    > mk -f /tmp/labels.md ; $ /demo.md::项目.配置.* -pj tag | fmt "- {}" | /> /tmp/labels.md:: -pj r ; $ /tmp/labels.md::
