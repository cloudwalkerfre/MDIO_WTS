# ANTD_DASH

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { createElement as h } from "react";
import { THEME_TOKENS, toBool, num, parseOpts, panelItems, iconOf } from "@app/ANTD_SHARED";

const dataDoc = () => (typeof window !== "undefined" && window.__teachLang === "en") ? "/ui_app/teach/antd_dashboard.en.md" : "/ui_app/teach/antd_dashboard.md";

const ICON_MAP = { "通知": "BellOutlined", "帮助": "QuestionCircleOutlined", "展开": "FullscreenOutlined", "刷新": "ReloadOutlined", "下载": "DownloadOutlined", "筛选": "FilterOutlined", "排序": "SortAscendingOutlined", "列": "TableOutlined", "查看": "EyeOutlined", "编辑": "EditOutlined", "删除": "DeleteOutlined", "搜索": "SearchOutlined",
  bell: "BellOutlined", help: "QuestionCircleOutlined", expand: "FullscreenOutlined", refresh: "ReloadOutlined", download: "DownloadOutlined", filter: "FilterOutlined", sort: "SortAscendingOutlined", columns: "TableOutlined", view: "EyeOutlined", edit: "EditOutlined", delete: "DeleteOutlined", search: "SearchOutlined" };

function Dashboard({ ANTD, ICONS, items }) {
  const A = ANTD;
  const en = typeof window !== "undefined" && window.__teachLang === "en";
  const I = (name, style) => iconOf(ICONS, ICON_MAP[name] || name, style);
  const look = (name) => items.item(name);
  const slot = (name, key, dflt) => { const v = look(name).slots[key]; return v == null || v === "" ? (dflt == null ? "" : dflt) : v; };
  const val = (name, key, dflt) => slot(name, key, dflt);
  const write = (name, key, v) => look(name).write(key, v);
  const pressed = (name) => toBool(slot(name, "pressed", "")) === true;

  const product = val("APP1", "product", "MDIO");
  const icons = parseOpts(val("APP1", "icons", "")).map((o) => o.label);
  let groups = [];
  try { groups = JSON.parse(val("NAV1", "groups", "[]")); } catch (e) { groups = []; }
  const crumb = String(val("BREAD1", "value", "")).split("/").map((s) => s.trim()).filter(Boolean);
  const tabOpts = parseOpts(val("TABS1", "options", ""));
  const tabChosen = val("TABS1", "chosen", tabOpts[0] ? tabOpts[0].value : "");
  const selOpts = parseOpts(val("SELECT1", "options", ""));
  const selChosen = val("SELECT1", "chosen", selOpts[0] ? selOpts[0].value : "");
  const btnText = val("BUTTON1", "value", en ? "Download" : "下载");
  const kpi = ["STAT1", "STAT2", "STAT3", "STAT4"].map((n) => ({ title: val(n, "title", n), value: val(n, "value", ""), delta: val(n, "delta", "") }));
  const t = look("TABLE1").slots;
  const cols = String(t.columns || "").split(",").map((s) => s.trim()).filter(Boolean);
  let rows = [];
  try { rows = JSON.parse(t.rows || "[]"); } catch (e) { rows = []; }
  const query = String(t.query || "").trim().toLowerCase();
  const shown = query ? rows.filter((r) => [r.id, r.name, r.email, r.role, r.type].some((x) => String(x || "").toLowerCase().indexOf(query) >= 0)) : rows;
  const AV = ["#6b62f2", "#3f8cff", "#12b76a", "#f79009", "#f04438", "#7a5af8", "#ee6c4d"];
  const avatarBg = (s) => { let x = 0; const str = String(s || "?"); for (let i = 0; i < str.length; i += 1) x = (x * 31 + str.charCodeAt(i)) >>> 0; return AV[x % AV.length]; };
  const data = shown.map((r, i) => ({ key: String(i), r }));
  const columns = cols.map((title, i) => ({
    title, key: "c" + i,
    render: (_, rec) => {
      const r = rec.r || {};
      if (i === 0) return h("span", { className: "dash-id" }, r.id || "");
      if (i === 1) return h("span", { className: "dash-member" },
        h("span", { className: "dash-avatar", style: { background: avatarBg(r.name) } }, String(r.name || "?").slice(0, 1)),
        h("span", { className: "dash-member-txt" }, h("span", { className: "dash-name" }, r.name || ""), h("span", { className: "dash-mail" }, r.email || "")));
      if (i === 2) return h("span", { className: "dash-cell" }, r.role || "");
      if (i === 3) return h("span", { className: "dash-cell" }, r.type || "");
      const act = (label) => () => write("TABLE1", "action", label + " · " + (r.name || ""));
      return h("span", { className: "dash-ops" },
        h("button", { type: "button", className: "dash-op", title: en ? "View" : "查看", onClick: act(en ? "View" : "查看") }, I("查看")),
        h("button", { type: "button", className: "dash-op", title: en ? "Edit" : "编辑", onClick: act(en ? "Edit" : "编辑") }, I("编辑")),
        h("button", { type: "button", className: "dash-op is-danger", title: en ? "Delete" : "删除", onClick: act(en ? "Delete" : "删除") }, I("删除")));
    },
  }));
  const setNav = (g, item) => {
    const next = groups.map((x) => (x === g ? Object.assign({}, x, { active: item }) : x));
    write("NAV1", "groups", JSON.stringify(next));
  };

  return h("div", { className: "antd2-canvas is-dash" },
    h("div", { className: "dash-shell" },
      h("div", { className: "dash-appbar", id: "sec-应用栏" },
        h("div", { className: "dash-brand" }, h("span", { className: "dash-logo" }), h("span", { className: "dash-brand-t" }, product)),
        h("div", { className: "dash-appbar-icons" }, icons.map((n, i) => h("span", { key: i, className: "dash-appicon" }, I(n))))
      ),
      h("div", { className: "dash-body" },
        h("div", { className: "dash-side", id: "sec-侧边栏" }, groups.map((g, gi) => h("div", { key: gi, className: "dash-navgroup" },
          h("div", { className: "dash-navgroup-t" }, g.title),
          (g.items || []).map((it, ii) => h("div", {
            key: ii, className: "dash-navitem" + (it === g.active ? " is-on" : ""),
            onClick: () => setNav(g, it),
          }, it))
        ))),
        h("div", { className: "dash-main" },
          h("div", { className: "dash-pagehead", id: "sec-页头" },
            h("div", { className: "dash-crumb" }, crumb.map((c, i) => h("span", { key: i, className: "dash-crumb-item" }, c, i < crumb.length - 1 ? h("span", { className: "dash-crumb-sep" }, "/") : null))),
            h("div", { className: "dash-headrow" },
              h("div", { className: "dash-tabs" }, tabOpts.map((o, i) => h("span", {
                key: i, className: "dash-tab" + (o.value === tabChosen ? " is-on" : ""),
                onClick: () => write("TABS1", "chosen", o.value),
              }, o.label))),
              h("div", { className: "dash-actions" },
                h("span", {
                  className: "dash-iconbtn" + (pressed("ICON1") ? " is-on" : ""),
                  title: val("ICON1", "value", en ? "refresh" : "刷新"),
                  onClick: () => write("ICON1", "pressed", pressed("ICON1") ? "off" : "on"),
                }, I("刷新")),
                h(A.Select, {
                  size: "small", value: selChosen, options: selOpts.map((o) => ({ value: o.value, label: o.label })),
                  style: { width: 100 }, onChange: (v) => write("SELECT1", "chosen", String(v)),
                }),
                h(A.Button, {
                  size: "small", type: "primary", icon: I("下载"),
                  onClick: () => write("BUTTON1", "pressed", pressed("BUTTON1") ? "off" : "on"),
                }, btnText + (pressed("BUTTON1") ? " ✓" : ""))
              )
            )
          ),
          h("div", { className: "dash-stats", id: "sec-指标卡" }, kpi.map((k, i) => h("div", { key: i, className: "dash-stat" },
            h("div", { className: "dash-stat-t" }, k.title),
            h("div", { className: "dash-stat-row" }, h("span", { className: "dash-stat-v" }, k.value),
              k.delta ? h("span", { className: "dash-delta " + (String(k.delta).indexOf("-") === 0 ? "down" : "up") }, k.delta) : null)))),
          h("div", { className: "dash-tablecard", id: "sec-员工表" },
            h("div", { className: "dash-tablehead" },
              h("div", { className: "dash-tabletitle" }, t.title || (en ? "All employees" : "全部员工"), " ", h("span", { className: "dash-count" }, t.count || "")),
              h(A.Input, {
                size: "small", prefix: I("搜索"), placeholder: t.search || (en ? "Search…" : "搜索…"),
                value: t.query || "", style: { width: 200 },
                onChange: (e) => write("TABLE1", "query", e.target.value),
              })
            ),
            h("div", { className: "dash-tools" }, ["TOOL1", "TOOL2", "TOOL3"].map((n) => h(A.Button, {
              key: n, size: "small", icon: I(val(n, "text", "")),
              type: pressed(n) ? "primary" : "default",
              onClick: () => write(n, "pressed", pressed(n) ? "off" : "on"),
            }, val(n, "text", n)))),
            t.action ? h("div", { className: "dash-action" }, (en ? "Recent: " : "最近操作：") + t.action) : null,
            h(A.Table, { size: "middle", columns: columns, dataSource: data, pagination: false, className: "dash-table" })
          )
        )
      )
    )
  );
}

/** 数据看板章的认领件：md 数据驱动看板 + 其下可折叠的 [render md]/[data md] Monaco。 */
export default observer(function AntdDash({ node }) {
  const env = getEnv(node);
  const read = env.read;
  const main = env && typeof env.getMainRoot === "function" ? env.getMainRoot() : null;
  const mods = main && main.decl ? main.decl.mods : null;
  const ANTD = mods && mods.get("ANTD") ? mods.get("ANTD").ns : null;
  const ICONS = mods && mods.get("ANTD_ICONS") ? mods.get("ANTD_ICONS").ns : null;
  if (!ANTD) return h("div", { className: "antd-pending" }, (typeof window !== "undefined" && window.__teachLang === "en") ? "loading antd remote bundle…" : "antd 远程件装载中…");
  const items = panelItems(read, env, node, dataDoc());
  const theme = Object.assign({}, THEME_TOKENS, { algorithm: ANTD.theme.darkAlgorithm });
  return h(ANTD.ConfigProvider, { theme: theme, getPopupContainer: (n) => (n && n.parentElement) || document.body },
    h("div", { className: "antd2-chapter" },
      h(Dashboard, { ANTD: ANTD, ICONS: ICONS, items: items })
    )
  );
});
```
