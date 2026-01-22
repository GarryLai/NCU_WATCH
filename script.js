// -----------------------------------------------------------------------------
// 0. Configuration & Constants
// -----------------------------------------------------------------------------
const CONFIG = {
    API_URL: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-D0047-005.json",
    GEOJSON_URL: "twtown2010.3.json",
    MAP: {
        CENTER: [24.85, 121.23],
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

// 定義3小時時段（從中午12點開始）
// 注意: 每個時段包含3個整點小時，例如12-15包含12, 13, 14點
const TIME_PERIODS = [
    { start: 12, end: 15, label: '12-15', hours: [12, 13, 14] },
    { start: 15, end: 18, label: '15-18', hours: [15, 16, 17] },
    { start: 18, end: 21, label: '18-21', hours: [18, 19, 20] },
    { start: 21, end: 24, label: '21-00', hours: [21, 22, 23] },
    { start: 0, end: 3, label: '00-03', hours: [0, 1, 2] },
    { start: 3, end: 6, label: '03-06', hours: [3, 4, 5] },
    { start: 6, end: 9, label: '06-09', hours: [6, 7, 8] },
    { start: 9, end: 12, label: '09-12', hours: [9, 10, 11] }
];

// 定義6小時時段（今日12-18、18-00、隔日00-06、06-12）
const TIME_PERIODS_6HOURS = [
    { start: 12, end: 18, label: '12-18', hours: [12, 13, 14, 15, 16, 17], isToday: true },
    { start: 18, end: 24, label: '18-00', hours: [18, 19, 20, 21, 22, 23], isCrossDay: true },
    { start: 0, end: 6, label: '00-06', hours: [0, 1, 2, 3, 4, 5], isNextDay: true },
    { start: 6, end: 12, label: '06-12', hours: [6, 7, 8, 9, 10, 11], isNextDay: true }
];

const VARIABLE_MAPPING = {
    "溫度": { 
        key: "溫度",
        dataInterval: 1,  // 每小時一筆
        colors: ['#117388','#207E92','#2E899C','#3D93A6','#4C9EB0','#5BA9BA','#69B4C4','#78BFCE','#87CAD8','#96D4E2','#A4DFEC','#B3EAF6','#0C924B','#1D9A51','#2FA257','#40A95E','#51B164','#62B96A','#74C170','#85C876','#96D07C','#A7D883','#B9E089','#CAE78F','#DBEF95','#F4F4C3','#F7E78A','#F4D576','#F1C362','#EEB14E','#EA9E3A','#E78C26','#E07B03','#ED5138','#ED1759','#AD053A','#780101','#9C68AD','#845194','#8520A0'],
        thresholds: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]]
    }, 
    "降雨機率": { 
        key: "3小時降雨機率",
        dataInterval: 3,  // 月3小時一筆
        colors: ['#FFFFFF', '#E0F2F7', '#B3D9E8', '#7FB3D5', '#4A90C2', '#2E5C8A', '#FF9500', '#FF6B35', '#E63946', '#A4161A', '#5C0A0A'],
        // thresholds: [[1, 2, 5, 8, 15, 20, 25, 30, 35, 40]]
        thresholds: [[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]]
    }, 
    "相對濕度": { 
        key: "相對濕度",
        dataInterval: 1,  // 每小時一筆
        colors: ["#D3E6EB", "#A7CFD8","#82F550","#4ADC0C","#93F4FF","#2DEAFF","#02D4E3"],
        thresholds: [[65,70,75,80,85,90]]
    }, 
    "風速": { 
        key: "風速",
        dataInterval: 3,  // 月3小時一筆
        colors: ['#FFFFFF', '#b0fff2', '#80f9be', '#50fcaf', '#FFFEA5', 
            '#F2DB79', '#E6B167', '#EA83ED', '#B940BD', '#6942AE', '#272F6E'],
        thresholds: [
            // [5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7, 41.5],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            // [4, 5, 6, 7, 8, 9, 10, 11, 12, 14]
            [2, 4, 6, 8, 10, 12, 14, 15, 16, 17]
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
    aggregationMode: '3hours',  // '3hours', '6hours', 或 'none'（不合併）
    timePeriods: [],  // 儲存時段分組資訊
    currentDisplayItems: [],  // 儲存當前顯示的時間項目（用於時間標籤顯示）

    // Map instances
    map: null,
    geoJsonLayer: null,
};

// -----------------------------------------------------------------------------
// 2. Utility Functions (Business Logic)
// -----------------------------------------------------------------------------
const Utils = {
    /**
     * 根據時間找到對應的時段
     * @param {Date} date - 時間物件
     * @returns {Object|null} - 時段物件或null
     */
    getTimePeriod(date) {
        const hour = date.getHours();
        return TIME_PERIODS.find(p => {
            if (p.start < p.end) {
                return hour >= p.start && hour < p.end;
            } else {
                // 跨日時段（如21-00）
                return hour >= p.start || hour < p.end;
            }
        });
    },

    /**
     * 將時間序列按時段分組
     * @param {Array} timeArray - 時間陣列
     * @param {Number} dataInterval - 資料間隔（小時），1=每小時, 3=月3小時
     * @returns {Array} - 時段分組陣列
     */
    groupTimesByPeriod(timeArray, dataInterval = 1) {
        const periodGroups = [];
        const processedDates = new Set();
        
        timeArray.forEach((timeStr, idx) => {
            const date = new Date(timeStr);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const period = this.getTimePeriod(date);
            
            if (period) {
                const groupKey = `${dateKey}-${period.label}`;
                if (!processedDates.has(groupKey)) {
                    processedDates.add(groupKey);
                    
                    // 根據資料間隔找出該時段內的所有時間索引
                    const indices = [];
                    
                    if (dataInterval === 1) {
                        // 逐時資料：找出時段內的所有3個小時 (12, 13, 14)
                        for (let i = 0; i < timeArray.length; i++) {
                            const checkDate = new Date(timeArray[i]);
                            const checkDateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
                            const checkPeriod = this.getTimePeriod(checkDate);
                            
                            if (checkDateKey === dateKey && checkPeriod && checkPeriod.label === period.label) {
                                indices.push(i);
                            }
                        }
                    } else if (dataInterval === 3) {
                        // 3小時資料：只需要找到該時段的起始時間點 (12:00)
                        for (let i = 0; i < timeArray.length; i++) {
                            const checkDate = new Date(timeArray[i]);
                            const checkHour = checkDate.getHours();
                            const checkDateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
                            
                            // 檢查是否為該時段的起始時間
                            if (checkDateKey === dateKey && checkHour === period.start) {
                                indices.push(i);
                                break;  // 3小時資料只有一筆
                            }
                        }
                    }
                    
                    if (indices.length > 0) {
                        // 所有時段都包含日期資訊（格式：YYYY/MM/DD）
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const displayLabel = `${year}/${month}/${day}\n${period.label}`;
                        
                        // Debug: 輸出時段資訊
                        const debugTimes = indices.map(i => {
                            const d = new Date(timeArray[i]);
                            return `${d.getHours()}:00`;
                        });
                        console.log(`[Interval=${dataInterval}h] Period ${period.label}: indices=${indices}, times=[${debugTimes.join(', ')}]`);
                        
                        periodGroups.push({
                            period: period,
                            dateKey: dateKey,
                            indices: indices,
                            displayLabel: displayLabel,
                            timestamp: date.getTime()  // 添加時間戳記方便排序和過濾
                        });
                    }
                }
            }
        });
        
        return periodGroups;
    },

    /**
     * 將時間序列按6小時時段分組
     * @param {Array} timeArray - 時間陣列
     * @param {Number} dataInterval - 資料間隔（小時），1=每小時, 3=月3小時
     * @returns {Array} - 6小時時段分組陣列
     */
    groupTimesByPeriod6Hours(timeArray, dataInterval = 1) {
        const periodGroups = [];
        const processedDates = new Set();
        
        timeArray.forEach((timeStr, idx) => {
            const date = new Date(timeStr);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const hour = date.getHours();
            
            // 確定6小時時段
            let period = null;
            let effectiveDate = date;
            
            if (hour >= 12 && hour < 18) {
                period = TIME_PERIODS_6HOURS[0]; // 12-18
            } else if (hour >= 18) {
                period = TIME_PERIODS_6HOURS[1]; // 18-00（跨日）
            } else if (hour < 6) {
                period = TIME_PERIODS_6HOURS[2]; // 00-06（隔日）
                // 對於00-06時段，應該使用前一天的日期作為groupKey
                effectiveDate = new Date(date);
                effectiveDate.setDate(effectiveDate.getDate() - 1);
            } else if (hour >= 6 && hour < 12) {
                period = TIME_PERIODS_6HOURS[3]; // 06-12（隔日）
                // 對於06-12時段，應該使用前一天的日期作為groupKey
                effectiveDate = new Date(date);
                effectiveDate.setDate(effectiveDate.getDate() - 1);
            }
            
            if (period) {
                const effectiveDateKey = `${effectiveDate.getFullYear()}-${effectiveDate.getMonth()}-${effectiveDate.getDate()}`;
                const groupKey = `${effectiveDateKey}-${period.label}`;
                
                if (!processedDates.has(groupKey)) {
                    processedDates.add(groupKey);
                    
                    // 找出該時段內的所有時間索引
                    const indices = [];
                    
                    if (dataInterval === 1) {
                        // 逐時資料：找出時段內的所有6個小時
                        for (let i = 0; i < timeArray.length; i++) {
                            const checkDate = new Date(timeArray[i]);
                            const checkHour = checkDate.getHours();
                            const checkDateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
                            
                            let matchPeriod = null;
                            let checkEffectiveDate = checkDate;
                            
                            if (checkHour >= 12 && checkHour < 18) {
                                matchPeriod = TIME_PERIODS_6HOURS[0];
                            } else if (checkHour >= 18) {
                                matchPeriod = TIME_PERIODS_6HOURS[1];
                            } else if (checkHour < 6) {
                                matchPeriod = TIME_PERIODS_6HOURS[2];
                                checkEffectiveDate = new Date(checkDate);
                                checkEffectiveDate.setDate(checkEffectiveDate.getDate() - 1);
                            } else if (checkHour >= 6 && checkHour < 12) {
                                matchPeriod = TIME_PERIODS_6HOURS[3];
                                checkEffectiveDate = new Date(checkDate);
                                checkEffectiveDate.setDate(checkEffectiveDate.getDate() - 1);
                            }
                            
                            const checkEffectiveDateKey = `${checkEffectiveDate.getFullYear()}-${checkEffectiveDate.getMonth()}-${checkEffectiveDate.getDate()}`;
                            
                            if (checkEffectiveDateKey === effectiveDateKey && matchPeriod && matchPeriod.label === period.label) {
                                indices.push(i);
                            }
                        }
                    } else if (dataInterval === 3) {
                        // 3小時資料：找該時段的起始時間點
                        for (let i = 0; i < timeArray.length; i++) {
                            const checkDate = new Date(timeArray[i]);
                            const checkHour = checkDate.getHours();
                            const checkDateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
                            
                            let checkEffectiveDate = checkDate;
                            
                            if (checkHour < 6) {
                                checkEffectiveDate = new Date(checkDate);
                                checkEffectiveDate.setDate(checkEffectiveDate.getDate() - 1);
                            } else if (checkHour >= 6 && checkHour < 12) {
                                checkEffectiveDate = new Date(checkDate);
                                checkEffectiveDate.setDate(checkEffectiveDate.getDate() - 1);
                            }
                            
                            const checkEffectiveDateKey = `${checkEffectiveDate.getFullYear()}-${checkEffectiveDate.getMonth()}-${checkEffectiveDate.getDate()}`;
                            
                            // 檢查是否為該時段的起始時間
                            if (checkEffectiveDateKey === effectiveDateKey && checkHour === period.start) {
                                indices.push(i);
                                break;  // 3小時資料只有一筆
                            }
                        }
                    }
                    
                    if (indices.length > 0) {
                        // 所有時段都包含日期資訊（格式：YYYY/MM/DD）
                        const year = effectiveDate.getFullYear();
                        const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
                        const day = String(effectiveDate.getDate()).padStart(2, '0');
                        const displayLabel = `${year}/${month}/${day}\n${period.label}`;
                        
                        periodGroups.push({
                            period: period,
                            dateKey: effectiveDateKey,
                            indices: indices,
                            displayLabel: displayLabel,
                            timestamp: effectiveDate.getTime()
                        });
                    }
                }
            }
        });
        
        return periodGroups;
    },

    /**
     * 過濾出今天中午12點到明天中午12點的時段
     * @param {Array} periodGroups - 所有時段分組
     * @returns {Array} - 過濾後的時段分組
     */
    filterTodayPeriods(periodGroups) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // 今天中午12點
        const todayNoon = new Date(today);
        todayNoon.setHours(12, 0, 0, 0);
        
        // 明天中午12點
        const tomorrowNoon = new Date(today);
        tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
        tomorrowNoon.setHours(12, 0, 0, 0);
        
        // 過濾出在時間範圍內的時段
        return periodGroups.filter(pg => {
            const pgDate = new Date(pg.timestamp);
            // 時段的開始時間要 >= 今天中午 且 < 明天中午
            return pgDate >= todayNoon && pgDate < tomorrowNoon;
        });
    },

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
     * Get aggregate value (max) for time period or single value.
     * @param {Object} weatherElement - 天氣元素資料
     * @param {Array|Number} timeIndices - 時間索引陣列（時段模式）或單一索引
     * @param {String} subVarKey - 子變量鍵值
     */
    getDisplayData(weatherElement, timeIndices, subVarKey) {
        let maxVal = -Infinity;
        let displayStr = "N/A";
        let foundData = false;

        // 支援單一索引或索引陣列
        const indices = Array.isArray(timeIndices) ? timeIndices : [timeIndices];

        // Loop through time indices
        for (const idx of indices) {
            if (idx >= weatherElement.Time.length) continue;

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
            
            // 生成時段分組資訊（預設使用1小時間隔，即溫度資料）
            const rawTimes = targetEl.Time.map(t => t.StartTime || t.DataTime);
            const allPeriods = Utils.groupTimesByPeriod(rawTimes, 1);
            
            // 僅保留今天中午到明天中午的時段
            AppState.timePeriods = Utils.filterTodayPeriods(allPeriods);
            
            console.log('Filtered Periods (Today Noon to Tomorrow Noon):', AppState.timePeriods);
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

        document.getElementById('aggregation-mode-select').addEventListener('change', (e) => {
            AppState.aggregationMode = e.target.value;
            AppState.selectedTimeIndex = 0;
            this.updateView();
        });
    },

    updateView() {
        this.renderTable();
        this.renderMap();
        
        // Initialize time display after rendering table
        if (AppState.currentDisplayItems.length > 0 && AppState.selectedTimeIndex < AppState.currentDisplayItems.length) {
            const item = AppState.currentDisplayItems[AppState.selectedTimeIndex];
            this.updateTimeDisplay(item.label);
        }
    },

    renderTable() {
        const thead = document.getElementById('table-header');
        const tbody = document.getElementById('table-body');
        
        if (!AppState.currentVariable) return;
        const varConfig = VARIABLE_MAPPING[AppState.currentVariable];

        // 1. Build Headers
        thead.innerHTML = '';
        
        // Determine what to display: periods or individual times
        let displayItems = [];
        if (AppState.aggregationMode !== 'none' && AppState.timePeriods.length > 0) {
            // 根據聚合模式和當前變量的資料間隔生成時段分組
            const dataInterval = varConfig.dataInterval || 1;
            
            // 找到當前變量的資料
            const firstLoc = AppState.locationsList[0];
            const weatherEl = firstLoc.data.find(el => el.ElementName === varConfig.key);
            
            if (weatherEl && weatherEl.Time) {
                const rawTimes = weatherEl.Time.map(t => t.StartTime || t.DataTime);
                
                if (AppState.aggregationMode === '3hours') {
                    // 3小時模式
                    const allPeriods = Utils.groupTimesByPeriod(rawTimes, dataInterval);
                    const filteredPeriods = Utils.filterTodayPeriods(allPeriods);
                    
                    displayItems = filteredPeriods.map(pg => ({
                        type: 'period',
                        indices: pg.indices,
                        label: pg.displayLabel,
                        timestamp: pg.timestamp
                    }));
                } else if (AppState.aggregationMode === '6hours') {
                    // 6小時模式
                    const allPeriods6h = Utils.groupTimesByPeriod6Hours(rawTimes, dataInterval);
                    const filteredPeriods6h = Utils.filterTodayPeriods(allPeriods6h);
                    
                    displayItems = filteredPeriods6h.map(pg => ({
                        type: 'period',
                        indices: pg.indices,
                        label: pg.displayLabel,
                        timestamp: pg.timestamp
                    }));
                }
            }
        } else {
            // 使用單一時間點模式
            displayItems = AppState.timeLabels.map((label, i) => ({
                type: 'single',
                indices: [i],
                label: label
            }));
        }

        // 保存當前顯示項目到 AppState（用於 selectTime 顯示時間標籤）
        AppState.currentDisplayItems = displayItems;

        // 時段模式：建立兩行表頭（日期行 + 時間行）
        if (AppState.aggregationMode !== 'none' && displayItems.length > 0) {
            // 第一行：日期行
            const dateRow = document.createElement('tr');
            const thLocDate = document.createElement('th');
            thLocDate.textContent = "地區";
            thLocDate.classList.add('location-col');
            thLocDate.rowSpan = 2;
            dateRow.appendChild(thLocDate);

            // 根據聚合模式決定每天的時段數
            const periodsPerDay = AppState.aggregationMode === '3hours' ? 4 : 2;
            const numDays = Math.ceil(displayItems.length / periodsPerDay);
            
            for (let i = 0; i < numDays; i++) {
                const dayItems = displayItems.slice(i * periodsPerDay, (i + 1) * periodsPerDay);
                if (dayItems.length > 0) {
                    const date = new Date(dayItems[0].timestamp);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}/${month}/${day}`;
                    
                    const thDate = document.createElement('th');
                    thDate.textContent = dateStr;
                    thDate.colSpan = dayItems.length;
                    thDate.classList.add('date-header');
                    dateRow.appendChild(thDate);
                }
            }
            thead.appendChild(dateRow);

            // 第二行：時間行
            const timeRow = document.createElement('tr');
            displayItems.forEach((item, viewIdx) => {
                const th = document.createElement('th');
                // 只顯示時段標籤（不含日期）
                const timeLabel = item.label.split('\n').pop();
                th.textContent = timeLabel;
                th.classList.add('time-header');
                th.onclick = () => this.selectTime(viewIdx);

                if (viewIdx === AppState.selectedTimeIndex) {
                    th.classList.add('active-time');
                }
                timeRow.appendChild(th);
            });
            thead.appendChild(timeRow);
        } else {
            // 單一時間點模式：保持原有單行表頭
            const row = document.createElement('tr');
            const thLoc = document.createElement('th');
            thLoc.textContent = "地區 / 時間";
            thLoc.classList.add('location-col');
            row.appendChild(thLoc);

            displayItems.forEach((item, viewIdx) => {
                const th = document.createElement('th');
                th.textContent = item.label;
                th.style.whiteSpace = "pre-line";
                th.onclick = () => this.selectTime(viewIdx);

                if (viewIdx === AppState.selectedTimeIndex) {
                    th.classList.add('active-time');
                }
                row.appendChild(th);
            });
            thead.appendChild(row);
        }

        // 2. Build Rows
        tbody.innerHTML = '';
        AppState.locationsList.forEach(loc => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.textContent = loc.name;
            tr.appendChild(tdName);

            // Find weather element
            const el = loc.data.find(e => e.ElementName === varConfig.key);

            displayItems.forEach(item => {
                const td = document.createElement('td');
                let color = '#cccccc';
                let text = "N/A";

                if (el) {
                    // 使用新的 getDisplayData，傳入索引陣列
                    const result = Utils.getDisplayData(
                        el, 
                        item.indices, 
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

        // 確定要使用的時間索引
        let timeIndices;
        if (AppState.aggregationMode !== 'none' && AppState.timePeriods.length > 0) {
            // 動態生成當前變量的時段分組（與表格邏輯一致）
            const dataInterval = varConfig.dataInterval || 1;
            const firstLoc = AppState.locationsList[0];
            const weatherEl = firstLoc.data.find(el => el.ElementName === varConfig.key);
            
            if (weatherEl && weatherEl.Time) {
                const rawTimes = weatherEl.Time.map(t => t.StartTime || t.DataTime);
                
                let filteredPeriods;
                if (AppState.aggregationMode === '3hours') {
                    const allPeriods = Utils.groupTimesByPeriod(rawTimes, dataInterval);
                    filteredPeriods = Utils.filterTodayPeriods(allPeriods);
                } else if (AppState.aggregationMode === '6hours') {
                    const allPeriods6h = Utils.groupTimesByPeriod6Hours(rawTimes, dataInterval);
                    filteredPeriods = Utils.filterTodayPeriods(allPeriods6h);
                }
                
                console.log(`[Map] Variable: ${AppState.currentVariable}, Interval: ${dataInterval}h, Mode: ${AppState.aggregationMode}, Periods:`, filteredPeriods);
                
                if (AppState.selectedTimeIndex < filteredPeriods.length) {
                    timeIndices = filteredPeriods[AppState.selectedTimeIndex].indices;
                } else {
                    timeIndices = filteredPeriods[0]?.indices || [0];
                }
            } else {
                timeIndices = [0];
            }
        } else {
            // 單一時間點模式
            timeIndices = [AppState.selectedTimeIndex];
        }

        AppState.geoJsonLayer.eachLayer(layer => {
            const name = layer.feature.properties.town;

            // O(1) Lookup
            const locData = AppState.locationsMap.get(name);
            
            let color = "#cccccc";
            let displayVal = "N/A";
            
            if (locData) {
                const el = locData.data.find(e => e.ElementName === varConfig.key);
                if (el) {
                    const result = Utils.getDisplayData(
                        el, 
                        timeIndices, 
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
                className: "map-label",
                offset: [0, 0]
            });
        });
    },

    selectTime(viewIndex) {
        AppState.selectedTimeIndex = viewIndex;
        
        // Get the time label to display from currentDisplayItems
        if (viewIndex < AppState.currentDisplayItems.length) {
            const item = AppState.currentDisplayItems[viewIndex];
            this.updateTimeDisplay(item.label);
        }
        
        // Update header UI - select only time headers
        const timeHeaders = document.querySelectorAll('#table-header th.time-header');
        if (timeHeaders.length > 0) {
            // 兩行表頭模式
            timeHeaders.forEach((th, i) => {
                if (i === viewIndex) {
                    th.classList.add('active-time');
                } else {
                    th.classList.remove('active-time');
                }
            });
        } else {
            // 單行表頭模式
            const headers = document.querySelectorAll('#table-header th');
            headers.forEach((th, i) => {
                if (i === 0) return; // Skip location column
                if (i - 1 === viewIndex) {
                    th.classList.add('active-time');
                } else {
                    th.classList.remove('active-time');
                }
            });
        }
        
        this.renderMap();
    },

    updateTimeDisplay(str) {
        document.getElementById('current-time-display').textContent = `目前顯示時間：${str}`;
        // 同時更新地圖上的時間顯示，格式化為「所選日期」和「小時區間」
        let mapDisplayText = str;
        if (str.includes('\n')) {
            const parts = str.split('\n');
            const dateStr = parts[0];
            const timeStr = parts[1];
            mapDisplayText = `所選日期：${dateStr}\n小時區間：${timeStr} 時`;
        }
        document.getElementById('map-time-display').textContent = mapDisplayText;
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => UI.init());
