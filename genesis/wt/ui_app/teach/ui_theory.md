# UI_THEORY

## 理念

### 一句话

```text
MST(mobx state tree) = 文档树
patch = 变更
computed = 派生
observer = 投影
```

心智模型:

- MD 和 JSON 没有边界, MDIO 的文档在 VFS 里是 MD，在 UI 进程里是 MST 节点, 可以看作同一种东西的两种投影
- MDIO 输出的 JSON 和 selector 拓扑同构, 也包括 patch json 和 ui.md 里的 mods/match
- 可以把 MDIO 视为一种广义的 mobx

### 运行时链路

```text
md edit(exec/crdt) -> patch JSON -> mdio_ui applyPatch(md, json)
     -> MST 文档节点更新 -> computed 失效 -> observer 重算 -> render
```

- P 帧到达后由 `applyPatch(md, json)` 直接改树（ui_core client）；
- computed 追踪依赖，observer 变化重渲染。

### ui.md

ui.md 是 app 的声明文件：`## mods` 把路径下的 MD 代码块登记成 JS 模块，`## match` 指定哪个节点归哪个模块认领，`## app` 指定整页根。

````md
# UI

## mods
- GENESIS_APP: .md::/ui_app/fe.md::FE.app._c
- UI_SWAP_A: .md::/ui_app/teach/ui/demos/swap_a.md::SWAP_A.实现._c
- UI_FIELD: .md::/ui_app/teach/ui/demos/field.md::UI_FIELD.实现._c

## match
- UI_SWAP_A: /ui_app/teach/ui_demos.md::UI_DEMOS.演示.swap
- UI_FIELD: /ui_app/teach/ui_demos.md::UI_DEMOS.演示.field

## app
- appview: GENESIS_APP
````

```text
mods    = 什么路径下的 MD 认作 JS 模块
match   = 什么路径下 MD 被哪个 mod 认领
appview = 整页根用哪个 mod
```

路径下的 md 拿来映射成什么, 代码/store/数据..., mdio_ui 不关心, mdio_ui 只关心「路径 → 模块/认领」的映射本身。
