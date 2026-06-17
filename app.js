// // City and County of Honolulu
// // Department of Emergency Management 
// // Water Gauge Dashboard

// const params    = new URLSearchParams(window.location.search);
// const preset    = params.get('preset');
// const paramMappings = {
//     'display-mode': ['display-mode'],
//     'reload-time': ['reload-time'],
//     'user': ['user'],
//     'table-columns': ['gauge-tables', 'columns'],
//     'table-filter': ['gauge-tables', 'area-filter'],
//     'graph-columns': ['gauge-graphs', 'columns'],
//     'graph-scale': ['gauge-graphs', 'default-scale'],
//     'graph-sites': ['gauge-graphs', 'sites'],
//     'graph-padding': ['gauge-graphs', 'axis-padding'],
//     'graph-padding-enabled': ['gauge-graphs', 'axis-padding-enabled']
// };

// // stream and dam location data
// let LOCATIONS = {};
// let VEOCI_NOTES = {};
// let AREAS = [];
// let GAUGE_REGISTRY = [];
// let GAUGE_BITMAP = 0n;

// const HISTORIC_CACHE = {};

// const API_KEY = 'bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1'; // dont look
// let AWS_ERROR = false;

// let charts = [];

// let USGS_OVERVIEW = [];
// let UHSLC_OVERVIEW = [];

// const GAUGE_IDS                 = "USGS-213320158061401,USGS-213308158035601,USGS-213133158014201,USGS-16345000,USGS-16330000,USGS-16325000,USGS-16210500,USGS-16304200,USGS-16301050,USGS-16296500,USGS-16294900,USGS-16294100,USGS-16284200,USGS-16283200,USGS-16279200,USGS-16275000,USGS-16274100,USGS-16265000,USGS-16264600,USGS-16254000,USGS-16249000,USGS-16247100,USGS-16244000,USGS-16241600,USGS-16240500,USGS-16238500,USGS-16238000,USGS-16229000,USGS-16227500,USGS-16226700,USGS-16226400,USGS-16226200,USGS-16247150,USGS-16213000,USGS-16212601,USGS-16210200,USGS-16210100,USGS-16210000,USGS-16208400,USGS-16208000,USGS-16206600,USGS-16200000,USGS-16212490,USGS-16211800,USGS-16211600";
// const AWS_USGS_TABLE_URL        = "https://ofsyjumlizgqte56n2kznphw740iwjzb.lambda-url.us-east-2.on.aws/";
// const AWS_USGS_TABLE_CACHE_URL  = "https://ookj3pwjnfbg7iw7qmadxboiwy0bxzgy.lambda-url.us-east-2.on.aws/";
// const AWS_POST_GRAPH_URL        = "https://y7q6tacvwpfr2yibliaf5ihnhy0ypocs.lambda-url.us-east-2.on.aws/";
// const AWS_USGS_GRAPH_URL        = "https://fpjimyrgmhmggjpfc3usfpwgti0fnbap.lambda-url.us-east-2.on.aws/?time_series_id=";
// const AWS_USGS_GRAPH_CACHE_URL  = "https://e6ctj5yqbrefeysjl7ibrriwti0tcluj.lambda-url.us-east-2.on.aws/?time_series_id=";
// const AWS_UHSLC_TABLE_URL       = "https://rixj5y655m3fetk5tgyrar4mae0mdsin.lambda-url.us-east-2.on.aws/";
// const AWS_UHSLC_TABLE_CACHE_URL = "https://jjulfzgttjof6m5jcj4lifz4qq0kgrop.lambda-url.us-east-2.on.aws/";
// const AWS_UHSLC_GRAPH_URL       = "https://v5s6r3g7fjkyfhcb4e2yio7i7a0jjpjl.lambda-url.us-east-2.on.aws/?site_id=";
// const AWS_UHSLC_GRAPH_CACHE_URL = "https://jonvmpzzk2n5ftpnpxjzztyvhi0kqeop.lambda-url.us-east-2.on.aws/?site_id=";
// const USGS_TABLE_URL            = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&lang=en-US&limit=50000&skipGeometry=true&api_key=bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1&unit_of_measure=ft&time=PT2H&properties=monitoring_location_id,value,time&monitoring_location_id=";
// const USGS_GRAPH_URL            = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?limit=50000&properties=time,value&time=P7D&api_key=bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1&time_series_id=";

// let countdownInterval;
// let remainingSeconds = 0;

// // configs
// let CONFIG_VALUES;
// let SETTINGS_CREATED = false;

const overlay = document.getElementById('loading-overlay');
function showLoading() { overlay.classList.add('active');    }
function hideLoading() { overlay.classList.remove('active'); }

// // all items
// // https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&lang=en-US&limit=50000&skipGeometry=false&offset=0&monitoring_location_id=USGS-16210000
// // individual
// // https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?limit=50000&properties=time,value,unit_of_measure,approval_status,qualifier&time_series_id=26e3b29b90d34a3baf13ebe7c297197a&time=P7D

