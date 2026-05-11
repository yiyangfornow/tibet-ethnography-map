
const DATA_URL = './data/places.geojson';
const ROUTES_URL = './data/routes.geojson';
const SOURCES_URL = './data/sources.json';
const CATEGORIES_URL = './data/categories.json';
const REGION_AREAS_URL = './data/region_areas.geojson';
const REGION_LABELS_URL = './data/region_labels.geojson';

const CATEGORY_ORDER = [
  'religious_site',
  'education_monastic',
  'pilgrimage',
  'craft_practice',
  'intangible_heritage',
  'sacred_landscape',
  'settlement',
  'archive_print',
  'medical_tradition',
  'natural_geography'
];

let REGION_COLORS = {
  u_tsang: '#9b6a3c',
  ngari: '#7b423a',
  kham: '#b08450',
  amdo: '#7d9997',
  himalayan: '#6c8178',
  bhutan_sikkim: '#94805f',
  diaspora_crossroads: '#75665b'
};

const DEFAULT_CATEGORY_COLORS = {
  religious_site: '#8f5f38',
  education_monastic: '#b58f5f',
  pilgrimage: '#6c4038',
  craft_practice: '#8c7a5c',
  intangible_heritage: '#9a6d60',
  sacred_landscape: '#7f9691',
  settlement: '#a1744e',
  archive_print: '#7c6558',
  medical_tradition: '#7b8f69',
  natural_geography: '#8f8b7a'
};

const RESEARCH_MASK = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { id: 'outside_research_extent' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
        [[72, 24], [72, 39], [108, 39], [108, 24], [72, 24]]
      ]
    }
  }]
};

