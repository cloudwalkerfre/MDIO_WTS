# UI_THEORY

## Idea

### In one line

```text
MST(mobx state tree) = document tree
patch = mutation
computed = derivation
observer = projection
```

Mental model:

- There is no boundary between MD and JSON: an MDIO document is MD in the VFS and MST nodes in the UI process — two projections of the same thing
- The JSON MDIO emits is isomorphic to the selector topology, including patch JSON and the mods/match declared in ui.md
- MDIO can be seen as a generalized mobx

### Runtime path

```text
md edit(exec/crdt) -> patch JSON -> mdio_ui applyPatch(md, json)
     -> MST document nodes update -> computed invalidated -> observer recomputes -> render
```

- When a P frame arrives, `applyPatch(md, json)` mutates the tree directly (ui_core client);
- computed tracks dependencies; observers re-render on change.

### ui.md

ui.md is an app's declaration file: `## mods` registers MD code blocks under a path as JS modules, `## match` says which node is claimed by which module, `## app` names the page root.

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
mods    = which MD under which paths count as JS modules
match   = which node is claimed by which mod
appview = which mod is the page root
```

What the md under a path is mapped to — code/store/data/... — is not something mdio_ui cares about; mdio_ui only cares about the "path → module/claim" mapping itself.
