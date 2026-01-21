// 定義資料來源
const API_URL = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Forecast/F-D0047-005.json";
const GEOJSON_URL = "twtown2010.3.json"; // Relative path to downloaded file

// 全域變數
let rawData = null;
let dataValueInfo = {}; // Store metadata
let currentLocations = [];
let timeLabels = [];
let currentVariable = null; // Will be set based on VARIABLE_MAPPING
let currentSubVariable = null; // Key for ElementValue (e.g. "WindSpeed" or "BeaufortScale")
let selectedTimeIndex = 0;
let map = null;
let geoJsonLayer = null; // New global for GeoJSON layer
let mapMarkers = [];
let isSixHourAggregation = true; // Default enabled

// 舊地名對應新地名 (桃園縣 -> 桃園市)
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

// 單位顯示對應表
const UNIT_MAPPING = {
    "攝氏度": "°C",
    "百分比": "%",
    "公尺/秒": "m/s",
    "蒲福風級": "級"
};

// 定義變數對應的 JSON keys 
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
    },
    /*"體感溫度": { 
        key: "體感溫度", 
        colors: ['#117388','#207E92','#2E899C','#3D93A6','#4C9EB0','#5BA9BA','#69B4C4','#78BFCE','#87CAD8','#96D4E2','#A4DFEC','#B3EAF6','#0C924B','#1D9A51','#2FA257','#40A95E','#51B164','#62B96A','#74C170','#85C876','#96D07C','#A7D883','#B9E089','#CAE78F','#DBEF95','#F4F4C3','#F7E78A','#F4D576','#F1C362','#EEB14E','#EA9E3A','#E78C26','#E07B03','#ED5138','#ED1759','#AD053A','#780101','#9C68AD','#845194','#8520A0'],
        thresholds: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]]
    },*/
    /*
    "舒適度": { 
        key: "舒適度指數",  
        colors: ['#f7f7f7', '#cccccc', '#969696', '#636363'],
        thresholds: [15, 20, 26]
    } 
    */
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchData();
    setupEventListeners();
});

// 1. 初始化地圖
function initMap() {
    // 設定中心點為桃園，取消街道圖層
    map = L.map('map', {
        center: [24.89, 121.23],
        zoom: 11
    });
    // 不再使用 L.tileLayer

    // 載入 GeoJSON
    loadGeoJSON();
}

async function loadGeoJSON() {
    try {
        const response = await fetch(GEOJSON_URL);
        const json = await response.json();

        // 過濾桃園 (County 10003 is Taoyuan County in 2010 data, county is 桃園縣)
        const taoyuanFeatures = json.features.filter(f => 
            f.properties.county && f.properties.county.includes("桃園")
        );

        // Normalize names in properties
        taoyuanFeatures.forEach(f => {
            const oldName = f.properties.town;
            if (NAME_MAPPING[oldName]) {
                f.properties.town = NAME_MAPPING[oldName]; // Update to new name (e.g., 桃園區)
            }
        });

        const taoyuanGeoJson = {
            type: "FeatureCollection",
            features: taoyuanFeatures
        };

        geoJsonLayer = L.geoJSON(taoyuanGeoJson, {
            style: {
                color: "#666",
                weight: 1,
                fillOpacity: 0.7,
                fillColor: "#ccc"
            },
            onEachFeature: function(feature, layer) {
                // Initial tooltip (will be updated in renderMapData)
                layer.bindTooltip(feature.properties.town, {
                    permanent: true,
                    direction: "center",
                    className: "map-label"
                });
            }
        }).addTo(map);

        // Fit bounds to Taoyuan
        // map.fitBounds(geoJsonLayer.getBounds());
        // 改為不自動縮放，以使用 L.map 初始化時設定的 zoom

        // Initial render if data is already ready
        if (currentLocations.length > 0) {
            renderMapData();
        }

    } catch (e) {
        console.error("GeoJSON load error:", e);
    }
}

// 2. 抓取資料
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        
        // 解析資料結構
        // 路徑: cwaopendata -> Dataset -> Locations -> Location []
        rawData = json.cwaopendata.Dataset.Locations.Location;
        dataValueInfo = json.cwaopendata.Dataset.DatasetInfo.DataValueInfo || {};

        console.log("原始資料載入完成:", rawData);
        
        // 處理基本資料 (地點、時間軸)
        parseDataStructure();
        
        // 渲染選單
        renderMenu();
        
        // 初始化次變數選單
        updateSubVariableMenu();

        // 渲染畫面
        updateView();
        
    } catch (error) {
        console.error("資料載入失敗:", error);
        alert("無法載入氣象資料，請檢查網路連線或 API 來源。");
    }
}

