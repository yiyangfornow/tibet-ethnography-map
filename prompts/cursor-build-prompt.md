# Cursor Build Prompt｜给 Cursor 的开发 Prompt

请帮我维护这个 MapLibre GL JS 静态网站。

项目目标：
做一个“藏文化区域民族志地图”，不是旅游地图，也不是行政边界地图。

技术限制：
- 不用 React，保持静态 HTML/CSS/JS
- 数据必须放在 data/places.geojson 和 data/routes.geojson
- 不要把点位硬编码到 JS
- 不需要后端
- 保持 GitHub Pages 可部署

已有功能：
- MapLibre GL JS
- CARTO basemap
- GeoJSON 点位与路线
- 图层筛选
- 区域筛选
- 搜索
- cluster
- 点击侧边栏
- 来源与可信度字段

请新增功能时遵守：
1. 保留 sources / confidence / sensitivity 显示。
2. 不要删除编辑伦理提醒。
3. 移动端要可用。
4. 如果新增字段，请同步更新 content/data-dictionary.md。
5. 如果需要新资料，请先输出数据审校清单，不要直接编造。
