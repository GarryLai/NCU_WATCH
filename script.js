/**
 * NCU_WATCH Weather Dashboard Logic
 * Refactored for performance and maintainability
 */

// =============================================================================
// 1. CONFIGURATION & CONSTANTS
// =============================================================================
const CONFIG = {
    API_URL: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-D0047-005.json",
    QPF_URLS: [
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_06.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_12.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_18.png",
        "https://cwa.ppp503.workers.dev/Data/fcst_img/QPF_ChFcstPrecip_6_24.png",
    ],
    QPF_ROI: {
        X_MIN: 735, X_MAX: 911,
        Y_MIN: 266, Y_MAX: 458
    },
    GEOJSON_URL: "twtown2010.3.json",
    MAP: { CENTER: [24.85, 121.23], ZOOM: 11 },
    AGGREGATION: {
        NONE: 'none',
        HOURS_3: '3hours',
        HOURS_6: '6hours'
    }
};

const NAME_MAPPING = {
    "桃園市": "桃園區", "中壢市": "中壢區", "平鎮市": "平鎮區", "八德市": "八德區",
    "楊梅市": "楊梅區", "大溪鎮": "大溪區", "蘆竹鄉": "蘆竹區", "大園鄉": "大園區",
    "龜山鄉": "龜山區", "龍潭鄉": "龍潭區", "新屋鄉": "新屋區", "觀音鄉": "觀音區",
    "復興鄉": "復興區"
};

const UNIT_MAPPING = {
    "攝氏度": "°C", "百分比": "%", "公尺/秒": "m/s", "蒲福風級": "級"
};

const VARIABLE_MAPPING = {
    "溫度": { 
        key: "溫度",
        colors: ['#117388','#207E92','#2E899C','#3D93A6','#4C9EB0','#5BA9BA','#69B4C4','#78BFCE','#87CAD8','#96D4E2','#A4DFEC','#B3EAF6','#0C924B','#1D9A51','#2FA257','#40A95E','#51B164','#62B96A','#74C170','#85C876','#96D07C','#A7D883','#B9E089','#CAE78F','#DBEF95','#F4F4C3','#F7E78A','#F4D576','#F1C362','#EEB14E','#EA9E3A','#E78C26','#E07B03','#ED5138','#ED1759','#AD053A','#780101','#9C68AD','#845194','#8520A0'],
        thresholds: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]]
    }, 
    "降雨機率": { 
        key: "3小時降雨機率",
        colors: ['#FFFFFF', '#E0F2F7', '#B3D9E8', '#7FB3D5', '#4A90C2', '#2E5C8A', '#FF9500', '#FF6B35', '#E63946', '#A4161A', '#5C0A0A'],
        thresholds: [[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]]
    }, 
    "相對濕度": { 
        key: "相對濕度",
        colors: ["#D3E6EB", "#A7CFD8","#82F550","#4ADC0C","#93F4FF","#2DEAFF","#02D4E3"],
        thresholds: [[65,70,75,80,85,90]]
    }, 
    "風速": { 
        key: "風速",
        colors: ['#FFFFFF', '#b0fff2', '#80f9be', '#50fcaf', '#FFFEA5', '#F2DB79', '#E6B167', '#EA83ED', '#B940BD', '#6942AE', '#272F6E'],
        thresholds: [
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // m/s
            [2, 4, 6, 8, 10, 12, 14, 15, 16, 17] // Beaufort
        ]
    },
    "定量降水預報": {
        key: "QPF",
        unit: "mm",
        // Valid for val >= threshold
        thresholds: [0.5, 1, 2, 5, 10, 15, 20, 30, 40, 50, 70, 90, 110, 130, 150, 200, 300],
        colors: ['#EDF9FE', '#C2C2C2', '#9CFCFF', '#03C8FF', '#059BFF', '#0363FF', '#059902', '#39FF03', '#FFFB03', '#FFC800', '#FF9500', '#FF0000', '#CC0000', '#990000', '#960099', '#C900CC', '#FB00FF', '#FDC9FF']
    }
};

