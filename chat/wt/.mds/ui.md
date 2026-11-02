# UI

## mods
- std: ui_std/std
- REACT_FLOW: http:https://esm.sh/@xyflow/react@12.8.2?bundle&external=react,react-dom
- CORE: .md::/app/core.md::..*_c[c.t=="jsx@core"]
- SESSION: .md::/app/session.md::..*_c[c.t=="jsx@session"]
- HIS: .md::/app/his.md::..*_c[c.t=="jsx@his"]
- SETTINGS: .md::/app/settings.md::..*_c[c.t=="jsx@settings"]
- COMPOSER: .md::/app/composer.md::..*_c[c.t=="jsx@composer"]
- APP: .md::/app/app.md::..*_c[c.t=="jsx@app"]

## match
- HIS: ::HIS

## app
- appview: APP

## APP
### visibility
- exclude: ::state