// // ── DOM refs ──────────────────────────────────────────────
// const tableContainer        = document.getElementById('table-container');
// const tableHeaderContainer  = document.getElementById('table-header-container');
// const graphContainer        = document.getElementById('graph-container');
// const settingsContainer     = document.getElementById('settings-container');
// const settingsTable         = document.getElementById('settings-table-body');
// const sectionTable          = document.getElementById('sectionTable');
// const sectionGraphs         = document.getElementById('sectionGraphs');
// const popupOverlay          = document.getElementById('popupOverlay');

// ── Init ──────────────────────────────────────────────────
async function init() {
    showLoading();
    try {
        loadParams();

        const response = await fetch('https://api.oahudem.com/water/get-active-locations?flat=true');
        const data = await response.json();
        console.log(data);
        // // fetch json files
        // const [locationsResult, veociResult, areaResult, configResult, historicResult] = await Promise.all([
        //     fetchAndWait('json/locations.json'),
        //     fetchAndWait('json/veoci-export.json'),
        //     fetchAndWait('json/area.json'),
        //     fetchAndWait('json/config.json'),
        //     fetchAndWait('json/historic-data.json')
        // ]);

        // // set globals from json files
        // CONFIG_VALUES = configResult;
        // LOCATIONS = locationsResult;
        // VEOCI_NOTES = veociResult.Sheet0;
        // AREAS = areaResult.sort((a, b) => a.Order - b.Order);



        // GAUGE_REGISTRY = mapGaugeRegistry(LOCATIONS);
        // GAUGE_BITMAP = CONFIG_VALUES["gauge-graphs"].sites ? decodeBase36ToBigInt(CONFIG_VALUES["gauge-graphs"].sites) : 0n;
        
        // await buildGaugeTable();
        
        // // load graphs
        // const preloadGauges = readBitMap(GAUGE_BITMAP);
        // await Promise.all(
        //     preloadGauges.map(async (gauge) => {
        //         const site    = AREAS.flatMap(a => a.Sites).find(s => s.id == gauge);
        //         const color   = AREAS.find(a => a.Sites.some(s => s.id == gauge))?.Color;
        //         const article = document.querySelector(`.gauge-card.${site?.type}.card-${gauge}`);
        //         await clickTableCell(site, article, color);
        //     })
        // );

        // // reorder graphs by area
        // const graphContainer = document.getElementById('graph-container');
        // const charts = [...graphContainer.children];

        // charts.sort((a, b) => {
        //     const areaA = AREAS.find(area => a.classList.contains(area.Area.replace(/\s+/g, '-')));
        //     const areaB = AREAS.find(area => b.classList.contains(area.Area.replace(/\s+/g, '-')));
        //     return (areaA?.Order ?? 999) - (areaB?.Order ?? 999);
        // }).forEach(el => graphContainer.appendChild(el));

        // startCountdown(CONFIG_VALUES["reload-time"], true);

        hideLoading();
    } 
    catch (err) {
        console.error(err);
    }
}

init();

// // ── SETUP ─────────────────────────────────────────────────
// function decodeBase36ToBigInt(str) {
//     return str.split('').reduce((acc, char) => {
//         return acc * 36n + BigInt(parseInt(char, 36));
//     }, 0n);
// }

// function mapGaugeRegistry(locations) {
//     const entries = Object.entries(locations);
//     const maxOrder = Math.max(...entries.map(([, val]) => val.order));
//     const result = new Array(maxOrder).fill(null);
  
//     entries.forEach(([id, value]) => {
//         result[value.order - 1] = id;
//     });
  
//     return result;
// }

// function readBitMap(map) {
//     if (!map) return [];
//     const mask = BigInt(map); 

//     return GAUGE_REGISTRY.filter((id, index) => {
//         if (id === null) return false;
//         return (mask & (1n << BigInt(index))) !== 0n;
//     });
// }

// function updateGaugeBit(id, state) {
//     const index = GAUGE_REGISTRY.indexOf(id);

//     if (index === -1) {
//         console.error(`Station ${id} not found in registry.`);
//         return;
//     }

//     const bitPosition = 1n << BigInt(index);
//     if (state) {
//         GAUGE_BITMAP |= bitPosition;
//     } 
//     else {
//         GAUGE_BITMAP &= ~bitPosition;
//     }
// }

function loadParams() {
    const loadPreset = () => {
        if (preset == null || isNaN(preset))
            return false;

        const previewValues = CONFIG_VALUES.presets[`${preset}`];
        if (previewValues == null)
            return false;

        CONFIG_VALUES = { ...CONFIG_VALUES, ...previewValues };

        return true;
    }

    if (!loadPreset()) {
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
    }

    updateParams();
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
    updateDisplayMode(CONFIG_VALUES["display-mode"]);
}

// // ── FETCH ─────────────────────────────────────────────────
// async function fetchAndWait(url, body = null) {
//     const response = await fetch(url, body ? {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//     } : undefined);

//     if (!response.ok) {
//         throw new Error(`ERROR status: ${response.status}`);
//     }
//     const data = await response.json();
//     return data;
// }

