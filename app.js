// City and County of Honolulu
// Department of Emergency Management 
// Water Gauge Dashboard

let SETTINGS = {};
const paramPresets = {
    1: {
        'display-mode': 1,
        'reload-time': 900,
        'user': null,
        'table-columns': 10,
        'table-filter': null,
        'graph-columns': 3,
        'graph-scale': 'w',
        'graph-sites': '',
        'graph-padding': '0p0,0p0'
    },
    2: {
        'display-mode': 2
    },
    3: {
        'display-mode': 3,
        'graph-padding': '0p0,0.1p0.1'
    }
};

const tabLookup = {
    'USGS':   { icon: 'ti ti-building-bank',     tooltip: 'USGS', type: 'source', order: 1 },
    'UHSLC':  { icon: 'ti ti-fish',              tooltip: 'UHSLC', type: 'source', order: 2 },
    'ST':     { icon: 'ti ti-ripple',             tooltip: 'Stream', type: 'type', order: 1 },
    'ST-CA':  { icon: 'ti ti-arrow-wave-right-up',tooltip: 'Canal', type: 'type', order: 2 },
    'ST-DCH': { icon: 'ti ti-line-dashed',        tooltip: 'Ditch', type: 'type', order: 3 },
    'LK':     { icon: 'ti ti-droplet-half-2',     tooltip: 'Lake/Reservoir/Dam', type: 'type', order: 4 },
    'NORTH-SHORE':          { icon: 'ti ti-beach',          tooltip: 'North Shore', type: 'area', order: 1 },
    'KOOLAULOA':            { icon: 'ti ti-mountain',        tooltip: 'Koolauloa', type: 'area', order: 5 },
    'KOOLAUPOKO':           { icon: 'ti ti-trees',           tooltip: 'Koolaupoko', type: 'area', order: 2 },
    'PRIMARY-URBAN-CENTER': { icon: 'ti ti-building-skyscraper', tooltip: 'Primary Urban Center', type: 'area', order: 3 },
    'CENTRAL-OAHU':         { icon: 'ti ti-map-pin',         tooltip: 'Central Oahu', type: 'area', order: 4 },
    'EWA':                  { icon: 'ti ti-sun',             tooltip: 'Ewa', type: 'area', order: 7 },
    'WAIANAE':              { icon: 'ti ti-sunset-2',        tooltip: 'Waianae', type: 'area', order: 6 },
    'increase': { icon: 'ti ti-chevrons-up-right',   tooltip: 'Gauge level increasing', type: 'change', order: 1 },
    'decrease': { icon: 'ti ti-chevrons-down-right', tooltip: 'Gauge level decreasing', type: 'change', order: 2 },
    'minor': { icon: 'ti ti-alert-triangle', tooltip: 'Reached threshold minor', type: 'threshold', order: 1 },
    'moderate': { icon: 'ti ti-alert-triangle', tooltip: 'Reached threshold moderate', type: 'threshold', order: 2 },
    'major': { icon: 'ti ti-alert-triangle', tooltip: 'Reached threshold major', type: 'threshold', order: 3 },
    'action': { icon: 'ti ti-alert-triangle', tooltip: 'Reached threshold action', type: 'threshold', order: 4 },
    'clicked': { icon: 'ti ti-chart-bar', tooltip: 'Gauge graph expanded' },
    'close': { icon: 'ti ti-trash', tooltip: 'Close gauge graph' },
    'expand': { icon: 'ti ti-arrows-maximize', tooltip: 'Expand gauge graph' },
}

const colorToAreaMap = {
    'NORTH-SHORE': '#ea9999',
    'KOOLAULOA': '#a2c4c9',
    'KOOLAUPOKO': '#f9cb9c',
    'PRIMARY-URBAN-CENTER': '#ffe599',
    'CENTRAL-OAHU': '#b6d7a8',
    'EWA': '#d5a6bd',
    'WAIANAE': '#b4a7d6',
}

const thresholdColorMap = {
    'minor': '#ffea00',
    'moderate': '#ffae00',
    'major': '#ee4b2b',
    'action': '#8b0000'
};

const graphOptions = (locationName, chartData, areaColor, min, max, thresholds) => ({
    series: [{ name: locationName, data: chartData }],
    title: {
        text: "TEST",
        align: 'center',
        margin: 10,
        offsetX: 0,
        offsetY: 0,
        floating: false,
        style: {
            fontSize:  '16px',
            color:  '#ffff'
        },
    },
    chart: { type: 'area', zoom: { enabled: false }, toolbar: { show: false } },
    dataLabels: { enabled: false },
    xaxis: {
        type: 'datetime',
        labels: {
            datetimeUTC: false,
            style: { colors: '#ffffff' }
        }
    },
    yaxis: {
        min: min,
        max: max,
        labels: {
            style: { colors: '#ffffff' }
        }
    },
    tooltip: { x: { format: 'dd MMM HH:mm' }, theme: 'dark' },
    colors: areaColor,
    stroke: { curve: 'smooth', colors: areaColor },
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.6,
            opacityTo: 0.1,
            colorStops: [
                { offset: 0, color: areaColor, opacity: 1 },
                { offset: 100, color: areaColor, opacity: 0.8 }
            ]
        }
    },
    annotations: thresholds
});

let ACTIVE_LOCATIONS = {};
let ACTIVE_LOCATIONS_STRING;
let LOCATIONS = {};
let AREAS;

let GAUGE_REGISTRY = [];
let GAUGE_BITMAP = 0n;

const GAUGES = {};
const SEARCH_STRINGS = {};

const DYNAMIC_FILTERS = {
    change: { increase: new Set(), decrease: new Set(), neutral: new Set() },
    threshold: { minor: new Set(), moderate: new Set(), major: new Set(), action: new Set() }
};
const ACTIVE_FILTERS = {
    area: new Set(), type: new Set(), source: new Set(),
    change: new Set(), threshold: new Set(), gauges: new Set()
};
let filterOpened = false;
let filtersActive = false;


let OVERVIEW = [];
const GRAPHS = {};
const FULL_GRAPHS = {};
const BASE_URL = "https://api.oahudem.com/water/";

let detailInitalized = false;
let detailsChart;

let focusedElement;

// let countdownInterval;
// let remainingSeconds = 0;

// // configs
// let CONFIG_VALUES;
// let SETTINGS_CREATED = false;

const overlay = document.getElementById('loading-overlay');
function showLoading() { overlay.classList.add('active');    }
function hideLoading() { overlay.classList.remove('active'); }

// ── DOM refs ──────────────────────────────────────────────
const detailsPopup          = document.getElementById('details-popup');
const searchInput           = document.getElementById('search-input');
const filterContainer       = document.getElementById('filter-expand');
const tableContainer        = document.getElementById('table-container');
const tableTemplate         = document.getElementById('table-card-template');
// const tableHeaderContainer  = document.getElementById('table-header-container');
const graphContainer        = document.getElementById('graph-container');
const graphTemplate         = document.getElementById('graph-card-template');
// const settingsContainer     = document.getElementById('settings-container');
// const settingsTable         = document.getElementById('settings-table-body');
// const sectionTable          = document.getElementById('sectionTable');
// const sectionGraphs         = document.getElementById('sectionGraphs');
// const popupOverlay          = document.getElementById('popupOverlay');

