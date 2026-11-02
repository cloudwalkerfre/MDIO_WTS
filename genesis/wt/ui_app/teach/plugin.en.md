# PLUGIN

## @LLM

`@LLM` is a stateful agent plugin. Each agent stores its model, system prompt, HIS, tool, and worldline configuration.

### Lifecycle

- List agents
  > @LLM
- Show a single agent
  > @LLM.agent
- Initialize
  > @LLM.agent.init -m "DEEPSEEK" -sysp "你是专家" -tool true -his "HIS"
- Default run
  > "分析这个错误" | @LLM.agent
- Streaming run
  > "分析这个错误" | @LLM.agent.stream
- Close
  > @LLM.agent.close

### Configuration updates

With no input, an existing agent updates its configuration directly:

> @LLM.agent -sysp "新的系统提示词" -retry 2 -timeout 120

Common fields:

- `-m`: model alias
- `-sysp`: system prompt
- `-tool`: whether to enable tool calls, true by default
- `-his`: HIS path
- `-retry`: retry count
- `-wl`: worldline
- `-provider` / `-backend` / `-timeout` / `-proxy`: backend configuration

### Provider

These commands take no agent chain:

- List providers
  > @LLM -provider
- Preflight an alias
  > @LLM -check "DEEPSEEK"
- Check the balance
  > @LLM -provider deepseek -balance
- List models
  > @LLM -provider deepseek -models

### worldline and branch

- `-wl`: the worldline this run/stream is recorded to
  > "继续" | @LLM.agent -wl "wl1"
- Create a branch from a record
  > @LLM.agent -wl "wl1" -branch 0 -branch_target "/demo.md::项目.配置"

### Callbacks and tools

- `-cb`: run one callback after a round ends normally
  > "总结" | @LLM.agent -cb '"done" | +> /tmp/llm.log.md::'
- `-tool true`: give the agent the `execute_mdio` tool

### State

- Agent configuration: `/.mds/llm.md`
- Provider / alias configuration: `/.mds/llm_config.md`
- HIS: given by `-his`

### Boundaries

- There is no stateless single-run mode for now; every conversation is bound to an agent, so `.init` is required first
- Repeating `.init` reports an error; do not add `.init` when changing configuration
- The same agent can only have one run/stream in flight at a time

## LLM demo

## @BASH

`@BASH` is a host Shell execution plugin; it does not go through the MDIO VFS sandbox. It supports one-shot execution and named sessions; the default execution mode is stream.

### Inspect state

With no input and no command, it only inspects state:

> @BASH

It lists the configuration, active tasks, and recent executions.

### One-shot execution

The command comes from the pipeline:

> """printf hello""" | @BASH

Write stream explicitly:

> """printf hello""" | @BASH.stream

### `-cmd` + stdin

Use `-cmd` for the command; pipeline data is passed as stdin:

> $ /job.md::BODY | @BASH -cmd """python3 -c "import sys; print(sys.stdin.read().upper())" """ -stdin _

Boundaries:

- `-stdin` can only be used together with `-cmd`
- `-cmd` and a piped command cannot be given together unless `-stdin _`
- `-sess` does not support `-stdin`

### Named sessions

Run in a named context:

> """pwd""" | @BASH -sess dev
> """pwd""" | @BASH.stream -sess dev

Manage sessions:

> @BASH.sess
> @BASH.sess -create dev -cwd "/tmp" -timeout "15"
> @BASH.sess -inspect dev
> @BASH.sess -restart dev
> @BASH.sess -close dev
> @BASH.sess -kill dev

### spawn / inspect / kill

Run asynchronously:

> @BASH.spawn -cmd "sleep 20"

Inspect the handle:

> @BASH.inspect -id <id>
> @BASH.inspect -last

Terminate:

> @BASH.kill -id <id>

Only spawn supports `-cb`:

> @BASH.spawn -cmd "printf callback" -cb "+> /spawn_cb.md::"

### Parameters

- `-cwd`: host working directory
- `-shell`: Shell name
- `-timeout`: timeout in seconds
- `-env`: JSON object or `KEY=VAL`
- `-nah`: safety guard, true by default
- `-cmd`: explicit command
- `-stdin _`: one-shot stdin
- `-sess`: named session
- `-cb`: spawn only

### tools

> @BASH.tools
> @BASH.tools.echo -op run -args '{"text":"tool-hi"}'
> @BASH.tools.edit -op view -args '{"path":"/tmp/x"}'

The built-in `edit` tool currently provides these ops:

`view / create / str_replace / edit / insert / write`

### State locations

- Configuration: `/.mds/bash.md`
- Active tasks: `/.mds/proc.md`
- Execution records: `/var/bash.md`

### Legacy syntax

These have been removed; do not use them again:

- `@BASH.run`
- `@BASH.dev`
- `@BASH.inspect -pid`
- `@BASH.kill -pid`

Use these instead:

- `@BASH` / `@BASH.stream`
- `@BASH -sess`
- `@BASH.sess`
- `@BASH.inspect -id`
- `@BASH.kill -id`

## Lab

- note: plugin commands run on the gateway host side (not a bfork md sandbox); all examples are read-only/idempotent — Reset closes sessions and clears the exec log.
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