// async function fetchData(type, awsURL, backupURL, printId = null, body = null) {
//     let data;
//     const start = performance.now();
//     const fetchUUID = crypto.randomUUID();
//     console.log(`↗️ Starting API call at [${rawConvertDate(new Date().toISOString())}]\n      '${fetchUUID}': ${type}`);

//     try {
//         if (!AWS_ERROR) {
//             data = await fetchAndWait(awsURL);
//             if (!data || (Array.isArray(data) && data.length === 0)) {
//                 if (type != 'graphUSGSCache') {
//                     AWS_ERROR = true;
//                 }

//                 throw new Error(`AWS data is empty: ${type}`);
//             }
//             console.log(`✅ ${printId} - fetched successfully in [${(performance.now() - start).toFixed(0)}ms]\n      '${fetchUUID}': ${type}`);
//             data = switchProcessData(type, false, data);
//         }
//         else {
//             throw new Error(`Skipped AWS: ${type}`);
//         }
//     } 
//     catch (error) {
//         console.warn(`⚠️ ${printId} - AWS fetch failed or empty, trying backup...\n      '${fetchUUID}': ${type}\n      `, error.message);
//         console.warn(data);
//         try {
//             if (backupURL) {
//                 const raw = await fetchAndWait(backupURL, body);
//                 data = switchProcessData(type, true, raw);
                
//                 if (!data || (Array.isArray(data) && data.length === 0)) {
//                     throw new Error(`Backup data is empty: ${type}`);
//                 }
//                 else {
//                     console.log(`✅ ${printId} - Backup fetched successfully in [${(performance.now() - start).toFixed(0)}ms]\n      '${fetchUUID}': ${type}`);
//                     if (!AWS_ERROR && type == 'graphUSGSCache') {
//                         postGraphData(type, data, printId)
//                     }
//                 }
//             }
//             else {
//                 console.error(`❌ ${printId} - No backup URL. Could not fetch data\n      '${fetchUUID}': ${type}\n      `);
//             }
//         }
//         catch (error) {
//             console.error(`❌ ${printId} - Backup fetch failed or empty\n      '${fetchUUID}': ${type}\n      `, error.message);
//         }
//     }
//     return data;
// }

// async function postGraphData(type, data, id) {
//     const start = performance.now();
//     const time_series_id = LOCATIONS[id].properties.time_series_id;
//     switch(type) {
//         case 'graphUSGSCache':
//             const response = await fetch(AWS_POST_GRAPH_URL, {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json"
//                 },
//                 body: JSON.stringify({
//                     timeSeries: time_series_id,
//                     update_time_now: data.updateTime,
//                     formattedData: data.data
//                 })
//             });
//     }
//     console.log(`🟨 ${id} - Data posted successfully in [${(performance.now() - start).toFixed(0)}ms]`);
// }

// // ── PROCESS ───────────────────────────────────────────────
// function switchProcessData(type, raw, data) {
//     const kind = type.toLowerCase().includes('table') ? 'Table' : 'Graph';
//     if (!raw) {
//         if (kind === 'Table') {
//             return processTable(data);
//         }
//         else {
//             return processGraph(data);
//         }
//     }

//     const source = type.replace('Cache', '').replace('table', '').replace('graph', '');
//     return eval(`processRaw${source}${kind}`)(data);
// }

// function rawConvertDate(date) {
//     return new Date(date).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })
// }

// function processTable(data) {
//     return {
//         updateTime: rawConvertDate(data.updateTime),
//         gauges: Object.fromEntries(
//             Object.entries(data.gauges).map(([id, gauge]) => [
//                 id, { 
//                     ...gauge, 
//                     time: rawConvertDate(gauge.time),
//                     ...(gauge.time_1h && { time_1h: rawConvertDate(gauge.time_1h) })
//                 }
//             ])
//         )
//     };
// }

// function processGraph(data) {
//     return {
//         updateTime: rawConvertDate(data.updateTime),
//         data: data.data.map(entry => ({
//             ...entry,
//             time: rawConvertDate(entry.time)
//         }))
//     };
// }

// function processRawUSGSTable(rawData) {
//     const grouped = {};
//     rawData.features.forEach(feature => {
//         const { monitoring_location_id, value, time } = feature.properties;
//         const parsed = parseFloat(value);

//         if (!grouped[monitoring_location_id]) grouped[monitoring_location_id] = []; {
//             grouped[monitoring_location_id].push({ val: isNaN(parsed) ? null : parsed, time: new Date(time) });
//         }
//     });

//     const updatedGauges = {};
//     Object.entries(grouped).forEach(([id, readings]) => {
//         readings.sort((a, b) => b.time - a.time); // newest first

//         const newest = readings[0];
//         const oneHourAgo = new Date(newest.time.getTime() - 60 * 60 * 1000);

//         // Find reading closest to 1 hour before the newest
//         const hourReading = readings.reduce((best, r) => {
//             const diff = Math.abs(r.time - oneHourAgo);
//             return diff < Math.abs(best.time - oneHourAgo) ? r : best;
//         }, readings[readings.length - 1]); // seed with oldest as fallback

//         updatedGauges[id] = {
//             val: newest.val,
//             val_1h: hourReading.val,
//             time: newest.time.toISOString()
//         };
//     });