// =============================================================================
// 2. CORE UTILITIES (Pure Functions)
// =============================================================================
const Utils = {
    parseValue(val) {
        if (val == null) return { num: NaN, str: "N/A", valid: false };
        if (typeof val === 'number') return { num: val, str: String(val), valid: true };

        const str = String(val).trim();
        if (str.includes('<=')) return { num: 0, str: str, valid: true };
        
        const parsed = parseFloat(str);
        return { num: parsed, str: str, valid: !isNaN(parsed) };
    },

    calculateAggregatedValue(element, indices, subKey) {
        if (!element || !indices || indices.length === 0) return { num: 0, str: "N/A", valid: false };

        let maxVal = -Infinity;
        let maxStr = "N/A";
        let found = false;

        for (const idx of indices) {
            const timeObj = element.Time[idx];
            if (!timeObj || !timeObj.ElementValue) continue;

            let raw;
            if (subKey && timeObj.ElementValue[subKey] != null) {
                raw = timeObj.ElementValue[subKey];
            } else {
                const values = Object.values(timeObj.ElementValue);
                if (values.length > 0) raw = values[0];
            }

            const { num, str, valid } = this.parseValue(raw);
            if (valid) {
                if (num > maxVal) {
                    maxVal = num;
                    maxStr = str;
                }
                found = true;
            }
        }

        return { num: found ? maxVal : 0, str: found ? maxStr : "N/A", valid: found };
    },

    getColor(val, varKey, subVarKey) {
        if (!VARIABLE_MAPPING[varKey]) return '#cccccc';
        const config = VARIABLE_MAPPING[varKey];
        const colors = config.colors;
        const thresholds = config.thresholds;

        // QPF Logic: value matches a specific discrete bin color
        if (varKey === "定量降水預報") {
            if (val === 0) return colors[0];
            
            // Check exact match first
            let idx = thresholds.indexOf(val);
            if (idx !== -1) {
                return colors[idx + 1] || '#cccccc'; 
            }
            
            // If interpolated/max value doesn't match exactly
            let tIdx = thresholds.findIndex(t => val < t);
            if (tIdx === -1) tIdx = thresholds.length;
            return colors[tIdx] || '#cccccc';
        }

        let activeThresholds = thresholds;
        if (Array.isArray(thresholds[0])) { // Legacy nested support
            activeThresholds = thresholds[0];
            if (varKey === "風速" && subVarKey === "BeaufortScale" && thresholds[1]) {
                activeThresholds = thresholds[1];
            }
        }

        let idx = activeThresholds.findIndex(t => val < t);
        if (idx === -1) idx = activeThresholds.length;

        if (idx >= colors.length) idx = colors.length - 1;
        return colors[idx] || '#cccccc';
    },

    getUnit(varKey, subVarKey, metaInfo) {
        if (subVarKey && metaInfo?.[subVarKey]?.['@unit']) {
            const u = metaInfo[subVarKey]['@unit'];
            if (u && u !== "NA" && u !== "null") return UNIT_MAPPING[u] || u;
        }
        if (VARIABLE_MAPPING[varKey]?.unit) return VARIABLE_MAPPING[varKey].unit;
        return "";
    }
};

