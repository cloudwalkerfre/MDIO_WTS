# PROJECTION

## Demo

（projection-light: the Markdown projection animation, embedded.）

## MDIO concepts

MDIO projects Markdown as `HS + proj`.

- **HS: header section topology**
  - A header is a section; non-header blocks belong to the nearest header above them; headers can nest.

~~~text
# Project                  [head h1]
├─ ## Config              [head h2]
│  ├─ - port: 8080       [bullet]
│  ├─ > local config     [bq]
│  ├─ 1. start server    [ol]
│  ├─ plain paragraph    [p]
│  ├─ | key | value |    [tb]
│  └─ <!-- note -->      [comment]
├─ ## Tasks              [head h2]
│  ├─ - todo: write docs [bullet]
│  ├─ ```python          [code]
│  └─ ### Subtask        [head h3]
│     └─ - item: test    [bullet]
└─ ## Log                [head h2]
   └─ > entry one        [bq]
~~~

- **proj: the five faces of each block**
  > raw = container[ mark + tag ] + content

## Lab
