// -----------------------------------------------------------------------------
// 0. Configuration & Constants
// -----------------------------------------------------------------------------
const CONFIG = {
    API_URL: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-D0047-005.json",
    GEOJSON_URL: "twtown2010.3.json",
    MAP: {
        CENTER: [24.89, 121.23],
        ZOOM: 11
    }
};

const NAME_MAPPING = {
    "桃園市": "桃園區",
    "中壢市": "中壢區",
    "平鎮市": "平鎮區",
    "八德市": "八德區",
    "楊梅市": "楊梅區",
    "大溪鎮": "大溪區",
    "蘆竹鄉": "蘆竹區",
    "大園鄉": "大園區",
    "龜山鄉": "龜山區",
    "龍潭鄉": "龍潭區",
    "新屋鄉": "新屋區",
    "觀音鄉": "觀音區",
    "復興鄉": "復興區"
};

const UNIT_MAPPING = {
    "攝氏度": "°C",
    "百分比": "%",
    "公尺/秒": "m/s",
    "蒲福風級": "級"
};

const VARIABLE_MAPPING = {
    "溫度": { 
        key: "溫度", 
        colors: ['#117388','#207E92','#2E899C','#3D93A6','#4C9EB0','#5BA9BA','#69B4C4','#78BFCE','#87CAD8','#96D4E2','#A4DFEC','#B3EAF6','#0C924B','#1D9A51','#2FA257','#40A95E','#51B164','#62B96A','#74C170','#85C876','#96D07C','#A7D883','#B9E089','#CAE78F','#DBEF95','#F4F4C3','#F7E78A','#F4D576','#F1C362','#EEB14E','#EA9E3A','#E78C26','#E07B03','#ED5138','#ED1759','#AD053A','#780101','#9C68AD','#845194','#8520A0'],
        thresholds: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]]
    }, 
    "降雨機率": { 
        key: "3小時降雨機率", 
        colors: ['#2446a9', '#2d59a0', '#396b94', '#497b85', '#60927b', '#7bae74', '#99cc6d', '#c4ea67', '#ffff66', '#FFCB00', '#FF9A00'],
        thresholds: [[1, 2, 5, 8, 15, 20, 25, 30, 35, 40]]
    }, 
    "相對濕度": { 
        key: "相對濕度",  
        colors: ["#D3E6EB", "#A7CFD8","#82F550","#4ADC0C","#93F4FF","#2DEAFF","#02D4E3"],
        thresholds: [[65,70,75,80,85,90]]
    }, 
    "風速": { 
        key: "風速", 
        colors: ['#FFFFFF', '#E7FFFF', '#D5FFEB', '#C7F4E0', '#FFFEA5', '#F2DB79', '#E6B167', '#EA83ED', '#B940BD', '#6942AE', '#272F6E'],
        thresholds: [
            [5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7, 41.5],
            [4, 5, 6, 7, 8, 9, 10, 11, 12, 14]
        ]
    }
};

// -----------------------------------------------------------------------------
// 1. Data Store & State Management
// -----------------------------------------------------------------------------
const AppState = {
    rawData: null,
    dataValueInfo: {},
    locationsList: [],
    // Optimization: Quick lookup map [LocationName -> WeatherData]
    locationsMap: new Map(), 
    timeLabels: [],
    
    // UI selections
    currentVariable: null,
    currentSubVariable: null,
    selectedTimeIndex: 0,
    isSixHourAggregation: true,

    // Map instances
    map: null,
    geoJsonLayer: null,
};