// 3. 解析基礎結構
function parseDataStructure() {
    if (!rawData || rawData.length === 0) return;

    // 取得所有地點名稱與座標
    currentLocations = rawData.map(loc => ({
        name: loc.LocationName,
        lat: parseFloat(loc.Latitude),
        lng: parseFloat(loc.Longitude),
        geocdoe: loc.Geocode,
        data: loc.WeatherElement // 保存該地點的所有天氣因子
    }));

    // 取得時間軸 (假設所有地點的時間軸一致，取第一個地點的第一個變數來抓時間)
    // 動態抓取 VARIABLE_MAPPING 中定義的第一個變數的 key，避免 "溫度" 被註解掉導致錯誤
    const firstLoc = rawData[0];
    const definedVars = Object.keys(VARIABLE_MAPPING);
    
    if (definedVars.length === 0) {
        console.error("VARIABLE_MAPPING 中沒有定義任何變數！");
        return;
    }

    const firstVarKey = VARIABLE_MAPPING[definedVars[0]].key; 
    const targetElement = firstLoc.WeatherElement.find(el => el.ElementName === firstVarKey);
    
    if (targetElement && targetElement.Time) {
        timeLabels = targetElement.Time.map(t => {
            const date = new Date(t.StartTime || t.DataTime);  
            // 格式化時間 MM/DD HH:mm
            return `${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
        });
    }
}

// 4. 設定選單
function renderMenu() {
    const select = document.getElementById('variable-select');
    select.innerHTML = '';
    
    const keys = Object.keys(VARIABLE_MAPPING);
    if (keys.length === 0) return;

    keys.forEach(varName => {
        const option = document.createElement('option');
        option.value = varName;
        option.textContent = varName;
        select.appendChild(option);
    });

    // 如果 currentVariable 為空，或不在目前的 Mapping 中，則預設選第一個
    if (!currentVariable || !VARIABLE_MAPPING[currentVariable]) {
        currentVariable = keys[0];
    }
    
    select.value = currentVariable;
}

function setupEventListeners() {
    document.getElementById('variable-select').addEventListener('change', (e) => {
        currentVariable = e.target.value;
        updateSubVariableMenu(); // Check if sub-variables options change
        updateView();
    });

    document.getElementById('sub-variable-select').addEventListener('change', (e) => {
        currentSubVariable = e.target.value;
        updateView();
    });

    document.getElementById('six-hour-toggle').addEventListener('change', (e) => {
        isSixHourAggregation = e.target.checked;
        selectedTimeIndex = 0; // Reset selection to avoid out of bounds
        updateView();
    });
}

// 4.5 更新子變數選單 (例如風速 vs 蒲福風級)
function updateSubVariableMenu() {
    const subSelect = document.getElementById('sub-variable-select');
    
    if (!currentVariable || !VARIABLE_MAPPING[currentVariable] || currentLocations.length === 0) {
        subSelect.style.display = 'none';
        currentSubVariable = null;
        return;
    }

    const config = VARIABLE_MAPPING[currentVariable];
    // Find weather element from first location to check structure
    const firstLoc = currentLocations[0];
    const weatherEl = firstLoc.data.find(el => el.ElementName === config.key);

    let keys = [];
    if (weatherEl && weatherEl.Time && weatherEl.Time.length > 0) {
        // Check the first time point
        const firstTime = weatherEl.Time[0];
        if (firstTime.ElementValue) {
             // ElementValue is expected to be an object { key: value, ... }
             if (typeof firstTime.ElementValue === 'object' && firstTime.ElementValue !== null) {
                 keys = Object.keys(firstTime.ElementValue);
             }
        }
    }

    if (keys.length > 1) {
        // Populate options
        subSelect.innerHTML = '';
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            
            // Lookup Chinese name in DataValueInfo
            let name = key;
            if (dataValueInfo && dataValueInfo[key] && dataValueInfo[key]['@description']) {
                name = dataValueInfo[key]['@description'];
            }
            option.textContent = name;
            subSelect.appendChild(option);
        });
        
        // Default to first if current is invalid
        if (!currentSubVariable || !keys.includes(currentSubVariable)) {
            currentSubVariable = keys[0];
        }
        
        subSelect.value = currentSubVariable;
        subSelect.style.display = 'inline-block';
    } else {
        subSelect.style.display = 'none';
        currentSubVariable = (keys.length > 0) ? keys[0] : null;
    }
}

// 5. 更新視圖 (表格 + 地圖)
function updateView() {
    renderTable();
    renderMapData();
}

// 6. 渲染表格
function renderTable() {
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    // Safety check
    if (!currentVariable || !VARIABLE_MAPPING[currentVariable]) return;

    const config = VARIABLE_MAPPING[currentVariable];

    // 清空
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';

    // --- 表頭 ---
    // 左上角空白格
    const thLoc = document.createElement('th');
    thLoc.textContent = "地區 / 時間";
    thLoc.className = "location-col";
    tableHeader.appendChild(thLoc);

    // 決定要顯示的時間點 (索引)
    let displayIndices = [];
    if (isSixHourAggregation) {
        for(let i=0; i<timeLabels.length; i+=6) {
            displayIndices.push(i);
        }
    } else {
        displayIndices = timeLabels.map((_, i) => i);
    }

    // 渲染時間欄位
    displayIndices.forEach((realIndex, displayIdx) => {
        const th = document.createElement('th');
        let label = timeLabels[realIndex];
        
        // 如果是聚合模式，顯示區間提示? 
        // 為了避免版面過擠，先顯示開始時間，但加註 (6h) 
        // 或是如果能算出結束時間更好
        // 假設 timeLabels 是連續的
        if (isSixHourAggregation) {
             // 嘗試抓結束時間
             const endIdx = Math.min(realIndex + 5, timeLabels.length - 1);
             if (endIdx > realIndex) {
                 // 簡化顯示：僅顯示 HH:00
                 // 取出 HH:00 部分
                 const startT = label.split(' ')[1] || label;
                 const endT = (timeLabels[endIdx].split(' ')[1] || timeLabels[endIdx]);
                 // 日期部分
                 const datePart = label.split(' ')[0];
                 label = `${datePart}\n${startT}~${endT}`;
             }
        }

        th.textContent = label;
        th.style.whiteSpace = "pre-line"; // 允許換行
        th.onclick = () => selectTime(displayIdx); // 這裡傳入的是「顯示索引」
        
        if (displayIdx === selectedTimeIndex) {
            th.classList.add('active-time');
            updateTimeDisplay(label.replace('\n', ' '));
        }
        
        tableHeader.appendChild(th);
    });

    // --- 表身 ---
    currentLocations.forEach(loc => {
        const tr = document.createElement('tr');
        
        // 地點名稱
        const tdName = document.createElement('td');
        tdName.textContent = loc.name;
        tr.appendChild(tdName);

        // 找尋對應的變數資料
        const weatherEl = loc.data.find(el => el.ElementName === config.key);
        
        // 填入數值
        if (weatherEl && weatherEl.Time) {
            displayIndices.forEach(realIndex => {
                let value = "N/A";
                let rawVal = 0; // 用於顏色計算
                let displayVal = "N/A";
                let hasData = false;

                if (isSixHourAggregation) {
                    // 聚合模式：找區間最大值
                    let maxV = -Infinity;
                    let maxValStr = "N/A"; // Track the display string for max value
                    for (let k = 0; k < 6; k++) {
                        const idx = realIndex + k;
                        if (idx >= weatherEl.Time.length) break;
                        
                        const t = weatherEl.Time[idx];
                        if (t && t.ElementValue) {
                            let valStr = null;
                            if (currentSubVariable && t.ElementValue[currentSubVariable] !== undefined) {
                                valStr = t.ElementValue[currentSubVariable];
                            } else {
                                const vals = Object.values(t.ElementValue);
                                if (vals.length > 0) valStr = vals[0];
                            }

                            if (valStr !== null) {
                                let v = parseFloat(valStr);
                                // Handle cases like "<= 1"
                                if (typeof valStr === 'string' && valStr.includes('<=')) {
                                    v = 0;
                                } else if (isNaN(v) && typeof valStr === 'string') {
                                    const match = valStr.match(/(\d+(\.\d+)?)/);
                                    if (match) v = parseFloat(match[0]);
                                }

                                if (!isNaN(v)) {
                                    if (v > maxV) {
                                        maxV = v;
                                        maxValStr = valStr; // Update display string
                                    }
                                    hasData = true;
                                }
                            }
                        }
                    }
                    if (hasData) {
                        rawVal = maxV;
                        displayVal = maxValStr;
                    }
                } else {
                    // 一般模式
                    const t = weatherEl.Time[realIndex];
                    if (t && t.ElementValue) {
                        let vStr = null;
                        if (currentSubVariable && t.ElementValue[currentSubVariable] !== undefined) {
                            vStr = t.ElementValue[currentSubVariable];
                        } else {
                            const vals = Object.values(t.ElementValue);
                            if (vals.length > 0) vStr = vals[0];
                        }

                        if (vStr !== null) {
                            rawVal = parseFloat(vStr);
                            if (typeof vStr === 'string' && vStr.includes('<=')) {
                                rawVal = 0;
                            } else if (isNaN(rawVal) && typeof vStr === 'string') {
                                const match = vStr.match(/(\d+(\.\d+)?)/);
                                if (match) rawVal = parseFloat(match[0]);
                            }
                            displayVal = vStr;
                            if (!isNaN(rawVal)) hasData = true;
                        }
                    }
                }

                const td = document.createElement('td');
                td.textContent = displayVal;
                
                // 設定背景色
                let color = '#cccccc';
                if (hasData) {
                    color = getColorForValue(rawVal, currentVariable);
                }
                
                td.style.backgroundColor = color + '80'; // 加一點透明度
                tr.appendChild(td);
            });
        }
        
        tableBody.appendChild(tr);
    });
}

// 7. 選擇時間
function selectTime(index) {
    selectedTimeIndex = index;
    // 重繪表頭樣式
    const headers = document.querySelectorAll('#table-header th');
    headers.forEach((th, i) => {
        // i=0 是地點欄，所以要位移
        if (i === 0) return;
        if (i - 1 === index) {
            th.classList.add('active-time');
            updateTimeDisplay(th.textContent.replace(/\n/g, ' '));
        } else {
            th.classList.remove('active-time');
        }
    });
    
    // 更新地圖
    renderMapData();
}

function updateTimeDisplay(timeStr) {
    document.getElementById('current-time-display').textContent = `目前顯示時間：${timeStr}`;
}

// 8. 渲染地圖上的數據 (面量圖邏輯)
function renderMapData() {
    if (!geoJsonLayer || currentLocations.length === 0) return;
    
    // Safety check: if currentVariable is invalid
    if (!currentVariable || !VARIABLE_MAPPING[currentVariable]) return;

    const config = VARIABLE_MAPPING[currentVariable];

    geoJsonLayer.eachLayer(layer => {
        let districtName = layer.feature.properties.town;
        
        // Handle name mapping (old name -> new name)
        if (NAME_MAPPING[districtName]) {
            districtName = NAME_MAPPING[districtName];
        }

        // Find matching weather data
        const loc = currentLocations.find(l => l.name === districtName);
        
        let displayVal = "N/A";
        let rawVal = 0;
        let color = "#cccccc"; // Default grey
        let hasData = false;
        
        if (loc) {
            const weatherEl = loc.data.find(el => el.ElementName === config.key);
            if (weatherEl && weatherEl.Time) {
                // Calculate range
                let startIndex = selectedTimeIndex;
                let count = 1;
                
                if (isSixHourAggregation) {
                    startIndex = selectedTimeIndex * 6;
                    count = 6;
                }

                // Find max in range
                if (startIndex < weatherEl.Time.length) {
                    if (isSixHourAggregation) {
                        let maxV = -Infinity;
                        let maxValStr = "N/A"; // Track string
                        for (let k = 0; k < count; k++) {
                            const idx = startIndex + k;
                            if (idx >= weatherEl.Time.length) break;
                            const t = weatherEl.Time[idx];
                            if (t && t.ElementValue) {
                                let valStr = null;
                                if (currentSubVariable && t.ElementValue[currentSubVariable] !== undefined) {
                                    valStr = t.ElementValue[currentSubVariable];
                                } else {
                                    const vals = Object.values(t.ElementValue);
                                    if (vals.length > 0) valStr = vals[0];
                                }

                                if (valStr !== null) {
                                    let v = parseFloat(valStr);
                                    // Handle cases like "<= 1"
                                    if (typeof valStr === 'string' && valStr.includes('<=')) {
                                        v = 0;
                                    } else if (isNaN(v) && typeof valStr === 'string') {
                                        const match = valStr.match(/(\d+(\.\d+)?)/);
                                        if (match) v = parseFloat(match[0]);
                                    }

                                    if (!isNaN(v)) {
                                        if (v > maxV) {
                                            maxV = v;
                                            maxValStr = valStr;
                                        }
                                        hasData = true;
                                    }
                                }
                            }
                        }
                        if (hasData) {
                            rawVal = maxV;
                            displayVal = maxValStr;
                        }
                    } else {
                        // Normal mode
                        const t = weatherEl.Time[startIndex];
                        if (t && t.ElementValue) {
                            let vStr = null;
                            if (currentSubVariable && t.ElementValue[currentSubVariable] !== undefined) {
                                vStr = t.ElementValue[currentSubVariable];
                            } else {
                                const vals = Object.values(t.ElementValue);
                                if (vals.length > 0) vStr = vals[0];
                            }

                            if (vStr !== null) {
                                rawVal = parseFloat(vStr);
                                if (typeof vStr === 'string' && vStr.includes('<=')) {
                                    rawVal = 0;
                                } else if (isNaN(rawVal) && typeof vStr === 'string') {
                                    const match = vStr.match(/(\d+(\.\d+)?)/);
                                    if (match) rawVal = parseFloat(match[0]);
                                }
                                displayVal = vStr;
                                if (!isNaN(rawVal)) hasData = true;
                            }
                        }
                    }
                }
                
                if (hasData) {
                    color = getColorForValue(rawVal, currentVariable);
                }
            }
        }
        
        // Set style
        layer.setStyle({
            fillColor: color,
            fillOpacity: 0.8,
            color: "white",
            weight: 1
        });
        
        // Update popup/tooltip
        let unit = config.unit;
        if (currentSubVariable && dataValueInfo && dataValueInfo[currentSubVariable] && dataValueInfo[currentSubVariable]['@unit']) {
             const u = dataValueInfo[currentSubVariable]['@unit'];
             if (u && u !== "NA" && u !== "null") {
                 unit = UNIT_MAPPING[u] || u;
             }
        }

        const tooltipContent = `<div style="text-align:center">
            <b>${districtName}</b><br>
            ${displayVal} ${unit}
        </div>`;

        // Update permanent tooltip content
        // Tooltip is bound in loadGeoJSON, we can just set its content again? 
        // Or unbind and bind again.
        layer.unbindTooltip();
        layer.bindTooltip(tooltipContent, {
            permanent: true,
            direction: "center",
            className: "map-label"
        });
    });
}

// 9. 輔助功能：顏色計算
function getColorForValue(val, type) {
    if (isNaN(val)) return '#cccccc';
    
    // Safety check
    if (!VARIABLE_MAPPING[type]) return '#cccccc';

    const config = VARIABLE_MAPPING[type];
    const colors = config.colors;
    let thresholds = config.thresholds;
    
    // Handle nested thresholds structure (Array of Arrays)
    let activeThresholds = thresholds;
    if (thresholds && thresholds.length > 0 && Array.isArray(thresholds[0])) {
        let tIndex = 0;
        // Determine which threshold set to use based on sub-variable
        // Special mapping for Wind Speed: index 1 is for BeaufortScale
        if (type === "風速" && currentSubVariable === "BeaufortScale") {
            tIndex = 1;
        }
        
        // Use the selected set, or default to the first one
        if (tIndex < thresholds.length) {
            activeThresholds = thresholds[tIndex];
        } else {
            activeThresholds = thresholds[0];
        }
    }

    let index = 0;

    // 如果有定義上界閾值，使用閾值判斷
    if (activeThresholds && activeThresholds.length > 0) {
        // 找出第一個大於 val 的閾值索引
        index = activeThresholds.findIndex(t => val < t);
        
        if (index === -1) {
            index = activeThresholds.length;
        }
    } else {
        // 預設邏輯：平均分配 (0~100) 或其他
        index = Math.floor(val / (100 / colors.length));
    }

    if (index >= colors.length) index = colors.length - 1;
    if (index < 0) index = 0;

    return colors[index] || colors[0];
}