const state = {
  allPlaces: null,
  allRoutes: null,
  regionAreas: null,
  regionLabels: null,
  sources: {},
  categories: {},
  regions: {},
  activeCategories: new Set(CATEGORY_ORDER),
  query: '',
  region: 'all',
  filteredPlaces: [],
  filteredRoutes: [],
  searchTimer: null
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [90.4, 31.4],
  zoom: 4.05,
  minZoom: 3.0,
  maxZoom: 15,
  maxBounds: [[72.0, 23.8], [108.2, 39.2]],
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

const els = {
  search: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  region: document.getElementById('region-select'),
  categories: document.getElementById('category-list'),
  toggleAll: document.getElementById('toggle-all'),
  fitVisible: document.getElementById('fit-visible'),
  story: document.getElementById('story-select'),
  visibleCount: document.getElementById('visible-count'),
  totalCount: document.getElementById('total-count'),
  routeCount: document.getElementById('route-count'),
  resultsList: document.getElementById('results-list'),
  resultsNote: document.getElementById('results-note'),
  sidebar: document.getElementById('sidebar'),
  sidebarContent: document.getElementById('sidebar-content'),
  closeSidebar: document.getElementById('close-sidebar'),
  status: document.getElementById('status-bar'),
  error: document.getElementById('error-panel')
};

function setStatus(message) {
  els.status.textContent = message;
}

function showError(error) {
  console.error(error);
  els.error.hidden = false;
  els.error.innerHTML = `
    <strong>数据加载失败。</strong>
    <p>如果你是直接双击打开 index.html，浏览器可能会阻止读取本地 GeoJSON。请在项目目录运行：</p>
    <code>python3 -m http.server 8000</code>
    <p>然后访问 <code>http://localhost:8000</code>。</p>
    <pre>${escapeHTML(error.message || error)}</pre>
  `;
  setStatus('数据加载失败：请使用本地静态服务器预览。');
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return trimmed.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    return trimmed.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [value];
}

function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('臺', '台')
    .replaceAll('達', '达')
    .replaceAll('藏傳', '藏传')
    .replaceAll('瑪', '玛')
    .replaceAll('岡', '冈')
    .replaceAll('劄', '札')
    .replaceAll('扎达', '札达')
    .replaceAll('科加', '科迦')
    .replaceAll('冈仁波钦', '冈仁波齐')
    .replaceAll('冈仁波切', '冈仁波齐')
    .replaceAll('玛旁雍措', '玛旁雍错')
    .replaceAll('拉昂措', '拉昂错')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryLabel(key) {
  return state.categories?.[key]?.label_zh || key;
}

function categoryDescription(key) {
  return state.categories?.[key]?.description || '';
}

function categoryColor(key) {
  return DEFAULT_CATEGORY_COLORS[key] || '#d6a54e';
}

function regionColor(key) {
  return REGION_COLORS[key] || '#8f5f38';
}

function regionExpression() {
  const expression = ['match', ['get', 'region_key']];
  for (const [key, color] of Object.entries(REGION_COLORS)) {
    expression.push(key, color);
  }
  expression.push('#8f5f38');
  return expression;
}

function hasCategory(feature, selectedCategories = state.activeCategories) {
  const props = feature.properties || {};
  const categories = new Set(asArray(props.categories));
  if (props.primary_category) categories.add(props.primary_category);
  for (const category of selectedCategories) {
    if (categories.has(category)) return true;
  }
  return false;
}

function matchesRegion(feature) {
  if (state.region === 'all') return true;
  const p = feature.properties || {};
  if (p.region_key === state.region) return true;
  return asArray(p.included_regions).includes(state.region);
}

function searchableText(feature) {
  const p = feature.properties || {};
  return normalizeSearch([
    p.id,
    p.name_zh,
    p.name_en,
    p.name_bo,
    p.romanization,
    p.region_label,
    p.primary_category,
    asArray(p.categories).join(' '),
    asArray(p.search_aliases).join(' '),
    p.summary_short,
    p.details,
    p.story_angle,
    p.craft_or_practice,
    JSON.stringify(p.highlights || ''),
    JSON.stringify(p.body_sections || '')
  ].filter(Boolean).join(' '));
}

function matchesQuery(feature) {
  const query = normalizeSearch(state.query);
  if (!query) return true;
  const haystack = searchableText(feature);
  const terms = query.split(' ').filter(Boolean);
  return terms.every(term => haystack.includes(term));
}

function filterPlaces() {
  if (!state.allPlaces) return [];
  return state.allPlaces.features.filter(feature =>
    hasCategory(feature) && matchesRegion(feature) && matchesQuery(feature)
  );
}

function filterRoutes() {
  if (!state.allRoutes) return [];
  return state.allRoutes.features.filter(feature =>
    matchesRegion(feature) && matchesQuery(feature)
  );
}

function addRegionLayers() {
  map.addSource('research-mask', { type: 'geojson', data: RESEARCH_MASK });
  map.addLayer({
    id: 'research-mask',
    type: 'fill',
    source: 'research-mask',
    paint: {
      'fill-color': '#2f2822',
      'fill-opacity': 0.18
    }
  });

  map.addSource('region-areas', { type: 'geojson', data: state.regionAreas });
  map.addLayer({
    id: 'region-fill',
    type: 'fill',
    source: 'region-areas',
    paint: {
      'fill-color': regionExpression(),
      'fill-opacity': [
        'case',
        ['==', ['get', 'region_key'], 'diaspora_crossroads'], 0.16,
        0.23
      ]
    }
  });
  map.addLayer({
    id: 'region-boundary',
    type: 'line',
    source: 'region-areas',
    paint: {
      'line-color': regionExpression(),
      'line-width': 1.6,
      'line-opacity': 0.62,
      'line-dasharray': [1.6, 1.1]
    }
  });

  map.addSource('region-labels', { type: 'geojson', data: state.regionLabels });
  map.addLayer({
    id: 'region-labels',
    type: 'symbol',
    source: 'region-labels',
    layout: {
      'text-field': ['get', 'name_zh'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 16,
        5, 21,
        8, 26
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#3b3027',
      'text-halo-color': '#fff7ea',
      'text-halo-width': 2.2,
      'text-opacity': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.9,
        7, 0.52,
        9, 0.2
      ]
    }
  });
}

function addDataLayers() {
  addRegionLayers();

  map.addSource('routes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'route-hitbox',
    type: 'line',
    source: 'routes',
    paint: { 'line-width': 18, 'line-opacity': 0 }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'routes',
    paint: {
      'line-color': regionExpression(),
      'line-opacity': 0.78,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 7, 3.2, 11, 5],
      'line-dasharray': [1.4, 1.1]
    }
  });

  map.addSource('places', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: false
  });

  map.addLayer({
    id: 'unclustered-points-halo',
    type: 'circle',
    source: 'places',
    paint: {
      'circle-color': regionExpression(),
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 7, 7, 11, 11, 16],
      'circle-opacity': 0.18,
      'circle-blur': 0.25
    }
  });

  map.addLayer({
    id: 'unclustered-points',
    type: 'circle',
    source: 'places',
    paint: {
      'circle-color': regionExpression(),
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4.8, 7, 6.6, 11, 9],
      'circle-stroke-color': '#fff7ea',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 1.1, 10, 1.8],
      'circle-opacity': 0.96
    }
  });

  map.addLayer({
    id: 'point-labels',
    type: 'symbol',
    source: 'places',
    minzoom: 5.0,
    layout: {
      'text-field': ['coalesce', ['get', 'name_zh'], ['get', 'name_en']],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 9, 12, 12, 14],
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#3b3027',
      'text-halo-color': '#fff7ea',
      'text-halo-width': 1.6
    }
  });

  map.on('click', 'unclustered-points', event => {
    const feature = event.features[0];
    renderSidebar(feature, 'place');
    map.easeTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 7), duration: 700 });
  });

  map.on('click', 'route-hitbox', event => {
    const feature = event.features[0];
    renderSidebar(feature, 'route');
    fitFeature(feature);
  });

  for (const layer of ['unclustered-points', 'route-hitbox']) {
    map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
  }
}