//     return processTable({
//         gauges: updatedGauges,
//         updateTime: new Date().toISOString()
//     });
// }

// function processRawUSGSGraph(rawData) {
//     const formattedData = rawData.features.map(feature => ({
//       time: rawConvertDate(feature.properties.time),
//       value: parseFloat(feature.properties.value) 
//     }));
//     formattedData.sort((a, b) => new Date(a.time) - new Date(b.time));

//     return {
//         updateTime: rawConvertDate(new Date()),
//         data: formattedData
//     };
// }

// function processRawUHSLCTable(rawData) {
//     // doesnt even work because of cross origin
//     return null;
// }


// function processRawUHSLCGraph(rawData) {
//     // doesnt even work because of cross origin
//     return null;
// }


// // ── RELOAD ────────────────────────────────────────────────
// async function reloadGaugeTable() {
//     const start = performance.now();

//     const isRecentUSGS = isRecentTime(USGS_OVERVIEW.updateTime);
//     const isRecentUHSLC = isRecentTime(UHSLC_OVERVIEW.updateTime);

//     if (isRecentUSGS && isRecentUHSLC) {
//         console.log(`🔄 TABLE-RELOAD - Data recent, not repulling`);
//         return;
//     }

//     const [overviewResultsUSGS, overviewResultsUHSLC] = await Promise.all([
//         !isRecentUSGS ? 
//             fetchData("tableUSGS", AWS_USGS_TABLE_URL, USGS_TABLE_URL + GAUGE_IDS, "GAUGE_OVERVIEW_RELOAD") : 
//             Promise.resolve(USGS_OVERVIEW),
//         !isRecentUHSLC ? 
//             fetchData("tableUHSLC", AWS_UHSLC_TABLE_URL, null, "GAUGE_OVERVIEW") : 
//             Promise.resolve(UHSLC_OVERVIEW)
//     ]);

//     USGS_OVERVIEW = overviewResultsUSGS;
//     UHSLC_OVERVIEW = overviewResultsUHSLC;

//     // only find areas that are visible and have updates
//     const filteredAreas = AREAS.map(area => ({
//         ...area,
//         Sites: area.Sites.filter(site => 
//             site.visible &&
//             !(site.type === 'USGS' && isRecentUSGS) &&
//             !(site.type === 'UHSLC' && isRecentUHSLC)
//         )
//     }));
    
//     filteredAreas.forEach((area) => {
//         area.Sites.forEach((site) => {
//             const data = site.type == "USGS" ? USGS_OVERVIEW.gauges[site.id] : UHSLC_OVERVIEW.gauges[site.id];
//             const currentArticle = document.querySelector(`.gauge-card.USGS.card-${site.id}`);
//             const updatedArticle = createSiteCard(site, data, area);

//             if (currentArticle && updatedArticle) {
//                 currentArticle._abortController?.abort();
//                 currentArticle.replaceWith(updatedArticle);
//             }
//         })
//     });

//     if (!isRecentUSGS || !isRecentUHSLC) {
//         console.log(`🔄 Table gauges reloaded, took: [${(performance.now() - start).toFixed(0)}ms]`);
//     }
// }

// async function reloadGaugeGraph(site) {
//     const start = performance.now();
//     const chart = charts.find(chart => chart.id == site.id);
//     const recent = isRecentTime(chart.pullTime);
//     const locationItem = LOCATIONS[site.id].properties;
//     const timeSeries = locationItem.time_series_id;

//     if (recent) {
//         console.log(`🔄 ${site.id}-RELOAD - Data recent, not repulling`);
//         return;
//     }

//     const [graphResultsUSGS, graphResultsUHSLC] = await Promise.all([
//         site.type == "USGS" ? 
//             fetchData("graphUSGS", AWS_USGS_GRAPH_URL + timeSeries, USGS_TABLE_URL + timeSeries, `${site.id}-RELOAD`) : 
//             Promise.resolve(),
//         site.type == "UHSLC" ? 
//             fetchData("graphUHSLC", AWS_UHSLC_GRAPH_URL + site.id, null, `${site.id}-RELOAD`) : 
//             Promise.resolve()
//     ]);

//     let convertedData;
//     if (site.type == "USGS") {
//         convertedData = convertDates(graphResultsUSGS);
//     }
//     else {
//         convertedData = convertDates(graphResultsUHSLC);
//     }

//     chart.fullData = convertedData;
//     chart.pullTime = rawConvertDate(new Date().toISOString());
//     await updateGraphTimeScale(site);

//     console.log(`🔄 ${site.id}-RELOAD - Graph reloaded, took: [${(performance.now() - start).toFixed(0)}ms]`);
// }

// async function updateGraphTimeScale(site) {
//     const locationItem = LOCATIONS[site.id].properties;
//     const chart = charts.find(chart => chart.id == site.id);
//     const filteredRawData = filterDataByRange(chart.fullData, CONFIG_VALUES["gauge-graphs"]["default-scale"]);

//     const chartData = filteredRawData.map(item => ({
//         x: new Date(item.time).getTime(),
//         y: item.value
//     }));