// ── Init ──────────────────────────────────────────────────
async function init() {
    showLoading();
    try {
        SETTINGS = { ...paramPresets[1], ...loadParams(new URLSearchParams(window.location.search)) };
        updateParams();

        ACTIVE_LOCATIONS = await fetchAndWait(BASE_URL + 'get-active-locations?flat=true');
        ACTIVE_LOCATIONS_STRING = Object.entries(ACTIVE_LOCATIONS).reduce((output, [key]) => output ? output + ',' + key : key, '');
        LOCATIONS = await fetchAndWait(BASE_URL + 'get-location-data?locations=' + ACTIVE_LOCATIONS_STRING);
        console.log(LOCATIONS);
        AREAS = Object.values(LOCATIONS).reduce((output, gauge) => {
            const area = gauge.area ?? 'Unknown';
            if (!output[area]) {
                output[area] = [];
            }
            output[area].push(gauge.gauge_id);
            return output;
        }, {});

        GAUGE_REGISTRY = mapGaugeRegistry();
        // GAUGE_BITMAP = CONFIG_VALUES["gauge-graphs"].sites ? decodeBase36ToBigInt(CONFIG_VALUES["gauge-graphs"].sites) : 0n;
        
        await buildGaugeTable(ACTIVE_LOCATIONS_STRING);

        hideLoading();

        createFilter();

        scheduleEvery5Minutes();
    } 
    catch (err) {
        console.error(err);
    }
}

init();

// ── SETUP ─────────────────────────────────────────────────
function decodeBase36ToBigInt(str) {
    return str.split('').reduce((acc, char) => {
        return acc * 36n + BigInt(parseInt(char, 36));
    }, 0n);
}

function mapGaugeRegistry() {
    const maxOrder = Math.max(...Object.values(ACTIVE_LOCATIONS).map(v => v.order));
    const result = new Array(maxOrder + 1).fill(null);

    Object.entries(ACTIVE_LOCATIONS).forEach(([gauge_id, val]) => {
        result[val.order] = gauge_id;
    });

    return result;
}

function readBitMap(map) {
    if (!map) return [];
    const mask = BigInt(map); 

    return GAUGE_REGISTRY.filter((id, index) => {
        if (id === null) return false;
        return (mask & (1n << BigInt(index))) !== 0n;
    });
}

function updateGaugeBit(id, state) {
    const index = GAUGE_REGISTRY.indexOf(id);

    if (index === -1) {
        console.error(`Station ${id} not found in registry.`);
        return;
    }

    const bitPosition = 1n << BigInt(index);
    if (state) {
        GAUGE_BITMAP |= bitPosition;
    } 
    else {
        GAUGE_BITMAP &= ~bitPosition;
    }
}

function loadParams(urlParams) {
    const preset = urlParams.get('preset');

    // if preset exist, ignore rest
    if (preset && preset > 0) {
        return paramPresets[preset];
    }

    const foundParams = {};
    for (const paramKey of Object.keys(paramPresets[1])) {
        const value = urlParams.get(paramKey);
        if (value) {
            foundParams[paramKey] = value;
        }
    }

    return foundParams;
}

function updateParams() {
    const url = new URL(window.location.href);
    url.search = '';

    for (const paramKey of Object.keys(paramPresets[1])) {
        const value = SETTINGS[paramKey];

        // if value is same as default, skip
        if (value == paramPresets[1][paramKey]) {
            continue;
        }

        if (value !== null && value !== undefined) {
            // if the value is BigInt, convert it to Base36 string
            const formattedValue = (typeof value === 'bigint') 
                ? value.toString(36) 
                : value;

            url.searchParams.set(paramKey, formattedValue);
        }
    }

    window.history.replaceState({}, '', url);
}

