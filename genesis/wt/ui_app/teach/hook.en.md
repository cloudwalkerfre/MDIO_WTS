# HOOK

## What is a hook

A hook watches content changes of the target path mapping: after the content mapped to the target path changes, it asynchronously executes the MDIO code specified by `-cb`.

- It binds to the path, not to a node object; after a node is rebuilt or replaced, judgment still follows path rules as long as the path mapping still matches
- One-shot hook: deleted automatically after firing once
- `-is_always`: persistent hook, registered into the current worktree's `/.mds/hook.md`
- The callback runs in the worktree that registered it and does not run in genesis
- Hook registration itself passes through pipeline data; the stream continues after registration

A hook does not execute synchronously right after a write; a write returning only means the write completed, not that the callback has already run.

## Registration

- `hook -target "<目标>" -cb "<代码>"`
  - `-target`: `[文件::]目标路径（可带选择器）`; when no file is given, relative to the current active doc
  - `-cb`: the MDIO pipeline executed after firing
- Persistence
  - With `-is_always`: still present after restart
  - Without it: fires only once

Example:

> mk -f /tmp/hook_log.md
> hook -target /demo.md::项目.配置:端口 -cb '"端口变了" | +> /tmp/hook_log.md::' -is_always

Then modify the target content:

> "9090" | /> /demo.md::项目.配置:端口

The callback is appended to `/tmp/hook_log.md` asynchronously; read the result later when needed.

## Management

- Delete a single hook
  > hook -del <id>
- Clear all hooks of a document
  > hook -deldoc /demo.md

`-deldoc` clears both runtime hooks and persistent entries; clearing only runtime ones means they are reloaded on restart.

## Trigger scope

- Target path is a leaf: content changes at that path trigger precisely
- Target path is a container / heading: content changes within the covered range trigger
- Target path is replaced or deleted: changes in path matching also trigger
- Node rebuild or replacement does not affect judgment; hooks look at path mappings, not object references

## Boundaries

- Temporary (mem) documents do not support hooks
- `-target` and `-cb` must be provided together
- Callback errors do not prevent other hooks from executing
- Callbacks are asynchronous tasks; do not assume the log already contains the entry right after writing

## Example: one-shot hook

> mk -f /tmp/hook_log.md
> hook -target /demo.md::项目.配置:环境 -cb '"环境变了" | +> /tmp/hook_log.md::'
> "prod" | /> /demo.md::项目.配置:环境

After the first trigger, this hook is deleted automatically.

## Example: persistent hook + cleanup

> hook -target /demo.md::项目.配置:端口 -cb '"/demo.md::项目.配置:端口" | +> /tmp/hook_log.md::' -is_always
> "7070" | /> /demo.md::项目.配置:端口
> hook -deldoc /demo.md

## Lab
