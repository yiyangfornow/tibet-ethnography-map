
const DATA_URL = './data/places.geojson';
const ROUTES_URL = './data/routes.geojson';
const SOURCES_URL = './data/sources.json';
const CATEGORIES_URL = './data/categories.json';

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

const CATEGORY_COLORS = {
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

const state = {
  allPlaces: null,
  allRoutes: null,
  sources: {},
  categories: {},
  regions: {},
  activeCategories: new Set(CATEGORY_ORDER),
  query: '',
  region: 'all',
  filteredPlaces: [],
  filteredRoutes: []
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [88.2, 31.0],
  zoom: 3.75,
  minZoom: 2.2,
  maxZoom: 15,
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

function categoryLabel(key) {
  return state.categories?.[key]?.label_zh || key;
}

function categoryDescription(key) {
  return state.categories?.[key]?.description || '';
}

function categoryColor(key) {
  return CATEGORY_COLORS[key] || '#d6a54e';
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
  return (feature.properties || {}).region_key === state.region;
}

function searchableText(feature) {
  const p = feature.properties || {};
  return [
    p.id,
    p.name_zh,
    p.name_en,
    p.name_bo,
    p.romanization,
    p.region_label,
    p.primary_category,
    asArray(p.categories).join(' '),
    p.summary_short,
    p.details,
    p.story_angle,
    p.craft_or_practice,
    JSON.stringify(p.body_sections || '')
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesQuery(feature) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  return searchableText(feature).includes(query);
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
    hasCategory(feature) && matchesRegion(feature) && matchesQuery(feature)
  );
}

function categoryExpression() {
  const expression = ['match', ['get', 'primary_category']];
  for (const key of CATEGORY_ORDER) {
    expression.push(key, categoryColor(key));
  }
  expression.push('#d6a54e');
  return expression;
}

function addDataLayers() {
  map.addSource('routes', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'route-hitbox',
    type: 'line',
    source: 'routes',
    paint: {
      'line-width': 18,
      'line-opacity': 0
    }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'routes',
    paint: {
      'line-color': '#8f5f38',
      'line-opacity': 0.78,
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        3, 1.4,
        7, 3.2,
        11, 5
      ],
      'line-dasharray': [1.4, 1.1]
    }
  });

  map.addSource('places', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 42,
    clusterMaxZoom: 8
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#6c4038',
        10, '#8f5f38',
        30, '#b58f5f'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        16,
        10, 22,
        30, 29
      ],
      'circle-stroke-color': '#fffaf2',
      'circle-stroke-width': 1.4,
      'circle-opacity': 0.92
    }
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12
    },
    paint: {
      'text-color': '#fffaf2'
    }
  });

  map.addLayer({
    id: 'unclustered-points',
    type: 'circle',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': categoryExpression(),
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3, 4.5,
        7, 6.5,
        11, 9
      ],
      'circle-stroke-color': '#f8f1e7',
      'circle-stroke-width': [
        'interpolate', ['linear'], ['zoom'],
        3, 0.8,
        10, 1.5
      ],
      'circle-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'point-labels',
    type: 'symbol',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    minzoom: 5.4,
    layout: {
      'text-field': ['coalesce', ['get', 'name_zh'], ['get', 'name_en']],
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, 10,
        9, 12,
        12, 14
      ],
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#3b3027',
      'text-halo-color': '#fffaf2',
      'text-halo-width': 1.6
    }
  });

  map.on('click', 'clusters', async event => {
    const cluster = map.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
    const clusterId = cluster.properties.cluster_id;
    const source = map.getSource('places');
    const zoom = await getClusterExpansionZoom(source, clusterId);
    map.easeTo({ center: cluster.geometry.coordinates, zoom, duration: 700 });
  });

  map.on('click', 'unclustered-points', event => {
    const feature = event.features[0];
    renderSidebar(feature, 'place');
    map.easeTo({
      center: feature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 7),
      duration: 700
    });
  });

  map.on('click', 'route-hitbox', event => {
    const feature = event.features[0];
    renderSidebar(feature, 'route');
    fitFeature(feature);
  });

  for (const layer of ['clusters', 'unclustered-points', 'route-hitbox']) {
    map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
  }
}

async function getClusterExpansionZoom(source, clusterId) {
  const maybePromise = source.getClusterExpansionZoom(clusterId);
  if (maybePromise && typeof maybePromise.then === 'function') {
    return maybePromise;
  }
  return new Promise((resolve, reject) => {
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) reject(err);
      else resolve(zoom);
    });
  });
}

