# Tibet Ethnography Map｜藏文化区域民族志地图原型

这是一个可直接部署的静态网页原型，用于探索“藏文化区域”的人文、宗教、手工艺、非遗与神山圣湖地景。

## 这个版本包含什么

- MapLibre GL JS 互动地图
- CARTO Dark Matter 无 token 底图
- 71 个示范点位：卫藏、阿里、康区、安多、跨喜马拉雅、不丹—锡金、流动交汇节点
- 7 条叙事路线：八廓、雅砻、冈仁波齐、康区印经、热贡艺术、安多口传、跨喜马拉雅弧线
- 图层筛选、区域筛选、搜索、聚合点、侧边栏
- 每个点位有来源、坐标可信度、内容可信度、敏感度、审校状态字段
- 数据与代码分离：`data/places.geojson`、`data/routes.geojson`、`data/sources.json`

## 本地预览

不要直接双击 `index.html`，因为浏览器可能禁止本地 `fetch()` 读取 GeoJSON。

在项目目录运行：

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## 部署到 GitHub Pages

1. 新建 GitHub repo，例如 `tibet-ethnography-map`
2. 上传本文件夹里的所有内容
3. 在 GitHub repo 设置里打开 Pages
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main` / root
6. 等待部署完成

## 目录结构

```text
tibet-ethnography-map/
  index.html
  src/
    main.js
    styles.css
  data/
    places.geojson
    routes.geojson
    categories.json
    sources.json
    sources.csv
  content/
    data-dictionary.md
    editorial-guidelines.md
  prompts/
    data-extraction-prompt.md
    cursor-build-prompt.md
```

## 重要范围说明

本项目按“藏文化区域”组织，不等同于任何行政边界。第一版包含：

- Ü-Tsang / 卫藏
- Ngari / 阿里与西部藏地
- Kham / 康区
- Amdo / 安多
- Trans-Himalaya / 跨喜马拉雅藏传文化圈
- Bhutan–Sikkim / 不丹—锡金文化圈
- Diaspora & Crossroads / 流动与交汇节点

## 数据状态

`places.geojson` 是 seed dataset，不是出版级最终数据。公开发布前需要逐笔核对：

- 坐标是否正确
- 藏文名与转写是否正确
- 历史叙述是否有可靠来源
- 图片、地图、文本是否有授权
- 是否涉及不宜公开的宗教、社区、路线或生态敏感信息

## 后续建议

下一步不要急着加 500 个点。建议先把 71 个点分成三组：

1. 可以公开发布：公开寺院、城镇、非遗概览
2. 需要改成区域级：神山、修学区域、地方社区、路线
3. 暂不公开：个人、住址、内部仪式、未授权工坊、敏感生态点

然后为每个点位补上更精确的来源链接和审校人备注。
