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
        HOURLY_DAY: 'hourlyday',
        HOURLY_DAY_MAX: 'hourlydaymax',
        HOURLY_DAY_24H_MAX: 'hourlyday24hmax',
        HOURLY_3H_MAX: 'hourly3hmax',
        HOURS_3: '3hours',
        HOURS_6: '6hours'
    },
    OBS_RAIN_LATEST_API: '/ncdr/obs_rain/latest',
    NCDR_RAIN_NONE_MAX_HOURS: 24,
    NCDR_RAIN_NONE_SHIFT_HOURS: 6
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

const QPF_THRESHOLDS = [0.5, 1, 2, 5, 10, 15, 20, 30, 40, 50, 70, 90, 110, 130, 150, 200, 300];
const QPF_COLORS = ['#EDF9FE', '#C2C2C2', '#9CFCFF', '#03C8FF', '#059BFF', '#0363FF', '#059902', '#39FF03', '#FFFB03', '#FFC800', '#FF9500', '#FF0000', '#CC0000', '#990000', '#960099', '#C900CC', '#FB00FF', '#FDC9FF'];
const RAIN_1H_THRESHOLDS = [0, 40, 100, 200];
const RAIN_3H_THRESHOLDS = [0, 80, 100, 200, 500];
const RAIN_24H_THRESHOLDS = [0, 80, 200, 350, 500];
const RAIN_1H_COLORS = ['#FFFFFF', '#03C8FF', '#ffe88c', '#ff8000', '#ff0000'];
const RAIN_3H_COLORS = ['#FFFFFF', '#03C8FF', '#ffe88c', '#ff8000', '#ff0000', '#d600cc'];
const RAIN_24H_COLORS = ['#FFFFFF', '#03C8FF', '#ffe88c', '#ff8000', '#ff0000', '#d600cc'];
const VARIABLE_MAPPING = {
    "溫度": { 
        key: "溫度",
        unit: "°C",
        colors: ['#117388','#207E92','#2E899C','#3D93A6','#4C9EB0','#5BA9BA','#69B4C4','#78BFCE','#87CAD8','#96D4E2','#A4DFEC','#B3EAF6','#0C924B','#1D9A51','#2FA257','#40A95E','#51B164','#62B96A','#74C170','#85C876','#96D07C','#A7D883','#B9E089','#CAE78F','#DBEF95','#F4F4C3','#F7E78A','#F4D576','#F1C362','#EEB14E','#EA9E3A','#E78C26','#E07B03','#ED5138','#ED1759','#AD053A','#780101','#9C68AD','#845194','#8520A0'],
        thresholds: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]]
    }, 
    "降雨機率": { 
        key: "3小時降雨機率",
        unit: "%",
        colors: ['#FFFFFF', '#E0F2F7', '#B3D9E8', '#7FB3D5', '#4A90C2', '#2E5C8A', '#FF9500', '#FF6B35', '#E63946', '#A4161A', '#5C0A0A'],
        thresholds: [[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]]
    }, 
    "相對濕度": { 
        key: "相對濕度",
        unit: "%",
        colors: ["#D3E6EB", "#A7CFD8","#82F550","#4ADC0C","#93F4FF","#2DEAFF","#02D4E3"],
        thresholds: [[65,70,75,80,85,90]]
    }, 
    "風速": { 
        key: "風速",
        // Original m/s colors and thresholds
        colors: ['#FFFFFF', '#b0fff2', '#80f9be', '#50fcaf', '#FFFEA5', '#F2DB79', '#E6B167', '#EA83ED', '#B940BD', '#6942AE', '#272F6E'],
        thresholds: [
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // m/s
            [2, 4, 6, 8, 10, 12, 14, 15, 16, 17] // Old Beaufort thresholds preserved for reference/fallback
        ],
        // New Beaufort specific config (Extended for 9+)
        colors_beaufort: ['#FFFFFF', '#6deadd', '#9dee89', '#ffe77c', '#ffc93e', '#ffac00', '#ff9292', '#df3b3b', '#a23ccb'],
        thresholds_beaufort: [2, 3, 4, 5, 6, 7, 8, 9]
    },
    "NCDR系集十米風": {
        key: "NCDR風速",
        unit: "m/s",
        colors: ['#FFFFFF', '#b0fff2', '#80f9be', '#50fcaf', '#FFFEA5', '#F2DB79', '#E6B167', '#EA83ED', '#B940BD', '#6942AE', '#272F6E'],
        thresholds: [
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [2, 3, 4, 5, 6, 7, 8, 9]
        ],
        colors_beaufort: ['#FFFFFF', '#6deadd', '#9dee89', '#ffe77c', '#ffc93e', '#ffac00', '#ff9292', '#df3b3b', '#a23ccb'],
        thresholds_beaufort: [2, 3, 4, 5, 6, 7, 8, 9]
    },
    "定量降水預報": {
        key: "QPF",
        unit: "mm",
        // Valid for val >= threshold
        thresholds: QPF_THRESHOLDS,
        colors: QPF_COLORS
    },
    "NCDR系集降雨預報": {
        key: "NCDR降雨",
        unit: "mm",
        thresholds: QPF_THRESHOLDS,
        colors: QPF_COLORS
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
        if (str.includes('<=')) return { num: 0, str: str.replace('<=', '≤'), valid: true };
        
        const parsed = parseFloat(str);
        return { num: parsed, str: str, valid: !isNaN(parsed) };
    },

    parseRecDateTime(raw) {
        if (!raw) return null;

        const str = String(raw).trim();
        const compact = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
        if (compact) {
            const [, y, m, d, hh, mm] = compact;
            return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0);
        }

        const iso = new Date(str);
        if (!isNaN(iso.getTime())) return iso;
        return null;
    },

    parseRecDateTimeAsUTC(raw) {
        if (!raw) return null;

        const str = String(raw).trim();

        // Compact format from NCDR, e.g. 202604241200 (UTC)
        const compact = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
        if (compact) {
            const [, y, m, d, hh, mm] = compact;
            return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0));
        }

        // ISO string without timezone should be treated as UTC for NCDR RecDateTime.
        const isoNoTz = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (isoNoTz) {
            const [, y, m, d, hh, mm, ss] = isoNoTz;
            return new Date(Date.UTC(
                Number(y),
                Number(m) - 1,
                Number(d),
                Number(hh),
                Number(mm),
                Number(ss || 0)
            ));
        }

        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) return parsed;
        return null;
    },

    wsToBeaufort(ws) {
        if (!Number.isFinite(ws) || ws < 0) return null;
        if (ws < 0.3) return 0;
        if (ws < 1.6) return 1;
        if (ws < 3.4) return 2;
        if (ws < 5.5) return 3;
        if (ws < 8.0) return 4;
        if (ws < 10.8) return 5;
        if (ws < 13.9) return 6;
        if (ws < 17.2) return 7;
        if (ws < 20.8) return 8;
        if (ws < 24.5) return 9;
        if (ws < 28.5) return 10;
        if (ws < 32.7) return 11;
        return 12;
    },

    calculateAggregatedValue(element, indices, subKey) {
        if (!element || !indices || indices.length === 0) return { num: 0, str: "-", valid: false };

        let maxVal = -Infinity;
        let maxStr = "-";
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

        return { num: found ? maxVal : 0, str: found ? maxStr : "-", valid: found };
    },

    getColor(val, varKey, subVarKey, options = {}) {
        if (!VARIABLE_MAPPING[varKey]) return '#cccccc';
        const config = VARIABLE_MAPPING[varKey];
        const colors = config.colors;
        const thresholds = config.thresholds;

        const aggMode = options.aggMode || null;

        // QPF Logic: value matches a specific discrete bin color
        if (varKey === "NCDR系集降雨預報") {
            let rainThresholds = RAIN_1H_THRESHOLDS;
            let rainColors = RAIN_1H_COLORS;

            if (aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX) {
                rainThresholds = RAIN_24H_THRESHOLDS;
                rainColors = RAIN_24H_COLORS;
            } else if (
                aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX
                || aggMode === CONFIG.AGGREGATION.HOURS_3
                || aggMode === CONFIG.AGGREGATION.HOURS_6
            ) {
                rainThresholds = RAIN_3H_THRESHOLDS;
                rainColors = RAIN_3H_COLORS;
            }

            if (val === 0) return rainColors[0];

            let idx = rainThresholds.indexOf(val);
            if (idx !== -1) {
                return rainColors[idx + 1] || '#cccccc';
            }

            let tIdx = rainThresholds.findIndex(t => val < t);
            if (tIdx === -1) tIdx = rainThresholds.length;
            return rainColors[tIdx] || '#cccccc';
        }

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
        let activeColors = colors;

        if (varKey === "風速" || varKey === "NCDR系集十米風") {
            if (subVarKey === "BeaufortScale") {
                // Use new Beaufort config if available
                if (config.colors_beaufort && config.thresholds_beaufort) {
                    activeColors = config.colors_beaufort;
                    activeThresholds = config.thresholds_beaufort;
                } else if (Array.isArray(thresholds[1])) {
                    // Fallback to old nested threshold structure
                    activeThresholds = thresholds[1];
                }
            } else {
                // Default wind (m/s)
                if (Array.isArray(thresholds[0])) {
                    activeThresholds = thresholds[0];
                }
            }
        } else if (Array.isArray(thresholds[0])) { 
            // Legacy nested support for other vars
            activeThresholds = thresholds[0];
        }

        let idx = activeThresholds.findIndex(t => val < t);
        if (idx === -1) idx = activeThresholds.length;

        if (idx >= activeColors.length) idx = activeColors.length - 1;
        return activeColors[idx] || '#cccccc';
    },

    getUnit(varKey, subVarKey, metaInfo) {
        if (subVarKey && metaInfo?.[subVarKey]?.['@unit']) {
            const u = metaInfo[subVarKey]['@unit'];
            if (u && u !== "NA" && u !== "null") return UNIT_MAPPING[u] || u;
        }
        if (VARIABLE_MAPPING[varKey]?.unit) return VARIABLE_MAPPING[varKey].unit;
        return "";
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
    }
};