function applyFilters({ fit = false } = {}) {
  state.filteredPlaces = filterPlaces();
  state.filteredRoutes = filterRoutes();

  const placeSource = map.getSource('places');
  const routeSource = map.getSource('routes');

  if (placeSource) {
    placeSource.setData({ type: 'FeatureCollection', features: state.filteredPlaces });
  }

  if (routeSource) {
    routeSource.setData({ type: 'FeatureCollection', features: state.filteredRoutes });
  }

  els.visibleCount.textContent = state.filteredPlaces.length;
  els.totalCount.textContent = state.allPlaces?.features.length || 0;
  els.routeCount.textContent = state.filteredRoutes.length;

  renderResults();
  setStatus(`当前显示 ${state.filteredPlaces.length}/${state.allPlaces.features.length} 个点位，${state.filteredRoutes.length}/${state.allRoutes.features.length} 条叙事线。Seed dataset，发布前请人工复核。`);

  if (fit) {
    fitVisible();
  }
}

function renderControls() {
  const regionOptions = [
    `<option value="all">全部藏文化区域</option>`,
    ...Object.entries(state.regions).map(([key, label]) => `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`)
  ];
  els.region.innerHTML = regionOptions.join('');

  els.categories.innerHTML = CATEGORY_ORDER.map(key => {
    const label = categoryLabel(key);
    const description = categoryDescription(key);
    return `
      <label class="category-item" title="${escapeHTML(description)}">
        <input type="checkbox" value="${escapeHTML(key)}" checked />
        <span class="swatch" style="background:${categoryColor(key)}"></span>
        <span class="category-text">
          <strong>${escapeHTML(label)}</strong>
          <small>${escapeHTML(description)}</small>
        </span>
      </label>
    `;
  }).join('');

  els.story.innerHTML = `<option value="">选择一条叙事路线</option>` + state.allRoutes.features.map(feature => {
    const p = feature.properties || {};
    return `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name_zh || p.name_en || p.id)}</option>`;
  }).join('');

  els.search.addEventListener('input', () => {
    state.query = els.search.value;
    applyFilters();
  });

  els.clearSearch.addEventListener('click', () => {
    els.search.value = '';
    state.query = '';
    applyFilters();
  });

  els.region.addEventListener('change', () => {
    state.region = els.region.value;
    applyFilters({ fit: true });
  });

  els.categories.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.activeCategories.add(checkbox.value);
      else state.activeCategories.delete(checkbox.value);
      applyFilters();
    });
  });

  els.toggleAll.addEventListener('click', () => {
    const allActive = state.activeCategories.size === CATEGORY_ORDER.length;
    state.activeCategories = new Set(allActive ? [] : CATEGORY_ORDER);
    syncControls();
    applyFilters();
  });

  els.fitVisible.addEventListener('click', fitVisible);

  els.story.addEventListener('change', () => {
    const routeId = els.story.value;
    if (!routeId) return;

    state.region = 'all';
    state.query = '';
    state.activeCategories = new Set(CATEGORY_ORDER);
    els.search.value = '';
    syncControls();
    applyFilters();

    const route = state.allRoutes.features.find(feature => feature.properties?.id === routeId);
    if (route) {
      renderSidebar(route, 'route');
      fitFeature(route);
    }
  });

  els.closeSidebar.addEventListener('click', () => {
    els.sidebar.classList.remove('open');
  });
}

function syncControls() {
  els.region.value = state.region;
  els.categories.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = state.activeCategories.has(checkbox.value);
  });
}