// =============================================================================
// 3. TIME AGGREGATION LOGIC
// =============================================================================
const TimeManager = {
    cache: new Map(),

    generateGroups(timeStrings, mode, interval = 1) {
        // Cache key based on input parameters
        const cacheKey = `${mode}-${interval}-${timeStrings.length}-${timeStrings[0]}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // QPF Special Handling (Fake Time Strings)
        if (mode === 'QPF') {
            const groups = timeStrings.map((t, i) => {
                // Upstream data interval changed to 6 hours
                const start = i * 6;
                const end = (i + 1) * 6;
                const label = `${start}-${end}hr`;

                return {
                    type: 'single',
                    indices: [i],
                    label: label,
                    periodLabel: label,
                    timestamp: new Date().getTime() + i, // Fake distinct timestamps
                    dateKey: "未來預報" // Group header
                };
            });
            this.cache.set(cacheKey, groups);
            return groups;
        }

        // 1. Define Filter Range (Today Noon -> Tomorrow Noon)
        const now = new Date();
        const startFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0); 
        const endFilter = new Date(startFilter);
        endFilter.setDate(endFilter.getDate() + 1);

        const groups = [];
        const parsedDates = timeStrings.map(t => new Date(t));

        // 2. Mode: Single Time Points (No Aggregation)
        if (mode === CONFIG.AGGREGATION.NONE) {
            parsedDates.forEach((d, i) => {
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const dd = d.getDate().toString().padStart(2, '0');
                const hh = d.getHours().toString().padStart(2, '0');
                const label = `${mm}/${dd} ${hh}:00`;
                
                groups.push({
                    type: 'single',
                    indices: [i],
                    label: label,
                    timestamp: d.getTime(),
                    dateKey: `${d.getFullYear()}/${mm}/${dd}`
                });
            });
            this.cache.set(cacheKey, groups);
            return groups;
        }

        // 3. Mode: Aggregation (3h / 6h)
        const buckets = new Map();

        parsedDates.forEach((date, index) => {
            const h = date.getHours();
            
            let period = null;
            let dateOffset = 0; 
            
            if (mode === CONFIG.AGGREGATION.HOURS_6) {
                // 6 Hour Logic (Original: 00-06 is 'next day' belonging to previous grouping day)
                if (h >= 12 && h < 18)      period = '12-18';
                else if (h >= 18)           period = '18-00';
                else if (h >= 0 && h < 6)   { period = '00-06'; dateOffset = -1; } 
                else if (h >= 6 && h < 12)  { period = '06-12'; dateOffset = -1; }
            } 
            else { // 3 HOURS
                // 3 Hour Logic (Original: strictly calendar based)
                if (h >= 12 && h < 15) period = '12-15';
                else if (h >= 15 && h < 18) period = '15-18';
                else if (h >= 18 && h < 21) period = '18-21';
                else if (h >= 21)           period = '21-00';
                else if (h >= 0 && h < 3)   period = '00-03';
                else if (h >= 3 && h < 6)   period = '03-06';
                else if (h >= 6 && h < 9)   period = '06-09';
                else if (h >= 9 && h < 12)  period = '09-12';
            }

            if (!period) return;

            // Apply logic for correct "Grouping Date"
            const logicalDate = new Date(date);
            if (dateOffset !== 0) logicalDate.setDate(logicalDate.getDate() + dateOffset);
            
            const y = logicalDate.getFullYear();
            const m = logicalDate.getMonth() + 1;
            const d = logicalDate.getDate();
            const dateStr = `${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
            const key = `${dateStr}|${period}`;

            if (!buckets.has(key)) {
                buckets.set(key, {
                    type: 'period',
                    label: `${dateStr}\n${period}`,
                    dateKey: dateStr, 
                    periodLabel: period,
                    timestamp: date.getTime(), // Use first found time as sort key
                    indices: []
                });
            }
            
            buckets.get(key).indices.push(index);
        });

        // Convert buckets to array and filter for Time Window (Today Noon -> Tomorrow Noon)
        const result = Array.from(buckets.values())
            .filter(item => {
                const t = item.timestamp; 
                return t >= startFilter.getTime() && t < endFilter.getTime();
            })
            // Sort by time
            .sort((a, b) => a.timestamp - b.timestamp);

        this.cache.set(cacheKey, result);
        return result;
    }
};

