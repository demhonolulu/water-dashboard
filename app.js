// City and County of Honolulu
// Department of Emergency Management 
// Water Gauge Dashboard

const params    = new URLSearchParams(window.location.search);
const preset    = params.get('preset');
const paramMappings = {
    'display-mode': ['display-mode'],
    'reload-time': ['reload-time'],
    'user': ['user'],
    'table-columns': ['gauge-tables', 'columns'],
    'graph-columns': ['gauge-graphs', 'columns'],
    'graph-scale': ['gauge-graphs', 'default-scale'],
    'graph-sites': ['gauge-graphs', 'sites']
};

// stream and dam location data
let LOCATIONS = {};
let VEOCI_NOTES = {};
let AREAS = [];
let HISTORIC = [];
let GAUGE_REGISTRY = [];
let GAUGE_BITMAP = 0n;

// dont look
let API_KEY = 'bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1';
let AWS_ERROR = false;

let graphCount = 0;
let charts = [];

let USGS_OVERVIEW = [];

const GAUGE_IDS          = "USGS-213320158061401,USGS-213308158035601,USGS-213133158014201,USGS-16345000,USGS-16330000,USGS-16325000,USGS-16210500,USGS-16304200,USGS-16301050,USGS-16296500,USGS-16294900,USGS-16294100,USGS-16284200,USGS-16283200,USGS-16279200,USGS-16275000,USGS-16274100,USGS-16265000,USGS-16264600,USGS-16254000,USGS-16249000,USGS-16247100,USGS-16244000,USGS-16241600,USGS-16240500,USGS-16238500,USGS-16238000,USGS-16229000,USGS-16227500,USGS-16226700,USGS-16226400,USGS-16226200,USGS-16247150,USGS-16213000,USGS-16212601,USGS-16210200,USGS-16210100,USGS-16210000,USGS-16208400,USGS-16208000,USGS-16206600,USGS-16200000,USGS-16212490,USGS-16211800,USGS-16211600";
const AWS_USGS_TABLE_URL = "https://ofsyjumlizgqte56n2kznphw740iwjzb.lambda-url.us-east-2.on.aws/";
const AWS_USGS_GRAPH_URL = "https://fpjimyrgmhmggjpfc3usfpwgti0fnbap.lambda-url.us-east-2.on.aws/?time_series_id=";
const USGS_TABLE_URL     = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&lang=en-US&limit=50000&skipGeometry=true&api_key=bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1&unit_of_measure=ft&time=PT2H&properties=monitoring_location_id,value,time&monitoring_location_id=";
const USGS_GRAPH_URL     = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?limit=50000&properties=time,value&time=P7D&api_key=bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1&time_series_id="
const BASE_URL = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/';
const CONFIG_SETTINGS = 
    '?f=json' +
    '&lang=en-US' +
    '&limit=50000' +
    '&skipGeometry=true' + 
    '&offset=0';
let ALL_ITEMS_URL = BASE_URL;
let USGS_OVERVIEW_URL = BASE_URL;
let INDIVIDUAL_URL = BASE_URL;

let countdownInterval;

// configs
let CONFIG_VALUES;

const overlay = document.getElementById('loading-overlay');
function showLoading() { overlay.classList.add('active');    }
function hideLoading() { overlay.classList.remove('active'); }

const thresholdLinesPlugin = {
    id: 'thresholdLines',
    afterDraw(chart, args, options) {
        const { ctx, chartArea, scales } = chart;
        const yScale = scales.y;

        if (!options || !options.lines) return;

        options.lines.forEach(line => {
            const { value, color = 'yellow', dash = [] } = line;

            if (value < yScale.min || value > yScale.max) return;

            const y = yScale.getPixelForValue(value);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chartArea.left, y);
            ctx.lineTo(chartArea.right, y);
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.setLineDash(dash);
            ctx.stroke();
            ctx.restore();
        });
    }
};
Chart.register(thresholdLinesPlugin);

// all items
// https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&lang=en-US&limit=50000&skipGeometry=false&offset=0&monitoring_location_id=USGS-16210000
// individual
// https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?limit=50000&properties=time,value,unit_of_measure,approval_status,qualifier&time_series_id=26e3b29b90d34a3baf13ebe7c297197a&time=P7D


// ── DOM refs ──────────────────────────────────────────────
const tableContainer = document.getElementById('table-container');
const graphContainer = document.getElementById('graph-container');
const graphs         = document.getElementById('allGraphs');
const sectionTable   = document.getElementById('sectionTable');
const sectionButtons = document.getElementById('sectionButtons');
const sectionGraphs  = document.getElementById('sectionGraphs');
const popupOverlay   = document.getElementById('popupOverlay');

