# ANTD_COLLAGE

## 实现

```jsx@node
import { observer } from "mobx-react-lite";
import { getEnv } from "mobx-state-tree";
import { createElement as h } from "react";
import dayjs from "https://esm.sh/dayjs@1.11.13";
import { THEME_TOKENS, toBool, num, parseOpts, panelItems, iconOf } from "@app/ANTD_SHARED";

const dataDoc = () => (typeof window !== "undefined" && window.__teachLang === "en") ? "/ui_app/teach/antd_components.en.md" : "/ui_app/teach/antd_components.md";

function Collage({ ANTD, ICONS, items }) {
  const A = ANTD;
  const en = typeof window !== "undefined" && window.__teachLang === "en";
  const I = (name, style) => iconOf(ICONS, name, style);
  const look = (name) => items.item(name);
  const slot = (name, key, dflt) => { const v = look(name).slots[key]; return v == null || v === "" ? (dflt == null ? "" : dflt) : v; };
  const write = (name, key, v) => look(name).write(key, v);
  const opts = (name, key) => parseOpts(slot(name, key, ""));
  const val = (name, key, dflt) => { const v = slot(name, key, ""); return v === "" ? (dflt == null ? "" : dflt) : v; };
  const pressed = (name) => toBool(slot(name, "pressed", "")) === true;

  const logoSvg = (s) => h("svg", { viewBox: "0 0 24 24", width: s, height: s, xmlns: "http://www.w3.org/2000/svg" },
    h("path", { key: "a", fill: "#1677ff", d: "M12 1.6 22.4 12 12 22.4 1.6 12z" }),
    h("path", { key: "b", fill: "#f5222d", d: "M12 1.6 22.4 12 12 12z" }));
  const QR_ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1677ff" d="M12 1.6 22.4 12 12 22.4 1.6 12z"/><path fill="#f5222d" d="M12 1.6 22.4 12 12 12z"/></svg>');

  const btn = (name) => {
    const it = look(name);
    const props = { key: name, onClick: () => write(name, "pressed", pressed(name) ? "off" : "on") };
    const type = slot(name, "type", ""); if (type) props.type = type;
    if (toBool(slot(name, "danger", "")) === true) props.danger = true;
    const shape = slot(name, "shape", ""); if (shape) props.shape = shape;
    if (toBool(slot(name, "dashed", "")) === true) props.dashed = true;
    return h(A.Button, props, slot(name, "text", name) + (pressed(name) ? " ✓" : ""));
  };

  const otpVals = (() => {
    const arr = look("OTP1").value.split(",").map((s) => s.trim());
    while (arr.length < 6) arr.push("");
    return arr.slice(0, 6);
  })();
  const setOtp = (i, v) => {
    const next = otpVals.slice();
    next[i] = String(v).slice(0, 1);
    write("OTP1", "value", next.join(","));
  };

  const imgs = slot("AVATARS1", "imgs", "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="ac-panel">
      <div className="ac-row">
        <div className="ac-col ac-left">
          <div className="ac-v">
            <div className="ac-h">
              <A.Input value={look("INPUT1").value} placeholder={val("INPUT1", "placeholder", "hi@example.com")}
                style={{ width: num(val("INPUT1", "width", 141), 141) }}
                onChange={(e) => write("INPUT1", "value", e.target.value)} />
              <A.Select mode={val("SELECT1", "mode", "tags")}
                value={look("SELECT1").chosen.split(",").map((s) => s.trim()).filter(Boolean)}
                options={opts("SELECT1", "options")} style={{ width: num(val("SELECT1", "width", 300), 300) }}
                onChange={(v) => write("SELECT1", "chosen", (Array.isArray(v) ? v : [v]).join(", "))} />
            </div>
            <div className="ac-h">
              <div className="ac-color" style={{ width: num(val("COLOR1", "width", 100), 100) }}>
                <A.ColorPicker value={look("COLOR1").value} size="small" showText={false} presets={[{ label: en ? "Presets" : "预设", colors: ["#1677ff", "#f5222d", "#52c41a", "#faad14", "#6b62f2"] }]}
                  onChange={(c) => write("COLOR1", "value", c.toHexString())} />
                <span className="ac-color-t">{look("COLOR1").value}</span>
              </div>
              <A.Space.Compact style={{ width: num(val("SELECT2", "width", 130), 130) }}>
                <A.Select value={look("SELECT2").chosen} options={opts("SELECT2", "options")}
                  style={{ width: "100%" }} onChange={(v) => write("SELECT2", "chosen", v)} />
              </A.Space.Compact>
              <A.DatePicker value={look("DATE1").value ? dayjs(look("DATE1").value) : null}
                placeholder={val("DATE1", "placeholder", "Select Date")}
                style={{ width: num(val("DATE1", "width", 195), 195) }}
                onChange={(d) => write("DATE1", "value", d ? d.format("YYYY-MM-DD") : "")} />
            </div>
            <div className="ac-h ac-between">
              <A.Checkbox.Group options={opts("CHECK1", "options").map((o) => ({ label: o.label, value: o.value }))}
                value={look("CHECK1").chosen.split(",").map((s) => s.trim()).filter(Boolean)}
                onChange={(v) => write("CHECK1", "chosen", v.join(", "))} />
              <A.Radio.Group options={opts("RADIO1", "options").map((o) => ({ label: o.label, value: o.value }))}
                value={look("RADIO1").chosen} onChange={(e) => write("RADIO1", "chosen", String(e.target.value))} />
              <A.Switch checked={toBool(look("SWITCH1").value) === true}
                onChange={(v) => write("SWITCH1", "value", v ? "on" : "off")} />
              <A.Progress type="circle" percent={num(look("PROGRESS1").value, 75)}
                size={num(val("PROGRESS1", "size", 20), 20)} showInfo={false} />
            </div>
            <A.Steps current={num(look("STEPS1").current, 1)}
              items={opts("STEPS1", "options").map((o) => ({ title: o.label, status: o.status || undefined }))} />
          </div>
          <div className="ac-v">
            <A.Progress percent={num(look("PROGRESS2").value, 50)} />
            <div className="ac-sliderrow">
              <A.Slider value={num(look("PROGRESS3").value, 50)} min={0} max={100}
                onChange={(v) => write("PROGRESS3", "value", String(v))}
                tooltip={{ formatter: (v) => (v == null ? "" : v + "%") }} />
              <span className="ac-slider-pct">{num(look("PROGRESS3").value, 0)}%</span>
            </div>
          </div>
          <div className="ac-h ac-between">
            {["BADGE1", "BADGE2", "BADGE3", "BADGE4", "BADGE5"].map((n) => (
              <A.Badge key={n} status={val(n, "status", "default")} text={val(n, "text", n)} />
            ))}
          </div>
          <div className="ac-qrrow">
            <div className="ac-qrcard">
              <A.QRCode value={val("QRCODE1", "value", "https://ant.design")}
                size={num(val("QRCODE1", "size", 158), 158)} bordered={false} icon={QR_ICON} />
            </div>
            <div className="ac-qrstack">
              <div className="ac-qrrow1">
                <A.Spin size={val("SPIN1", "size", "small")} />
                <span className="ac-dots2"><i /><i /><i /><i /></span>
                <A.Rate value={num(look("RATE1").value, 3)} onChange={(v) => write("RATE1", "value", String(v))} />
              </div>
              <div className="ac-tagcard">
                {["TAG1", "TAG2", "TAG3"].map((n) => (
                  <A.Tag key={n} color={val(n, "color", "blue")} icon={I(val(n, "icon", ""))}>{val(n, "text", n)}</A.Tag>
                ))}
              </div>
              {val("POP1", "value", "open") === "open" ? (
                <div className="ac-pop">
                  <span className="ac-pop-t"><span className="ac-pop-ico">{I("ExclamationCircleFilled")}</span>{val("POP1", "title", "Are you OK?")}</span>
                  <span className="ac-pop-b">
                    <A.Button size="small" onClick={() => write("POP1", "value", "closed")}>{val("POP1", "cancel", en ? "Cancel" : "取消")}</A.Button>
                    <A.Button size="small" type="primary" onClick={() => write("POP1", "value", "closed")}>{val("POP1", "ok", en ? "OK" : "确定")}</A.Button>
                  </span>
                </div>
              ) : (
                <A.Button size="small" onClick={() => write("POP1", "value", "open")}>{en ? "Open notification" : "打开通知"}</A.Button>
              )}
            </div>
          </div>
          <div className="ac-segcard">
            <A.Segmented block options={opts("SEGMENT1", "options").map((o) => o.value)}
              value={look("SEGMENT1").chosen} onChange={(v) => write("SEGMENT1", "chosen", String(v))} />
            <A.Segmented block options={opts("SEGMENT2", "options").map((o) => ({ value: o.value, label: o.label, icon: I(o.icon) }))}
              value={look("SEGMENT2").chosen} onChange={(v) => write("SEGMENT2", "chosen", String(v))} />
          </div>
        </div>
        <div className="ac-col ac-mid">
          <div className="ac-v">
            <A.Avatar.Group size={46}>
              {imgs.map((src) => <A.Avatar key={src} src={src} />)}
              <A.Avatar style={{ background: "#fff", color: "#666" }}>{val("AVATARS1", "more", "+5")}</A.Avatar>
            </A.Avatar.Group>
            <div className="ac-title">{val("TITLE1", "value", "Verify account")}</div>
            <div className="ac-sub">{val("DESC1", "value", "")}</div>
            <div className="ac-otp">
              {otpVals.map((v, i) => (
                <A.Input key={i} value={v} style={{ width: 33, height: 40, padding: 0, textAlign: "center", fontSize: 18 }}
                  onChange={(e) => setOtp(i, e.target.value)} />
              ))}
            </div>
            <div className="ac-sub">{val("RESEND1", "value", "Didn't receive a code?")}{" "}<a>{val("RESEND1", "action", "Resend")}</a></div>
          </div>
          <div className="ac-btnrows">
            <div className="ac-h ac-center">{btn("BTN1")}{btn("BTN2")}</div>
            <div className="ac-h ac-center">{btn("BTN3")}{btn("BTN4")}</div>
          </div>
          <div className="ac-brandcard">
            <span className="ac-logo-img">{logoSvg(60)}</span>
            <div className="ac-brandtxt">
              <div className="ac-brandname">{val("BRAND1", "name", "Ant Design")}</div>
              <div className="ac-brandhandle">{val("BRAND1", "handle", "@ant-design")}</div>
              <div className="ac-branddesc">{val("BRAND1", "desc", "")}</div>
            </div>
          </div>
          {val("NOTICE1", "value", "open") === "open" ? (
            <div className="ac-notice">
              <span className="ac-notice-icon">{I("CheckCircleFilled")}</span>
              <div className="ac-notice-main">
                <div className="ac-notice-title">{val("NOTICE1", "title", "Ant Design")}</div>
                <div className="ac-notice-desc">{val("NOTICE1", "desc", "")}</div>
              </div>
              <span className="ac-notice-close" onClick={() => write("NOTICE1", "value", "closed")}>{I("CloseOutlined")}</span>
            </div>
          ) : (
            <A.Button size="small" onClick={() => write("NOTICE1", "value", "open")}>{en ? "Reopen notice card" : "重新打开通知卡"}</A.Button>
          )}
        </div>
        <div className="ac-col ac-right">
          <div className="ac-create">
            <span className="ac-logo-img">{logoSvg(50)}</span>
            <div className="ac-create-t">{val("CREATE1", "title", "Create an account")}</div>
            <div className="ac-create-d">{val("CREATE1", "desc", "")}</div>
            <A.Button type="primary" size="large" block style={{ height: 40, fontSize: 16 }}
              onClick={() => write("CREATE1", "pressed", pressed("CREATE1") ? "off" : "on")}>
              {val("CREATE1", "button", "Get Started")}{pressed("CREATE1") ? " ✓" : ""}
            </A.Button>
            <A.Divider plain>{val("DIVIDER1", "value", "OR")}</A.Divider>
            <div className="ac-create-btns">
              <A.Button size="large" block icon={I("GoogleOutlined")} style={{ height: 40, fontSize: 16 }}
                type={val("OAUTH1", "pressed", "") === "google" ? "primary" : "default"}
                onClick={() => write("OAUTH1", "pressed", val("OAUTH1", "pressed", "") === "google" ? "" : "google")}>
                {val("OAUTH1", "google", "Continue with Google")}
              </A.Button>
              <A.Button size="large" block icon={I("AppleOutlined")} style={{ height: 40, fontSize: 16 }}
                type={val("OAUTH1", "pressed", "") === "apple" ? "primary" : "default"}
                onClick={() => write("OAUTH1", "pressed", val("OAUTH1", "pressed", "") === "apple" ? "" : "apple")}>
                {val("OAUTH1", "apple", "Continue with Apple")}
              </A.Button>
            </div>
          </div>
          {val("MODAL1", "value", "open") === "open" ? (
            <div className="ac-modal">
              <span className="ac-modal-close" onClick={() => write("MODAL1", "value", "closed")}>{I("CloseOutlined")}</span>
              <div className="ac-modal-title">{val("MODAL1", "title", "Ant Design")}</div>
              <div className="ac-modal-desc">{val("MODAL1", "desc", "")}</div>
              <div className="ac-modal-footer">
                <A.Button size="small" onClick={() => write("MODAL1", "value", "closed")}>{val("MODAL1", "cancel", en ? "Cancel" : "取消")}</A.Button>
                <A.Button size="small" type="primary" onClick={() => write("MODAL1", "value", "closed")}>{val("MODAL1", "ok", en ? "OK" : "确定")}</A.Button>
              </div>
            </div>
          ) : (
            <A.Button size="small" onClick={() => write("MODAL1", "value", "open")}>{en ? "Open modal" : "打开模态"}</A.Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** COMPONENTS 章的认领件：md 数据驱动拼贴 + 其下可折叠的 [render md]/[data md] Monaco。 */
export default observer(function AntdCollage({ node }) {
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
    h("div", { className: "antd2-chapter is-collage" },
      h(Collage, { ANTD: ANTD, ICONS: ICONS, items: items })
    )
  );
});
```