// =============================================================================
// 3. TIME AGGREGATION LOGIC
// =============================================================================
const TimeManager = {
    cache: new Map(),

    generateGroups(timeStrings, mode, interval = 1, options = {}) {
        const windowShiftHours = Number(options.windowShiftHours) || 0;
        // Cache key based on input parameters
        const cacheKey = `${mode}-${interval}-${windowShiftHours}-${timeStrings.length}-${timeStrings[0]}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // QPF Special Handling (Fake Time Strings)
        if (mode === 'QPF') {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const todayStr = `${y}/${m}/${d}`;

            const tmr = new Date(now);
            tmr.setDate(tmr.getDate() + 1);
            const ty = tmr.getFullYear();
            const tm = String(tmr.getMonth() + 1).padStart(2, '0');
            const td = String(tmr.getDate()).padStart(2, '0');
            const tmrStr = `${ty}/${tm}/${td}`;
            
            const groupHeader = `${todayStr} 08時 ~ ${tmrStr} 08時`;
            const qpfLabels = ["08-14", "14-20", "20-02", "02-08"];

            const groups = timeStrings.map((t, i) => {
                const label = qpfLabels[i] || `${i*6}-${(i+1)*6}`;

                return {
                    type: 'single',
                    indices: [i],
                    label: label,
                    periodLabel: label,
                    timestamp: new Date().getTime() + i, // Fake distinct timestamps
                    dateKey: groupHeader // Group header
                };
            });
            this.cache.set(cacheKey, groups);
            return groups;
        }

        // 1. Define Filter Range (Dynamic 24h window aligned to 6-hour switch points)
        const now = new Date();
        const startFilter = new Date(now);
        startFilter.setMinutes(0, 0, 0);

        const currentHour = now.getHours();
        const nextBoundaryHour = Math.ceil(currentHour / 6) * 6;

        if (nextBoundaryHour >= 24) {
            startFilter.setDate(startFilter.getDate() + 1);
            startFilter.setHours(0, 0, 0, 0);
        } else {
            startFilter.setHours(nextBoundaryHour, 0, 0, 0);
        }

        const endFilter = new Date(startFilter);
        endFilter.setHours(endFilter.getHours() + 24);

        if (windowShiftHours !== 0) {
            startFilter.setHours(startFilter.getHours() + windowShiftHours);
            endFilter.setHours(endFilter.getHours() + windowShiftHours);
        }

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
                    periodLabel: hh,
                    timestamp: d.getTime(),
                    dateKey: `${d.getFullYear()}/${mm}/${dd}`
                });
            });
            this.cache.set(cacheKey, groups);
            return groups;
        }

        // 2.5 Mode: Hourly points within dynamic 24h window
        if (mode === CONFIG.AGGREGATION.HOURLY_DAY) {
            parsedDates.forEach((d, i) => {
                const t = d.getTime();
                if (t < startFilter.getTime() || t >= endFilter.getTime()) return;

                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const dd = d.getDate().toString().padStart(2, '0');
                const hh = d.getHours().toString().padStart(2, '0');

                groups.push({
                    type: 'single',
                    indices: [i],
                    label: `${mm}/${dd} ${hh}:00`,
                    periodLabel: hh,
                    timestamp: t,
                    dateKey: `${d.getFullYear()}/${mm}/${dd}`
                });
            });

            groups.sort((a, b) => a.timestamp - b.timestamp);
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
                // 6 Hour Logic (Updated: Follows calendar day similar to 3hours)
                if (h >= 12 && h < 18)      period = '12-18';
                else if (h >= 18)           period = '18-00';
                else if (h >= 0 && h < 6)   period = '00-06';
                else if (h >= 6 && h < 12)  period = '06-12';
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

        // Convert buckets to array and filter for dynamic 24h window
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
                    if (Utils.pointInPoly(x, y, ring)) {
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
        townCoordCache: new Map(),
        meta: {},
        currentVar: null,
        currentSubVar: null,
        aggMode: CONFIG.AGGREGATION.HOURS_3, 
        currentDisplayItems: [],
        timeIndex: -1,
        csrfToken: null,
        ncdrWindLoaded: false,
        ncdrWindBaseTime: null,
        ncdrRainLoaded: false,
        ncdrObsRainLoaded: false,
        ncdrRainBaseTime: null,
        ncdrRainEnsemble: 'MAX',
        ncdrRainMaxAggregationOrder: 'sumfirst',
        ncdrRainRawSeries: new Map(),
        ncdrRainCumSeries: new Map(),
        ncdrRainMaxMemberRawByTown: {},
        ncdrRainMaxMemberCumByTown: {},
        ncdrRainNoneWindowStart: 0,
        ncdrRainNoneWindowTotal: 0,
        ncdrRainWindowShiftHours: 0,
        obsRainRequestedTime: null,
        obsRain24hByTown: new Map(),
        obsRainSourceUrl: null
    },

    ncdrBounds: {
        minLon: 120.95,
        maxLon: 121.50,
        minLat: 24.55,
        maxLat: 25.15
    },
    
    ui: {
        map: null,
        layer: null,
        tableHeader: document.getElementById('table-header'),
        tableBody: document.getElementById('table-body'),
        timeDisplay: document.getElementById('current-time-display'),
        mapTimeDisplay: document.getElementById('map-time-display'),
        ncdrRainNoneNav: document.getElementById('ncdr-rain-none-nav'),
        ncdrRainPrev6Btn: document.getElementById('ncdr-rain-prev-6-btn'),
        ncdrRainNext6Btn: document.getElementById('ncdr-rain-next-6-btn'),
        ncdrRainWindowRange: document.getElementById('ncdr-rain-window-range'),
        ncdrMaxOrderSwitch: document.getElementById('ncdr-max-order-switch'),
        ncdrMaxOrderMaxBtn: document.getElementById('ncdr-max-order-max-btn'),
        ncdrMaxOrderSumBtn: document.getElementById('ncdr-max-order-sum-btn'),
        ncdrMaxLoadingOverlay: document.getElementById('ncdr-max-loading-overlay'),
        ncdrMaxLoadingText: document.getElementById('ncdr-max-loading-text'),
        ncdrMaxLoadingBar: document.getElementById('ncdr-max-loading-bar')
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
        this.ui.ncdrRainNoneNav = document.getElementById('ncdr-rain-none-nav');
        this.ui.ncdrRainPrev6Btn = document.getElementById('ncdr-rain-prev-6-btn');
        this.ui.ncdrRainNext6Btn = document.getElementById('ncdr-rain-next-6-btn');
        this.ui.ncdrRainWindowRange = document.getElementById('ncdr-rain-window-range');
        this.ui.ncdrMaxOrderSwitch = document.getElementById('ncdr-max-order-switch');
        this.ui.ncdrMaxOrderMaxBtn = document.getElementById('ncdr-max-order-max-btn');
        this.ui.ncdrMaxOrderSumBtn = document.getElementById('ncdr-max-order-sum-btn');
        this.ui.ncdrMaxLoadingOverlay = document.getElementById('ncdr-max-loading-overlay');
        this.ui.ncdrMaxLoadingText = document.getElementById('ncdr-max-loading-text');
        this.ui.ncdrMaxLoadingBar = document.getElementById('ncdr-max-loading-bar');
    },

    isNCDRRainNoneMode() {
        return this.state.currentVar === "NCDR系集降雨預報"
            && this.state.aggMode === CONFIG.AGGREGATION.NONE;
    },

    isNCDRRainMode() {
        return this.state.currentVar === "NCDR系集降雨預報";
    },

    isNCDRMaxEnsembleMode() {
        return this.isNCDRRainMode() && this.state.ncdrRainEnsemble === 'MAX';
    },

    isNCDRMaxOrderSwitchApplicableMode() {
        return [
            CONFIG.AGGREGATION.HOURLY_3H_MAX,
            CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX,
            CONFIG.AGGREGATION.HOURS_3,
            CONFIG.AGGREGATION.HOURS_6
        ].includes(this.state.aggMode);
    },

    shouldShowNCDRMaxOrderSwitch() {
        return this.isNCDRMaxEnsembleMode() && this.isNCDRMaxOrderSwitchApplicableMode();
    },

    isNCDRSumFirstModeEnabled() {
        return this.shouldShowNCDRMaxOrderSwitch() && this.state.ncdrRainMaxAggregationOrder === 'sumfirst';
    },

    updateNCDRMaxOrderSwitchUI() {
        const wrap = this.ui.ncdrMaxOrderSwitch;
        if (!wrap) return;

        const show = this.shouldShowNCDRMaxOrderSwitch();
        wrap.style.display = show ? 'inline-flex' : 'none';

        if (this.ui.ncdrMaxOrderMaxBtn) {
            this.ui.ncdrMaxOrderMaxBtn.classList.toggle('active', this.state.ncdrRainMaxAggregationOrder === 'maxfirst');
        }
        if (this.ui.ncdrMaxOrderSumBtn) {
            this.ui.ncdrMaxOrderSumBtn.classList.toggle('active', this.state.ncdrRainMaxAggregationOrder === 'sumfirst');
        }
    },

    applyNCDRRainNoneWindow(displayItems) {
        const items = Array.isArray(displayItems) ? displayItems : [];

        if (!this.isNCDRRainNoneMode()) {
            this.state.ncdrRainNoneWindowStart = 0;
            this.state.ncdrRainNoneWindowTotal = 0;
            return items;
        }

        this.state.ncdrRainNoneWindowTotal = items.length;
        const windowSize = CONFIG.NCDR_RAIN_NONE_MAX_HOURS;

        if (items.length <= windowSize) {
            this.state.ncdrRainNoneWindowStart = 0;
            return items;
        }

        const maxStart = items.length - windowSize;
        const start = Math.min(Math.max(0, this.state.ncdrRainNoneWindowStart), maxStart);
        this.state.ncdrRainNoneWindowStart = start;

        return items.slice(start, start + windowSize);
    },

    updateNCDRRainNoneNavControls() {
        const nav = this.ui.ncdrRainNoneNav;
        const prevBtn = this.ui.ncdrRainPrev6Btn;
        const nextBtn = this.ui.ncdrRainNext6Btn;

        if (!nav || !prevBtn || !nextBtn) return;

        if (!this.isNCDRRainMode()) {
            nav.style.display = 'none';
            return;
        }

        nav.style.display = 'inline-flex';

        if (!this.isNCDRRainNoneMode()) {
            prevBtn.disabled = false;
            nextBtn.disabled = false;
            if (this.ui.ncdrRainWindowRange) {
                this.ui.ncdrRainWindowRange.textContent = '';
            }
            return;
        }

        const total = this.state.ncdrRainNoneWindowTotal;
        const windowSize = CONFIG.NCDR_RAIN_NONE_MAX_HOURS;
        const maxStart = Math.max(0, total - windowSize);
        const start = Math.min(Math.max(0, this.state.ncdrRainNoneWindowStart), maxStart);
        this.state.ncdrRainNoneWindowStart = start;

        prevBtn.disabled = start <= 0;
        nextBtn.disabled = start >= maxStart;

        if (this.ui.ncdrRainWindowRange) {
            if (total <= 0) {
                this.ui.ncdrRainWindowRange.textContent = '0/0';
            } else {
                const from = start + 1;
                const to = Math.min(total, start + Math.min(windowSize, total - start));
                this.ui.ncdrRainWindowRange.textContent = `${from}-${to} / ${total}`;
            }
        }
    },

    shiftNCDRRainNoneWindow(offsetHours) {
        if (!this.isNCDRRainMode()) return;

        if (!this.isNCDRRainNoneMode()) {
            this.state.ncdrRainWindowShiftHours += offsetHours;
            this.state.timeIndex = -1;
            this.updateData();
            return;
        }

        const total = this.state.ncdrRainNoneWindowTotal;
        const windowSize = CONFIG.NCDR_RAIN_NONE_MAX_HOURS;
        if (total <= windowSize) return;

        const maxStart = total - windowSize;
        const nextStart = Math.min(maxStart, Math.max(0, this.state.ncdrRainNoneWindowStart + offsetHours));
        if (nextStart === this.state.ncdrRainNoneWindowStart) return;

        this.state.ncdrRainNoneWindowStart = nextStart;
        this.state.timeIndex = -1;
        this.updateData();
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

    async fetchCsrfToken() {
        try {
            const res = await fetch('/ncdr/get_csrf_token');
            const data = await res.json();
            if (data.csrf_token) {
                this.state.csrfToken = data.csrf_token;
                console.log("Get CSRF Token Success");
            } else {
                console.error("Cannot find 'csrf_token' in response:", data);
            }
        } catch (e) {
            console.error("CSRF Token Fetch Error:", e);
        }
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

    getNCDRRainMemberEnsembles() {
        return ['G01', ...Array.from({ length: 20 }, (_, i) => `N${String(i).padStart(2, '0')}`)];
    },

    formatProgressBar(done, total, width = 20) {
        const safeTotal = Math.max(1, Number(total) || 1);
        const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
        const filled = Math.round((safeDone / safeTotal) * width);
        const empty = Math.max(0, width - filled);
        return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
    },

    showNCDRRainMaxOverlay() {
        if (this.ui.ncdrMaxLoadingOverlay) {
            this.ui.ncdrMaxLoadingOverlay.style.display = 'flex';
        }
    },

    hideNCDRRainMaxOverlay() {
        if (this.ui.ncdrMaxLoadingOverlay) {
            this.ui.ncdrMaxLoadingOverlay.style.display = 'none';
        }
        if (this.ui.ncdrMaxLoadingBar) {
            this.ui.ncdrMaxLoadingBar.style.width = '0%';
        }
    },

    updateNCDRRainMaxProgress(processed, total, failedCount, currentEnsemble = null) {
        const safeTotal = Math.max(1, Number(total) || 1);
        const safeProcessed = Math.max(0, Math.min(safeTotal, Number(processed) || 0));
        const percent = Math.round((safeProcessed / safeTotal) * 100);
        const suffix = currentEnsemble ? `，目前 ${currentEnsemble}` : '';

        if (this.ui.timeDisplay) {
            this.ui.timeDisplay.textContent = `MAX載入中：${safeProcessed}/${safeTotal}，失敗 ${failedCount}${suffix}`;
        }

        if (this.ui.ncdrMaxLoadingText) {
            this.ui.ncdrMaxLoadingText.textContent = `${safeProcessed}/${safeTotal} (${percent}%)，失敗 ${failedCount}${suffix}`;
        }

        if (this.ui.ncdrMaxLoadingBar) {
            this.ui.ncdrMaxLoadingBar.style.width = `${percent}%`;
        }
    },

    mergeNCDRRainEnsembleMax(parsedList) {
        if (!Array.isArray(parsedList) || parsedList.length === 0) return null;

        const hourIds = Array.from(new Set(
            parsedList.flatMap(item => Array.isArray(item?.hourIds) ? item.hourIds : [])
        )).sort((a, b) => Number(a) - Number(b));

        if (hourIds.length === 0) return null;

        let baseTime = null;
        for (const parsed of parsedList) {
            if (parsed?.baseTime instanceof Date && Number.isFinite(parsed.baseTime.getTime())) {
                baseTime = parsed.baseTime;
                break;
            }
        }

        const townHourlyRainRaw = {};
        const townHourlyRainCum = {};
        const memberRawSeriesByTown = {};
        const memberCumSeriesByTown = {};

        this.state.locations.forEach(loc => {
            const townName = loc.name;
            townHourlyRainRaw[townName] = {};
            townHourlyRainCum[townName] = {};

            const memberRawSeries = parsedList.map(parsed => {
                return hourIds.map(hh => {
                    const hourKey = `H${hh}`;
                    const val = parsed?.townHourlyRainRaw?.[townName]?.[hourKey];
                    return Number.isFinite(val) ? Math.max(val, 0) : null;
                });
            });

            const memberCumSeries = memberRawSeries.map(rawSeries => {
                const cum = [];
                let memberRunning = 0;
                rawSeries.forEach(val => {
                    if (Number.isFinite(val)) memberRunning += val;
                    cum.push(Number.isFinite(val) ? memberRunning : null);
                });
                return cum;
            });

            memberRawSeriesByTown[townName] = memberRawSeries;
            memberCumSeriesByTown[townName] = memberCumSeries;

            let running = 0;
            hourIds.forEach((hh, hIdx) => {
                const hourKey = `H${hh}`;
                let maxRaw = null;

                memberRawSeries.forEach(rawSeries => {
                    const val = rawSeries[hIdx];
                    if (Number.isFinite(val) && (maxRaw == null || val > maxRaw)) {
                        maxRaw = val;
                    }
                });

                if (Number.isFinite(maxRaw)) {
                    const nonNegMax = Math.max(maxRaw, 0);
                    running += nonNegMax;
                    townHourlyRainRaw[townName][hourKey] = nonNegMax;
                    townHourlyRainCum[townName][hourKey] = running;
                } else {
                    townHourlyRainRaw[townName][hourKey] = null;
                    townHourlyRainCum[townName][hourKey] = null;
                }
            });
        });

        return {
            baseTime,
            hourIds,
            townHourlyRainRaw,
            townHourlyRainCum,
            memberRawSeriesByTown,
            memberCumSeriesByTown
        };
    },

    async fetchNCDRRainByEnsemble(ensemble, suppressAlert = false) {
        if (!this.state.csrfToken) await this.fetchCsrfToken();

        const formData = new FormData();
        formData.append('format', 'csv');
        formData.append('csrf_token', this.state.csrfToken);

        let url = '/ncdr/En05km';
        if (ensemble === 'G01') {
            url = '/ncdr/EnG01';
        } else {
            formData.append('variable', 'raintot');
            formData.append('number', ensemble);
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.state.csrfToken
                }
            });

            if (!res.ok) {
                if (!suppressAlert) {
                    if (res.status === 429) {
                        alert("請求過於頻繁，請稍後再試");
                    } else {
                        alert("NCDR資料載入失敗");
                    }
                }
                const errorData = await res.json().catch(() => ({}));
                console.error(`NCDR Rain Fetch Error [${ensemble}]`, errorData);
                return null;
            }

            const csvText = await res.text();
            return this.parseNCDRcsv(csvText, 'rain', ensemble);
        } catch (e) {
            console.error(`NCDR Rain Fetch Error [${ensemble}]`, e);
            if (!suppressAlert) {
                alert("NCDR資料載入失敗");
            }
            return null;
        }
    },

    async fetchNCDRRainMaxData() {
        const ensembles = this.getNCDRRainMemberEnsembles();
        const parsedList = [];
        const failedEnsembles = [];
        const total = ensembles.length;

        this.showNCDRRainMaxOverlay();

        try {
            this.updateNCDRRainMaxProgress(0, total, 0);

            for (let i = 0; i < ensembles.length; i++) {
                const ensemble = ensembles[i];
                this.updateNCDRRainMaxProgress(i, total, failedEnsembles.length, ensemble);

                const parsed = await this.fetchNCDRRainByEnsemble(ensemble, true);
                if (!parsed) {
                    failedEnsembles.push(ensemble);
                    this.updateNCDRRainMaxProgress(i + 1, total, failedEnsembles.length);
                    continue;
                }

                parsedList.push(parsed);
                this.updateNCDRRainMaxProgress(i + 1, total, failedEnsembles.length);
            }

            if (parsedList.length === 0) {
                this.state.ncdrRainMaxMemberRawByTown = {};
                this.state.ncdrRainMaxMemberCumByTown = {};
                alert("MAX系集載入失敗：所有系集皆無法下載");
                return null;
            }

            const merged = this.mergeNCDRRainEnsembleMax(parsedList);
            this.state.ncdrRainMaxMemberRawByTown = merged?.memberRawSeriesByTown || {};
            this.state.ncdrRainMaxMemberCumByTown = merged?.memberCumSeriesByTown || {};
            return merged;
        } finally {
            this.hideNCDRRainMaxOverlay();
        }
    },

    async fetchNCDRData(type) {
        if (type === 'rain') {
            const ensemble = this.state.ncdrRainEnsemble;
            if (ensemble === 'MAX') {
                return this.fetchNCDRRainMaxData();
            }

            this.state.ncdrRainMaxMemberRawByTown = {};
            this.state.ncdrRainMaxMemberCumByTown = {};
            return this.fetchNCDRRainByEnsemble(ensemble);
        }

        if (!this.state.csrfToken) await this.fetchCsrfToken();

        const formData = new FormData();
        formData.append('format', 'csv');
        formData.append('csrf_token', this.state.csrfToken);

        let url = '/ncdr/En05km';
        if (type === 'wind') {
            formData.append('variable', 'uv10');
            formData.append('number', 'N00');
        } else {
            throw new Error("Unknown NCDR variable type: " + type);
        };

        try {
            const res = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.state.csrfToken
                }
            });
            if (!res.ok) {
                if (res.status === 429) {
                    alert("請求過於頻繁，請稍後再試");
                    return null;
                }
                const errorData = await res.json().catch(() => ({}));
                console.error("Server Error Response:", errorData);
                throw new Error(`HTTP ${res.status}: ${errorData.error || 'Unknown Error'}`);
            }
            const csvText = await res.text();
            return this.parseNCDRcsv(csvText, type);
        } catch (e) {
            console.error("NCDR Data Fetch Error", e);
            alert("NCDR資料載入失敗");
            return null;
        }
    },

    normalizeTownName(name) {
        if (!name) return null;
        const n = String(name).trim();
        return NAME_MAPPING[n] || n;
    },

    async fetchObservedRain24hData() {
        try {
            const latestRes = await fetch(`${CONFIG.OBS_RAIN_LATEST_API}?t=${Date.now()}`, { cache: 'no-store' });
            if (!latestRes.ok) {
                console.warn('Failed to query latest observation rainfall filename');
                return false;
            }

            const latest = await latestRes.json();
            const url = latest?.url || (latest?.filename ? `/${latest.filename}` : null);
            if (!url) {
                console.warn('Latest observation rainfall response has no URL');
                return false;
            }

            const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) {
                console.warn(`Failed to fetch observation rainfall JSON: ${url}`);
                return false;
            }

            const data = await res.json();
            const ok = this.parseObservedRain24hJson(data, url);
            if (!ok) {
                console.warn('Observation rainfall JSON format is invalid');
                return false;
            }

            this.state.ncdrObsRainLoaded = true;
            console.log(`Observed 24h rain loaded from ${url}`);
            return true;
        } catch (e) {
            console.warn('Observed 24h rain loading failed', e);
            return false;
        }
    },

    parseObservedRain24hJson(payload, sourceUrl) {
        if (!payload || !Array.isArray(payload.data)) return false;  // Basic validation

        const requestedTime = Utils.parseRecDateTime(payload.requested_time || payload.window_end);
        const byTown = new Map();

        payload.data.forEach(st => {
            const districtRaw = st?.district;
            const town = this.normalizeTownName(districtRaw);
            const moving = st?.moving_accumulation_mm;
            if (!town || !moving || typeof moving !== 'object') return; // Skip invalid entries

            if (!byTown.has(town)) byTown.set(town, []); // Initialize array for town if not exists
            byTown.get(town).push({
                stationId: st.station_id,
                stationName: st.station_name,
                moving
            });
        });

        this.state.obsRain24hByTown.clear();
        byTown.forEach((v, k) => this.state.obsRain24hByTown.set(k, v));
        this.state.obsRainRequestedTime = requestedTime;
        this.state.obsRainSourceUrl = sourceUrl || null;

        return this.state.obsRain24hByTown.size > 0;
    },

    getObservedRainAccumByHour(locName, targetTime, fallbackHours = 22) {
        const stations = this.state.obsRain24hByTown.get(locName);
        if (!stations || stations.length === 0) return null;

        let acHours = fallbackHours;
        const refTime = this.state.obsRainRequestedTime;

        if (targetTime instanceof Date && Number.isFinite(targetTime.getTime()) && refTime instanceof Date && Number.isFinite(refTime.getTime())) {
            const hourDiff = Math.round((targetTime.getTime() - refTime.getTime()) / 3600000);
            acHours = 23 - hourDiff;
        }

        acHours = Math.max(0, Math.min(24, acHours));
        if (acHours === 0) return 0;

        const key = `${acHours}hAC`;
        const boundedFallback = Math.max(0, Math.min(24, fallbackHours));
        const fallbackKey = boundedFallback === 0 ? null : `${boundedFallback}hAC`;

        let maxVal = null;
        for (const st of stations) {
            const val = Number(st?.moving?.[key]);
            if (Number.isFinite(val) && (maxVal == null || val > maxVal)) {
                maxVal = val;
            }
        }

        if (maxVal == null && fallbackKey && fallbackKey !== key) {
            for (const st of stations) {
                const val = Number(st?.moving?.[fallbackKey]);
                if (Number.isFinite(val) && (maxVal == null || val > maxVal)) {
                    maxVal = val;
                }
            }
        }

        return maxVal;
    },

    getSeriesAccumFor24hMode(rawSeries, idx, hoursOverride) {
        if (!rawSeries || !Number.isInteger(idx)) return null;

        const endIdx = idx + 1;
        let dynamicHours;
        if (Number.isFinite(hoursOverride)) {
            dynamicHours = Math.max(1, Math.min(24, hoursOverride));
        } else {
            const displayItems = this.state.currentDisplayItems || [];
            const dayStartIdx = displayItems.length > 0 ? Number(displayItems[0]?.indices?.[0]) : null;
            const baseIdx = Number.isInteger(dayStartIdx) ? dayStartIdx : idx;
            dynamicHours = Math.max(1, Math.min(24, (idx - baseIdx) + 2));
        }
        const startIdx = Math.max(0, endIdx - dynamicHours + 1);

        let sum = 0;
        let found = false;
        for (let i = startIdx; i <= endIdx; i++) {
            const val = rawSeries[i];
            if (Number.isFinite(val)) {
                sum += val;
                found = true;
            }
        }

        return found ? sum : null;
    },

    getNCDRForecastAccumFor24hMode(locName, idx, hoursOverride) {
        const rawSeries = this.state.ncdrRainRawSeries.get(locName);
        return this.getSeriesAccumFor24hMode(rawSeries, idx, hoursOverride);
    },
    
    parseNCDRcsv(csvText, type, rainEnsemble = null) {
        const lines = csvText.split('\n').map(line => line.replace(/\r/g, ''));
        if (lines.length < 3) return null;

        const recDateTimeRaw = (lines[0].split(',')[1] || '').trim();
        const dataLines = lines.slice(2).filter(line => line.trim() !== '');
        const headers = lines[1].split(',').map(h => h.trim());

        if (type === 'wind') {
            return this.parseNCDRWindCsv(headers, dataLines, recDateTimeRaw);
        }

        if (type === 'rain') {
            const directHourly = (rainEnsemble || this.state.ncdrRainEnsemble) === 'G01';
            return this.parseNCDRRainCsv(headers, dataLines, recDateTimeRaw, directHourly);
        }

        const hourHeaders = headers.filter(h => h.startsWith('H'));
        const townMaxData = {};
        this.state.locations.forEach(loc => { townMaxData[loc.name] = {}; });

        dataLines.forEach(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((h, i) => row[h] = parseFloat(values[i]));

            const townName = this.findTownByCoords(row.Lon, row.Lat);
            if (townName && townMaxData[townName]) {
                hourHeaders.forEach(h => {
                    const val = row[h];
                    if (!townMaxData[townName][h] || val > townMaxData[townName][h]) {
                        townMaxData[townName][h] = val;
                    }
                });
            }
        });
        return townMaxData;
    },

    parseNCDRRainCsv(headers, dataLines, recDateTimeRaw, directHourly = false) {
        const baseTime = Utils.parseRecDateTimeAsUTC(recDateTimeRaw);
        const hourIds = headers
            .filter(h => /^H\d{2}$/i.test(h))
            .map(h => h.slice(1))
            .sort((a, b) => Number(a) - Number(b));

        const townHourlyRain = {};
        this.state.locations.forEach(loc => { townHourlyRain[loc.name] = {}; });

        dataLines.forEach(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((h, i) => row[h] = values[i]);

            const lon = parseFloat(row.Lon ?? row.lon);
            const lat = parseFloat(row.Lat ?? row.lat);
            const townName = this.findTownByCoords(lon, lat);
            if (!townName || !townHourlyRain[townName]) return;

            hourIds.forEach(hh => {
                const rain = parseFloat(row[`H${hh}`]);
                if (!Number.isFinite(rain)) return;

                const hourKey = `H${hh}`;
                const existing = townHourlyRain[townName][hourKey];
                if (!Number.isFinite(existing) || rain > existing) {
                    townHourlyRain[townName][hourKey] = rain;
                }
            });
        });

        const townHourlyStepRainRaw = {};
        this.state.locations.forEach(loc => {
            const townName = loc.name;
            const cumByHour = townHourlyRain[townName] || {};
            const stepByHour = {};

            if (directHourly) {
                // G01: each H column is direct hourly rainfall, no differencing needed
                hourIds.forEach(hh => {
                    const hourKey = `H${hh}`;
                    const val = cumByHour[hourKey];
                    stepByHour[hourKey] = Number.isFinite(val) ? Math.max(val, 0) : null;
                });
            } else {
                hourIds.forEach((hh, idx) => {
                    const hourKey = `H${hh}`;
                    const curCum = cumByHour[hourKey];
                    const nextHourId = hourIds[idx + 1];
                    const nextCum = nextHourId ? cumByHour[`H${nextHourId}`] : null;
                    const prevHourId = hourIds[idx - 1];
                    const prevCum = prevHourId ? cumByHour[`H${prevHourId}`] : null;

                    if (!Number.isFinite(curCum)) {
                        stepByHour[hourKey] = null;
                        return;
                    }

                    if (Number.isFinite(nextCum)) {
                        stepByHour[hourKey] = Math.max(nextCum - curCum, 0);
                    } else {
                        if (Number.isFinite(prevCum)) {
                            stepByHour[hourKey] = Math.max(curCum - prevCum, 0);
                        } else {
                            stepByHour[hourKey] = Math.max(curCum, 0);
                        }
                    }
                });
            }

            townHourlyStepRainRaw[townName] = stepByHour;
        });

        // For G01 (direct hourly), build cumulative series as running sum
        let finalCum = townHourlyRain;
        if (directHourly) {
            const cumulativeByTown = {};
            this.state.locations.forEach(loc => {
                const townName = loc.name;
                const stepByHour = townHourlyStepRainRaw[townName] || {};
                const cumByHour = {};
                let running = 0;
                hourIds.forEach(hh => {
                    const hourKey = `H${hh}`;
                    const step = stepByHour[hourKey];
                    if (Number.isFinite(step)) running += step;
                    cumByHour[hourKey] = running;
                });
                cumulativeByTown[townName] = cumByHour;
            });
            finalCum = cumulativeByTown;
        }

        return { baseTime, hourIds, townHourlyRainRaw: townHourlyStepRainRaw, townHourlyRainCum: finalCum };
    },

    parseNCDRWindCsv(headers, dataLines, recDateTimeRaw) {
        const baseTime = Utils.parseRecDateTimeAsUTC(recDateTimeRaw);
        const hourIds = Array.from(new Set(
            headers
                .map(h => {
                    const m = h.match(/^H(\d{2})_(u|v)$/i);
                    return m ? m[1] : null;
                })
                .filter(Boolean)
        )).sort((a, b) => Number(a) - Number(b));

        const townHourlyWs = {};
        this.state.locations.forEach(loc => { townHourlyWs[loc.name] = {}; });

        dataLines.forEach(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((h, i) => row[h] = values[i]);

            const lon = parseFloat(row.Lon ?? row.lon);
            const lat = parseFloat(row.Lat ?? row.lat);
            const townName = this.findTownByCoords(lon, lat);
            if (!townName || !townHourlyWs[townName]) return;

            hourIds.forEach(hh => {
                const u = parseFloat(row[`H${hh}_u`]);
                const v = parseFloat(row[`H${hh}_v`]);
                if (!Number.isFinite(u) || !Number.isFinite(v)) return;

                const ws = Math.hypot(u, v);
                const hourKey = `H${hh}`;
                const existing = townHourlyWs[townName][hourKey];
                if (!Number.isFinite(existing) || ws > existing) {
                    townHourlyWs[townName][hourKey] = ws;
                }
            });
        });

        return { baseTime, hourIds, townHourlyWs };
    },

    injectNCDRWindData(parsedWind) {
        if (!parsedWind) return;

        const { baseTime, hourIds, townHourlyWs } = parsedWind;
        this.state.ncdrWindBaseTime = baseTime;

        this.state.meta.WindSpeed = {
            '@description': '風速',
            '@unit': '公尺/秒'
        };
        this.state.meta.BeaufortScale = {
            '@description': '蒲福風級',
            '@unit': '蒲福風級'
        };

        this.state.locations.forEach(loc => {
            const wsByHour = townHourlyWs[loc.name] || {};
            const times = hourIds.map(hh => {
                const hourKey = `H${hh}`;
                const ws = wsByHour[hourKey];
                const date = baseTime
                    ? new Date(baseTime.getTime() + Number(hh) * 3600 * 1000)
                    : null;

                return {
                    StartTime: date ? date.toISOString() : hourKey,
                    ElementValue: {
                        WindSpeed: Number.isFinite(ws) ? Number(ws.toFixed(1)) : null,
                        BeaufortScale: Number.isFinite(ws) ? Utils.wsToBeaufort(ws) : null
                    }
                };
            });

            loc.data["NCDR風速"] = {
                ElementName: "NCDR風速",
                Time: times
            };
        });
    },

    injectNCDRRainData(parsedRain) {
        if (!parsedRain) return;

        const { baseTime, hourIds, townHourlyRainRaw, townHourlyRainCum } = parsedRain;
        this.state.ncdrRainBaseTime = baseTime;
        this.state.ncdrRainRawSeries.clear();
        this.state.ncdrRainCumSeries.clear();

        this.state.meta.Rainfall = {
            '@description': '雨量',
            '@unit': 'mm'
        };

        this.state.locations.forEach(loc => {
            const rainRawByHour = townHourlyRainRaw[loc.name] || {};
            const rainCumByHour = townHourlyRainCum[loc.name] || {};
            const rawSeries = [];
            const cumSeries = [];
            const times = hourIds.map(hh => {
                const hourKey = `H${hh}`;
                const rainRaw = rainRawByHour[hourKey];
                const rainCum = rainCumByHour[hourKey];
                const date = baseTime
                    ? new Date(baseTime.getTime() + Number(hh) * 3600 * 1000)
                    : null;

                rawSeries.push(Number.isFinite(rainRaw) ? rainRaw : null);
                cumSeries.push(Number.isFinite(rainCum) ? rainCum : null);

                return {
                    StartTime: date ? date.toISOString() : hourKey,
                    ElementValue: {
                        Rainfall: Number.isFinite(rainRaw) ? rainRaw : null
                    }
                };
            });

            this.state.ncdrRainRawSeries.set(loc.name, rawSeries);
            this.state.ncdrRainCumSeries.set(loc.name, cumSeries);

            loc.data["NCDR降雨"] = {
                ElementName: "NCDR降雨",
                Time: times
            };
        });
    },

    findTownByCoords(lon, lat) {
        if (!this.ui.layer) return null;

        const { minLon, maxLon, minLat, maxLat } = this.ncdrBounds;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
            return null;
        }

        const cacheKey = `${lon}|${lat}`;
        if (this.state.townCoordCache.has(cacheKey)) {
            return this.state.townCoordCache.get(cacheKey);
        }

        let foundTown = null;

        this.ui.layer.eachLayer(layer => {
            if (foundTown) return;

            const feature = layer.feature;
            const townName = feature.properties.town;
            const geometry = feature.geometry;

            if (geometry.type === "Polygon") {
                if (Utils.pointInPoly(lon, lat, geometry.coordinates[0])) {
                    foundTown = townName;
                }
            } else if (geometry.type === "MultiPolygon") {
                for (const poly of geometry.coordinates) {
                    if (Utils.pointInPoly(lon, lat, poly[0])) {
                        foundTown = townName;
                        break;
                    }
                }
            }
        });

        this.state.townCoordCache.set(cacheKey, foundTown);
        return foundTown;
    },

    initMenu() {
        const sel = document.getElementById('variable-select');
        const keys = Object.keys(VARIABLE_MAPPING);
        
        sel.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
        this.state.currentVar = keys[0]; 

        // Initialize ensemble select options
        const ensembleSel = document.getElementById('ncdr-rain-ensemble-select');
        if (ensembleSel) {
            const options = ['MAX', ...this.getNCDRRainMemberEnsembles()];
            ensembleSel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
            ensembleSel.value = this.state.ncdrRainEnsemble;
        }
        
        this.updateAggregationModeOptions();
        this.updateSubMenu();
        this.updateData();
    },

    updateAggregationModeOptions() {
        const aggSel = document.getElementById('aggregation-mode-select');
        if (!aggSel) return;

        if (this.state.currentVar === "NCDR系集降雨預報") {
            const current = this.state.aggMode;
            aggSel.innerHTML = `
                <option value="${CONFIG.AGGREGATION.NONE}">不合併</option>
                <option value="${CONFIG.AGGREGATION.HOURLY_DAY}">單日逐時+累積降雨圖</option>
                <option value="${CONFIG.AGGREGATION.HOURLY_DAY_MAX}">單日逐時+全時段最大</option>
                <option value="${CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX}">單日逐24小時+全時段最大</option>
                <option value="${CONFIG.AGGREGATION.HOURLY_3H_MAX}">單日逐3小時+全時段最大</option>
                <option value="${CONFIG.AGGREGATION.HOURS_3}">單日3小時合併</option>
                <option value="${CONFIG.AGGREGATION.HOURS_6}">單日6小時合併</option>
            `;

            if ([
                CONFIG.AGGREGATION.NONE,
                CONFIG.AGGREGATION.HOURLY_DAY,
                CONFIG.AGGREGATION.HOURLY_DAY_MAX,
                CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX,
                CONFIG.AGGREGATION.HOURLY_3H_MAX,
                CONFIG.AGGREGATION.HOURS_3,
                CONFIG.AGGREGATION.HOURS_6
            ].includes(current)) {
                aggSel.value = current;
            } else {
                aggSel.value = CONFIG.AGGREGATION.HOURLY_DAY;
                this.state.aggMode = CONFIG.AGGREGATION.HOURLY_DAY;
            }
            return;
        }

        const current = this.state.aggMode;
        aggSel.innerHTML = `
            <option value="${CONFIG.AGGREGATION.NONE}">不合併</option>
            <option value="${CONFIG.AGGREGATION.HOURLY_DAY}">單日逐時</option>
            <option value="${CONFIG.AGGREGATION.HOURS_3}">單日3小時合併</option>
            <option value="${CONFIG.AGGREGATION.HOURS_6}">單日6小時合併</option>
        `;

        if (
            current === CONFIG.AGGREGATION.HOURLY_DAY_MAX
            || current === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX
            || current === CONFIG.AGGREGATION.HOURLY_3H_MAX
        ) {
            this.state.aggMode = CONFIG.AGGREGATION.HOURLY_DAY;
        }
        aggSel.value = this.state.aggMode;
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
            if (this.state.currentVar === "NCDR系集十米風" && subKeys.includes("BeaufortScale")) {
                this.state.currentSubVar = "BeaufortScale";
                subSel.value = "BeaufortScale";
            } else {
                this.state.currentSubVar = subKeys[0];
            }
        } else {
            subSel.style.display = 'none';
            this.state.currentSubVar = null;
        }

        // Show/hide ensemble select for NCDR rain
        const ensembleLabel = document.getElementById('ncdr-rain-ensemble-label');
        if (ensembleLabel) {
            ensembleLabel.style.display = (this.state.currentVar === "NCDR系集降雨預報") ? 'inline' : 'none';
        }
    },

    bindEvents() {
        document.getElementById('variable-select').addEventListener('change', async e => {
            this.state.currentVar = e.target.value;
            this.updateAggregationModeOptions();
            this.state.ncdrRainNoneWindowStart = 0;
            this.state.ncdrRainWindowShiftHours = 0;
            
            if (this.state.currentVar === "定量降水預報") {
                document.getElementById('aggregation-mode-select').disabled = true;
                this.state.aggMode = 'QPF';
                
                // Initialize QPF data if needed
                if (!this.state.locations[0].data["QPF"]) {
                     this.ui.timeDisplay.textContent = "正在解析雨量圖...";
                     await QPFService.process();
                }
            } else if (this.state.currentVar === "NCDR系集十米風") {
                document.getElementById('aggregation-mode-select').disabled = false;
                this.state.aggMode = document.getElementById('aggregation-mode-select').value;

                if (!this.state.ncdrWindLoaded) {
                    this.ui.timeDisplay.textContent = "正在載入 NCDR系集十米風...";
                    const parsedWind = await this.fetchNCDRData('wind');
                    if (parsedWind) {
                        this.injectNCDRWindData(parsedWind);
                        this.state.ncdrWindLoaded = true;
                    }
                }
            } else if (this.state.currentVar === "NCDR系集降雨預報") {
                document.getElementById('aggregation-mode-select').disabled = false;
                this.state.aggMode = document.getElementById('aggregation-mode-select').value;

                if (!this.state.ncdrRainLoaded) {
                    this.ui.timeDisplay.textContent = `正在載入 NCDR系集降雨預報 (${this.state.ncdrRainEnsemble})...`;
                    const parsedRain = await this.fetchNCDRData('rain');
                    if (parsedRain) {
                        this.injectNCDRRainData(parsedRain);
                        this.state.ncdrRainLoaded = true;
                    }
                }

                if (!this.state.ncdrObsRainLoaded) {
                    await this.fetchObservedRain24hData();
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

        const ensembleSel = document.getElementById('ncdr-rain-ensemble-select');
        if (ensembleSel) {
            ensembleSel.addEventListener('change', async e => {
                const newEnsemble = e.target.value;
                if (newEnsemble === this.state.ncdrRainEnsemble) return;
                this.state.ncdrRainEnsemble = newEnsemble;
                this.state.ncdrRainLoaded = false;
                this.ui.timeDisplay.textContent = `正在載入 NCDR系集降雨預報 (${newEnsemble})...`;
                const parsedRain = await this.fetchNCDRData('rain');
                if (parsedRain) {
                    this.injectNCDRRainData(parsedRain);
                    this.state.ncdrRainLoaded = true;
                }
                this.state.ncdrRainNoneWindowStart = 0;
                this.state.ncdrRainWindowShiftHours = 0;
                this.state.timeIndex = -1;
                this.updateData();
            });
        }

        if (this.ui.ncdrMaxOrderMaxBtn) {
            this.ui.ncdrMaxOrderMaxBtn.addEventListener('click', () => {
                if (this.state.ncdrRainMaxAggregationOrder === 'maxfirst') return;
                this.state.ncdrRainMaxAggregationOrder = 'maxfirst';
                this.updateNCDRMaxOrderSwitchUI();
                this.updateData();
            });
        }

        if (this.ui.ncdrMaxOrderSumBtn) {
            this.ui.ncdrMaxOrderSumBtn.addEventListener('click', () => {
                if (this.state.ncdrRainMaxAggregationOrder === 'sumfirst') return;
                this.state.ncdrRainMaxAggregationOrder = 'sumfirst';
                this.updateNCDRMaxOrderSwitchUI();
                this.updateData();
            });
        }

        document.getElementById('aggregation-mode-select').addEventListener('change', e => {
            this.state.aggMode = e.target.value;
            this.state.ncdrRainNoneWindowStart = 0;
            this.state.ncdrRainWindowShiftHours = 0;
            this.state.timeIndex = -1; 
            this.updateData();
        });

        if (this.ui.ncdrRainPrev6Btn) {
            this.ui.ncdrRainPrev6Btn.addEventListener('click', () => {
                this.shiftNCDRRainNoneWindow(-CONFIG.NCDR_RAIN_NONE_SHIFT_HOURS);
            });
        }

        if (this.ui.ncdrRainNext6Btn) {
            this.ui.ncdrRainNext6Btn.addEventListener('click', () => {
                this.shiftNCDRRainNoneWindow(CONFIG.NCDR_RAIN_NONE_SHIFT_HOURS);
            });
        }

        document.getElementById('download-btn').addEventListener('click', () => {
            const mainElement = document.querySelector('main');
            if (!mainElement) return;

            if (typeof html2canvas === 'undefined') {
                alert('圖片下載模組尚未載入，請確認網路連線');
                return;
            }

            // Add screenshot mode class to clean up UI for capture
            document.body.classList.add('taking-screenshot');

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
                    document.body.classList.remove('taking-screenshot');
                }).catch(e => {
                    console.error(e);
                    alert('擷取圖片失敗');
                    document.body.classList.remove('taking-screenshot');
                });
            }, 200); // Slightly increased delay to ensure styles propagate
        });
    },

    updateData() {
        const config = VARIABLE_MAPPING[this.state.currentVar];
        if (!config || !this.state.locations.length) return;

        const firstLoc = this.state.locations[0];
        const element = firstLoc.data[config.key];
        let generatedItems = [];
        
        if (element && element.Time) {
            const rawTimes = element.Time.map(t => t.StartTime || t.DataTime);
            
            // QPF Mode or standard
            const mode = (this.state.currentVar === "定量降水預報") ? 'QPF' : this.state.aggMode;
            const normalizedMode = (
                mode === CONFIG.AGGREGATION.HOURLY_DAY_MAX
                || mode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX
                || mode === CONFIG.AGGREGATION.HOURLY_3H_MAX
            )
                ? CONFIG.AGGREGATION.HOURLY_DAY
                : mode;
            
            // Interval logic (Standard)
            let interval = 1;
            if (normalizedMode !== 'QPF' && rawTimes.length > 1) {
                const diff = new Date(rawTimes[1]) - new Date(rawTimes[0]);
                if (diff >= 3 * 3600 * 1000) interval = 3;
            }

            const windowShiftHours = (
                this.state.currentVar === "NCDR系集降雨預報"
                && this.state.aggMode !== CONFIG.AGGREGATION.NONE
            )
                ? this.state.ncdrRainWindowShiftHours
                : 0;

            generatedItems = TimeManager.generateGroups(
                rawTimes, 
                normalizedMode, 
                interval,
                { windowShiftHours }
            );
        }

        this.state.currentDisplayItems = this.applyNCDRRainNoneWindow(generatedItems);

        if (this.state.timeIndex >= this.state.currentDisplayItems.length) {
            this.state.timeIndex = -1;
        }

        this.updateNCDRRainNoneNavControls();
        this.updateNCDRMaxOrderSwitchUI();

        this.renderTable();
        this.renderMap();
        this.updateLabels();
        this.renderLegend();
    },

    formatNCDRRainValue(rawVal) {
        if (!Number.isFinite(rawVal)) {
            return { num: 0, str: "-", valid: false };
        }

        const nonNeg = Math.max(rawVal, 0);
        const rounded = Math.ceil(nonNeg);
        const str = (nonNeg > 0 && nonNeg < 1) ? "<1" : String(rounded);

        return { num: rounded, str, valid: true };
    },

    calculateNCDR24hTotalForSeries(locName, element, idx, rawSeries) {
        if (!rawSeries || !Number.isInteger(idx)) return null;

        const rawTime = element?.Time?.[idx]?.StartTime || element?.Time?.[idx]?.DataTime;
        const targetTime = rawTime ? new Date(rawTime) : null;

        const stationsAvail = (this.state.obsRain24hByTown.get(locName)?.length ?? 0) > 0;
        let acHours = 0;
        if (stationsAvail) {
            const refTime = this.state.obsRainRequestedTime;
            if (targetTime instanceof Date && Number.isFinite(targetTime.getTime()) &&
                refTime instanceof Date && Number.isFinite(refTime.getTime())) {
                const hourDiff = Math.round((targetTime.getTime() - refTime.getTime()) / 3600000);
                acHours = Math.max(0, Math.min(24, 23 - hourDiff));
            } else {
                acHours = 22;
            }
        }

        const obsAccum = acHours > 0 ? this.getObservedRainAccumByHour(locName, targetTime, 22) : null;
        const fcstAccum = acHours === 0
            ? this.getSeriesAccumFor24hMode(rawSeries, idx, 24)
            : this.getSeriesAccumFor24hMode(rawSeries, idx);

        if (!Number.isFinite(obsAccum) && !Number.isFinite(fcstAccum)) return null;

        return (Number.isFinite(obsAccum) ? obsAccum : 0) + (Number.isFinite(fcstAccum) ? fcstAccum : 0);
    },

    calculateNCDRMaxSumFirstValue(locName, element, indices) {
        const memberRawList = this.state.ncdrRainMaxMemberRawByTown?.[locName];
        const memberCumList = this.state.ncdrRainMaxMemberCumByTown?.[locName];
        if (!Array.isArray(memberRawList) || memberRawList.length === 0 || !Array.isArray(indices) || indices.length === 0) {
            return { num: 0, str: "-", valid: false };
        }

        let maxVal = null;

        for (let m = 0; m < memberRawList.length; m++) {
            const rawSeries = memberRawList[m];
            const cumSeries = Array.isArray(memberCumList?.[m]) ? memberCumList[m] : null;
            let value = null;

            if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX) {
                const idx = indices[0];
                if (
                    cumSeries
                    && Number.isInteger(idx)
                    && Number.isFinite(cumSeries[idx + 1])
                    && Number.isFinite(cumSeries[idx - 2])
                ) {
                    value = Math.max(cumSeries[idx + 1] - cumSeries[idx - 2], 0);
                } else {
                    let sumRaw = 0;
                    let found = false;
                    for (let i = Math.max(0, idx - 2); i <= idx; i++) {
                        const raw = rawSeries?.[i];
                        if (Number.isFinite(raw)) {
                            sumRaw += raw;
                            found = true;
                        }
                    }
                    if (found) value = sumRaw;
                }
            } else if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX) {
                value = this.calculateNCDR24hTotalForSeries(locName, element, indices[0], rawSeries);
            } else if (
                (this.state.aggMode === CONFIG.AGGREGATION.HOURS_3 || this.state.aggMode === CONFIG.AGGREGATION.HOURS_6)
                && indices.length > 1
            ) {
                let sumRaw = 0;
                let found = false;
                for (const idx of indices) {
                    const raw = rawSeries?.[idx];
                    if (Number.isFinite(raw)) {
                        sumRaw += raw;
                        found = true;
                    }
                }
                if (found) value = sumRaw;
            }

            if (Number.isFinite(value) && (maxVal == null || value > maxVal)) {
                maxVal = value;
            }
        }

        if (!Number.isFinite(maxVal)) return { num: 0, str: "-", valid: false };
        return this.formatNCDRRainValue(maxVal);
    },

    calculateDisplayValue(locName, element, indices) {
        if (this.state.currentVar === "NCDR系集降雨預報") {
            const rawSeries = this.state.ncdrRainRawSeries.get(locName);
            const cumSeries = this.state.ncdrRainCumSeries.get(locName);
            if (!rawSeries || !Array.isArray(indices) || indices.length === 0) {
                return { num: 0, str: "-", valid: false };
            }

            if (this.isNCDRSumFirstModeEnabled()) {
                return this.calculateNCDRMaxSumFirstValue(locName, element, indices);
            }

            if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX) {
                const idx = indices[0];
                if (
                    cumSeries
                    && Number.isInteger(idx)
                    && Number.isFinite(cumSeries[idx + 1])
                    && Number.isFinite(cumSeries[idx - 2])
                ) {
                    const rolling3h = Math.max(cumSeries[idx + 1] - cumSeries[idx - 2], 0);
                    return this.formatNCDRRainValue(rolling3h);
                }

                let sumRaw = 0;
                let found = false;
                for (let i = Math.max(0, idx - 2); i <= idx; i++) {
                    const raw = rawSeries[i];
                    if (Number.isFinite(raw)) {
                        sumRaw += raw;
                        found = true;
                    }
                }
                if (!found) return { num: 0, str: "-", valid: false };
                return this.formatNCDRRainValue(sumRaw);
            }

            if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX) {
                const idx = indices[0];
                const total24h = this.calculateNCDR24hTotalForSeries(locName, element, idx, rawSeries);
                if (!Number.isFinite(total24h)) return { num: 0, str: "-", valid: false };
                return this.formatNCDRRainValue(total24h);
            }

            const shouldSumNCDRRainPeriod = (
                this.state.aggMode === CONFIG.AGGREGATION.HOURS_3
                || this.state.aggMode === CONFIG.AGGREGATION.HOURS_6
            ) && indices.length > 1;

            if (shouldSumNCDRRainPeriod) {
                let sumRaw = 0;
                let found = false;

                for (const idx of indices) {
                    const raw = rawSeries[idx];
                    if (Number.isFinite(raw)) {
                        sumRaw += raw;
                        found = true;
                    }
                }

                if (!found) return { num: 0, str: "-", valid: false };
                return this.formatNCDRRainValue(sumRaw);
            }

            const raw = rawSeries[indices[0]];
            return this.formatNCDRRainValue(raw);
        }

        return Utils.calculateAggregatedValue(element, indices, this.state.currentSubVar);
    },

    renderTable() {
        const { tableHeader, tableBody } = this.ui;
        const items = this.state.currentDisplayItems;
        const config = VARIABLE_MAPPING[this.state.currentVar];
        const isMergedDateHeaderMode = (
            this.state.aggMode === 'QPF'
            || this.state.currentVar === "定量降水預報"
            ||
            this.state.aggMode === CONFIG.AGGREGATION.NONE
            || this.state.aggMode === CONFIG.AGGREGATION.HOURS_3
            || this.state.aggMode === CONFIG.AGGREGATION.HOURS_6
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_MAX
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX
        );

        tableHeader.innerHTML = '';
        
        // 1. HEADER GENERATION
        if (isMergedDateHeaderMode && items.length > 0) {
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
                th.textContent = item.periodLabel || item.label.split(' ')[1]; 
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
                th.className = 'time-header';
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
            let shortName = loc.name.replace('區', '');
            tdName.textContent = shortName[0] + '　' + shortName[1];
            tr.appendChild(tdName);

            const element = loc.data[config.key];
            
            items.forEach((item, idx) => {
                const td = document.createElement('td');
                
                // Add day boundary styling
                if (idx > 0 && item.dateKey !== items[idx-1].dateKey) {
                    td.classList.add('day-start');
                }

                const { num, str, valid } = this.calculateDisplayValue(loc.name, element, item.indices);
                
                td.textContent = str;
                if (valid) {
                    // Added '80' transparency to match original UX
                    const baseColor = Utils.getColor(num, this.state.currentVar, this.state.currentSubVar, {
                        aggMode: this.state.aggMode
                    });
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

        this.applyTableLayout(items.length);
    },

    applyTableLayout(itemCount) {
        const table = document.getElementById('weather-table');
        if (!table) return;

        const existingColgroup = table.querySelector('colgroup');
        if (existingColgroup) existingColgroup.remove();

        const colgroup = document.createElement('colgroup');
        const locationRatio = 14;
        const dataRatio = itemCount > 0 ? (100 - locationRatio) / itemCount : (100 - locationRatio);

        const colLocation = document.createElement('col');
        colLocation.style.width = `${locationRatio}%`;
        colgroup.appendChild(colLocation);

        for (let i = 0; i < itemCount; i++) {
            const col = document.createElement('col');
            col.style.width = `${dataRatio}%`;
            colgroup.appendChild(col);
        }

        table.prepend(colgroup);

        let fontSize = '';
        if (itemCount >= 24) fontSize = '1.5rem';
        else if (itemCount >= 8) fontSize = '2.0rem';
        else if (itemCount >= 4) fontSize = '2.2rem';

        const timeHeaders = this.ui.tableHeader.querySelectorAll('th.time-header');
        timeHeaders.forEach(th => {
            th.style.fontSize = fontSize;
        });

        const shouldUseCompactRainFont = this.shouldUseCompactRainTableFont();
        let dataFontSize = fontSize;
        if (shouldUseCompactRainFont) {
            if (itemCount >= 24) dataFontSize = '1.3rem';
            else if (itemCount >= 8) dataFontSize = '1.7rem';
            else if (itemCount >= 4) dataFontSize = '1.9rem';
            else dataFontSize = '2.0rem';
        }

        const allRows = this.ui.tableBody.querySelectorAll('tr');
        allRows.forEach(row => {
            const dataCells = row.querySelectorAll('td:not(:first-child)');
            dataCells.forEach(td => {
                td.style.fontSize = dataFontSize;
            });
        });
    },

    shouldUseCompactRainTableFont() {
        const rainVars = ["定量降水預報", "NCDR系集降雨預報"];
        if (!rainVars.includes(this.state.currentVar)) return false;

        const rows = this.ui.tableBody?.querySelectorAll('tr');
        if (!rows || rows.length === 0) return false;

        for (const row of rows) {
            const cells = row.querySelectorAll('td:not(:first-child)');
            for (const cell of cells) {
                const text = (cell.textContent || '').trim();
                if (!text || text === '-' || text === 'N/A') continue;

                const numeric = Number(text.replace(/[^\d.-]/g, ''));
                if (Number.isFinite(numeric) && Math.abs(numeric) >= 1000) {
                    return true;
                }
            }
        }

        return false;
    },

    renderMap() {
        if (!this.ui.layer || !this.state.locations.length) return;
        
        const config = VARIABLE_MAPPING[this.state.currentVar];
        const unit = Utils.getUnit(this.state.currentVar, this.state.currentSubVar, this.state.meta);

        let ncdrRainMinIndex = null;
        let ncdrRainMaxIndex = null;
        if (
            this.state.currentVar === "NCDR系集降雨預報"
            && this.state.timeIndex === -1
            && this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY
            && this.state.currentDisplayItems.length > 0
        ) {
            const allIndices = this.state.currentDisplayItems.flatMap(item => item.indices || []);
            if (allIndices.length > 0) {
                ncdrRainMinIndex = Math.min(...allIndices);
                ncdrRainMaxIndex = Math.max(...allIndices);
            }
        }

        this.ui.layer.eachLayer(layer => {
            const town = layer.feature.properties.town; 
            const loc = this.state.locationsMap.get(town);
            
            let color = '#cccccc';
            let label = 'N/A';

            if (loc && loc.data[config.key]) {
                let num, str, valid = false;

                if (this.state.timeIndex === -1 && this.state.currentDisplayItems.length > 0) {
                     if (
                         this.state.currentVar === "NCDR系集降雨預報"
                         && this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY
                     ) {
                         const cumSeries = this.state.ncdrRainCumSeries.get(loc.name);
                         if (
                             cumSeries
                             && Number.isInteger(ncdrRainMinIndex)
                             && Number.isInteger(ncdrRainMaxIndex)
                             && Number.isFinite(cumSeries[ncdrRainMinIndex])
                             && Number.isFinite(cumSeries[ncdrRainMaxIndex])
                         ) {
                             const periodRaw = Math.max(cumSeries[ncdrRainMaxIndex] - cumSeries[ncdrRainMinIndex], 0);
                             const formatted = this.formatNCDRRainValue(periodRaw);
                             num = formatted.num;
                             str = formatted.str;
                             valid = formatted.valid;
                         }
                     } else {
                         // Max Mode
                         let maxVal = -Infinity;
                         let maxStr = 'N/A';
                         this.state.currentDisplayItems.forEach(item => {
                             const res = this.calculateDisplayValue(loc.name, loc.data[config.key], item.indices);
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
                     }
                } else {
                    // Specific Time Mode
                    const activeItem = this.state.currentDisplayItems[this.state.timeIndex];
                    if (activeItem) {
                        const res = this.calculateDisplayValue(loc.name, loc.data[config.key], activeItem.indices);
                        num = res.num;
                        str = res.str;
                        valid = res.valid;
                    }
                }
                
                if (valid) {
                    color = Utils.getColor(num, this.state.currentVar, this.state.currentSubVar, {
                        aggMode: this.state.aggMode
                    });
                    label = str;
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
        if (
            this.state.aggMode === CONFIG.AGGREGATION.NONE
            ||
            this.state.aggMode === CONFIG.AGGREGATION.HOURS_3
            || this.state.aggMode === CONFIG.AGGREGATION.HOURS_6
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_MAX
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX
            || this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX
        ) {
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

    renderLegend() {
        const legend = document.getElementById('map-legend');
        if (!legend) return;

        if (this.state.currentVar === "NCDR系集降雨預報") {
            legend.style.display = 'block';

            const makeCell = (color, text, withBorder = false) =>
                `<div class="l-cell"><div class="l-icon" style="flex: 0.3"><i style="background: ${color};${withBorder ? ' border: 1px solid #ccc;' : ''}"></i></div><div class="l-lvl" style="text-align: left;">${text}</div></div>`;

            const formatLegendText = (threshold, lvl) =>
                `<span style="display:inline-block; width:4.6em; text-align:left;">≥ ${threshold}</span><span style="display:inline-block; margin-left:0.6em; text-align:left;">${lvl}</span>`;

            let thresholds = RAIN_1H_THRESHOLDS;
            let colors = RAIN_1H_COLORS;
            let modeTitle = '逐1小時 預報分級 (mm)';

            if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX) {
                thresholds = RAIN_24H_THRESHOLDS;
                colors = RAIN_24H_COLORS;
                modeTitle = '逐24小時 預報分級 (mm)';
            } else if (
                this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX
                || this.state.aggMode === CONFIG.AGGREGATION.HOURS_3
                || this.state.aggMode === CONFIG.AGGREGATION.HOURS_6
            ) {
                thresholds = RAIN_3H_THRESHOLDS;
                colors = RAIN_3H_COLORS;
                modeTitle = '逐3小時 預報分級 (mm)';
            } else if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_MAX) {
                thresholds = RAIN_1H_THRESHOLDS;
                colors = RAIN_1H_COLORS;
                modeTitle = '逐1小時 預報分級 (mm)';
            }

            const severityLabels = ['降雨注意', '大雨', '豪雨', '大豪雨', '超大豪雨'];
            const levelCells = thresholds.map((threshold, idx) => {
                const lvl = severityLabels[idx] || `等級${idx + 1}`;
                const c = colors[idx + 1] || colors[colors.length - 1];
                return makeCell(c, formatLegendText(threshold, lvl));
            }).join('');

            legend.innerHTML = `
            <div class="l-group" style="border-color:#90A4AE; color:#455A64; margin-bottom: 0.5em;">
                <div class="l-group-title">${modeTitle}</div>
                <div class="l-grid" style="grid-template-columns: 1fr; row-gap: 0.35em;">
                    ${levelCells}
                </div>
            </div>`;
            return;
        }
        
        if ((this.state.currentVar === "風速" || this.state.currentVar === "NCDR系集十米風")
            && this.state.currentSubVar === "BeaufortScale") {
            legend.style.display = 'block';
            legend.innerHTML = `
            <!-- Row 1: <=1, 2, 3 (Independent Grid) -->
            <div class="l-grid" style="margin-bottom: 0.5em;">
                <div class="l-cell"><div class="l-icon"><i style="background: #FFFFFF; border: 1px solid #ccc;"></i></div><div class="l-lvl">≤1</div></div>
                <div class="l-cell"><div class="l-icon"><i style="background: #6deadd;"></i></div><div class="l-lvl">2</div></div>
                <div class="l-cell"><div class="l-icon"><i style="background: #9dee89;"></i></div><div class="l-lvl">3</div></div>
            </div>

            <!-- Group 1: Attention -->
            <div class="l-group" style="border-color:#F5B041; color:#E67E22;">
                <div class="l-group-title">強風注意</div>
                <div class="l-grid">
                    <div class="l-cell"><div class="l-icon"><i style="background: #ffe77c;"></i></div><div class="l-lvl">4</div></div>
                    <div class="l-cell"><div class="l-icon"><i style="background: #ffc93e;"></i></div><div class="l-lvl">5</div></div>
                    <div class="l-cell"><div class="l-icon"><i style="background: #ffac00;"></i></div><div class="l-lvl">6</div></div>
                </div>
            </div>

            <!-- Group 2: Warning -->
            <div class="l-group l-warn">
                <div class="l-group-title">強風警示</div>
                <div class="l-grid">
                    <div class="l-cell"><div class="l-icon"><i style="background: #ff9292;"></i></div><div class="l-lvl">7</div></div>
                    <div class="l-cell"><div class="l-icon"><i style="background: #df3b3b;"></i></div><div class="l-lvl">8</div></div>
                    <div class="l-cell"><div class="l-icon"><i style="background: #a23ccb;"></i></div><div class="l-lvl">9+</div></div>
                </div>
            </div>`;
        } else {
            legend.innerHTML = '';
            legend.style.display = 'none';
        }
    },

    updateLabels() {
        const unit = Utils.getUnit(this.state.currentVar, this.state.currentSubVar, this.state.meta);
        const unitText = unit ? ` (單位：${unit})` : "";

        if (this.state.timeIndex === -1) {
            if (this.state.currentVar === "NCDR系集降雨預報") {
                if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_MAX) {
                    this.ui.timeDisplay.textContent = "";
                    this.ui.mapTimeDisplay.textContent = "圖：全時段最大值(單位：mm/hr)\n表：逐時降雨(單位：mm/hr)";
                    this.ui.mapTimeDisplay.style.whiteSpace = "pre-line";
                    return;
                }

                if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_3H_MAX) {
                    this.ui.timeDisplay.textContent = "";
                    this.ui.mapTimeDisplay.textContent = "圖：全時段最大值(單位：mm/3hr)\n表：逐3小時降雨(單位：mm/3hr)";
                    this.ui.mapTimeDisplay.style.whiteSpace = "pre-line";
                    return;
                }

                if (this.state.aggMode === CONFIG.AGGREGATION.HOURLY_DAY_24H_MAX) {
                    this.ui.timeDisplay.textContent = "";
                    this.ui.mapTimeDisplay.textContent = "圖：全時段最大值(mm/24hr)\n表：逐時24小時累積(mm/24hr)";
                    this.ui.mapTimeDisplay.style.whiteSpace = "pre-line";
                    return;
                }

                let tableUnitText = "時降雨(單位：mm/hr";
                if (this.state.aggMode === CONFIG.AGGREGATION.HOURS_3) {
                    tableUnitText = "3小時降雨(單位：mm/3hr";
                } else if (this.state.aggMode === CONFIG.AGGREGATION.HOURS_6) {
                    tableUnitText = "6小時降雨(單位：mm/6hr";
                }

                this.ui.timeDisplay.textContent = "";
                this.ui.mapTimeDisplay.textContent = `圖：累積降雨(單位：mm)\n表：逐${tableUnitText})`;
                this.ui.mapTimeDisplay.style.whiteSpace = "pre-line";
                return;
            }

            this.ui.timeDisplay.textContent = "目前顯示時間：全時段最大值";
            this.ui.mapTimeDisplay.textContent = `全時段最大值${unitText}`;
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
        this.ui.mapTimeDisplay.textContent = mapText + unitText;
        this.ui.mapTimeDisplay.style.whiteSpace = "pre-line"; // Ensure newlines render
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