// ── FETCH ─────────────────────────────────────────────────
async function fetchAndWait(url, body = null) {
    const response = await fetch(url, body ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    } : undefined);

    if (!response.ok) {
        throw new Error(`ERROR status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

function focusElement(name) {
    const elements = document.querySelectorAll('.focus-elements');

    if (focusedElement == name) {
        elements.forEach(el => el.classList.remove('hidden'));
        focusedElement = null;
        return;
    }

    elements.forEach(el => el.classList.add('hidden'));
    focusedElement = name;

    document.querySelector(`#${name}`)?.classList?.remove('hidden');
}

function updateSearchString(location) {
    const gauge = GAUGES[location]?.search;
    const searchString = Object.values(gauge).filter(Boolean)
        .join(',')
        .toLowerCase()
        .replace(/\s+/g, '');

    SEARCH_STRINGS[location] = searchString
}

function search(text) {
    const input = text.toLowerCase().replace(/\s+/g, '');
    Object.entries(SEARCH_STRINGS).forEach(([id, string]) => {
        const visible = !GAUGES[id].hide && (input === '' || string.includes(input));
        // const visible = !(filtersActive && GAUGES[id].hide) && ((input === '' && !filtersActive) || string.includes(input));
        GAUGES[id].data.table?.classList.toggle('d-none', !visible);
        GAUGES[id].data.graph?.classList.toggle('d-none', !visible);
    });
}

function createFilter() {
    const getTypeMap = (type) => {
        return Object.fromEntries(Object.entries(tabLookup)
            .filter(([code, val]) => val.type === type)
            .sort(([, a], [, b]) => a.order - b.order)
            .map(([code, val]) => [code, val.tooltip])
        );
    };

    const areaContainer = filterContainer.querySelector('#filter-area');
    const typeContainer = filterContainer.querySelector('#filter-type');
    const sourceContainer = filterContainer.querySelector('#filter-source');
    const changeContainer = filterContainer.querySelector('#filter-change');
    const thresholdContainer = filterContainer.querySelector('#filter-thresholds');

    const areas = getTypeMap('area');
    const types = getTypeMap('type');
    const sources = getTypeMap('source');

    // static filters
    Object.entries(areas).forEach(([code, area]) => {
        areaContainer.innerHTML += createFilterButton(area, `area-${code}`, 'area', area.toUpperCase());
    });

    Object.entries(types).forEach(([code, desc]) => {
        typeContainer.innerHTML += createFilterButton(desc, `type-${code}`, 'type', code);
    });

    Object.entries(sources).forEach(([code, desc]) => {
        sourceContainer.innerHTML += createFilterButton(desc, `source-${code}`, 'source', code);
    });

    // dynamic filters
    changeContainer.innerHTML += createFilterButton('increase', 'change-increase', 'change', 'increase');
    changeContainer.innerHTML += createFilterButton('decrease', 'change-decrease', 'change', 'decrease');
    changeContainer.innerHTML += createFilterButton('neutral', 'change-neutral', 'change', 'neutral');
    //change.innerHTML = createButton('change', ['increase', 'decrease', 'neutral']);

    thresholdContainer.innerHTML += createFilterButton('minor', 'threshold-minor', 'threshold', 'minor');
    thresholdContainer.innerHTML += createFilterButton('moderate', 'threshold-moderate', 'threshold', 'moderate');
    thresholdContainer.innerHTML += createFilterButton('major', 'threshold-major', 'threshold', 'major');
    thresholdContainer.innerHTML += createFilterButton('action', 'threshold-action', 'threshold', 'action');
}

function clickFilter(type, value) {
    const tag = filterContainer.querySelector(`.table-tag.${type}-${value.replace(/\s+/g, '-')}`);
    
    if (ACTIVE_FILTERS[type].has(value)) {
        ACTIVE_FILTERS[type].delete(value);
        tag.classList.add('inactive');
    } 
    else {
        ACTIVE_FILTERS[type].add(value);
        tag.classList.remove('inactive');
    }
    console.log(ACTIVE_FILTERS)

    filtersActive = Object.values(ACTIVE_FILTERS).some(set => set.size > 0);
    console.log(type)
    console.log(value)
    // console.log(filtersActive);
    // console.log(ACTIVE_FILTERS);
    // console.log(LOCATIONS)

    updateFilters();
}

function resetFilters() {
    Object.values(ACTIVE_FILTERS).forEach(set => set.clear());
    filterContainer.querySelectorAll('.badge.rounded-pill.table-tag').forEach(el => el.classList.add('inactive'));
  
    updateFilters();
}

function saveFilters() {
    filterContainer.classList.toggle('hidden', true);
}

function updateFilters() {
    Object.keys(GAUGES).forEach(id => {
        const info = LOCATIONS[id]; 

        const matchesArea   = ACTIVE_FILTERS.area.size === 0   || ACTIVE_FILTERS.area.has(info.area);
        const matchesType   = ACTIVE_FILTERS.type.size === 0   || ACTIVE_FILTERS.type.has(info.site_type_code);
        const matchesSource = ACTIVE_FILTERS.source.size === 0   || ACTIVE_FILTERS.source.has(info.gauge_type);
        
        const matchesChange = ACTIVE_FILTERS.change.size === 0 || [...ACTIVE_FILTERS.change].some(val => DYNAMIC_FILTERS.change[val]?.has(id));
        const matchesThreshold = ACTIVE_FILTERS.threshold.size === 0 || [...ACTIVE_FILTERS.threshold].some(val => DYNAMIC_FILTERS.threshold[val]?.has(id));
        
        GAUGES[id].hide = !(matchesArea && matchesType && matchesSource && matchesChange && matchesThreshold);
        //console.log(`${id}: match: ${matchesArea} hide: ${GAUGES[id].hide}`);
    });

    search(searchInput.value);
}

// ── TABLE ─────────────────────────────────────────────────
async function buildGaugeTable(locations) {
    // set up placeholder cards for all locations
    Object.entries(AREAS).forEach(([area, locationList]) => {
        const lookupArea = getAreaClassName(area);

        locationList.forEach((location) => {
            const info = LOCATIONS[location];
            const clone = tableTemplate.content.cloneNode(true);

            const card = clone.querySelector('.table-card');
            card.classList.add(`table-${info.gauge_id}`);

            clone.querySelector('.table-click')?.addEventListener('click', () => tableClick(info.gauge_id));
            
            const title = clone.querySelector('.card-title');
            title.innerHTML = `<strong>${info.short_name}</strong>`;
            title.style.color = `var(--color-${lookupArea})`;

            const tags = clone.querySelector('.table-tags');
            // tags.innerHTML = `
            //     ${createTab('area', lookupArea, true)}
            //     ${createTab('type', info.gauge_type, true)}
            //     ${createTab('site', info.site_type_code, true)}
            //`;
            tags.innerHTML = `${createTab('site', info.site_type_code, true)}`

            // add to gauges list
            GAUGES[location] = {
                data: { table: card },
                search: {
                    name: info.full_name,
                    area: area,
                    id: location,
                    type: info.gauge_type,
                    type_code: info.site_type
                },
                hide: false
            };

            tableContainer.appendChild(clone);
        });
    });

    console.log(GAUGES);
    updateGaugeTable(locations);
}

function createTab(type, code, static, func = null, params = null) {
    const staticClass = static ? 'static' : '';
    const hover = func ? 'button-hover-effect' : '';
    const clickEvent = func ? `onclick="${func}('${params}')"` : ''
    const icon = type == 'text' ? code : `<i class="${tabLookup[code]?.icon}"></i>`;
    return `
    <span class="badge rounded-pill table-tag tag-${type} ${type}-${code} ${staticClass} ${hover}"
        data-bs-toggle="tooltip" ${clickEvent}
        title="${tabLookup[code]?.tooltip}">
        ${icon}
    </span>`;
}

function createFilterButton(text, colorClass, type, value) {
    return `
    <span class="badge rounded-pill table-tag button-hover-effect ${colorClass.replace(/\s+/g, '-')} inactive"
        data-bs-toggle="tooltip" onclick="clickFilter('${type}', '${value}')">
        ${text.toUpperCase()}
    </span>`;
}

function getAreaClassName(area) {
    return area.replace(/\s+/g, '-')
}

async function updateGaugeTable(locations) {
    OVERVIEW = await fetchAndWait(BASE_URL + 'get-table-overview?locations=' + locations);
    console.log(OVERVIEW);

    OVERVIEW.forEach((location) => {
        const card = document.querySelector(`.table-${location.gauge_id}`);
        if (card) {
            // value with change
            card.querySelector('.table-value').textContent = location.current_val;

            const changeEl = card.querySelector('.table-change');
            const changePercent = ((location.current_val - location.past_val) / location.past_val).toFixed(2);
            const sign = changePercent > 0 ? '+' : changePercent < 0 ? '-' : '=';
            changeEl.textContent = `(${sign}${Math.abs(changePercent)}%)`;
            changeEl.setAttribute('title', `${location.past_val} (${sign}${Math.abs(location.current_val - location.past_val).toFixed(2)}) at ${formatDateShort(location.past_date)}`);

            const signLookup = { '+': 'increase', '=': 'neutral', '-': 'decrease' }
            const signClass = signLookup[sign];
            const removeClasses = Object.values(signLookup).filter(c => c !== signClass);

            changeEl.classList.remove(...removeClasses);
            changeEl.classList.add(signClass);
            GAUGES[location.gauge_id].search['change'] = signClass;
            //ACTIVE_FILTERS[type].delete(value);

            // DYNAMIC_FILTERS['change']['increase'].delete(location.gauge_id);
            Object.values(DYNAMIC_FILTERS['change']).forEach(set => set.delete(location.gauge_id));
            DYNAMIC_FILTERS['change'][signClass].add(location.gauge_id);

            // date
            const dateEl = card.querySelector('.table-date');
            dateEl.textContent = formatDateShort(location.current_date);
            dateEl.setAttribute('title', `${formatDateLong(location.current_date)}`);

            const currentDate = new Date(location.current_date);
            const today = new Date();
            const isOld = currentDate.toDateString() !== today.toDateString();

            dateEl.classList.toggle('old', isOld);

            // update thresholds
            const cardBody = card.querySelector('.card-body');
            const thresholdEl = card.querySelector('.table-threshold');
            const { text, hits, display } = tableDisplayThreshold(location);
            thresholdEl.textContent = text;
            thresholdEl.classList.remove('minor', 'major', 'action');
            if (display) thresholdEl.classList.add(display);
            hits.forEach((threshold) => {
                cardBody.classList.add(threshold);
            });
            GAUGES[location.gauge_id].search['thresholds'] = hits.join(',');

            // update tags 
            const tagsEl = card.querySelector('.table-tags');
            const changeTag = tagsEl.querySelector('.tag-change');
            if (changeTag) changeTag.remove();
            if (sign != '=') tagsEl.innerHTML += createTab('change', signClass, false);

            const thresholdTags = tagsEl.querySelector('.tag-threshold');
            if (thresholdTags) thresholdTags.remove();
            hits.forEach((threshold) => {
                tagsEl.innerHTML += createTab('threshold', threshold, false);
            });
            
            updateSearchString(location.gauge_id);
        }
    });
}

function formatDateShort(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateLong(dateString) {
    if (dateString) {
        const date = new Date(dateString);
        const datePart = date.toLocaleDateString('en-US');
        const timePart = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${datePart}, ${timePart}`;
    }

    return 'N/A';
}

async function tableClick(location, visible = null) {
    if (visible) {
        return;
    }
    const card = document.querySelector(`.table-${location}`);
    const tagsEl = card.querySelector('.table-tags');
    const clickTag = tagsEl.querySelector('.tag-clicked');

    if (clickTag) {
        GAUGES[location].search['expanded'] = null;
        hideGraph(location);
    }
    else {
        GAUGES[location].search['expanded'] = 'expanded';
        tagsEl.innerHTML += createTab('clicked', 'clicked', false);

        await createGraph(location);
    }
    updateSearchString(location);
    fetchFullGraphData(location);
}

async function fetchFullGraphData(location) {
    const info = LOCATIONS[location];
    const cached = FULL_GRAPHS[location];
    if (!cached) {
        const data = await fetchAndWait(BASE_URL + 'get-graph-data?time=365&gauge_id=' + location);
        const { data: formatted, min, max, padding } = formatGraphData(data[location], 24 * 365);

        if (!detailInitalized) {
            detailInitalized = true;
            const chartDiv = detailsPopup.querySelector(`.popup-chart`);
            const newChart = new ApexCharts(chartDiv, graphOptions(info.full_name, formatted, colorToAreaMap[info.area]), min + padding, max + padding, {});
            newChart.render();
            detailsChart = newChart;
        }
        FULL_GRAPHS[location] = { formatted, min, max, padding };
    }
    console.log(`Fetched graph data for ${location} with ${FULL_GRAPHS[location].formatted.length} items`)
}

async function createGraph(location) {
    showLoading();
    const cached = GRAPHS[location];

    if (!cached) {
        const info = LOCATIONS[location];
        const data = await fetchAndWait(BASE_URL + 'get-graph-data?time=7&gauge_id=' + location);
        const { data: formatted, min, max, padding } = formatGraphData(data[location], 24 * 7);
        const areaName = getAreaClassName(info.area);
        const isDamn = info.site_type_code == 'LK';
        const thresholds = getThresholdValues(info.thresholds);
        console.log(thresholds.annotations);

        const clone = graphTemplate.content.cloneNode(true);

        const card = clone.querySelector('.graph-card');
        card.classList.add(`graph-${info.gauge_id}`);

        const title = clone.querySelector('.card-title');
        title.innerHTML = `<strong>${info.full_name}</strong>`;
        title.style.color = `var(--color-${areaName})`;

        clone.querySelector('.card-buttons').innerHTML = `
            ${createTab('expand', 'expand', false, 'expandGraph', location)}
            ${createTab('close', 'close', false, 'hideGraph', location)}
        `;

        // body chart
        clone.querySelector('.card-chart').classList.add(`chart-${info.gauge_id}`);

        // footer items
        clone.querySelector('.footer-scale').innerHTML = `
            <span>Time Scale:</span>
            ${createTab('text', 'H', false, 'updateTimeScale', location + ',1')}
            ${createTab('text', 'D', false, 'updateTimeScale', location + ',24')}
            ${createTab('text', 'W', false, 'updateTimeScale', location + ',168')}
            ${createTab('text', 'M', false, 'updateTimeScale', location + ',672')}
        `;

        // thresholds
        clone.querySelector('.footer-threshold.minor').textContent = `${thresholds.minor}`;
        clone.querySelector('.footer-threshold.moderate').textContent = `${thresholds.moderate}`;
        clone.querySelector('.footer-threshold.major').textContent = `${thresholds.major}`;
        clone.querySelector('.footer-threshold.action').textContent = `${thresholds.action}`;
        if (isDamn) {
            clone.querySelector('.title-minor').textContent = 'High-Flow:';
            clone.querySelector('.title-moderate').textContent = 'Emergency:';
            clone.querySelector('.title-major').textContent = 'Imminent:';
            clone.querySelector('.title-action').textContent = 'Top of Dam:';
        }

        GAUGES[location].data.graph = card;
        graphContainer.appendChild(clone);

        const chartDiv = document.querySelector(`.chart-${location}`);

        const newChart = new ApexCharts(chartDiv, graphOptions(info.full_name, formatted, colorToAreaMap[areaName], Math.floor(min - padding), Math.ceil(max + padding), thresholds.annotations));
        newChart.render();
        
        GRAPHS[location] = {
            fullData: data[location],
            time: Date.now(),
            timeScale: 24*7,
            chartInstance: newChart,
            annotations: thresholds.annotations
        };

        updateGraph(location, false)
    }
    else {
        const graphCard = document.querySelector(`.graph-card.graph-${location}`);
        const isStale = cached && (Date.now() - cached.time) > 5 * 60 * 1000;

        graphCard.classList.remove('hidden');

        if (isStale) {
            updateGraph(location, true);
        }
    }

    hideLoading(location);
}

async function hideGraph(location) {
    const graphCard = document.querySelector(`.graph-card.graph-${location}`);
    const tableCard = document.querySelector(`.table-${location}`);
    const tagsEl = tableCard.querySelector('.table-tags');
    const clickTag = tagsEl.querySelector('.tag-clicked');

    graphCard.classList.add('hidden');
    clickTag.remove();
}

function updateTimeScale(params) {
    const split = params.split(',');
    const location = split[0];
    const hours = parseInt(split[1]);

    GRAPHS[location].timeScale = hours;
    updateGraph(location, false);
}

async function updateGraph(location, reload) {
    if (reload) {
        const data = await fetchAndWait(BASE_URL + 'get-graph-data?time=30&gauge_id=' + location);
        GRAPHS[location].fullData = data[location];
        GRAPHS[location].time = Date.now();
        // GRAPHS[location] = {
        //     fullData: data[location],
        //     time: Date.now()
        // };
    }

    // update chart
    //console.log(GRAPHS[location])
    const { data: formatted, min, max, padding } = formatGraphData(GRAPHS[location].fullData, GRAPHS[location].timeScale);
    //console.log(formatGraphData(GRAPHS[location].fullData, GRAPHS[location].timeScale));
    GRAPHS[location].chartInstance.updateOptions({
        series: [{ data: formatted }],
        yaxis: {
            min: Math.floor(min - padding),
            max: Math.ceil(max + padding),
            labels: {
                style: { colors: '#ffffff' }
            }
        },
        title: {
            text: `${formatDateLong(formatted[formatted.length - 1].x)} - ${formatDateLong(formatted[0].x)}`
        }
    });

    // update footer
    const graphCard = document.querySelector(`.graph-card.graph-${location}`);
    const latest = graphCard.querySelector('.footer-latest');
    const change = graphCard.querySelector('.footer-change');
    const time = graphCard.querySelector('.footer-time');
    const overview = OVERVIEW.find(item => item.gauge_id === location);
    const changePercent = ((overview.current_val - overview.past_val) / overview.past_val).toFixed(2);
    const sign = changePercent > 0 ? '+' : changePercent < 0 ? '-' : '';
    const signLookup = { '+': 'increase', '': 'neutral', '-': 'decrease' }
    change.classList.remove('increase', 'decrease', 'neutral');
    change.classList.add(signLookup[sign]);
    latest.textContent = `${formatted[0].y.toFixed(2) ?? '??'}`;
    change.textContent = `(${sign}${Math.abs(overview.current_val - overview.past_val).toFixed(2)} ${sign}${Math.abs(changePercent)}%)`;
    time.textContent = `${formatDateShort(formatted[0].x)}`;
}

function formatGraphData(data, range) {
    const cutoff = new Date(Date.now() - range * 60 * 60 * 1000);
    const filtered = data
        .filter(reading => new Date(reading.reading_datetime) >= cutoff)
        .sort((a, b) => new Date(b.reading_datetime) - new Date(a.reading_datetime))
        .map(reading => ({
            x: reading.reading_datetime,
            y: parseFloat(reading.val)
        }))
        .filter(reading => !isNaN(reading.y));

    const vals = filtered.map(r => r.y);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = (max - min) * 0.1;

    return { data: filtered, min, max, padding };
}

function getThresholdValues(thresholds) {
    const yaxis = [];
    //thresholdColorMap
    const createAnnotation = (value, level) => {
        return {
            y: value,
            id: `threshold-line-${level}`,
            borderColor: thresholdColorMap[level],
            strokeDashArray: 0,
            label: { text: `${level.charAt(0).toUpperCase() + level.slice(1)}`, position: 'left' }
        }
    };

    let minor, moderate, major, action;
    minor = moderate = major = action = 'N/A';

    if (thresholds?.minor) {
        minor = thresholds.minor;
        yaxis.push(createAnnotation(minor, 'minor'));
    }

    if (thresholds?.moderate) {
        moderate = thresholds.moderate;
        yaxis.push(createAnnotation(moderate, 'moderate'));
    }

    if (thresholds?.major) {
        major = thresholds.major;
        yaxis.push(createAnnotation(major, 'major'));
    }

    if (thresholds?.action) {
        action = thresholds.action;
        yaxis.push(createAnnotation(action, 'action'));
    }
    const annotations = { yaxis };

    return { minor, moderate, major, action, annotations};
}

function tableDisplayThreshold(overview) {
    const locationItem = LOCATIONS[overview.gauge_id];
    if (!locationItem?.thresholds || (!locationItem?.thresholds?.minor && !locationItem?.thresholds?.major && !locationItem?.thresholds?.action)) {
        return { text: 'N/A', hits: [], display: '' };
    }

    const thresholds = locationItem.thresholds;
    const val = parseFloat(overview.current_val);
    const hits = [];
    let display = '';

    // determine which thresholds are hit
    const minorHit = thresholds.minor != null && val >= thresholds.minor;
    const majorHit = thresholds.major != null && val >= thresholds.major;
    const actionHit = thresholds.action != null && val >= thresholds.action;

    if (minorHit) hits.push('minor');
    if (majorHit) hits.push('major');
    if (actionHit) hits.push('action');

    if (thresholds.minor) display = 'minor';
    if (thresholds.major && val >= thresholds.minor) display = 'major';
    if (thresholds.action && val >= thresholds.major) display = 'action';

    return { text: `${thresholds[display]}ft`, hits, display};
}

function expandGraph(location) {
    const item = LOCATIONS[location];
    const overview = OVERVIEW.find(item => item.gauge_id === location);
    const areaColor = colorToAreaMap[getAreaClassName(item.area)];
    
    // set details
    const title = detailsPopup.querySelector(`.popup-title`);
    title.textContent = item.full_name;
    title.style.color = `var(--color-${getAreaClassName(item.area)})`;
    
    const graphData = FULL_GRAPHS[location];
    console.log(graphData)
    detailsChart.updateOptions({
        series: [{ data: graphData.formatted }],
        chart: { 
            height: 300,
            zoom: {
                enabled: true,
                type: 'x',
                autoScaleYaxis: true
            }
        },
        yaxis: {
            min: Math.floor(graphData.min - graphData.padding),
            max: Math.ceil(graphData.max + graphData.padding),
            labels: {
                style: { colors: '#ffffff' }
            }
        },
        title: {
            text: `${formatDateLong(graphData.formatted[graphData.formatted.length - 1].x)} - ${formatDateLong(graphData.formatted[0].x)}`
        },
        colors: areaColor,
        stroke: { curve: 'smooth', colors: areaColor },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                colorStops: [
                    { offset: 0, color: areaColor, opacity: 1 },
                    { offset: 100, color: areaColor, opacity: 0.8 }
                ]
            }
        },
    });

    console.log(overview)
    detailsPopup.querySelector('.popup-latest').textContent = `${overview.current_val.toFixed(2)} ft`;

    detailsPopup.querySelector('.popup-high').textContent = `${graphData.max.toFixed(2)} ft`;
    detailsPopup.querySelector('.popup-low').textContent = `${graphData.min.toFixed(2)} ft`;

    const thresholds = getThresholdValues(item.thresholds);
    detailsPopup.querySelector('.popup-minor').textContent = `${thresholds.minor}`;
    detailsPopup.querySelector('.popup-moderate').textContent = `${thresholds.moderate}`;
    detailsPopup.querySelector('.popup-major').textContent = `${thresholds.major}`;
    detailsPopup.querySelector('.popup-action').textContent = `${thresholds.action}`;

    document.body.style.overflow = 'hidden';
    detailsPopup.classList.remove('hidden');
}

function closeExpand() {
    document.body.style.overflow = '';
    detailsPopup.classList.add('hidden');
}


function scheduleEvery5Minutes() {
    const now = new Date();

    // Milliseconds until the next 5-minute mark
    const msUntilNext =
        (5 - (now.getMinutes() % 5)) * 60 * 1000 -
        now.getSeconds() * 1000 -
        now.getMilliseconds();

    setTimeout(() => {
        reloadData();
        setInterval(reloadData, 5 * 60 * 1000);
    }, msUntilNext);
}

async function reloadData() {
    console.log(`Data reloaded at ${new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', dateStyle: 'full', timeStyle: 'long' }).format(new Date())}`);
    updateGaugeTable(ACTIVE_LOCATIONS);

    Object.entries(GRAPHS).forEach(([id, graphData]) => {
        // console.log(id);
        // console.log(graphData);
        updateGraph(id, true);
    })
}

// function getCurrentThreshold(value, thresholdsObject) {
//     if(!value) {
//         return null
//     }

//     const { base, minor, major, action } = thresholdsObject;

//     const isNear = (threshold) => {
//         if (threshold == null) return false;
//         return value >= (threshold - ((threshold - base) * 0.1));
//     };

//     if (isNear(action)) return 'action';
//     if (isNear(major)) return 'major';
//     if (isNear(minor)) return 'minor';

//     return null;
// }

// function getDisplayThreshold(value, thresholdsObject) {
//     if(!value) {
//         return null
//     }

//     const { base, minor, major, action } = thresholdsObject;

//     if (minor != null && value < minor) return 'minor';
//     else if (major != null && value < major) return 'major';
//     else if (action != null && value < action) return 'action';

//     return null;
// }

// async function getThresholdObject(id) {
//     const locationItem = LOCATIONS[id];
//     const historicItem = await getHistoricItem(id);
//     const monthlyItems = getHistoricMonth(historicItem);
//     const thresholds = getThresholdGraph(id, locationItem.properties.thresholds, monthlyItems);
//     return thresholds;
// }

// async function createChartFooter(thresholds, id, data) {
//     const checkValue = (input) => input ?? '??';

//     const historicItem = await getHistoricItem(id);
//     const currentMonth = getHistoricMonth(historicItem)?.[0] ?? null;;

//     const chartFooter = document.createElement('div');
//     chartFooter.classList.add(`chart-footer-${id}`);

//     let average = checkValue(thresholds.base);    // default to old data

//     const { date, value, color, diff } = calcDataChange(data);

//     if (currentMonth) {
//         average = currentMonth.average.toFixed(2);
//     }

//     chartFooter.innerHTML = `
//         <div style="display: flex; justify-content: space-between;">
//             <span style="color: ${getWarningColor('base')}">Base: ${average}ft</span>
//             <span style="color: ${getWarningColor('minor')}">Minor: ${checkValue(thresholds.minor)}ft</span>
//             <span style="color: ${getWarningColor('major')}">Major: ${checkValue(thresholds.major)}ft</span>
//             <span style="color: ${getWarningColor('action')}">Failure: ${checkValue(thresholds.action)}ft</span>
//         </div>
//         <div style="display: flex; gap: 8px;">
//             <span style="color: #FFFFFF">Last Update: ${date} - </span>
//             <span style="color: ${getWarningColor(getCurrentThreshold(value, thresholds))} ">${value}ft</span>
//             <span style="color: ${color} ">(${diff}%)</span>
//         </div> 
//     `;
//     return chartFooter;
// }

// function createSettings() {
//     SETTINGS_CREATED = true;
//     //settingsTable

//     // display mode
//     const isDisplayMode = (val) => {
//         return CONFIG_VALUES["display-mode"] == val ? 'checked' : '';
//     }
//     settingsTable.appendChild(createDetailsTableRow("Display Mode", 
//         `<span style="display:flex; justify-content:space-between; width:100%;">
//             <label><input type="radio" name="display-mode-input" value="1" ${isDisplayMode(1)}>Standard</label>
//             <label><input type="radio" name="display-mode-input" value="2" ${isDisplayMode(2)}>Table View</label>
//             <label><input type="radio" name="display-mode-input" value="3" ${isDisplayMode(3)}>Graph View</label>
//         </span>`
//     ));

//     // reload time
//     settingsTable.appendChild(createDetailsTableRow("Reload Time (minutes)", `<input type="number" id="reload-time-input" value="${(CONFIG_VALUES["reload-time"]/60)}" min="5" max="60">`));

//     // user
//     settingsTable.appendChild(createDetailsTableRow("Current User", `<input type="text" id="current-user-input" value="${CONFIG_VALUES["user"]}">`));
    
//     // table columns
//     settingsTable.appendChild(createDetailsTableRow("Overview Table Columns", `<input type="number" id="table-columns-input" value="${CONFIG_VALUES["gauge-tables"].columns}" min="1" max="60">`));
    
//     // graph columns
//     settingsTable.appendChild(createDetailsTableRow("Gauge Graph Columns", `<input type="number" id="graph-columns-input" value="${CONFIG_VALUES["gauge-graphs"].columns}" min="1" max="10">`));

//     // graph scale
//     const isGraphScale = (val) => {
//         return CONFIG_VALUES["gauge-graphs"]["default-scale"] == val ? 'checked' : '';
//     }
//     settingsTable.appendChild(createDetailsTableRow("Gauge Graph Timescale", 
//         `<span style="display:flex; justify-content:space-between; width:100%;">
//             <label><input type="radio" name="graph-scale-input" value="h" ${isGraphScale('h')}>Last Hour</label>
//             <label><input type="radio" name="graph-scale-input" value="d" ${isGraphScale('d')}>Last Day</label>
//             <label><input type="radio" name="graph-scale-input" value="w" ${isGraphScale('w')}>Last Week</label>
//         </span>`
//     ));

//     // graph padding
//     const [percent, add] = CONFIG_VALUES["gauge-graphs"]["axis-padding"].split('p').map(Number);
//     settingsTable.appendChild(createDetailsTableRow("Gauge Graph y-axis Padding (% , +)", 
//         `<span style="display:flex; justify-content:space-between; width:100%;">
//             <input type="number" id="graph-padding-per-input" value="${percent}" min="0" step="0.1">
//             <input type="number" id="graph-padding-add-input" value="${add}" min="0" step="0.1">
//         </span>`
//     ));

//     // graph padding enabled
//     const [below, above] = CONFIG_VALUES["gauge-graphs"]["axis-padding-enabled"].split('p').map(Number);
//     settingsTable.appendChild(createDetailsTableRow("Gauge Graph Padding Enabled (below , above)", 
//         `<span style="display:flex; justify-content:space-between; width:100%;">
//             <label>Below<input type="checkbox" id="graph-padding-below-input" ${below ? 'checked' : ''}></label>
//             <label>Above<input type="checkbox" id="graph-padding-above-input" ${above ? 'checked' : ''}></label>
//         </span>`
//     ));

//     //'graph-padding-enabled': ['gauge-graphs', 'axis-padding-enabled']
//     const div = document.querySelector('.details-table-container.settings');
//     div.innerHTML += `
//     <div style="display:flex; justify-content:flex-end;">
//         <button onclick="updateSettings()">Update</button>
//     </div>`
// }

// function updateSettings() {
//     const displayMode = document.querySelector('input[name="display-mode-input"]:checked')?.value;
//     const reloadTime = document.getElementById('reload-time-input').value;
//     const user = document.getElementById('current-user-input').value;
//     const tableColumns = document.getElementById('table-columns-input').value;
//     const graphColumns = document.getElementById('graph-columns-input').value;
//     const graphScale = document.querySelector('input[name="graph-scale-input"]:checked')?.value;
//     const paddingPercent = document.getElementById('graph-padding-per-input').value;
//     const paddingAdd = document.getElementById('graph-padding-add-input').value;
//     const paddingBelow = document.getElementById('graph-padding-below-input').checked;
//     const paddingAbove = document.getElementById('graph-padding-above-input').checked;

//     const checkValid = (val, source) => { return (val && val != source) };
//     const printUpdate = (title, val) => {
//         console.log(`⚙️ Settings Updated: ${title} - ${val} at [${rawConvertDate(new Date().toISOString())}]`)
//     }

//     let updateTimeScale = false;

//     if (checkValid(displayMode, CONFIG_VALUES["display-mode"])) {
//         CONFIG_VALUES["display-mode"] = displayMode;
//         updateDisplayMode(displayMode);

//         printUpdate("display-mode", displayMode);
//     }

//     if (checkValid(reloadTime * 60, CONFIG_VALUES["reload-time"])) {
//         CONFIG_VALUES["reload-time"] = reloadTime * 60;
//         //updateDisplayMode(displayMode);

//         printUpdate("reload-time", reloadTime);
//     }

//     if (checkValid(user, CONFIG_VALUES["user"])) {
//         CONFIG_VALUES["user"] = user;

//         printUpdate("user", user);
//     }

//     if (checkValid(tableColumns, CONFIG_VALUES["gauge-tables"]["columns"])) {
//         CONFIG_VALUES["gauge-tables"]["columns"] = tableColumns;
//         document.getElementById('table-container').style.gridTemplateColumns = `repeat(${tableColumns}, 1fr)`;

//         printUpdate('["gauge-tables"]["columns"]', tableColumns);
//     }

//     if (checkValid(graphColumns, CONFIG_VALUES["gauge-graphs"]["columns"])) {
//         CONFIG_VALUES["gauge-graphs"]["columns"] = graphColumns;
//         document.getElementById('graph-container').style.gridTemplateColumns = `repeat(${graphColumns}, 1fr)`;

//         printUpdate('["gauge-graphs"]["columns"]', graphColumns);
//     }

//     if (checkValid(graphScale, CONFIG_VALUES["gauge-graphs"]["default-scale"])) {
//         CONFIG_VALUES["gauge-graphs"]["default-scale"] = graphScale;
//         updateTimeScale = true;

//         printUpdate(`["gauge-graphs"]["default-scale"]`, graphScale);
//     }

//     const padding = `${paddingPercent}p${paddingAdd}`;
//     if (checkValid(padding, CONFIG_VALUES["gauge-graphs"]["axis-padding"])) {
//         CONFIG_VALUES["gauge-graphs"]["axis-padding"] = padding;
//         updateTimeScale = true;

//         printUpdate('["gauge-graphs"]["axis-padding"]', padding);
//     }

//     const paddingEnabled = `${Number(paddingBelow)}p${Number(paddingAbove)}`;
//     if (checkValid(paddingEnabled, CONFIG_VALUES["gauge-graphs"]["axis-padding-enabled"])) {
//         CONFIG_VALUES["gauge-graphs"]["axis-padding-enabled"] = paddingEnabled;
//         updateTimeScale = true;

//         printUpdate('["gauge-graphs"]["axis-padding-enabled"]', paddingEnabled);
//     }

//     if (updateTimeScale) {
//         charts.forEach(chart => {
//             const site = AREAS
//                 .flatMap(area => area.Sites)
//                 .find(s => s.id === chart.id);
            
//             updateGraphTimeScale(site); 
//         });
//     }

//     updateParams();
//     const button = document.getElementById('settings-button');
//     toggleSettings(button);
// }

// function createDetailsTableRow(title, value, color = null) {
//     const tr = document.createElement('tr');
    
//     const tdTitle = document.createElement('td');
//     tdTitle.className = 'table-title';
//     tdTitle.textContent = title;
//     tr.appendChild(tdTitle);
    
//     const tdValue = document.createElement('td');
//     tdValue.innerHTML = value;
//     tdValue.className = 'table-value';
    
//     if (color) {
//         tdValue.style.color = row.color;
//     }
//     tr.appendChild(tdValue);

//     return tr;
// };

// function updateDisplayMode(mode) {
//     switch(parseInt(mode)) {
//         case 1:
//             sectionTable.classList.remove('hidden');
//             sectionGraphs.classList.remove('hidden');
//             break;
//         case 2:
//             sectionTable.classList.remove('hidden');
//             sectionGraphs.classList.add('hidden');
//             break;
//         case 3:
//             sectionTable.classList.add('hidden');
//             sectionGraphs.classList.remove('hidden');
//             break;
//     }
// }

// // open popup
// async function graphClick(site, event) {
//     popupOverlay.style.display = "flex";
//     document.body.style.overflow = 'hidden';

//     const locationItem = LOCATIONS[site.id];
//     const veociItem = VEOCI_NOTES.find(obj => obj.SiteID === site.id.replace("USGS-", ""));
//     const siteColor = getSiteArea(site).Color;

//     const headerText = popupOverlay.querySelector('.popup-header-text');
//     headerText.textContent = locationItem.properties.monitoring_location_name;
//     headerText.style.color = siteColor;

//     const body = popupOverlay.querySelector('.popup-body');
//     body.innerHTML = '';

//     const nwsNotes = veociItem?.["NWS Notes"];
//     const eocNotes = veociItem?.["EOC Procedures"] ?? null;

//     // map of location
//     const mapDiv = document.createElement('div');
//     mapDiv.style.height = '400px';
//     mapDiv.innerHTML = `
//         <iframe
//             width="100%"
//             height="100%"
//             style="border:0; border-radius: 8px;"
//             loading="lazy"
//             allowfullscreen
//             src="https://www.google.com/maps?q=${locationItem.geometry.coordinates[1]},${locationItem.geometry.coordinates[0]}&t=h&output=embed">
//         </iframe>
//     `;
//     body.appendChild(mapDiv);
//     body.appendChild(document.createElement('br'));

//     if (locationItem?.dam?.link) {
//         const linkDiv = document.createElement('div');
//         const graphLink = document.createElement('a');
//         graphLink.href = locationItem.dam.link;
//         graphLink.textContent = 'DLNR Dam Information Link';
//         graphLink.target = '_blank';

//         linkDiv.appendChild(graphLink);
//         body.appendChild(linkDiv);
//         body.appendChild(document.createElement('br'));
//     }

//     const nwsDiv = createPopupEntry("National Weather Service Notes", nwsNotes, siteColor);
//     if (nwsDiv) {
//         body.appendChild(nwsDiv);
//         body.appendChild(document.createElement('br'));
//     }

//     if (CONFIG_VALUES.user == "dem") {
//         const eocDiv = createPopupEntry("Department of Emergency Management Notes", eocNotes, siteColor);
//         if (eocDiv) {
//             body.appendChild(eocDiv);
//             body.appendChild(document.createElement('br'));
//         }
//     }

//     const tableDiv = document.createElement('div');
//     tableDiv.className = 'tables-wrapper';
//     const chart = charts.find(obj => obj.id === site.id);
//     const currentItem = chart.fullData[chart.fullData.length - 1];
//     const currentDisplayThreshold = getCurrentThreshold(currentItem.value, locationItem);
//     const textColor = getWarningColor(currentDisplayThreshold);

//     const historicItem = await getHistoricItem(site.id);
//     const currentMonth = getHistoricMonth(historicItem)?.[0] ?? null;;
//     const previousYear = getHistoricYear(historicItem);

//     // tables
//     tableDiv.appendChild(createDetailsTable("Current", [
//         {"title": "Current", "value": `${parseFloat(currentItem.value).toFixed(2)} ft`, "color": textColor},
//         {"title": "Last Update", "value": `${formatDateTime(currentItem.time)}`, "color": "#b9b9b9"},
//         {"title": "Minor Threshold", "value": `${locationItem.properties.thresholds.minor} ft`, "color": getWarningColor('minor')},
//         {"title": "Major Threshold", "value": `${locationItem.properties.thresholds.major} ft`, "color": getWarningColor('major')},
//         {"title": "Action Threshold", "value": `${locationItem.properties.thresholds.action} ft`, "color": getWarningColor('action')}
//     ]));

//     if (currentMonth) {
//         tableDiv.appendChild(createDetailsTable(`Historic Month (${printMonth(currentMonth.month)} ${previousYear.year})`, [
//             {"title": "Average", "value": `${currentMonth.average.toFixed(2)} ft`},
//             {"title": "Max", "value": `${currentMonth.max.toFixed(2)} ft`, "color": getCurrentThreshold(currentMonth.max, locationItem)},
//             {"title": "Min", "value": `${currentMonth.min.toFixed(2)} ft`},
//             {"title": "Max date", "value": `${formatDateTime(currentMonth.max_timestamp)}`, "color": "#b9b9b9"},
//             {"title": "Min date", "value": `${formatDateTime(currentMonth.min_timestamp)}`, "color": "#b9b9b9"}
//         ]));
//     }

//     if (previousYear) {
//         tableDiv.appendChild(createDetailsTable(`Historic Year (${previousYear.year})`, [
//             {"title": "Average", "value": `${previousYear.yearly_average.toFixed(2)} ft`, "color": textColor},
//             {"title": "Max", "value": `${previousYear.overall_max.toFixed(2)} ft`},
//             {"title": "Min", "value": `${previousYear.overall_min.toFixed(2)} ft`},
//             {"title": "Highest average", "value": `${printMonth(previousYear.overall_max_month)}`, "color": "#b9b9b9"},
//             {"title": "Lowest average", "value": `${printMonth(previousYear.overall_min_month)}`, "color": "#b9b9b9"}
//         ]));
//     }

//     body.appendChild(tableDiv);
// }

// function createPopupEntry(headerText, bodyText, color) {
//     if (!bodyText || bodyText == "") {
//         return null;
//     }
    
//     const container = document.createElement('div');
//     const header = document.createElement('div');
//     const body = document.createElement('div');

//     header.textContent = headerText;
//     header.fontWeight = "bold";
//     header.style.color = color;
//     body.textContent = bodyText;

//     container.appendChild(header);
//     container.appendChild(body);
//     return container;
// }

// function getSiteArea(site) {
//     const area = AREAS.find(area => 
//         area.Sites.some(s => s.id === site.id)
//     );
//     return area;
// }

// function printMonth(dateString) {
//     const [year, month] = dateString.split('-');
//     const date = new Date(year, month - 1); // month is 0-indexed
//     return date.toLocaleString('default', { month: 'long' });
// }

// function formatDateTime(dateString) {
//     const date = new Date(dateString);
//     return date.toLocaleString('en-US', { 
//         month: 'short',
//         day: '2-digit',
//         year: 'numeric',
//         hour: '2-digit',
//         minute: '2-digit',
//         second: '2-digit',
//         hour12: false
//     }).replace(/,/g, '');
// }

// function createDetailsTable(header, rows) {
//     const tableContainer = document.createElement('div');
//     tableContainer.className = 'details-table-container';
    
//     const headerDiv = document.createElement('div');
//     headerDiv.className = 'table-header';
//     headerDiv.textContent = header;
//     tableContainer.appendChild(headerDiv);
    
//     const table = document.createElement('table');
//     table.className = 'details-table';
    
//     rows.forEach(row => {
//         const tr = document.createElement('tr');
        
//         const tdTitle = document.createElement('td');
//         tdTitle.className = 'table-title';
//         tdTitle.textContent = row.title;
//         tr.appendChild(tdTitle);
        
//         const tdValue = document.createElement('td');
//         tdValue.className = 'table-value';
//         tdValue.textContent = row.value;
        
//         if (row.color) {
//             tdValue.style.color = row.color;
//         }
        
//         tr.appendChild(tdValue);
//         table.appendChild(tr);
//     });
    
//     tableContainer.appendChild(table);
//     return tableContainer;
// }

// function popupClose() {
//     popupOverlay.style.display = "none";
//     document.body.style.overflow = 'auto';
// }

// // update timer
// function startCountdown(seconds, stopReload = false) {
//     clearInterval(countdownInterval);
//     remainingSeconds = seconds;

//     updateDisplay(stopReload);

//     countdownInterval = setInterval(() => {
//         remainingSeconds--;

//         if (remainingSeconds <= 0) {
//             startCountdown(CONFIG_VALUES["reload-time"]);
//         }
//     }, 1000);
// }

// // Update timer display
// function updateDisplay(stopReload) {
//     const lastUpdate = document.getElementById('last-update');
//     lastUpdate.textContent = `Last Refresh: ${rawConvertDate(new Date().toISOString()).split(', ')[1]}`;

//     if (stopReload) {
//         return;
//     }

//     console.log(`⏱️ Timer end starting refresh at [${rawConvertDate(new Date().toISOString())}]`);
//     reloadGaugeTable();

//     charts.forEach(chart => {
//         const site = AREAS
//             .flatMap(area => area.Sites)
//             .find(s => s.id === chart.id);
        
//         reloadGaugeGraph(site);
//     });
// }