function applyFilters({ fit = false } = {}) {
  state.filteredPlaces = filterPlaces();
  state.filteredRoutes = filterRoutes();

  const placeSource = map.getSource('places');
  const routeSource = map.getSource('routes');
  if (placeSource) placeSource.setData({ type: 'FeatureCollection', features: state.filteredPlaces });
  if (routeSource) routeSource.setData({ type: 'FeatureCollection', features: state.filteredRoutes });

  els.visibleCount.textContent = state.filteredPlaces.length;
  els.totalCount.textContent = state.allPlaces?.features.length || 0;
  els.routeCount.textContent = state.filteredRoutes.length;

  renderResults();
  setStatus(`当前显示 ${state.filteredPlaces.length}/${state.allPlaces.features.length} 个点位，${state.filteredRoutes.length}/${state.allRoutes.features.length} 条叙事线。地图色块为文化区域示意，不是行政边界。`);
  if (fit) fitVisible();
}

function renderControls() {
  const regionOptions = [`<option value="all">全部藏文化区域</option>`, ...Object.entries(state.regions).map(([key, label]) => `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`)];
  els.region.innerHTML = regionOptions.join('');

  els.categories.innerHTML = CATEGORY_ORDER.filter(key => state.categories[key]).map(key => {
    const label = categoryLabel(key);
    const description = categoryDescription(key);
    return `
      <label class="category-item" title="${escapeHTML(description)}">
        <input type="checkbox" value="${escapeHTML(key)}" checked />
        <span class="swatch" style="background:${categoryColor(key)}"></span>
        <span class="category-text"><strong>${escapeHTML(label)}</strong><small>${escapeHTML(description)}</small></span>
      </label>
    `;
  }).join('');

  renderRegionLegend();

  els.story.innerHTML = `<option value="">选择一条叙事路线</option>` + state.allRoutes.features.map(feature => {
    const p = feature.properties || {};
    return `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name_zh || p.name_en || p.id)}</option>`;
  }).join('');

  const handleSearch = () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.query = els.search.value;
      applyFilters({ fit: Boolean(normalizeSearch(state.query)) });
    }, 180);
  };
  els.search.addEventListener('input', handleSearch);
  els.search.addEventListener('keyup', handleSearch);
  els.search.addEventListener('search', handleSearch);

  els.clearSearch.addEventListener('click', () => {
    els.search.value = '';
    state.query = '';
    applyFilters({ fit: true });
  });

  els.region.addEventListener('change', () => {
    state.region = els.region.value;
    applyFilters({ fit: true });
  });

  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  els.categories.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.activeCategories.add(checkbox.value);
      else state.activeCategories.delete(checkbox.value);
      applyFilters({ fit: true });
    });
  });

  els.toggleAll.addEventListener('click', () => {
    const allActive = state.activeCategories.size === Object.keys(state.categories).length;
    state.activeCategories = new Set(allActive ? [] : CATEGORY_ORDER.filter(key => state.categories[key]));
    syncControls();
    applyFilters({ fit: true });
  });

  els.fitVisible.addEventListener('click', fitVisible);

  els.story.addEventListener('change', () => {
    const routeId = els.story.value;
    if (!routeId) return;
    state.region = 'all';
    state.query = '';
    state.activeCategories = new Set(CATEGORY_ORDER.filter(key => state.categories[key]));
    els.search.value = '';
    syncControls();
    applyFilters();
    const route = state.allRoutes.features.find(feature => feature.properties?.id === routeId);
    if (route) {
      renderSidebar(route, 'route');
      fitFeature(route);
    }
  });

  els.closeSidebar.addEventListener('click', () => els.sidebar.classList.remove('open'));
}

