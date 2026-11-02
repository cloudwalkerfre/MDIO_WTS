# HOOK

## hook 是什么

hook 监听目标路径映射的内容变化：目标路径映射到的内容发生变化后，异步执行 `-cb` 指定的 MDIO 代码。

- 绑定的是路径，不是节点对象；节点重建或替换后，只要路径映射仍然命中，仍按路径规则判断
- 一次性 hook：触发一次后自动删除
- `-is_always`：持久 hook，注册到当前 worktree 的 `/.mds/hook.md`
- 回调在注册它的 worktree 里执行，不会跑到 genesis
- hook 注册本身会透传管道数据；注册后继续流

hook 不是同步写后立即执行；写操作返回只代表写入完成，不代表回调已经跑完。

## 注册

- `hook -target "<目标>" -cb "<代码>"`
  - `-target`：`[文件::]目标路径（可带选择器）`；不写文件时相对当前 active doc
  - `-cb`：触发后执行的 MDIO 管道
- 持久化
  - 加 `-is_always`：重启后仍然存在
  - 不加：只触发一次

示例：

> mk -f /tmp/hook_log.md
> hook -target /demo.md::项目.配置:端口 -cb '"端口变了" | +> /tmp/hook_log.md::' -is_always

之后修改目标内容：

> "9090" | /> /demo.md::项目.配置:端口

回调会异步追加到 `/tmp/hook_log.md`；需要读结果时稍后再读。

## 管理

- 删除单条 hook
  > hook -del <id>
- 清除某个文档的全部 hook
  > hook -deldoc /demo.md

`-deldoc` 会同时清理运行时 hook 和持久条目；只清运行时的话，重启会重新加载。

## 触发范围

- 目标路径是叶子：该路径内容变化精确触发
- 目标路径是 container / heading：路径覆盖范围内的内容变化触发
- 目标路径被替换或删除：路径命中关系变化也触发
- 节点重建或替换不影响判定；hook 看的是路径映射，不是对象引用

## 边界

- 临时(mem)文档不支持 hook
- `-target` 和 `-cb` 必须同时提供
- 回调报错不会阻止其他 hook 执行
- 回调是异步任务；不要写完立刻假设日志已经出现

## 示例：一次性 hook

> mk -f /tmp/hook_log.md
> hook -target /demo.md::项目.配置:环境 -cb '"环境变了" | +> /tmp/hook_log.md::'
> "prod" | /> /demo.md::项目.配置:环境

第一次触发后，这个 hook 自动删除。

## 示例：持久 hook + 清理

> hook -target /demo.md::项目.配置:端口 -cb '"/demo.md::项目.配置:端口" | +> /tmp/hook_log.md::' -is_always
> "7070" | /> /demo.md::项目.配置:端口
> hook -deldoc /demo.md

## 实验台