// -----------------------------------------------------------------------------
// 2. Utility Functions (Business Logic)
// -----------------------------------------------------------------------------
const Utils = {
    /**
     * Parse raw string value to number, handling "<= 1".
     * @returns {Object} { num: Number|NaN, str: String, hasData: Boolean }
     */
    parseWeatherValue(valStr) {
        if (valStr === null || valStr === undefined) {
            return { num: NaN, str: "N/A", hasData: false };
        }

        let v = parseFloat(valStr);
        let str = valStr;

        // Handle string cases
        if (typeof valStr === 'string') {
            if (valStr.includes('<=')) {
                v = 0; // Treat as 0 for logic
            } else if (isNaN(v)) {
                // Try extract number
                const match = valStr.match(/(\d+(\.\d+)?)/);
                if (match) v = parseFloat(match[0]);
            }
        }

        return {
            num: v,
            str: str,
            hasData: !isNaN(v)
        };
    },

    /**
     * Get aggregate value (max) for 6-hour window, or single value.
     */
    getDisplayData(weatherElement, timeStartIndex, isAggregated, subVarKey) {
        const count = isAggregated ? 6 : 1;
        
        let maxVal = -Infinity;
        let displayStr = "N/A";
        let foundData = false;

        // Loop through time range
        for (let k = 0; k < count; k++) {
            const idx = timeStartIndex + k;
            if (idx >= weatherElement.Time.length) break;

            const t = weatherElement.Time[idx];
            if (!t || !t.ElementValue) continue;

            // Extract raw string
            let valStr = null;
            if (subVarKey && t.ElementValue[subVarKey] !== undefined) {
                valStr = t.ElementValue[subVarKey];
            } else {
                // Default to first value if unknown
                const vals = Object.values(t.ElementValue);
                if (vals.length > 0) valStr = vals[0];
            }

            const parsed = this.parseWeatherValue(valStr);
            
            if (parsed.hasData) {
                if (parsed.num > maxVal) {
                    maxVal = parsed.num;
                    displayStr = parsed.str;
                }
                foundData = true;
            }
        }

        return {
            rawVal: foundData ? maxVal : 0,
            displayVal: foundData ? displayStr : "N/A",
            hasData: foundData
        };
    },

    /**
     * Determine color based on value and variable config.
     */
    getColor(val, varKey, subVarKey) {
        if (isNaN(val)) return '#cccccc';
        if (!VARIABLE_MAPPING[varKey]) return '#cccccc';

        const config = VARIABLE_MAPPING[varKey];
        const colors = config.colors;
        let thresholds = config.thresholds;

        // Handle nested thresholds (e.g. Wind Speed vs Beaufort)
        let activeThresholds = thresholds;
        if (thresholds && thresholds.length > 0 && Array.isArray(thresholds[0])) {
            let tIndex = 0;
            if (varKey === "風速" && subVarKey === "BeaufortScale") {
                tIndex = 1;
            }
            activeThresholds = (tIndex < thresholds.length) ? thresholds[tIndex] : thresholds[0];
        }

        // Find color index
        let index = 0;
        if (activeThresholds && activeThresholds.length > 0) {
            index = activeThresholds.findIndex(t => val < t);
            if (index === -1) index = activeThresholds.length;
        } else {
            // Default distribution
            index = Math.floor(val / (100 / colors.length));
        }

        // Clamp index
        if (index >= colors.length) index = colors.length - 1;
        if (index < 0) index = 0;

        return colors[index] || colors[0];
    },

    /**
     * Get display unit.
     */
    getUnit(varKey, subVarKey, metaInfo) {
        // Default unit from config
        let unit = VARIABLE_MAPPING[varKey]?.unit || ""; // Default if defined

        // Override from API metadata if available
        if (subVarKey && metaInfo && metaInfo[subVarKey] && metaInfo[subVarKey]['@unit']) {
            const u = metaInfo[subVarKey]['@unit'];
            if (u && u !== "NA" && u !== "null") {
                unit = UNIT_MAPPING[u] || u;
            }
        }
        return unit;
    }
};

