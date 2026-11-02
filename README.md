# MDIO_WTS

MDIO 的工作树集（worktree set）：一组可被 [`mdio`](https://github.com/cloudwalkerfre/MDIO) 直接 `load` 的 wt，
每个 wt 自带 `install.md` / `wt/`（文档根 + app）与 `ui/`（可选资源）。

## 载入

```bash
mdio load https://github.com/cloudwalkerfre/MDIO_WTS
```

或在已运行的 mdio 里按 `install.md` 的 worktree 清单逐个挂载。

## 目录

| 路径 | 内容 |
|---|---|
| `install.md` | WTS 清单（schema 1）：根树 `genesis` + 各应用树 |
| `genesis/` | 根树：首页 / 教学页 / 品牌与导航 |
| `chat/` | 对话 app（HIS 落 md 文档） |
| `log/` | 日志面板 app |
| `monaco/` | 代码编辑面板 app |
| `console/` | 控制台 app |
| `DreamScript/` | 剧本集 app（纯渲染） |
| `THIRD_PARTY_NOTICES.md` | 第三方组件与字体许可说明 |

## License

代码与文档：MIT，见 [`LICENSE`](./LICENSE)。
第三方组件与字体许可见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