//     const [minPadding, maxPadding] = getAxisPadding(chartData);
//     const thresholds = await getThresholdObject(site.id);

//     chart.instance.updateOptions({
//         xaxis: {
//             type: 'datetime',
//             labels: {
//                 datetimeUTC: false,
//                 style: { colors: '#FFFFFF' }
//             }
//         },
//         yaxis: {
//             min: minPadding,
//             max: maxPadding,
//             labels: {
//                 style: { colors: '#FFFFFF' }
//             }
//         },
//     }, false, false);

//     chart.instance.updateSeries([{ data: chartData }], false);

//     setTimeout(() => {
//         chart.instance.updateOptions({
//             annotations: thresholds
//         }, true, false);
//     }, 100);

//     // update footer
//     const currentFooter = document.querySelector(`.chart-footer-${site.id}`);
//     const updatedFooter = await createChartFooter(locationItem.thresholds, site.id, chartData);

//     currentFooter.replaceWith(updatedFooter);
// }

// // ── TABLE ─────────────────────────────────────────────────
// async function buildGaugeTable() {
//     // pull cache data to build table
//     const [overviewResultsUSGS, overviewResultsUHSLC] = await Promise.all([
//         fetchData("tableUSGSCache", AWS_USGS_TABLE_CACHE_URL, USGS_TABLE_URL + GAUGE_IDS, "GAUGE_OVERVIEW"),
//         fetchData("tableUHSLCCache", AWS_UHSLC_TABLE_CACHE_URL, null, "GAUGE_OVERVIEW")
//     ]);

//     USGS_OVERVIEW = overviewResultsUSGS;
//     UHSLC_OVERVIEW = overviewResultsUHSLC;

//     console.log(`GAUGE_TABLE - Inital load fetch results at [${rawConvertDate(new Date().toISOString())}]`);
//     console.log(USGS_OVERVIEW);
//     console.log(UHSLC_OVERVIEW);
    
//     AREAS.forEach((area) => {
//         tableHeaderContainer.appendChild(createAreaCard(area));
        
//         area.Sites.forEach((site) => {
//             const data = site.type == "USGS" ?  USGS_OVERVIEW.gauges[site.id] : UHSLC_OVERVIEW.gauges[site.id];
//             const card = createSiteCard(site, data, area);
//             if (card) {
//                 tableContainer.appendChild(card);
//             }
//         })
//     });

//     const areaObj = AREAS.find(a => a.Order === parseInt(CONFIG_VALUES["gauge-tables"]["area-filter"]));
//     const name = areaObj?.Area ?? null;
//     if (name) {
//         const article = document.querySelector(`article.gauge-card.gauge-card-header.${getAreaClassName(name)}`);
//         if (article) {
//             filterByArea(areaObj, article);
//         }
//     }
    
//     // run function async
//     reloadGaugeTable();
// }

// function getAreaClassName(area) {
//     return area.replace(/\s+/g, '-')
// }

// function createAreaCard(area) {
//     const article = document.createElement('article');
//     article.classList.add('gauge-card', 'gauge-card-header', `${area.Area.replace(/\s+/g, '-')}`);
//     article.style.borderColor = area.Color;
//     article._abortController = new AbortController();
//     const signal = article._abortController.signal;

//     const titleText = document.createElement('h6');
//     titleText.style.margin = "0";
//     titleText.textContent = `${area.Area}`;
//     titleText.style.color = area.Color;
//     article.appendChild(titleText);

//     article.addEventListener('click', () => {
//         filterByArea(area, article);
//     }, { signal });

//     return article;
// }

// function filterByArea(area, article) {
//     const articles = tableContainer.querySelectorAll('article');
//     const graphs = graphContainer.querySelectorAll('div.chart-container');
//     const headers = tableHeaderContainer.querySelectorAll('article');
//     const areaClass = area.Area.replace(/\s+/g, '-');

//     tableHeaderContainer.className = tableHeaderContainer.classList.contains(areaClass) ? '' : areaClass;
//     const selected = tableHeaderContainer.className !== '';

//     // table cells
//     articles.forEach(art => {
//         if (selected) {
//             // area selected and apply filter
//             if (art.classList.contains(areaClass)) {
//                 art.classList.remove('hidden');
//             } 
//             else {
//                 art.classList.add('hidden');
//             }
//         }
//         else {
//             // clear filter
//             art.classList.remove('hidden');
//         }
//     });

//     headers.forEach(art => {
//         art.classList.remove('filter-active');
//     });

//     if (selected) {
//         article.style.setProperty('--area-color', area.Color);
//         article.classList.add('filter-active');
//         CONFIG_VALUES["gauge-tables"]["area-filter"] = area.Order;
//     }
//     else {
//         CONFIG_VALUES["gauge-tables"]["area-filter"] = 0;
//     }

//     // graphs
//     graphs.forEach(graph => {
//         if (selected) {
//             // area selected and apply filter
//             if (graph.classList.contains(areaClass)) {
//                 graph.classList.remove('hidden');
//             } 
//             else {
//                 graph.classList.add('hidden');
//             }
//         }
//         else {
//             // clear filter
//             graph.classList.remove('hidden');
//         }
//     });