// -----------------------------------------------------------------------------
// 3. UI Controller & Initialization
// -----------------------------------------------------------------------------
const UI = {
    init() {
        this.initMap();
        this.fetchData();
        this.setupListeners();
    },

    initMap() {
        AppState.map = L.map('map', {
            center: CONFIG.MAP.CENTER,
            zoom: CONFIG.MAP.ZOOM
        });
        this.loadGeoJSON();
    },

    async loadGeoJSON() {
        try {
            const response = await fetch(CONFIG.GEOJSON_URL);
            const json = await response.json();

            // Filter for Taoyuan
            const taoyuanFeatures = json.features.filter(f => 
                f.properties.county && f.properties.county.includes("桃園")
            );

            // Normalize Names
            taoyuanFeatures.forEach(f => {
                const oldName = f.properties.town;
                if (NAME_MAPPING[oldName]) {
                    f.properties.town = NAME_MAPPING[oldName];
                }
            });

            const collection = { type: "FeatureCollection", features: taoyuanFeatures };

            AppState.geoJsonLayer = L.geoJSON(collection, {
                style: { color: "#666", weight: 1, fillOpacity: 0.7, fillColor: "#ccc" },
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(feature.properties.town, {
                        permanent: true,
                        direction: "center",
                        className: "map-label"
                    });
                }
            }).addTo(AppState.map);

            // Check if data is ready to render
            if (AppState.locationsList.length > 0) {
                this.renderMap();
            }

        } catch (e) {
            console.error("GeoJSON Error:", e);
        }
    },

    async fetchData() {
        try {
            const response = await fetch(CONFIG.API_URL);
            const json = await response.json();
            
            AppState.rawData = json.cwaopendata.Dataset.Locations.Location;
            AppState.dataValueInfo = json.cwaopendata.Dataset.DatasetInfo.DataValueInfo || {};
            
            console.log("Data Loaded:", AppState.rawData);
            
            this.processData();
            this.renderMenu();
            this.updateSubMenu();
            this.updateView();

        } catch (error) {
            console.error("Fetch Error:", error);
            alert("Unable to load weather data.");
        }
    },

    processData() {
        if (!AppState.rawData) return;

        // Process Locations
        AppState.locationsList = AppState.rawData.map(loc => ({
            name: loc.LocationName,
            lat: parseFloat(loc.Latitude),
            lng: parseFloat(loc.Longitude),
            data: loc.WeatherElement
        }));

        // Build Map for O(1) Access
        AppState.locationsList.forEach(loc => {
            AppState.locationsMap.set(loc.name, loc);
        });

        // Process Time Labels (from first variable of first location)
        const definedVars = Object.keys(VARIABLE_MAPPING);
        if (definedVars.length === 0) return;

        const firstKey = VARIABLE_MAPPING[definedVars[0]].key;
        const firstLoc = AppState.rawData[0];
        const targetEl = firstLoc.WeatherElement.find(el => el.ElementName === firstKey);

        if (targetEl && targetEl.Time) {
            AppState.timeLabels = targetEl.Time.map(t => {
                const d = new Date(t.StartTime || t.DataTime);
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const dd = d.getDate().toString().padStart(2, '0');
                const HH = d.getHours().toString().padStart(2, '0');
                return `${mm}/${dd} ${HH}:00`;
            });
        }
    },

    renderMenu() {
        const select = document.getElementById('variable-select');
        select.innerHTML = '';
        const keys = Object.keys(VARIABLE_MAPPING);
        
        keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            select.appendChild(opt);
        });

        // Set default
        if (!AppState.currentVariable || !VARIABLE_MAPPING[AppState.currentVariable]) {
            AppState.currentVariable = keys[0];
        }
        select.value = AppState.currentVariable;
    },

    updateSubMenu() {
        const subSelect = document.getElementById('sub-variable-select');
        const varConfig = VARIABLE_MAPPING[AppState.currentVariable];
        
        if (!varConfig || AppState.locationsList.length === 0) {
            subSelect.style.display = 'none';
            AppState.currentSubVariable = null;
            return;
        }

        // Check structure of first location
        const firstLoc = AppState.locationsList[0];
        const weatherEl = firstLoc.data.find(el => el.ElementName === varConfig.key);
        
        let keys = [];
        if (weatherEl?.Time?.[0]?.ElementValue) {
             const ev = weatherEl.Time[0].ElementValue;
             if (typeof ev === 'object') keys = Object.keys(ev);
        }

        if (keys.length > 1) {
            subSelect.innerHTML = '';
            keys.forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                // Get display name from metadata
                let name = key;
                const meta = AppState.dataValueInfo[key];
                if (meta && meta['@description']) name = meta['@description'];
                
                opt.textContent = name;
                subSelect.appendChild(opt);
            });

            // Maintain selection or default
            if (!AppState.currentSubVariable || !keys.includes(AppState.currentSubVariable)) {
                AppState.currentSubVariable = keys[0];
            }
            subSelect.value = AppState.currentSubVariable;
            subSelect.style.display = 'inline-block';
        } else {
            subSelect.style.display = 'none';
            AppState.currentSubVariable = keys.length > 0 ? keys[0] : null;
        }
    },

    setupListeners() {
        document.getElementById('variable-select').addEventListener('change', (e) => {
            AppState.currentVariable = e.target.value;
            this.updateSubMenu();
            this.updateView();
        });

        document.getElementById('sub-variable-select').addEventListener('change', (e) => {
            AppState.currentSubVariable = e.target.value;
            this.updateView();
        });

        document.getElementById('six-hour-toggle').addEventListener('change', (e) => {
            AppState.isSixHourAggregation = e.target.checked;
            AppState.selectedTimeIndex = 0;
            this.updateView();
        });
    },

    updateView() {
        this.renderTable();
        this.renderMap();
    },

    renderTable() {
        const thead = document.getElementById('table-header');
        const tbody = document.getElementById('table-body');
        
        if (!AppState.currentVariable) return;
        const varConfig = VARIABLE_MAPPING[AppState.currentVariable];

        // 1. Build Headers
        thead.innerHTML = '';
        const thLoc = document.createElement('th');
        thLoc.textContent = "地區 / 時間";
        thLoc.classList.add('location-col');
        thead.appendChild(thLoc);

        // Determine indices to display
        let displayIndices = [];
        if (AppState.isSixHourAggregation) {
            for(let i=0; i < AppState.timeLabels.length; i+=6) displayIndices.push(i);
        } else {
            displayIndices = AppState.timeLabels.map((_, i) => i);
        }

        displayIndices.forEach((realIdx, viewIdx) => {
            const th = document.createElement('th');
            let label = AppState.timeLabels[realIdx];
            
            // Format for aggregation?
            if (AppState.isSixHourAggregation) {
                const endIdx = Math.min(realIdx + 5, AppState.timeLabels.length - 1);
                if (endIdx > realIdx) {
                     const startT = label.split(' ')[1];
                     const endT = AppState.timeLabels[endIdx].split(' ')[1];
                     label = `${label.split(' ')[0]}\n${startT}~${endT}`;
                }
            }

            th.textContent = label;
            th.style.whiteSpace = "pre-line";
            th.onclick = () => this.selectTime(viewIdx);

            if (viewIdx === AppState.selectedTimeIndex) {
                th.classList.add('active-time');
                this.updateTimeDisplay(label.replace('\n', ' '));
            }
            thead.appendChild(th);
        });

        // 2. Build Rows
        tbody.innerHTML = '';
        AppState.locationsList.forEach(loc => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.textContent = loc.name;
            tr.appendChild(tdName);

            // Find weather element
            const el = loc.data.find(e => e.ElementName === varConfig.key);

            displayIndices.forEach(realIdx => {
                const td = document.createElement('td');
                let color = '#cccccc';
                let text = "N/A";

                if (el) {
                    // Logic extracted to Utils
                    const result = Utils.getDisplayData(
                        el, 
                        realIdx, 
                        AppState.isSixHourAggregation, 
                        AppState.currentSubVariable
                    );

                    text = result.displayVal;
                    if (result.hasData) {
                        color = Utils.getColor(result.rawVal, AppState.currentVariable, AppState.currentSubVariable);
                    }
                }

                td.textContent = text;
                td.style.backgroundColor = color + '80'; // Transparency
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    },

    renderMap() {
        if (!AppState.geoJsonLayer || AppState.locationsList.length === 0) return;
        
        const varConfig = VARIABLE_MAPPING[AppState.currentVariable];
        if (!varConfig) return;

        // Determine time start index
        let realStartIndex = AppState.selectedTimeIndex;
        if (AppState.isSixHourAggregation) {
            realStartIndex = AppState.selectedTimeIndex * 6;
        }

        AppState.geoJsonLayer.eachLayer(layer => {
            let name = layer.feature.properties.town;
            if (NAME_MAPPING[name]) name = NAME_MAPPING[name];

            // O(1) Lookup
            const locData = AppState.locationsMap.get(name);
            
            let color = "#cccccc";
            let displayVal = "N/A";
            
            if (locData) {
                const el = locData.data.find(e => e.ElementName === varConfig.key);
                if (el) {
                    const result = Utils.getDisplayData(
                        el, 
                        realStartIndex, 
                        AppState.isSixHourAggregation, 
                        AppState.currentSubVariable
                    );
                    
                    if (result.hasData) {
                        displayVal = result.displayVal;
                        color = Utils.getColor(result.rawVal, AppState.currentVariable, AppState.currentSubVariable);
                    }
                }
            }

            layer.setStyle({
                fillColor: color,
                fillOpacity: 0.8,
                color: "white",
                weight: 1
            });

            // Get Unit
            const unit = Utils.getUnit(AppState.currentVariable, AppState.currentSubVariable, AppState.dataValueInfo);
            
            const tooltipContent = `<div style="text-align:center">
                <b>${name}</b><br>
                ${displayVal} ${unit}
            </div>`;
            
            layer.unbindTooltip();
            layer.bindTooltip(tooltipContent, {
                permanent: true,
                direction: "center",
                className: "map-label"
            });
        });
    },

    selectTime(viewIndex) {
        AppState.selectedTimeIndex = viewIndex;
        // Update header UI only (Optimization: don't re-render whole table)
        const headers = document.querySelectorAll('#table-header th');
        headers.forEach((th, i) => {
            if (i === 0) return;
            if (i - 1 === viewIndex) {
                th.classList.add('active-time');
                this.updateTimeDisplay(th.textContent.replace(/\n/g, ' '));
            } else {
                th.classList.remove('active-time');
            }
        });
        
        this.renderMap();
    },

    updateTimeDisplay(str) {
        document.getElementById('current-time-display').textContent = `目前顯示時間：${str}`;
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => UI.init());
