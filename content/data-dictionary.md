# Data Dictionary｜数据字典

## `data/places.geojson`

每个点位是一个 GeoJSON Feature。

### 核心字段

| 字段 | 说明 |
|---|---|
| `id` | 稳定唯一 ID，建议使用英文小写与下划线 |
| `name_zh` | 中文显示名 |
| `name_en` | 英文名或常用外文名 |
| `name_bo` | 藏文名；不确定时填 `null` |
| `romanization` | Wylie、拼写或常见转写；不确定时填 `null` |
| `region_key` | 区域 key，例如 `u_tsang`、`kham`、`amdo` |
| `region_label` | 区域显示名 |
| `primary_category` | 主图层分类 |
| `categories` | 多选分类数组 |
| `summary_short` | 一句话简介 |
| `details` | 侧边栏较长说明 |
| `story_angle` | 推荐的民族志叙事角度 |
| `craft_or_practice` | 若是工艺、非遗、身体实践，可填写 |
| `source_ids` | 对应 `data/sources.json` 的来源 ID 数组 |
| `coordinate_confidence` | 坐标可信度 |
| `content_confidence` | 内容可信度 |
| `sensitivity` | 敏感度 |
| `review_status` | 审校状态 |
| `last_reviewed` | 最后审阅日期 |

## 坐标可信度

| 值 | 使用场景 |
|---|---|
| `verified` | 经纬度已由可靠地图、机构资料或实地资料核对 |
| `approximate` | 只到村镇、河谷、景区、区域级，适合原型 |
| `disputed` | 地名、位置或边界有争议 |
| `unknown` | 暂无可靠坐标 |

## 内容可信度

| 值 | 使用场景 |
|---|---|
| `high` | 有权威来源，例如 UNESCO、机构档案、学术资料 |
| `medium` | 有公开资料，但仍需人工复核 |
| `low` | 仅为选题线索，不能直接发布为事实 |
| `needs_review` | 待补资料 |

## 敏感度

| 值 | 使用场景 |
|---|---|
| `public` | 公开地标、公开寺院、公开城镇 |
| `approximate_only` | 只显示区域级坐标，不展示细部位置 |
| `restricted` | 不公开坐标或不公开内容，只保留内部记录 |
| `remove` | 不应纳入公开地图 |

## 推荐新增字段

随着项目变大，可以加入：

- `image_url`
- `image_license`
- `bibliography`
- `reviewer`
- `community_permission`
- `language_notes`
- `alternate_names`
- `related_people`
- `related_texts`
- `related_routes`