//     updateParams();
// }

// function createSiteCard(site, data, area) {
//     if (!site.visible) {
//         return null;
//     }

//     const locationItem = LOCATIONS[site.id];
//     const color = area.Color;

//     let article = document.createElement('article');
//     article.classList.add('gauge-card', site.type, `card-${site.id}`, `${area.Area.replace(/\s+/g, '-')}`);
//     article.style.borderColor = color;
//     article._abortController = new AbortController();
//     const signal = article._abortController.signal;

//     const iconDiv = document.createElement('div');
//     iconDiv.classList.add('card-icon', `icon-${locationItem.properties.site_type_code}`);

//     const siteIcon = document.createElement('span');
//     const changeIcon = document.createElement('span');
//     const selectIcon = document.createElement('span');

//     siteIcon.classList.add('site-icon');
//     changeIcon.classList.add('change-icon');
//     selectIcon.classList.add('select-icon');

//     iconDiv.appendChild(siteIcon);
//     iconDiv.appendChild(changeIcon);
//     iconDiv.appendChild(selectIcon);
//     siteIcon.addEventListener('click', () => {
//         favoriteCardToggle(site.id);
//     }, { signal });
//     article.appendChild(iconDiv);

//     const titleText = document.createElement('h6');
//     titleText.style.margin = "0";
//     titleText.textContent = locationItem.properties.name_short;
//     titleText.style.color = color;
//     article.appendChild(titleText);

//     article = addCardDetails(article, site.id, data);
//     article.addEventListener('click', () => {
//         clickTableCell(site, article, color);
//     }, { signal });

//     return article;
// }

// function addCardDetails(article, id, data) {
//     if (!data || !data.val) {
//         console.log("⚠️ No live data found: " + id)
//         return article;
//     }
    
//     const change = (data.val - data.val_1h).toFixed(2);
//     const percent = (((data.val - data.val_1h) / data.val_1h) * 100).toFixed(2);
//     const symbol = change > 0 ? '▲' : change < 0 ? '▼' : '=';
//     const dirClass = change > 0 ? 'up' : change < 0 ? 'down' : 'equal';
//     const isOld = (Date.now() - new Date(data.time).getTime()) > 24 * 60 * 60 * 1000;

//     const thresholds = LOCATIONS[id].properties.thresholds;
//     const displayThreshold = getDisplayThreshold(data.val, thresholds);
//     const currentThreshold = getCurrentThreshold(data.val, thresholds);
//     const thresholdText = thresholds[displayThreshold] 
//         ? `<small> - <span class="threshold-highlight ${displayThreshold}">${thresholds[displayThreshold]}ft</span></small>` 
//         : '';
//     if (currentThreshold) {
//         article.classList.add(currentThreshold, "alert");
//     }
//     const colorOverrideAlert = currentThreshold ? `style="color: #000000"` : '';

//     const siteIcon = article.querySelector('.site-icon');
//     const changeIcon = article.querySelector('.change-icon');
//     // siteIcon for fav later

//     changeIcon.textContent = symbol;
//     changeIcon.classList.add(`${dirClass}-bright`);

//     const dataDiv = document.createElement('div');
//     dataDiv.classList.add('gauge-data');
//     dataDiv.innerHTML = `
//         <span class="main-value" ${colorOverrideAlert}><strong style="margin: 0; padding: 0;">${data.val}</strong>
//         <small style="padding: 0; margin: 0;">ft</small>
//         </span>
//         <small><span ${colorOverrideAlert} class="card-diff ${dirClass}">(${change} ${percent}%)</span></small>
//     `;

//     const dateDiv = document.createElement('div');
//     dateDiv.classList.add('gauge-meta');
//     dateDiv.innerHTML = `
//         <small class="main-value" ${isOld ? 'style="color: red;"' : ''}">${formatTimeShort(data.time)}</small>${thresholdText}
//     `;

//     article.appendChild(dataDiv);
//     article.appendChild(dateDiv);
//     return article;
// }

// function isRecentTime(time) {
//     return time && (Date.now() - new Date(new Date(time).toLocaleString('en-US', { timeZone: 'UTC' })).getTime() + (10 * 60 * 60 * 1000)) < 15 * 60 * 1000;
// }

// function formatTimeShort(time) {
//     return new Date(time).toLocaleTimeString('en-US', {
//         hour: 'numeric',
//         minute: '2-digit',
//         hour12: true
//     }).toLowerCase().replace(' ', '');
// }

// function formatTimeLong(time) {
//     return new Date(time).toLocaleString('en-US', {
//         year: 'numeric',
//         month: 'numeric',
//         day: 'numeric',
//         hour: 'numeric',
//         minute: '2-digit',
//         hour12: true
//     }).toLowerCase()
// }

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

// function favoriteCardToggle(id) {
//     console.log("favorite " + id);
// }

// async function clickTableCell(site, article, color) {
//     showLoading();
//     if (article.classList.contains('selected')) {
//         article.classList.remove('selected');

//         const chartIndex = charts.findIndex(c => c.id === site.id);