// =============================================================================
// 4. QPF SERVICE
// =============================================================================
const QPFService = {
    colorTable: [
        { val: 0, rgb: [237, 249, 254] },   // #EDF9FE
        { val: 0.5, rgb: [194, 194, 194] }, // #C2C2C2
        { val: 1, rgb: [156, 252, 255] },   // #9CFCFF
        { val: 2, rgb: [3, 200, 255] },     // #03C8FF
        { val: 5, rgb: [5, 155, 255] },     // #059BFF
        { val: 10, rgb: [3, 99, 255] },     // #0363FF
        { val: 15, rgb: [5, 153, 2] },      // #059902
        { val: 20, rgb: [57, 255, 3] },     // #39FF03
        { val: 30, rgb: [255, 251, 3] },    // #FFFB03
        { val: 40, rgb: [255, 200, 0] },    // #FFC800
        { val: 50, rgb: [255, 149, 0] },    // #FF9500
        { val: 70, rgb: [255, 0, 0] },      // #FF0000
        { val: 90, rgb: [204, 0, 0] },      // #CC0000
        { val: 110, rgb: [153, 0, 0] },     // #990000
        { val: 130, rgb: [150, 0, 153] },   // #960099
        { val: 150, rgb: [201, 0, 204] },   // #C900CC
        { val: 200, rgb: [251, 0, 255] },   // #FB00FF
        { val: 300, rgb: [253, 201, 255] }  // #FDC9FF
    ],
    
    geoBounds: null, 
    townPolygons: new Map(),

    async process() {
        if (!App.state.locations.length) return;
        
        this.calculateGeoBounds();

        // Load Images
        const promises = CONFIG.QPF_URLS.map(url => this.loadImage(url));
        const images = await Promise.all(promises);

        // Setup Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const roiW = CONFIG.QPF_ROI.X_MAX - CONFIG.QPF_ROI.X_MIN;
        const roiH = CONFIG.QPF_ROI.Y_MAX - CONFIG.QPF_ROI.Y_MIN;
        canvas.width = roiW;
        canvas.height = roiH;

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            
            // Draw cropped ROI
            ctx.drawImage(img, 
                CONFIG.QPF_ROI.X_MIN, CONFIG.QPF_ROI.Y_MIN, roiW, roiH, 
                0, 0, roiW, roiH
            );
            const imgData = ctx.getImageData(0, 0, roiW, roiH);
            
            // Process per Location
            for (const loc of App.state.locations) {
                const maxVal = this.analyzeTown(loc.name, imgData, roiW, roiH);
                
                // Inject Data
                if (!loc.data["QPF"]) {
                    loc.data["QPF"] = { Time: [], ElementName: "QPF" };
                }
                
                // Add Timestep
                if (loc.data["QPF"].Time.length <= i) {
                     loc.data["QPF"].Time.push({
                         StartTime: `T+${(i+1)*6}`, 
                         ElementValue: { value: maxVal }
                     });
                } else {
                    loc.data["QPF"].Time[i].ElementValue.value = maxVal;
                }
            }
        }
    },

    loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(new Image()); 
            img.src = src;
        });
    },

    calculateGeoBounds() {
        if (!App.ui.layer) return;
        
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        
        App.ui.layer.eachLayer(layer => {
            const feature = layer.feature;
            const townName = feature.properties.town;
            const coords = feature.geometry.coordinates;
             
            // Handle GeoJSON MultiPolygon vs Polygon
            const polys = (feature.geometry.type === "Polygon") ? [coords] : coords;
            const processedPolys = [];

            polys.forEach(poly => {
                const ring = poly[0]; // Outer ring
                const points = [];
                ring.forEach(pt => {
                    const [lng, lat] = pt;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    points.push([lng, lat]);
                });
                processedPolys.push(points);
            });
            this.townPolygons.set(townName, processedPolys);
        });
        
        this.geoBounds = { minLng, maxLng, minLat, maxLat };
    },

    analyzeTown(name, imgData, w, h) {
        const polys = this.townPolygons.get(name);
        if (!polys || !this.geoBounds) return 0;

        const { minLng, maxLng, minLat, maxLat } = this.geoBounds;
        const lngRange = maxLng - minLng;
        const latRange = maxLat - minLat; 

        let maxRain = 0;

        // Optimization: Bounding box scan for polygons
        let pMinX = w, pMaxX = 0, pMinY = h, pMaxY = 0;
        
        const pixelPolys = polys.map(ring => {
            return ring.map(pt => {
                const [lng, lat] = pt;
                // Linear Mapping to ROI
                const x = Math.floor(((lng - minLng) / lngRange) * w);
                const y = Math.floor(((maxLat - lat) / latRange) * h); // Inverted Y-axis
                
                if (x < pMinX) pMinX = x;
                if (x > pMaxX) pMaxX = x;
                if (y < pMinY) pMinY = y;
                if (y > pMaxY) pMaxY = y;
                return [x, y];
            });
        });

        pMinX = Math.max(0, pMinX - 1); pMaxX = Math.min(w-1, pMaxX + 1);
        pMinY = Math.max(0, pMinY - 1); pMaxY = Math.min(h-1, pMaxY + 1);

        for (let y = pMinY; y <= pMaxY; y++) {
            for (let x = pMinX; x <= pMaxX; x++) {
                let inside = false;
                for (const ring of pixelPolys) {
                    if (this.pointInPoly(x, y, ring)) {
                        inside = true;
                        break;
                    }
                }
                
                if (inside) {
                     const idx = (y * w + x) * 4;
                     const r = imgData.data[idx];
                     const g = imgData.data[idx+1];
                     const b = imgData.data[idx+2];
                     
                     const val = this.matchColor(r, g, b);
                     if (val > maxRain) maxRain = val;
                }
            }
        }
        return maxRain;
    },

    pointInPoly(x, y, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0], yi = poly[i][1];
            const xj = poly[j][0], yj = poly[j][1];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    matchColor(r, g, b) {
        for (const entry of this.colorTable) {
            if (r == entry.rgb[0] && g == entry.rgb[1] && b == entry.rgb[2]) return entry.val;
        }
        return 0; 
    }
};