function applyPreset(preset) {
  state.query = '';
  state.activeCategories = new Set(CATEGORY_ORDER.filter(key => state.categories[key]));
  if (preset === 'ngari') {
    state.region = 'ngari';
  } else if (preset === 'guge') {
    state.region = 'ngari';
    state.query = '古格';
  } else if (preset === 'pilgrimage') {
    state.region = 'all';
    state.activeCategories = new Set(['pilgrimage', 'sacred_landscape']);
  } else if (preset === 'heritage') {
    state.region = 'ngari';
    state.activeCategories = new Set(['intangible_heritage', 'craft_practice']);
    state.query = '普兰';
  }
  els.search.value = state.query;
  syncControls();
  applyFilters({ fit: true });
}

function renderRegionLegend() {
  const host = document.querySelector('.quick-actions');
  if (!host || document.querySelector('.region-legend')) return;
  const legend = document.createElement('div');
  legend.className = 'region-legend';
  legend.innerHTML = Object.entries(state.regions).map(([key, label]) => `<span><i style="background:${regionColor(key)}"></i>${escapeHTML(label)}</span>`).join('');
  host.insertAdjacentElement('afterend', legend);
}

function syncControls() {
  els.region.value = state.region;
  els.categories.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = state.activeCategories.has(checkbox.value);
  });
}

function renderResults() {
  const results = state.filteredPlaces.slice(0, 12);
  if (!results.length) {
    els.resultsList.innerHTML = `<p class="scope-note">没有符合筛选条件的点位。试着清除搜索或打开更多图层。</p>`;
    els.resultsNote.textContent = '0 个匹配';
    return;
  }
  els.resultsNote.textContent = `${state.filteredPlaces.length} 个匹配`;
  els.resultsList.innerHTML = results.map(feature => {
    const p = feature.properties || {};
    const categories = asArray(p.categories).map(categoryLabel).slice(0, 2).join(' / ');
    return `<button class="result-card" data-id="${escapeHTML(p.id)}"><strong>${escapeHTML(p.name_zh || p.name_en || p.id)}</strong><span>${escapeHTML(p.region_label || '')} · ${escapeHTML(categories)}</span></button>`;
  }).join('');
  els.resultsList.querySelectorAll('.result-card').forEach(button => {
    button.addEventListener('click', () => {
      const feature = state.filteredPlaces.find(item => item.properties?.id === button.dataset.id);
      if (!feature) return;
      renderSidebar(feature, 'place');
      const coordinates = feature.geometry.coordinates;
      map.easeTo({ center: coordinates, zoom: Math.max(map.getZoom(), 7), duration: 700 });
    });
  });
}