function renderResults() {
  const results = state.filteredPlaces.slice(0, 10);
  if (!results.length) {
    els.resultsList.innerHTML = `<p class="scope-note">没有符合筛选条件的点位。试着清除搜索或打开更多图层。</p>`;
    els.resultsNote.textContent = '0 个匹配';
    return;
  }

  els.resultsNote.textContent = `${state.filteredPlaces.length} 个匹配`;
  els.resultsList.innerHTML = results.map(feature => {
    const p = feature.properties || {};
    const categories = asArray(p.categories).map(categoryLabel).slice(0, 2).join(' / ');
    return `
      <button class="result-card" data-id="${escapeHTML(p.id)}">
        <strong>${escapeHTML(p.name_zh || p.name_en || p.id)}</strong>
        <span>${escapeHTML(p.region_label || '')} · ${escapeHTML(categories)}</span>
      </button>
    `;
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
  return `
    <div class="section-block">
      ${items.map(section => {
        const title = typeof section === 'object' ? section.title : '专题说明';
        const body = typeof section === 'object' ? section.body : section;
        return `
          <div class="note-card">
            <strong>${escapeHTML(title || '专题说明')}</strong>
            <span>${escapeHTML(body || '')}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSidebar(feature, type = 'place') {
  const p = feature.properties || {};
  const categories = new Set(asArray(p.categories));
  if (p.primary_category) categories.add(p.primary_category);

  const sourceIds = asArray(p.source_ids);
  const sourceHtml = sourceIds.length
    ? sourceIds.map(id => {
      const source = state.sources[id] || { title: id, url: '' };
      if (source.url) {
        return `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener">${escapeHTML(source.title || id)}</a>`;
      }
      return `<span>${escapeHTML(source.title || id)}</span>`;
    }).join('')
    : '<span>尚未填写来源。正式发布前必须补齐。</span>';

  const coordinates = getFeatureCenter(feature);
  const coordinateText = coordinates ? `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}` : '路线 / 区域示意';

  const tibetan = p.name_bo ? `<div class="tibetan-name">${escapeHTML(p.name_bo)}</div>` : '';
  const roman = p.romanization ? `<span class="chip">${escapeHTML(p.romanization)}</span>` : '';
  const categoryChips = [...categories].map(key => `
    <span class="chip"><span class="swatch" style="background:${categoryColor(key)}"></span>${escapeHTML(categoryLabel(key))}</span>
  `).join('');

  const craftRow = p.craft_or_practice ? `
    <div><strong>工艺 / 实践</strong><span>${escapeHTML(p.craft_or_practice)}</span></div>
  ` : '';

  const eraRow = p.era ? `<div><strong>时期</strong><span>${escapeHTML(p.era)}</span></div>` : '';

  const reviewRow = p.review_status ? `<div><strong>审校状态</strong><span>${escapeHTML(p.review_status)}</span></div>` : '';

  els.sidebarContent.innerHTML = `
    <p class="eyebrow">${type === 'route' ? 'Story Route' : 'Ethnographic Place'}</p>
    <h2>${escapeHTML(p.name_zh || p.name_en || p.id)}</h2>
    ${tibetan}
    <div class="chips">
      ${roman}
      ${categoryChips}
    </div>
    <p>${escapeHTML(p.summary_short || '')}</p>
    <p>${escapeHTML(p.details || '')}</p>
    ${renderBodySections(p.body_sections)}

    <div class="meta-grid">
      <div><strong>英文 / 转写名</strong><span>${escapeHTML(p.name_en || p.romanization || '—')}</span></div>
      <div><strong>区域</strong><span>${escapeHTML(p.region_label || '—')}</span></div>
      ${craftRow}
      ${eraRow}
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
  if (!features.length) {
    setStatus('没有可定位的结果。');
    return;
  }
  fitFeatures(features);
}

function fitFeature(feature) {
  fitFeatures([feature]);
}

function fitFeatures(features) {
  const coords = features.flatMap(feature => flattenCoordinates(feature.geometry?.coordinates));
  if (!coords.length) return;

  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 7), duration: 900 });
    return;
  }

  const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(bounds, {
    padding: {
      top: 90,
      right: window.innerWidth > 980 ? 500 : 40,
      bottom: 90,
      left: window.innerWidth > 980 ? 430 : 40
    },
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
  setStatus('正在读取 GeoJSON 与来源表…');
  const [places, routes, sourceRefs, categoryConfig] = await Promise.all([
    loadJson(DATA_URL),
    loadJson(ROUTES_URL),
    loadJson(SOURCES_URL),
    loadJson(CATEGORIES_URL)
  ]);

  state.allPlaces = places;
  state.allRoutes = routes;
  state.sources = sourceRefs;
  state.categories = categoryConfig.categories || {};
  state.regions = categoryConfig.regions || {};
  state.activeCategories = new Set(CATEGORY_ORDER.filter(key => state.categories[key]));

  renderControls();
  addDataLayers();
  applyFilters({ fit: true });
}

map.on('load', () => {
  init().catch(showError);
});