// =============================================================================
// 5. MAIN APPLICATION STATE
// =============================================================================
const App = {
    state: {
        locations: [],
        locationsMap: new Map(),
        meta: {},
        currentVar: null,
        currentSubVar: null,
        aggMode: CONFIG.AGGREGATION.HOURS_3, 
        currentDisplayItems: [],
        timeIndex: -1
    },
    
    ui: {
        map: null,
        layer: null,
        tableHeader: document.getElementById('table-header'),
        tableBody: document.getElementById('table-body'),
        timeDisplay: document.getElementById('current-time-display'),
        mapTimeDisplay: document.getElementById('map-time-display')
    },

    init() {
        this.cacheDOM(); 
        this.initMap();
        this.fetchData();
        this.bindEvents();
    },

    cacheDOM() {
        // Elements already cached in `ui` roughly, but good practice to ensure they exist
        this.ui.tableHeader = document.getElementById('table-header');
        this.ui.tableBody = document.getElementById('table-body');
        this.ui.timeDisplay = document.getElementById('current-time-display');
        this.ui.mapTimeDisplay = document.getElementById('map-time-display');
    },

    initMap() {
        // HTML2Canvas Compatibility Fixes:
        // 1. Force CPU rendering (any3d = false) to use top/left positioning.
        // 2. Disable animations to prevent transform artifacts.
        // 3. Use Canvas renderer (preferCanvas: true) for better image capture stability than SVG.
        if (L.Browser) {
            L.Browser.any3d = false;
        }

        this.ui.map = L.map('map', { 
            center: CONFIG.MAP.CENTER, 
            zoom: CONFIG.MAP.ZOOM,
            minZoom: CONFIG.MAP.ZOOM,
            maxZoom: CONFIG.MAP.ZOOM,
            zoomControl: false,
            preferCanvas: true,
            zoomAnimation: false,
            fadeAnimation: false,
            markerZoomAnimation: false
        });
        
        fetch(CONFIG.GEOJSON_URL)
            .then(r => r.json())
            .then(json => {
                const features = json.features.filter(f => f.properties.county && f.properties.county.includes("桃園"));
                features.forEach(f => {
                    const old = f.properties.town;
                    if (NAME_MAPPING[old]) f.properties.town = NAME_MAPPING[old];
                });

                this.ui.layer = L.geoJSON({ type: "FeatureCollection", features }, {
                    style: { color: "#666", weight: 1, fillOpacity: 0.7, fillColor: "#ccc" }, // Original Opacity 0.7
                    onEachFeature: (feature, layer) => {
                        layer.bindTooltip("", { 
                            permanent: true, direction: "center", className: "map-label" 
                        });
                    }
                }).addTo(this.ui.map);

                if (this.state.locations.length) this.renderMap();
            })
            .catch(e => console.error("GeoJSON failed", e));
    },

    async fetchData() {
        try {
            const res = await fetch(CONFIG.API_URL);
            const data = await res.json();
            
            const rawLocs = data.cwaopendata.Dataset.Locations.Location;
            this.state.meta = data.cwaopendata.Dataset.DatasetInfo.DataValueInfo || {};

            this.state.locations = rawLocs.map(loc => ({
                name: loc.LocationName,
                data: loc.WeatherElement.reduce((acc, el) => {
                    acc[el.ElementName] = el;
                    return acc;
                }, {})
            }));

            this.state.locations.forEach(l => this.state.locationsMap.set(l.name, l));

            this.initMenu();
            
        } catch (e) {
            console.error("Data Load Error", e);
            alert("氣象資料載入失敗");
        }
    },

    initMenu() {
        const sel = document.getElementById('variable-select');
        const keys = Object.keys(VARIABLE_MAPPING);
        
        sel.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
        this.state.currentVar = keys[0]; 
        
        this.updateSubMenu();
        this.updateData();
    },

    updateSubMenu() {
        const subSel = document.getElementById('sub-variable-select');
        const config = VARIABLE_MAPPING[this.state.currentVar];
        
        const exLoc = this.state.locations[0];
        const exEl = exLoc.data[config.key];
        
        let subKeys = [];
        if (exEl?.Time?.[0]?.ElementValue) {
            subKeys = Object.keys(exEl.Time[0].ElementValue);
        }

        if (subKeys.length > 1) {
            subSel.innerHTML = subKeys.map(k => {
                const label = this.state.meta[k]?.['@description'] || k;
                return `<option value="${k}">${label}</option>`;
            }).join('');
            subSel.style.display = 'inline-block';
            this.state.currentSubVar = subKeys[0];
        } else {
            subSel.style.display = 'none';
            this.state.currentSubVar = null;
        }
    },

    bindEvents() {
        document.getElementById('variable-select').addEventListener('change', async e => {
            this.state.currentVar = e.target.value;
            
            if (this.state.currentVar === "定量降水預報") {
                document.getElementById('aggregation-mode-select').disabled = true;
                this.state.aggMode = 'QPF';
                
                // Initialize QPF data if needed
                if (!this.state.locations[0].data["QPF"]) {
                     this.ui.timeDisplay.textContent = "正在解析雨量圖...";
                     await QPFService.process();
                }
            } else {
                document.getElementById('aggregation-mode-select').disabled = false;
                this.state.aggMode = document.getElementById('aggregation-mode-select').value;
            }

            this.state.timeIndex = -1;
            this.updateSubMenu();
            this.updateData();
        });

        document.getElementById('sub-variable-select').addEventListener('change', e => {
            this.state.currentSubVar = e.target.value;
            this.updateData(); // Re-calc data
        });

        document.getElementById('aggregation-mode-select').addEventListener('change', e => {
            this.state.aggMode = e.target.value;
            this.state.timeIndex = -1; 
            this.updateData();
        });

        document.getElementById('download-btn').addEventListener('click', () => {
            const mainElement = document.querySelector('main');
            if (!mainElement) return;

            if (typeof html2canvas === 'undefined') {
                alert('圖片下載模組尚未載入，請確認網路連線');
                return;
            }

            // Small delay to ensure any map rendering is stable
            setTimeout(() => {
                html2canvas(mainElement, {
                    useCORS: true, 
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    scale: 1 // Ensure 1:1 scale to avoid high-DPI scaling artifacts
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `NCU_Watcher_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }).catch(e => {
                    console.error(e);
                    alert('擷取圖片失敗');
                });
            }, 100);
        });
    },

    updateData() {
        const config = VARIABLE_MAPPING[this.state.currentVar];
        if (!config || !this.state.locations.length) return;

        const firstLoc = this.state.locations[0];
        const element = firstLoc.data[config.key];
        
        if (element && element.Time) {
            const rawTimes = element.Time.map(t => t.StartTime || t.DataTime);
            
            // QPF Mode or standard
            const mode = (this.state.currentVar === "定量降水預報") ? 'QPF' : this.state.aggMode;
            
            // Interval logic (Standard)
            let interval = 1;
            if (mode !== 'QPF' && rawTimes.length > 1) {
                const diff = new Date(rawTimes[1]) - new Date(rawTimes[0]);
                if (diff >= 3 * 3600 * 1000) interval = 3;
            }

            this.state.currentDisplayItems = TimeManager.generateGroups(
                rawTimes, 
                mode, 
                interval
            );
        } else {
            this.state.currentDisplayItems = [];
        }

        this.renderTable();
        this.renderMap();
        this.updateLabels();
    },

    renderTable() {
        const { tableHeader, tableBody } = this.ui;
        const items = this.state.currentDisplayItems;
        const config = VARIABLE_MAPPING[this.state.currentVar];

        tableHeader.innerHTML = '';
        
        // 1. HEADER GENERATION
        if (this.state.aggMode !== CONFIG.AGGREGATION.NONE && items.length > 0) {
            // Two-row header
            const row1 = document.createElement('tr');
            const row2 = document.createElement('tr');
            
            row1.innerHTML = `<th class="location-col" rowspan="2">行政區</th>`;
            
            let currentDate = null;
            let spanCount = 0;
            let dateTh = null;

            // Loop to merge date headers
            items.forEach((item, idx) => {
                if (item.dateKey !== currentDate) {
                    currentDate = item.dateKey;
                    spanCount = 1;
                    dateTh = document.createElement('th');
                    dateTh.className = 'date-header';
                    if (idx > 0) dateTh.classList.add('day-start');
                    dateTh.textContent = currentDate;
                    dateTh.colSpan = 1;
                    row1.appendChild(dateTh);
                } else {
                    spanCount++;
                    if (dateTh) dateTh.colSpan = spanCount;
                }

                // Time Header
                const th = document.createElement('th');
                const timeText = item.periodLabel || item.label.split(' ')[1];

                // Format time: split start and end to custom size (e.g. "12-15" -> "12" large, "-15" small)
                const match = timeText.match(/^(\d{1,2})(-.*)$/);
                if (match) {
                     th.innerHTML = `<span class="time-start">${match[1]}</span><span class="time-end">${match[2]}</span>`;
                } else {
                     th.textContent = timeText;
                }

                th.className = 'time-header'; 
                if (idx === this.state.timeIndex) th.classList.add('active-time');
                // Add day boundary styling
                if (idx > 0 && item.dateKey !== items[idx-1].dateKey) {
                    th.classList.add('day-start'); 
                }
                th.onclick = () => this.selectTime(idx);
                row2.appendChild(th);
            });

            tableHeader.appendChild(row1);
            tableHeader.appendChild(row2);
        } 
        else {
            // Single-row header
            const row = document.createElement('tr');
            row.innerHTML = `<th class="location-col">地區 / 時間</th>`;
            items.forEach((item, idx) => {
                const th = document.createElement('th');
                th.textContent = item.label;
                th.style.whiteSpace = "pre-line"; // Restored style
                if (idx === this.state.timeIndex) th.classList.add('active-time');
                th.onclick = () => this.selectTime(idx);
                row.appendChild(th);
            });
            tableHeader.appendChild(row);
        }

        // 2. BODY GENERATION
        const frag = document.createDocumentFragment();
        
        this.state.locations.forEach(loc => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.textContent = loc.name.replace('區', '');
            tr.appendChild(tdName);

            const element = loc.data[config.key];
            
            items.forEach((item, idx) => {
                const td = document.createElement('td');
                
                // Add day boundary styling
                if (idx > 0 && item.dateKey !== items[idx-1].dateKey) {
                    td.classList.add('day-start');
                }

                const { num, str, valid } = Utils.calculateAggregatedValue(
                    element, 
                    item.indices, 
                    this.state.currentSubVar
                );
                
                td.textContent = str;
                if (valid) {
                    // Added '80' transparency to match original UX
                    const baseColor = Utils.getColor(num, this.state.currentVar, this.state.currentSubVar);
                    td.style.backgroundColor = baseColor + '80';
                } else {
                    td.style.backgroundColor = '#cccccc'; // Match default
                }
                tr.appendChild(td);
            });
            frag.appendChild(tr);
        });
        
        tableBody.innerHTML = '';
        tableBody.appendChild(frag);
    },

    renderMap() {
        if (!this.ui.layer || !this.state.locations.length) return;
        
        const config = VARIABLE_MAPPING[this.state.currentVar];
        const unit = Utils.getUnit(this.state.currentVar, this.state.currentSubVar, this.state.meta);

        this.ui.layer.eachLayer(layer => {
            const town = layer.feature.properties.town; 
            const loc = this.state.locationsMap.get(town);
            
            let color = '#cccccc';
            let label = 'N/A';

            if (loc && loc.data[config.key]) {
                let num, str, valid = false;

                if (this.state.timeIndex === -1 && this.state.currentDisplayItems.length > 0) {
                     // Max Mode
                     let maxVal = -Infinity;
                     let maxStr = 'N/A';
                     this.state.currentDisplayItems.forEach(item => {
                         const res = Utils.calculateAggregatedValue(
                             loc.data[config.key], 
                             item.indices, 
                             this.state.currentSubVar
                         );
                         if (res.valid && res.num > maxVal) {
                             maxVal = res.num;
                             maxStr = res.str;
                             valid = true;
                         }
                     });
                     if (valid) {
                         num = maxVal;
                         str = maxStr;
                     }
                } else {
                    // Specific Time Mode
                    const activeItem = this.state.currentDisplayItems[this.state.timeIndex];
                    if (activeItem) {
                        const res = Utils.calculateAggregatedValue(
                            loc.data[config.key], 
                            activeItem.indices, 
                            this.state.currentSubVar
                        );
                        num = res.num;
                        str = res.str;
                        valid = res.valid;
                    }
                }
                
                if (valid) {
                    color = Utils.getColor(num, this.state.currentVar, this.state.currentSubVar);
                    label = `${str} ${unit}`;
                }
            }

            layer.setStyle({ fillColor: color, fillOpacity: 0.7 }); // Reseting valid styles
            
            const tooltipContent = `<div style="text-align:center"><b>${town.replaceAll('區', '')}</b><br>${label}</div>`;
            layer.setTooltipContent(tooltipContent);
        });
    },

    selectTime(idx) {
        // Toggle Feature: If clicking the currently active column, unselect it (return to Max Mode)
        if (this.state.timeIndex === idx) {
            this.state.timeIndex = -1;
        } else {
            this.state.timeIndex = idx;
        }
        
        // Update Table Headers
        // Strategy: find all terminal 'th' elements that represent time columns
        const allThs = this.ui.tableHeader.querySelectorAll('th');
        // Filter those that have checkable behavior or class
        // Easier: Re-render table headers? No, expensive.
        // DOM Manipulation:
        if (this.state.aggMode !== CONFIG.AGGREGATION.NONE) {
             const timeRow = this.ui.tableHeader.lastElementChild;
             Array.from(timeRow.children).forEach((th, i) => {
                 if (i === this.state.timeIndex) th.classList.add('active-time');
                 else th.classList.remove('active-time');
             });
        } else {
            const row = this.ui.tableHeader.firstElementChild;
             Array.from(row.children).forEach((th, i) => {
                 if (i === 0) return; // Skip location
                 if (i - 1 === this.state.timeIndex) th.classList.add('active-time');
                 else th.classList.remove('active-time');
             });
        }

        this.renderMap();
        this.updateLabels();
    },

    updateLabels() {
        if (this.state.timeIndex === -1) {
            this.ui.timeDisplay.textContent = "目前顯示時間：全時段最大值";
            this.ui.mapTimeDisplay.textContent = "全時段最大值";
            return;
        }

        const item = this.state.currentDisplayItems[this.state.timeIndex];
        if (!item) return;

        const text = item.label;
        this.ui.timeDisplay.textContent = `目前顯示時間：${text}`;

        // Map Time Display Logic from original
        let mapText = text;
        if (text.includes('\n')) {
            const [d, t] = text.split('\n');
            mapText = `所選日期：${d}\n小時區間：${t} 時`;
        }
        this.ui.mapTimeDisplay.textContent = mapText;
        this.ui.mapTimeDisplay.style.whiteSpace = "pre-line"; // Ensure newlines render
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