function renderBodySections(sections) {
  const items = asArray(sections).filter(Boolean);
  if (!items.length) return '';
  return `<div class="section-block">${items.map(section => {
    const title = typeof section === 'object' ? section.title : '专题说明';
    const body = typeof section === 'object' ? section.body : section;
    return `<div class="note-card"><strong>${escapeHTML(title || '专题说明')}</strong><span>${escapeHTML(body || '')}</span></div>`;
  }).join('')}</div>`;
}

function renderHeroImage(p) {
  if (p.image_url) {
    const credit = p.image_credit ? `<small>${escapeHTML(p.image_credit)}</small>` : '';
    const source = p.image_source_url ? `<a href="${escapeHTML(p.image_source_url)}" target="_blank" rel="noopener">图片来源 / 授权页</a>` : '';
    return `<figure class="hero-image"><img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.image_alt || p.name_zh || p.name_en || '')}" loading="lazy" /><figcaption>${escapeHTML(p.image_caption || '')} ${credit} ${source}</figcaption></figure>`;
  }
  const regionKey = p.region_key || 'default';
  const regionLabel = state.regions[regionKey] || p.region_label || 'Tibet ethnography';
  return `<div class="hero-placeholder" style="--region-color:${regionColor(regionKey)}"><span>${escapeHTML(regionLabel)}</span><strong>${escapeHTML(p.name_zh || p.name_en || 'Ethnographic place')}</strong><small>图片位已预留：建议上传授权建筑/地景照片后，在 GeoJSON 中填写 image_url。</small></div>`;
}

function renderHighlights(items) {
  const list = asArray(items).filter(Boolean);
  if (!list.length) return '';
  return `<h3>重点看点</h3><ul class="highlight-list">${list.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
}

function renderSidebar(feature, type = 'place') {
  const p = feature.properties || {};
  const categories = new Set(asArray(p.categories));
  if (p.primary_category) categories.add(p.primary_category);
  const sourceIds = asArray(p.source_ids || p.source_refs);
  const sourceHtml = sourceIds.length
    ? sourceIds.map(id => {
      const source = state.sources[id] || { title: id, url: '' };
      if (source.url) return `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener">${escapeHTML(source.title || id)}<small>${escapeHTML(source.note || source.type || '')}</small></a>`;
      return `<span>${escapeHTML(source.title || id)}</span>`;
    }).join('')
    : '<span>尚未填写来源。正式发布前必须补齐。</span>';
  const coordinates = getFeatureCenter(feature);
  const coordinateText = coordinates ? `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}` : '路线 / 区域示意';
  const tibetan = p.name_bo ? `<div class="tibetan-name">${escapeHTML(p.name_bo)}</div>` : '';
  const roman = p.romanization ? `<span class="chip">${escapeHTML(p.romanization)}</span>` : '';
  const categoryChips = [...categories].map(key => `<span class="chip"><span class="swatch" style="background:${categoryColor(key)}"></span>${escapeHTML(categoryLabel(key))}</span>`).join('');
  const craftRow = p.craft_or_practice ? `<div><strong>工艺 / 实践</strong><span>${escapeHTML(p.craft_or_practice)}</span></div>` : '';
  const eraRow = p.era ? `<div><strong>建立 / 时期</strong><span>${escapeHTML(p.era)}</span></div>` : '';
  const reviewRow = p.review_status ? `<div><strong>审校状态</strong><span>${escapeHTML(p.review_status)}</span></div>` : '';
  els.sidebarContent.innerHTML = `
    ${renderHeroImage(p)}
    <p class="eyebrow">${type === 'route' ? 'Story Route' : 'Ethnographic Place'}</p>
    <h2>${escapeHTML(p.name_zh || p.name_en || p.id)}</h2>
    ${tibetan}
    <div class="chips">${roman}${categoryChips}</div>
    <p class="lead-copy">${escapeHTML(p.summary_short || '')}</p>
    ${p.details ? `<p>${escapeHTML(p.details)}</p>` : ''}
    ${renderHighlights(p.highlights)}
    ${renderBodySections(p.body_sections)}
    <div class="meta-grid">
      <div><strong>英文 / 转写名</strong><span>${escapeHTML(p.name_en || p.romanization || '—')}</span></div>
      <div><strong>文化区域</strong><span>${escapeHTML(p.region_label || state.regions[p.region_key] || '—')}</span></div>
      ${eraRow}
      ${craftRow}
      <div><strong>坐标</strong><span>${escapeHTML(coordinateText)}</span></div>
      <div><strong>坐标可信度</strong><span>${escapeHTML(p.coordinate_confidence || 'schematic')}</span></div>
      <div><strong>内容可信度</strong><span>${escapeHTML(p.content_confidence || 'seed')}</span></div>
      <div><strong>敏感度</strong><span>${escapeHTML(p.sensitivity || 'public')}</span></div>
      ${reviewRow}
    </div>
    <h3>叙事角度</h3>
    <p class="hint">${escapeHTML(p.story_angle || '可作为后续民族志专题入口。')}</p>
    <h3>来源 / 复核线索</h3>
    <div class="source-list">${sourceHtml}</div>
  `;
  els.sidebar.classList.add('open');
}