//         if (chartIndex !== -1) {
//             charts[chartIndex].instance.destroy();
//             charts.splice(chartIndex, 1);
//         }

//         const chartContainer = document.getElementById(`chart-container-${site.id}`); // or however you reference it
//         if (chartContainer) {
//             chartContainer.remove();
//         }

//         // update url
//         updateGaugeBit(site.id, false);
//     }
//     else {
//         article.classList.add('selected');
//         let graphResults;

//         // fetch data
//         if (site.type == "USGS") {
//             const timeSeries = LOCATIONS[site.id].properties.time_series_id;
//             graphResults = await fetchData("graphUSGSCache", AWS_USGS_GRAPH_CACHE_URL + timeSeries, USGS_GRAPH_URL + timeSeries, site.id);
//         }

//         if (site.type == "UHSLC") {
//             graphResults = await fetchData("graphUHSLCCache", AWS_UHSLC_GRAPH_CACHE_URL + site.id, null, site.id);
//         }
        
//         // build graph
//         if (graphResults) {
//             const convertedData = convertDates(graphResults);
//             const chartDiv = await createGraph(site, convertedData, color, graphResults.updateTime);
//             graphContainer.appendChild(chartDiv);

//             charts[charts.length - 1].instance.render();

//             reloadGaugeGraph(site);
//         }

//         updateGaugeBit(site.id, true);
//     }

//     CONFIG_VALUES["gauge-graphs"]["sites"] = GAUGE_BITMAP;
//     updateParams();

//     hideLoading();
//     return;
// }

// function convertDates(data) {
//     if (!data || !data.data) {
//         return null;
//     }

//     return data.data.map(item => ({
//         ...item,
//         time: new Date(item.time).toLocaleString('en-US', {
//             timeZone: 'Pacific/Honolulu'
//         })
//     }));
// }

// async function createGraph(site, data, color, time) {
//     if (!data || data.length < 1) {
//         return null;
//     }

//     const locationItem = LOCATIONS[site.id];
//     const chartContainer = document.createElement('div');
//     chartContainer.id = `chart-container-${site.id}`;
//     chartContainer.style.position = "relative";
    
//     chartContainer._abortController = new AbortController();
//     const signal = chartContainer._abortController.signal;

//     const area = getSiteArea(site);
//     const areaClass = area.Area.replace(/\s+/g, '-');
//     chartContainer.classList.add(`${areaClass}`, 'chart-container');

//     // close graph
//     const closeGraphIcon = document.createElement('span');
//     closeGraphIcon.innerHTML = "✕";
//     closeGraphIcon.style.color = "#FF0000"
//     closeGraphIcon.classList.add('close-graph-icon');
//     closeGraphIcon.addEventListener('click', (event) => {
//         event.stopPropagation();
//         const article = document.querySelector(`.gauge-card.${site.type}.card-${site.id}`);
//         clickTableCell(site, article, color)
//     }, { signal });
//     chartContainer.appendChild(closeGraphIcon);

//     const chartDiv = document.createElement('div');
//     chartDiv.classList.add('chart', site.type, `chart-${site.id}`);
//     chartDiv.addEventListener('click', (event) => {
//         graphClick(site, event)
//     }, { signal });

//     const filteredRawData = filterDataByRange(data, CONFIG_VALUES["gauge-graphs"]["default-scale"]);
//     const chartData = filteredRawData.map(item => ({
//         x: new Date(item.time).getTime(),
//         y: item.value
//     }));

//     // y axis padding
//     const [minPadding, maxPadding] = getAxisPadding(chartData);

//     const thresholds = await getThresholdObject(site.id);

//     const options = {
//         series: [{
//             name: locationItem.properties.monitoring_location_name,
//             data: chartData
//         }],
//         title: {
//             text: locationItem.properties.monitoring_location_name.replace(', Oahu, HI', ''),
//             align: 'center',
//             margin: 10,
//             offsetX: 0,
//             offsetY: 0,
//             floating: false,
//             style: {
//                 fontSize:  '21px',
//                 fontWeight: 'bold',
//                 color:  color
//             },
//         },
//         chart: {
//             type: 'area', // 'area' looks great for water levels
//             zoom: { enabled: true },
//             toolbar: { show: false }
//         },
//         dataLabels: { enabled: false },
//         xaxis: {
//             type: 'datetime',
//             labels: {
//                 datetimeUTC: false,
//                 style: {
//                     colors: '#FFFFFF'
//                 }
//             }
//         },
//         yaxis: {
//             min: minPadding,
//             max: maxPadding,
//             labels: {
//                 style: {
//                     colors: '#FFFFFF'
//                 }
//             }
//         },
//         tooltip: {
//             x: { format: 'dd MMM HH:mm' },
//             theme: 'dark'
//         },
//         colors: color,
//         stroke: {
//             curve: 'smooth',
//             colors: color
//         },
//         fill: {
//             type: 'gradient',
//             gradient: {
//                 shadeIntensity: 1,
//                 opacityFrom: 0.6,
//                 opacityTo: 0.1,
//                 colorStops: [
//                     { offset: 0, color: color, opacity: 1 },
//                     { offset: 100, color: color, opacity: 0.8 }
//                 ]
//             }
//         },
//         annotations: thresholds
//     };

