# 投影

## 演示

（projection-light：Markdown 投影动画，内嵌演示。）

## MDIO 概念

MDIO 将 Markdown 投影为 `HS + proj`。

- **HS：header section 拓扑**
  - header 是节；非 header block 归它前面最近的 header；header 可嵌套。

~~~text
# 项目                         [head h1]
├─ ## 配置                     [head h2]
│  ├─ - 端口: 8080             [bullet]
│  ├─ > 本地配置               [bq]
│  ├─ 1. 先启动服务            [ol]
│  ├─ 普通段落文本              [p]
│  ├─ | 列 | 值 |              [tb]
│  └─ <!-- 备注 -->            [comment]
├─ ## 任务                     [head h2]
│  ├─ - 待办: 写文档           [bullet]
│  ├─ ```python                [code]
│  └─ ### 子任务               [head h3]
│     └─ - 子项: 测试          [bullet]
└─ ## 日志                     [head h2]
   └─ > 记录一                 [bq]
~~~

- **proj：每个 block 的五面**
  > raw = container[ mark + tag ] + content

## 实验台