// ── Init ──────────────────────────────────────────────────
async function init() {
    showLoading();
    try {
        // fetch json files
        const [locationsResult, veociResult, areaResult, configResult, historicResult] = await Promise.all([
            fetchAndWait('json/locations.json'),
            fetchAndWait('json/veoci-export.json'),
            fetchAndWait('json/area.json'),
            fetchAndWait('json/config.json'),
            fetchAndWait('json/historic-data.json')
        ]);

        // set globals from json files
        CONFIG_VALUES = configResult;
        LOCATIONS = locationsResult;
        VEOCI_NOTES = veociResult.Sheet0;
        AREAS = areaResult.sort((a, b) => a.Order - b.Order);
        HISTORIC = getCurrentMonthHistoric(historicResult);

        loadParams();

        GAUGE_REGISTRY = mapGaugeRegistry(LOCATIONS);
        GAUGE_BITMAP = CONFIG_VALUES["gauge-graphs"].sites ? decodeBase36ToBigInt(CONFIG_VALUES["gauge-graphs"].sites) : 0n;
        
        const [overviewResults] = await Promise.all([
            fetchData("tableUSGS", AWS_USGS_TABLE_URL, USGS_TABLE_URL + GAUGE_IDS)
        ]);

        USGS_OVERVIEW = overviewResults;
        console.log(overviewResults);

        buildGaugeTable();

        // load graphs
        const preloadGauges = readBitMap(GAUGE_BITMAP);
        await Promise.all(
            preloadGauges.map(async (gauge) => {
                const site    = AREAS.flatMap(a => a.Sites).find(s => s.id == gauge);
                const color   = AREAS.find(a => a.Sites.some(s => s.id == gauge))?.Color;
                const article = document.querySelector(`.gauge-card.${site?.type}.card-${gauge}`);
                await clickTableCell(site, article, color);
            })
        );

        hideLoading();
        return

        const [presetLoad] = await Promise.all([
            loadGaugeGraphs()
        ]);
        
        startCountdown(CONFIG_VALUES["reload-time"]);
        
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

function mapGaugeRegistry(locations) {
    const entries = Object.entries(locations);
    const maxOrder = Math.max(...entries.map(([, val]) => val.order));
    const result = new Array(maxOrder).fill(null);
  
    entries.forEach(([id, value]) => {
        result[value.order - 1] = id;
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

function loadParams() {
    loadPreset();
    
    for (const [paramKey, pathArray] of Object.entries(paramMappings)) {
        const value = params.get(paramKey);
        if (value !== null) {
            if (Array.isArray(pathArray)) {
                let target = CONFIG_VALUES;
                for (let i = 0; i < pathArray.length - 1; i++) {
                    target = target[pathArray[i]] = target[pathArray[i]] || {};
                }
                target[pathArray[pathArray.length - 1]] = value;
            } else {
                CONFIG_VALUES[pathArray] = value;
            }
        }
    }

    updateParams();
}

function loadPreset() {
    if (preset == null || isNaN(preset))
        return;

    const previewValues = CONFIG_VALUES.presets[`${preset}`];
    if (previewValues == null)
        return;

    CONFIG_VALUES = { ...CONFIG_VALUES, ...previewValues };

    updateDisplayMode(CONFIG_VALUES["display-mode"]);
}

function updateParams() {
    const url = new URL(window.location.href);
    url.search = '';

    for (const [paramKey, path] of Object.entries(paramMappings)) {
        let value = CONFIG_VALUES;
        for (const key of path) {
            value = value?.[key];
        }

        if (value !== null && value !== undefined) {
            // CHECK: If the value is a BigInt, convert it to Base36 string
            const formattedValue = (typeof value === 'bigint') 
                ? value.toString(36) 
                : value;

            url.searchParams.set(paramKey, formattedValue);
        }
    }

    window.history.replaceState({}, '', url);

    // update table and graph columns
    document.getElementById('table-container').style.gridTemplateColumns = `repeat(${CONFIG_VALUES["gauge-tables"].columns}, 1fr)`;
    document.getElementById('graph-container').style.gridTemplateColumns = `repeat(${CONFIG_VALUES["gauge-graphs"].columns}, 1fr)`;
}

function getCurrentMonthHistoric(json) {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    const filtered = {};
    for (const [locationId, data] of Object.entries(json)) {
        const match = data.monthly.find(m => m.month.split('-')[1] === currentMonth);
        filtered[locationId] = {
            currentMonth: match || null,
            yearly: data.yearly_summaries[0] || null
        };
    }
    return filtered;
}

// ── FETCH ─────────────────────────────────────────────────
async function fetchAndWait(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`ERROR status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

async function fetchData(type, awsURL, backupURL) {
    let data;
    const start = performance.now();
    console.log(`➤ ${type}: Starting API call at [${rawConvertDate(new Date().toISOString())}]`);

    try {
        if (!AWS_ERROR) {
            data = await fetchAndWait(awsURL);

            if (!data || (Array.isArray(data) && data.length === 0)) {
                AWS_ERROR = true;
                throw new Error(`AWS data is empty: ${type}`);
            }
            console.log(`✅ ${type}: fetched successfully in ${(performance.now() - start).toFixed(0)}ms`);
            switch(type) {
                case 'tableUSGS':
                    data = processUSGSTable(data);
                    break;
                case 'graphUSGS':
                    data = processUSGSGraph(data);
                    break;
            }
        }
        else {
            throw new Error(`Skipped AWS: ${type}`);
        }
    } 
    catch (error) {
        console.warn("AWS fetch failed or empty, trying backup...", error.message);
        const raw = await fetchAndWait(backupURL);
        switch(type) {
            case 'tableUSGS':
                data = processRawUSGSTable(raw);
                break;
            case 'graphUSGS':
                data = processRawUSGSGraph(raw);
                break;
        }
    }

    return data;
}

// ── PROCESS ───────────────────────────────────────────────
function processRawUSGSTable(rawData) {
    const grouped = {};
    rawData.features.forEach(feature => {
        const { monitoring_location_id, value, time } = feature.properties;
        const parsed = parseFloat(value);

        if (!grouped[monitoring_location_id]) grouped[monitoring_location_id] = []; {
            grouped[monitoring_location_id].push({ val: isNaN(parsed) ? null : parsed, time: new Date(time) });
        }
    });

    const updatedGauges = {};
    Object.entries(grouped).forEach(([id, readings]) => {
        readings.sort((a, b) => b.time - a.time); // newest first

        const newest = readings[0];
        const oneHourAgo = new Date(newest.time.getTime() - 60 * 60 * 1000);

        // Find reading closest to 1 hour before the newest
        const hourReading = readings.reduce((best, r) => {
            const diff = Math.abs(r.time - oneHourAgo);
            return diff < Math.abs(best.time - oneHourAgo) ? r : best;
        }, readings[readings.length - 1]); // seed with oldest as fallback

        updatedGauges[id] = {
            val: newest.val,
            val_1h: hourReading.val,
            time: newest.time.toISOString()
        };
    });

    return processUSGSTable({
        gauges: updatedGauges,
        updateTime: new Date().toISOString()
    });
}

function rawConvertDate(date) {
    return new Date(date).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })
}

function processUSGSTable(data) {
    return {
        updateTime: rawConvertDate(data.updateTime),
        gauges: Object.fromEntries(
            Object.entries(data.gauges).map(([id, gauge]) => [
                id, { ...gauge, time: rawConvertDate(gauge.time) }
            ])
        )
    };
}

function processRawUSGSGraph(rawData) {
    const formattedData = rawData.features.map(feature => ({
      time: feature.properties.time,
      value: parseFloat(feature.properties.value) 
    }));
    formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));

    return formattedData;
}

function processUSGSGraph(data) {
    return {
        updateTime: rawConvertDate(new Date()),
        data: data.data.map(entry => ({
            ...entry,
            time: rawConvertDate(entry.time)
        }))
    };
}

// ── TABLE ─────────────────────────────────────────────────
function buildGaugeTable() {
    AREAS.forEach((area) => {
        area.Sites.forEach((site) => {
            const card = createSiteCard(site, area.Color);
            if (card) {
                tableContainer.appendChild(card);
            }
        })
    });
}

function createSiteCard(site, color) {
    if (!site.visible) {
        return null;
    }

    const locationItem = LOCATIONS[site.id];
    let article = document.createElement('article');
    article.classList.add('gauge-card', site.type, `card-${site.id}`);
    article.style.borderColor = color;

    const iconDiv = document.createElement('div');
    iconDiv.classList.add('card-icon', `icon-${locationItem.properties.site_type_code}`);

    const siteIcon = document.createElement('span');
    const changeIcon = document.createElement('span');
    const selectIcon = document.createElement('span');

    siteIcon.classList.add('site-icon');
    changeIcon.classList.add('change-icon');
    selectIcon.classList.add('select-icon');

    iconDiv.appendChild(siteIcon);
    iconDiv.appendChild(changeIcon);
    iconDiv.appendChild(selectIcon);
    siteIcon.addEventListener('click', () => {
        favoriteCardToggle(site.id);
    });
    article.appendChild(iconDiv);

    const titleText = document.createElement('h6');
    titleText.style.margin = "0";
    titleText.textContent = locationItem.properties.name_short;
    titleText.style.color = color;
    article.appendChild(titleText);

    if (site.type == "USGS") {
        article = addUSGSCard(article, site.id);
        article.addEventListener('click', () => {
            clickTableCell(site, article, color);
        });
    }

    return article;
}

function addUSGSCard(article, id) {
    const data = USGS_OVERVIEW.gauges[id];
    if (!data || !data.val) {
        console.log(`${id}: no data found`);
        return article;
    }
    
    const change = (data.val - data.val_1h).toFixed(2);
    const percent = (((data.val - data.val_1h) / data.val_1h) * 100).toFixed(2);
    const symbol = change > 0 ? '▲' : change < 0 ? '▼' : '=';
    const dirClass = change > 0 ? 'up' : change < 0 ? 'down' : 'equal';
    const isOld = (Date.now() - new Date(data.time).getTime()) > 24 * 60 * 60 * 1000;

    const thresholds = LOCATIONS[id].properties.thresholds;
    const displayThreshold = getDisplayThreshold(data.val, thresholds);
    const currentThreshold = getCurrentThreshold(data.val, thresholds);
    const thresholdText = thresholds[displayThreshold] 
        ? `<small> - <span class="threshold-highlight ${displayThreshold}">${thresholds[displayThreshold]}ft</span></small>` 
        : '';
    if (currentThreshold) {
        article.classList.add(currentThreshold, "alert");
    }

    const siteIcon = article.querySelector('.site-icon');
    const changeIcon = article.querySelector('.change-icon');
    // siteIcon for fav later

    changeIcon.textContent = symbol;
    changeIcon.classList.add(`${dirClass}-bright`);

    const dataDiv = document.createElement('div');
    dataDiv.classList.add('gauge-data');
    dataDiv.innerHTML = `
        <span class="main-value" style="padding-right: 0;"><strong>${data.val}</strong>
        <small style="padding-left: 0;>ft</small>
        </span>
        <small><span class="card-diff ${dirClass}">(${change} ${percent}%)</span></small>
    `;

    const dateDiv = document.createElement('div');
    dateDiv.classList.add('gauge-meta');
    dateDiv.innerHTML = `
        <small ${isOld ? 'style="color: red;"' : ''}">${formatTimeShort(data.time)}</small>${thresholdText}
    `;

    article.appendChild(dataDiv);
    article.appendChild(dateDiv);
    return article;
}

function formatTimeShort(time) {
    return new Date(time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).toLowerCase().replace(' ', '');
}

function formatTimeLong(time) {
    return new Date(time).toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).toLowerCase()
}

function getCurrentThreshold(value, thresholdsObject) {
    if(!value) {
        return null
    }

    const { base, minor, major, action } = thresholdsObject;

    const isNear = (threshold) => {
        if (threshold == null) return false;
        return value >= (threshold - ((threshold - base) * 0.1));
    };

    if (isNear(action)) return 'action';
    if (isNear(major)) return 'major';
    if (isNear(minor)) return 'minor';

    return null;
}

function getDisplayThreshold(value, thresholdsObject) {
    if(!value) {
        return null
    }

    const { base, minor, major, action } = thresholdsObject;

    if (minor != null && value < minor) return 'minor';
    else if (major != null && value < major) return 'major';
    else if (action != null && value < action) return 'action';

    return null;
}

function favoriteCardToggle(id) {
    console.log("favorite " + id);
}

async function clickTableCell(site, article, color) {
    if (article.classList.contains('selected')) {
        article.classList.remove('selected');
        console.log("remove")

        const chartIndex = charts.findIndex(c => c.id === site.id);

        if (chartIndex !== -1) {
            charts[chartIndex].instance.destroy();
            charts.splice(chartIndex, 1);
        }

        const chartContainer = document.getElementById(`chart-container-${site.id}`); // or however you reference it
        if (chartContainer) {
            chartContainer.remove();
        }

        // update url
        updateGaugeBit(site.id, false);
    }
    else {
        article.classList.add('selected');
        let graphResults;

        // fetch data
        if (site.type == "USGS") {
            const timeSeries = LOCATIONS[site.id].properties.time_series_id;
            graphResults = await fetchData("graphUSGS", AWS_USGS_GRAPH_URL + timeSeries, USGS_GRAPH_URL + timeSeries);
        }

        // build graph
        if (graphResults) {
            const convertedData = convertDates(graphResults);
            const chartDiv = await createGraph(site, convertedData, color);
            graphContainer.appendChild(chartDiv);

            charts[charts.length - 1].instance.render();
        }

        updateGaugeBit(site.id, true);
    }

    CONFIG_VALUES["gauge-graphs"]["sites"] = GAUGE_BITMAP;
    updateParams();

    return;
}

function convertDates(data) {
    if (!data || !data.data) {
        return null;
    }

    return data.data.map(item => ({
        ...item,
        time: new Date(item.time).toLocaleString('en-US', {
            timeZone: 'Pacific/Honolulu'
        })
    }));
}

async function createGraph(site, data, color) {
    if (!data || data.length < 1) {
        return null;
    }

    const locationItem = LOCATIONS[site.id];
    const chartContainer = document.createElement('div');
    chartContainer.id = `chart-container-${site.id}`;
    chartContainer.addEventListener('click', (event) => graphClick(site, event));

    const chartDiv = document.createElement('div');
    chartDiv.classList.add('chart', site.type, `chart-${site.id}`);

    const filteredRawData = filterDataByRange(data, CONFIG_VALUES["gauge-graphs"]["default-scale"]);
    const chartData = filteredRawData.map(item => ({
        x: new Date(item.time).getTime(),
        y: item.value
    }));

    const options = {
        series: [{
            name: locationItem.properties.monitoring_location_name,
            data: chartData
        }],
        title: {
            text: locationItem.properties.monitoring_location_name,
            align: 'center',
            margin: 10,
            offsetX: 0,
            offsetY: 0,
            floating: false,
            style: {
                fontSize:  '21px',
                fontWeight: 'bold',
                color:  color
            },
        },
        chart: {
            type: 'area', // 'area' looks great for water levels
            zoom: { enabled: true },
            toolbar: { show: false }
        },
        dataLabels: { enabled: false },
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false,
                style: {
                    colors: '#FFFFFF'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#FFFFFF'
                }
            }
        },
        tooltip: {
            x: { format: 'dd MMM HH:mm' },
            theme: 'dark'
        },
        colors: color,
        stroke: {
            curve: 'smooth',
            colors: color
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                colorStops: [
                    { offset: 0, color: color, opacity: 1 },
                    { offset: 100, color: color, opacity: 0.8 }
                ]
            }
        },
        /*,
        // Adding your threshold lines
        annotations: {
            yaxis: [
                {
                    y: 20, // Example Flood Stage
                    borderColor: '#FF4560',
                    label: {
                        text: 'Flood Stage',
                        style: { color: '#fff', background: '#FF4560' }
                    }
                }
            ]
        }*/
    };

    const newChart = new ApexCharts(chartDiv, options);
    chartContainer.appendChild(chartDiv);
    chartContainer.appendChild(createChartFooter(locationItem.properties.thresholds, site.id, chartData));

    //newChart.render();
    charts.push({
        id: site.id,
        type: site.type,
        instance: newChart,
        fullData: data
    });   

    return chartContainer;
}

function filterDataByRange(data, range) {
    switch(range) {
        case "w":
            return data;
        case "d":
            return data.length > 288 ? data.slice(-288) : data;
        case "h":
            return data.length > 12 ? data.slice(-12) : data;
    }
}

function createChartFooter(thresholds, id, data) {
    const checkValue = (input) => input ?? '??';

    const historic = HISTORIC[id]
    const chartFooter = document.createElement('div');
    chartFooter.classList.add(`.chart-footer.${id}`);

    let average = checkValue(thresholds.base);    // default to old data

    const { date, value, color, diff } = calcDataChange(data);
    //const formatDate = new Date(data.features[data.features.length - 1].properties.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');
    //const dataDiff = dataChange(data);
    if (historic) {
        average = historic.currentMonth.average.toFixed(2);
    }

    chartFooter.innerHTML = `
        <div style="display: flex; justify-content: space-between;>
            <span style="color: #FFFFFF">Base: ${average}ft</span>
            <span style="color: #FFEA00">Minor: ${checkValue(thresholds.minor)}ft</span>
            <span style="color: #EE4B2B">Major: ${checkValue(thresholds.major)}ft</span>
            <span style="color: #8B0000">Failure: ${checkValue(thresholds.action)}ft</span>
        </div>
        <div style="display: flex;">
            <span style="color: #FFFFFF">Last Update: ${date} - </span>
            <span style="color: ${getCurrentThreshold(value, thresholds)} ">${value}ft</span>
            <span style="color: ${color} ">(${diff}%)</span>
        </div> 
    `;
    return chartFooter;
}

function calcDataChange(data) {
    const current = data[data.length - 1].y
    const past = data.length >= 13 ? data[data.length - 13].y : data[0].y;
    const diff = (((current - past) / past) * 100);
    const color = diff > 0 ? 'green' : diff < 0 ? 'red' : 'gray';

    return {
        date: formatTimeLong(data[data.length - 1].x),
        value: current.toFixed(2),
        color: color,
        diff: diff.toFixed(2)
    };
}

function getWarningColor(threshold) {
    switch (threshold) {
        case 'action':
            return "#8B0000";
        case 'major':
            return "#EE4B2B";
        case 'minor':
            return "#FFEA00";
        default:
            return "#FFFFFF";
    }
}

// ── Button click ──────────────────────────────────────────
function changeDisplayMode() {
    let mode;
    switch(CONFIG_VALUES["display-mode"]) {
        case 1:
            mode = 2;
            break;
        case 2:
            mode = 3;
            break;
        case 3:
            mode = 1;
            break;
    }

    updateDisplayMode(mode);
}

function updateDisplayMode(mode) {
    const displayButton = document.getElementById('displayButton');
    CONFIG_VALUES["display-mode"] = parseInt(mode);
    displayButton.textContent = CONFIG_VALUES["display-mode"];

    switch(CONFIG_VALUES["display-mode"]) {
        case 1:
            sectionTable.classList.remove('hidden');
            sectionButtons.classList.remove('hidden');
            sectionGraphs.classList.remove('hidden');
            break;
        case 2:
            sectionTable.classList.remove('hidden');
            sectionButtons.classList.add('hidden');
            sectionGraphs.classList.add('hidden');
            break;
        case 3:
            sectionTable.classList.add('hidden');
            sectionButtons.classList.add('hidden');
            sectionGraphs.classList.remove('hidden');
            break;
    }
}

// click table cell
async function handleCellClick(item, event) {
    item = Array.from(item).pop();
    if (item == null) {
        return;
    }

    showLoading();

    const td = event.target.closest('td');
    const location_id = item.properties.monitoring_location_id;
    const time_series_id = item.properties.time_series_id;

    // unselect if selected
    if (td.classList.contains('selected')) {
        td.classList.remove('selected');
        graphCount--;

        const charId = 'chart-' + location_id;

        // destory chart
        const chartIndex = charts.findIndex(chart => chart.id === charId);
        if (chartIndex !== -1) {
            const chartItem = charts[chartIndex];

            // get the cell from the canvas
            const cell = chartItem.instance.canvas.closest('td');
            const row = cell.closest('tr');
            if (cell) {
                cell.remove();
            }

            // remove row if empty
            if (row && row.cells.length === 0) {
                row.remove();
            }

            chartItem.instance.destroy();

            // remove from array
            charts.splice(chartIndex, 1);
        }
    }
    else {
        let data = await GetGraphData(time_series_id);
        await buildGraph(location_id, time_series_id, data);
        const chart = charts.find(chart => chart.id === `chart-${location_id}`);
        await setRangeIndividual(chart, CONFIG_VALUES["gauge-graphs"]["default-scale"]);
    }

    resizeGraphs();
    hideLoading();

    return;
}

async function GetGraphData(time_series_id) {
    console.log("FETCH: Graph data");
    const response = await fetch(INDIVIDUAL_URL + time_series_id, {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`ERROR status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

// graphs
function resizeGraphs() {
    charts.forEach((chart) => {
        chart.instance.resize();
    });
}

// open popup
function graphClick(site, event) {
    popupOverlay.style.display = "flex";
    document.body.style.overflow = 'hidden';

    const locationItem = LOCATIONS[site.id];
    const historicItem = HISTORIC[site.id];
    const veociItem = VEOCI_NOTES.find(obj => obj.SiteID === site.id.replace("USGS-", ""));

    console.log(locationItem);
    console.log(historicItem);
    console.log(veociItem);

    const headerText = popupOverlay.querySelector('.popup-header-text');
    headerText.textContent = locationItem.properties.monitoring_location_name;

    const body = popupOverlay.querySelector('.popup-body');
    body.innerHTML = '';

    const nwsNotes = veociItem["NWS Notes"];
    const eocNotes = veociItem["EOC Procedures"];

    // map of location
    console.log(`https://www.google.com/maps?q=${locationItem.geometry.coordinates[1]},${locationItem.geometry.coordinates[0]}`);
    const mapDiv = document.createElement('div');
    mapDiv.style.height = '400px';
    mapDiv.innerHTML = `
        <iframe
            width="100%"
            height="100%"
            style="border:0; border-radius: 8px;"
            loading="lazy"
            allowfullscreen
            src="https://www.google.com/maps?q=${locationItem.geometry.coordinates[1]},${locationItem.geometry.coordinates[0]}&t=h&output=embed">
        </iframe>
    `;
    body.appendChild(mapDiv);

    if (nwsNotes != null && nwsNotes != "") {
        const nwsDiv = document.createElement('div');
        nwsDiv.textContent = nwsNotes;
        body.appendChild(nwsDiv);
    }

    if (eocNotes != null && eocNotes != "" && CONFIG_VALUES.user == "dem") {
        const eocDiv = document.createElement('div');
        eocDiv.textContent = eocNotes;
        body.appendChild(eocDiv);
    }

    const tableDiv = document.createElement('div');
    tableDiv.className = 'tables-wrapper';
    const chart = charts.find(obj => obj.id === site.id);
    const currentItem = chart.fullData[chart.fullData.length - 1];
    console.log(currentItem);
    const currentDisplayThreshold = getCurrentThreshold(currentItem.y, locationItem);
    const textColor = getWarningColor(currentDisplayThreshold);

    // tables
    tableDiv.appendChild(createDetailsTable("Current", [
        {"title": "Current", "value": `${parseFloat(currentItem.y).toFixed(2)} ft`, "color": textColor},
        {"title": "Last Update", "value": `${formatDateTime(currentItem.x)}`, "color": "#b9b9b9"},
        {"title": "Minor Threshold", "value": `${locationItem.properties.thresholds.minor} ft`, "color": getWarningColor('minor')},
        {"title": "Major Threshold", "value": `${locationItem.properties.thresholds.major} ft`, "color": getWarningColor('major')},
        {"title": "Action Threshold", "value": `${locationItem.properties.thresholds.action} ft`, "color": getWarningColor('action')}
    ]));

    tableDiv.appendChild(createDetailsTable(`Historic Month (${printMonth(historicItem.currentMonth.month)} ${historicItem.yearly.year})`, [
        {"title": "Average", "value": `${historicItem.currentMonth.average.toFixed(2)} ft`},
        {"title": "Max", "value": `${historicItem.currentMonth.max.toFixed(2)} ft`, "color": getCurrentThreshold(historicItem.currentMonth.max, locationItem)},
        {"title": "Min", "value": `${historicItem.currentMonth.min.toFixed(2)} ft`},
        {"title": "Max date", "value": `${formatDateTime(historicItem.currentMonth.max_timestamp)}`, "color": "#b9b9b9"},
        {"title": "Min date", "value": `${formatDateTime(historicItem.currentMonth.min_timestamp)}`, "color": "#b9b9b9"}
    ]));

    tableDiv.appendChild(createDetailsTable(`Historic Year (${historicItem.yearly.year})`, [
        {"title": "Average", "value": `${historicItem.yearly.yearly_average.toFixed(2)} ft`, "color": textColor},
        {"title": "Max", "value": `${historicItem.yearly.overall_max.toFixed(2)} ft`},
        {"title": "Min", "value": `${historicItem.yearly.overall_min.toFixed(2)} ft`},
        {"title": "Highest average", "value": `${printMonth(historicItem.yearly.overall_max_month)}`, "color": "#b9b9b9"},
        {"title": "Lowest average", "value": `${printMonth(historicItem.yearly.overall_min_month)}`, "color": "#b9b9b9"}
    ]));

    body.appendChild(tableDiv);
}

function printMonth(dateString) {
    const [year, month] = dateString.split('-');
    const date = new Date(year, month - 1); // month is 0-indexed
    return date.toLocaleString('default', { month: 'long' });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/,/g, '');
}

function createDetailsTable(header, rows) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'details-table-container';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'table-header';
    headerDiv.textContent = header;
    tableContainer.appendChild(headerDiv);
    
    const table = document.createElement('table');
    table.className = 'details-table';
    
    rows.forEach(row => {
        const tr = document.createElement('tr');
        
        const tdTitle = document.createElement('td');
        tdTitle.className = 'table-title';
        tdTitle.textContent = row.title;
        tr.appendChild(tdTitle);
        
        const tdValue = document.createElement('td');
        tdValue.className = 'table-value';
        tdValue.textContent = row.value;
        
        if (row.color) {
            tdValue.style.color = row.color;
        }
        
        tr.appendChild(tdValue);
        table.appendChild(tr);
    });
    
    tableContainer.appendChild(table);
    return tableContainer;
}

function popupClose() {
    console.log("close");
    popupOverlay.style.display = "none";
    document.body.style.overflow = 'auto';
}

async function loadGaugeGraphs() {
    if (CONFIG_VALUES["gauge-graphs"].sites == null && CONFIG_VALUES["gauge-graphs"].sites.length < 1) {
        return;
    }
    
    const sites = CONFIG_VALUES["gauge-graphs"].sites;
    const timeSeriesData = [...new Map(
        USGS_OVERVIEW.map(item => [
            item.properties?.monitoring_location_id,
            item.properties?.time_series_id
        ]).filter(([location, timeSeries]) => location && timeSeries)
    )].map(([monitoring_location_id, time_series_id]) => ({
        monitoring_location_id,
        time_series_id
    }));

    const siteTimeSeries = [];
    sites.forEach((site) => {
        const match = timeSeriesData.find(data => data.monitoring_location_id === site);
        if (match) {
            siteTimeSeries.push({
                site: site,
                time_series_id: match.time_series_id
            });
        }
    });
  
    const fetchPromises = siteTimeSeries.map(async (item) => ({
        key: item.site,
        data: await GetGraphData(item.time_series_id)
    }));

    const results = await Promise.all(fetchPromises);
    const dynamicStore = {};
    results.forEach(({ key, data }) => {
        dynamicStore[key] = data;
    });

    await Promise.all(results.map((item) => {
        const match = timeSeriesData.find(data => data.monitoring_location_id === item.key).time_series_id;
        return buildGraph(item.key, match, item.data);
    }));

    await new Promise(r => setTimeout(r, 1000));

    setRange(CONFIG_VALUES["gauge-graphs"]["default-scale"]);
}

async function buildGraph(location_id, time_series_id, data) {
    let info = LOCATIONS[location_id];

    let row;
    if (graphCount <= 0 || (graphCount % (CONFIG_VALUES["gauge-graphs"].columns)) == 0) {
        row = graphs.insertRow();
    }
    else {
        row = graphs.rows[graphs.rows.length - 1];
    }
        
    const cell = row.insertCell();

    const chartId = `chart-${info.id}`;
    cell.innerHTML = `
        <div class="chart-container">
            <canvas id="${chartId}"></canvas>
        </div>
        <div class="chart-footer ${location_id}"></div>
    `;

    cell.addEventListener('click', (event) => graphClick(location_id, event));

    // format data to chartjs format
    let formattedData = formatData(data);

    const yValues = formattedData.map(d => d.y);
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const padding = (max - min) * 0.1;

    let chartColor = 'rgb(0, 170, 204)';
    let thresholdArray = createThresholdArray(info.properties.thresholds);

    const ctx = document.getElementById(chartId).getContext('2d');
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                data: formattedData,
                borderColor: chartColor,
                backgroundColor: chartColor + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBorderWidth: 0,
                //spanGaps: false
            }]
        },
        options: {
            responsive: true,
            //maintainAspectRatio: true,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            plugins: {
                thresholdLines: {
                    lines: thresholdArray
                },
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    color: 'white',
                    text: info.properties.monitoring_location_name,
                    font: {
                        size: 14
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const date = new Date(context.raw.x);
                            return `Value: ${context.raw.y} at ${date.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    min: min - padding,
                    max: max + padding,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });

    // update table footer
    createGraphFooter(location_id, data);

    // select item in table
    const tableCell = document.querySelector(`.gauge-cell.${location_id}`)
    if (tableCell != null) {
        tableCell.classList.add('selected');
    }
    
    // store chart instance for cleanup
    charts.push({
        id: chartId,
        instance: newChart,
        time_series_id: time_series_id,
        location_id: location_id,
        fullData: formattedData
    });   
    graphCount++; 
    
    return;
}

function createThresholdArray(thresholds) {
    let thresholdArray = [];
    
    if (thresholds.base != null) {
        thresholdArray.push({
            value: thresholds.base,
            color: '#FFFFFF',
            dash: [5, 5]
        })
    }

    if (thresholds.minor != null) {
        thresholdArray.push({
            value: thresholds.minor,
            color: '#FFEA00',
            dash: []
        })
    }

    if (thresholds.major != null) {
        thresholdArray.push({
            value: thresholds.major,
            color: '#EE4B2B',
            dash: [5, 5]
        })
    }

    if (thresholds.action != null) {
        thresholdArray.push({
            value: thresholds.action,
            color: '#8B0000',
            dash: []
        })
    }

    return thresholdArray;
}

function dataChange(data) {
    const final = data.features[data.features.length - 1].properties.value;
    const prev = data.features[data.features.length - 13].properties.value;
    const diff = (((final - prev) / prev) * 100).toFixed(2);
    const color = diff >= 0 ? 'green' : 'red';
    return {
        color: color,
        value: diff
    }
}

function formatData(data) {
    let formattedData = [];
    for (let i = 0; i < data.features.length; i++) {
        formattedData.push({
            x: new Date(data.features[i].properties.time),
            y: parseFloat(data.features[i].properties.value)
        });
    }

    return formattedData;
}

/*
async function filterDataByRange(data, hours) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

    return data.filter(d => new Date(d.x) >= cutoff);
}*/

async function setRange(time) {
    /*
    const hours = (time == "hour") ? 24 : 168
    for (const chart of charts) {
        
        const filtered = await filterDataByRange(chart.fullData, hours);
        chart.instance.options.scales.x.time.displayFormats.hour = hours <= 24 ? 'ha' : 'MMM d';
        
        chart.instance.data.datasets[0].data = filtered;
        chart.instance.options.scales.x.time.unit = time;
        chart.instance.update('none');

        await new Promise(r => setTimeout(r, 100));
        //setRangeIndividual(chart, time);
    }*/
    
    /*
    for (const chart of charts) {
        setRangeIndividual(chart, time);
    }*/
    await Promise.all(charts.map(chart => setRangeIndividual(chart, time)));
}

async function setRangeIndividual(chart, time) {
    const hours = (time == "hour") ? 24 : 168
    const filtered = await filterDataByRange(chart.fullData, hours);
    chart.instance.options.scales.x.time.displayFormats.hour = hours <= 24 ? 'ha' : 'MMM d';
        
    chart.instance.data.datasets[0].data = filtered;
    chart.instance.options.scales.x.time.unit = time;
    chart.instance.update();
}

/*
async function reloadData() {
    showLoading();

    // reload gauge table
    const [overviewResults] = await Promise.all([
        fetchAndWait(USGS_OVERVIEW_URL)
    ]);
    USGS_OVERVIEW = overviewResults.features;
    console.log(USGS_OVERVIEW);
    USGS_OVERVIEW.forEach((item) => {
        const id   = item.properties.monitoring_location_id;
        const cell = document.querySelector(`.gauge-cell.${id}`);
        if (cell) {
            //cell.innerHTML = `<div class="circle">${item.properties.value}</div>`;
            cell.innerHTML = `<div class="circle">${gaugeReport(USGS_OVERVIEW, LOCATIONS[id])}</div>`;
        }
    });

    // reload graphs
    for (const chart of charts) {
        const updatedData = await GetGraphData(chart.time_series_id);
        const formatted = formatData(updatedData);

        chart.instance.data.datasets[0].data = [formatted];
        chart.instance.update();

        createGraphFooter(chart.location_id, updatedData);
    }

    //update scale
    console.log(CONFIG_VALUES["gauge-graphs"]["default-scale"]);
    setRange(CONFIG_VALUES["gauge-graphs"]["default-scale"]);

    console.log("Reloaded");
    hideLoading();
}*/

// update timer
function startCountdown(seconds) {
    // Clear any existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    updateDisplay(seconds);
    
    countdownInterval = setInterval(() => {
        seconds--;
        updateDisplay(seconds);
    }, 1000);
}

// Update timer display
function updateDisplay(remaining) {
    const timerSpan = document.getElementById('timer');
    
    if (remaining <= 0) {
        timerSpan.textContent = '00:00';
        clearInterval(countdownInterval);

        startCountdown(CONFIG_VALUES["reload-time"]);
        reloadData();
    } else {
        timerSpan.textContent = `${formatTime(remaining)}`;
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}