//     const newChart = new ApexCharts(chartDiv, options);
//     chartContainer.appendChild(chartDiv);
//     chartContainer.appendChild(await createChartFooter(locationItem.properties.thresholds, site.id, chartData));

//     charts.push({
//         id: site.id,
//         type: site.type,
//         instance: newChart,
//         fullData: data,
//         pullTime: time
//     });   

//     return chartContainer;
// }

// function getAxisPadding(chartData) {
//     const [percent, add] = CONFIG_VALUES["gauge-graphs"]["axis-padding"].split('p').map(Number);
//     const [below, above] = CONFIG_VALUES["gauge-graphs"]["axis-padding-enabled"].split('p').map(Number);
//     const yValues = chartData.map(d => d.y);
//     const min = Math.min(...yValues);
//     const max = Math.max(...yValues);
//     const minPadding = below ? (min * (1 - percent * 0.01)) - add : min;
//     const maxPadding = above ? (max * (percent * 0.01 + 1)) + add : max;

//     return [minPadding, maxPadding];
// }

// async function getThresholdObject(id) {
//     const locationItem = LOCATIONS[id];
//     const historicItem = await getHistoricItem(id);
//     const monthlyItems = getHistoricMonth(historicItem);
//     const thresholds = getThresholdGraph(id, locationItem.properties.thresholds, monthlyItems);
//     return thresholds;
// }

// async function getHistoricItem(id) {
//     if (!HISTORIC_CACHE[id]) {
//         const [historicResult] = await Promise.all([
//             fetchAndWait('json/historic-data.json')
//         ]);
        
//         HISTORIC_CACHE[id] = historicResult[id];
//     }

//     return HISTORIC_CACHE[id];
// }
// function getHistoricMonth(historicItem) {
//     if (historicItem == null) {
//         return null;
//     }

//     const now = new Date();
//     const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

//     const filtered = historicItem.monthly
//         .filter(item => item.month.endsWith(`-${currentMonth}`))
//         .sort((a, b) => b.month.localeCompare(a.month));

//     return filtered;
// }

// function getHistoricYear(historicItem, year) {
//     if (historicItem == null) return null;

//     const previousYear = new Date().getFullYear() - 1;
//     return historicItem.yearly_summaries?.find(y => y.year === previousYear) ?? null;
// }

// function filterDataByRange(data, range) {
//     switch(range) {
//         case "w":
//             return data;
//         case "d":
//             return data.length > 288 ? data.slice(-288) : data;
//         case "h":
//             return data.length > 12 ? data.slice(-12) : data;
//     }
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

// function calcDataChange(data) {
//     const current = data[data.length - 1].y
//     const past = data.length >= 13 ? data[data.length - 13].y : data[0].y;
//     const diff = (((current - past) / past) * 100);
//     const color = diff > 0 ? 'green' : diff < 0 ? 'red' : 'gray';

//     return {
//         date: formatTimeLong(data[data.length - 1].x),
//         value: current.toFixed(2),
//         color: color,
//         diff: diff.toFixed(2)
//     };
// }

// function getWarningColor(threshold) {
//     switch (threshold) {
//         case 'action':
//             return "#8B0000";
//         case 'major':
//             return "#EE4B2B";
//         case 'minor':
//             return "#FFEA00";
//         default:
//             return "#FFFFFF";
//     }
// }

// function getThresholdGraph(id, thresholds, monthly) {
//     if (!thresholds)
//         return {};

//     let base = thresholds.base;
//     let labelDesc = "Baseline Averag Height"
//     if (typeof monthly?.[0]?.average === 'number') {
//         LOCATIONS[id].properties.thresholds.base = monthly[0].average;
//         base = monthly[0].average;
//         labelDesc = `${monthly[0].month} Average Height`;
//     }

//     const yaxis = [];
//     const createThresholdObject = (val, level, dash = 0) => {
//         yaxis.push({
//             y: val,
//             borderColor: getWarningColor(level),
//             borderWidth: 3,
//             strokeDashArray: dash,
//             zIndex: 999
//         });
//     }
    
//     if (base) {
//         createThresholdObject(base, "base", 5);
//     }

//     if (thresholds.minor) {
//         createThresholdObject(thresholds.minor, "minor");
//     }

//     if (thresholds.major) {
//         createThresholdObject(thresholds.major, "major");
//     }

//     if (thresholds.action) {
//         createThresholdObject(thresholds.action, "action");
//     }

//     return { "yaxis" : yaxis };
// }

// // ── Button click ──────────────────────────────────────────
// function toggleSettings(button) {
//     const isExpanded = button.classList.contains('expanded');
//     if (isExpanded) {
//         button.textContent = "▽";
//         button.classList.remove('expanded');
//         settingsContainer.style.display = 'none';
//     } else {
//         button.textContent = "△";
//         button.classList.add('expanded');
//         settingsContainer.style.display = '';

//         if (!SETTINGS_CREATED) {
//             createSettings();
//         }
//     }
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