function getFeatureCenter(feature) {
  if (!feature?.geometry) return null;
  if (feature.geometry.type === 'Point') return feature.geometry.coordinates;
  const coords = flattenCoordinates(feature.geometry.coordinates);
  if (!coords.length) return null;
  const lng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
  const lat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
  return [lng, lat];
}

function flattenCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  if (typeof coordinates[0] === 'number') return [coordinates];
  return coordinates.flatMap(flattenCoordinates);
}

function fitVisible() {
  const features = [...state.filteredPlaces, ...state.filteredRoutes];
  if (!features.length) { setStatus('没有可定位的结果。'); return; }
  fitFeatures(features);
}

function fitFeature(feature) { fitFeatures([feature]); }

function fitFeatures(features) {
  const coords = features.flatMap(feature => flattenCoordinates(feature.geometry?.coordinates));
  if (!coords.length) return;
  if (coords.length === 1) { map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 7), duration: 900 }); return; }
  const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(bounds, {
    padding: { top: 90, right: window.innerWidth > 980 ? 500 : 40, bottom: 90, left: window.innerWidth > 980 ? 430 : 40 },
    maxZoom: 8.5,
    duration: 900
  });
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

async function init() {
  setStatus('正在读取 GeoJSON、区域色块与来源表…');
  const [places, routes, sourceRefs, categoryConfig, regionAreas, regionLabels] = await Promise.all([
    loadJson(DATA_URL), loadJson(ROUTES_URL), loadJson(SOURCES_URL), loadJson(CATEGORIES_URL), loadJson(REGION_AREAS_URL), loadJson(REGION_LABELS_URL)
  ]);
  state.allPlaces = places;
  state.allRoutes = routes;
  state.sources = sourceRefs;
  state.categories = categoryConfig.categories || {};
  state.regions = categoryConfig.regions || {};
  REGION_COLORS = categoryConfig.region_colors || REGION_COLORS;
  state.regionAreas = regionAreas;
  state.regionLabels = regionLabels;
  state.activeCategories = new Set(CATEGORY_ORDER.filter(key => state.categories[key]));
  renderControls();
  addDataLayers();
  applyFilters();
  fitFeatures(regionAreas.features);
}

map.on('load', () => init().catch(showError));
