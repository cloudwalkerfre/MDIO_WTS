# PLUGIN

## @LLM

`@LLM` 是有状态 agent 插件。每个 agent 保存模型、system prompt、HIS、tool 和 worldline 配置。

### 生命周期

- 列出 agents
  > @LLM
- 查看单个 agent
  > @LLM.agent
- 初始化
  > @LLM.agent.init -m "DEEPSEEK" -sysp "你是专家" -tool true -his "HIS"
- 默认运行
  > "分析这个错误" | @LLM.agent
- 流式运行
  > "分析这个错误" | @LLM.agent.stream
- 关闭
  > @LLM.agent.close

### 配置更新

已有 agent 不带输入，直接改配置：

> @LLM.agent -sysp "新的系统提示词" -retry 2 -timeout 120

常用字段：

- `-m`：模型别名
- `-sysp`：system prompt
- `-tool`：是否启用工具调用，默认 true
- `-his`：HIS 路径
- `-retry`：重试次数
- `-wl`：worldline
- `-provider` / `-backend` / `-timeout` / `-proxy`：后端配置

### Provider

这些命令不带 agent chain：

- 查看 providers
  > @LLM -provider
- 预检某个 alias
  > @LLM -check "DEEPSEEK"
- 查看余额
  > @LLM -provider deepseek -balance
- 查看模型列表
  > @LLM -provider deepseek -models

### worldline 与 branch

- `-wl`：指定本次 run/stream 落到的 worldline
  > "继续" | @LLM.agent -wl "wl1"
- 从记录创建 branch
  > @LLM.agent -wl "wl1" -branch 0 -branch_target "/demo.md::项目.配置"

### 回调与工具

- `-cb`：一轮正常结束后执行一次回调
  > "总结" | @LLM.agent -cb '"done" | +> /tmp/llm.log.md::'
- `-tool true`：给 agent 提供 `execute_mdio` 工具

### 状态

- agent 配置：`/.mds/llm.md`
- provider / alias 配置：`/.mds/llm_config.md`
- HIS：由 `-his` 指定

### 边界

- 当前没有无状态单跑模式；所有对话都绑定到 agent，必须先 `.init`
- `.init` 重复会报错；改配置不要加 `.init`
- 同一 agent 同时只能有一个 run/stream 在跑

## LLM 试跑

## @BASH

`@BASH` 是宿主 Shell 执行插件，不走 MDIO VFS 沙箱。它支持一次性执行和命名 session；默认执行方式是 stream。

### 看状态

不带输入、不带命令时只看状态：

> @BASH

会列出配置、活跃任务和最近执行。

### 一次性执行

命令从管道来：

> """printf hello""" | @BASH

显式写 stream：

> """printf hello""" | @BASH.stream

### `-cmd` + stdin

命令用 `-cmd`，管道数据作为 stdin：

> $ /job.md::BODY | @BASH -cmd """python3 -c "import sys; print(sys.stdin.read().upper())" """ -stdin _

边界：

- `-stdin` 只能和 `-cmd` 一起用
- `-cmd` 和管道命令不能同时给，除非 `-stdin _`
- `-sess` 不支持 `-stdin`

### 命名 session

在命名 context 里执行：

> """pwd""" | @BASH -sess dev
> """pwd""" | @BASH.stream -sess dev

管理 session：

> @BASH.sess
> @BASH.sess -create dev -cwd "/tmp" -timeout "15"
> @BASH.sess -inspect dev
> @BASH.sess -restart dev
> @BASH.sess -close dev
> @BASH.sess -kill dev

### spawn / inspect / kill

异步执行：

> @BASH.spawn -cmd "sleep 20"

查看 handle：

> @BASH.inspect -id <id>
> @BASH.inspect -last

终止：

> @BASH.kill -id <id>

spawn 才支持 `-cb`：

> @BASH.spawn -cmd "printf callback" -cb "+> /spawn_cb.md::"

### 参数

- `-cwd`：宿主工作目录
- `-shell`：Shell 名称
- `-timeout`：超时秒数
- `-env`：JSON 对象或 `KEY=VAL`
- `-nah`：安全守卫，默认 true
- `-cmd`：显式命令
- `-stdin _`：one-shot stdin
- `-sess`：命名 session
- `-cb`：仅 spawn

### tools

> @BASH.tools
> @BASH.tools.echo -op run -args '{"text":"tool-hi"}'
> @BASH.tools.edit -op view -args '{"path":"/tmp/x"}'

当前内置 `edit` tool，ops：

`view / create / str_replace / edit / insert / write`

### 状态位置

- 配置：`/.mds/bash.md`
- 活跃任务：`/.mds/proc.md`
- 执行记录：`/var/bash.md`

### 旧语法

这些已经删除，不要再写：

- `@BASH.run`
- `@BASH.dev`
- `@BASH.inspect -pid`
- `@BASH.kill -pid`

当前统一用：

- `@BASH` / `@BASH.stream`
- `@BASH -sess`
- `@BASH.sess`
- `@BASH.inspect -id`
- `@BASH.kill -id`

## 实验台

- note: 插件命令在网关宿主侧执行（不是 bfork md 沙箱）；这些示例都是只读/幂等命令，「重置」会关闭 session 并清执行记录。
- agents: `@LLM`
- providers: `@LLM -provider`
- status: `@BASH`
- tools: `@BASH.tools`
- oneshot: `"""printf hello""" | @BASH`
- stream: `"""printf hello""" | @BASH.stream`
- pwd: `"""pwd""" | @BASH`
- sessions: `@BASH.sess`
- session-run: `"""pwd""" | @BASH -sess dev`
- resethost: `@BASH.sess -close dev`
- resethost: `rm -f /var/bash.md`
