import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="精簡 D0047 天氣資料：只保留降雨與風勢重點")
    parser.add_argument("--input", required=True, help="D0047 原始 JSON 檔案路徑")
    parser.add_argument("--output", default=None, help="輸出精簡 JSON 路徑")
    parser.add_argument("--top-n", type=int, default=5, help="輸出降雨/風勢關注行政區前 N 名")
    parser.add_argument("--keep-timeseries", action="store_true", help="是否保留精簡後時序資料")
    return parser.parse_args()


def safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_iso_dt(text):
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def get_element_map(location):
    elements = location.get("WeatherElement", [])
    return {item.get("ElementName"): item for item in elements}


def extract_rain_series(location):
    element_map = get_element_map(location)
    rain = element_map.get("3小時降雨機率", {})
    out = []
    for item in rain.get("Time", []):
        values = item.get("ElementValue", {})
        pop = safe_float(values.get("ProbabilityOfPrecipitation"))
        out.append(
            {
                "start_time": item.get("StartTime"),
                "end_time": item.get("EndTime"),
                "pop": pop,
            }
        )
    return out


def extract_wind_series(location):
    element_map = get_element_map(location)
    wind_speed_item = element_map.get("風速", {})
    wind_dir_item = element_map.get("風向", {})

    speed_by_time = {}
    for item in wind_speed_item.get("Time", []):
        values = item.get("ElementValue", {})
        key = item.get("DataTime")
        speed_by_time[key] = {
            "wind_speed": safe_float(values.get("WindSpeed")),
            "beaufort": safe_float(values.get("BeaufortScale")),
        }

    dir_by_time = {}
    for item in wind_dir_item.get("Time", []):
        values = item.get("ElementValue", {})
        key = item.get("DataTime")
        dir_by_time[key] = values.get("WindDirection")

    all_times = sorted(set(speed_by_time.keys()) | set(dir_by_time.keys()))
    out = []
    for t in all_times:
        speed_obj = speed_by_time.get(t, {})
        out.append(
            {
                "data_time": t,
                "wind_speed": speed_obj.get("wind_speed"),
                "beaufort": speed_obj.get("beaufort"),
                "wind_direction": dir_by_time.get(t),
            }
        )
    return out


def summarize_location(location, keep_timeseries=False):
    location_name = location.get("LocationName")

    rain_series = extract_rain_series(location)
    wind_series = extract_wind_series(location)

    rain_vals = [item["pop"] for item in rain_series if item["pop"] is not None]
    wind_vals = [item["wind_speed"] for item in wind_series if item["wind_speed"] is not None]
    beaufort_vals = [item["beaufort"] for item in wind_series if item["beaufort"] is not None]
    wind_dirs = [item["wind_direction"] for item in wind_series if item.get("wind_direction")]

    rain_peak = max(rain_series, key=lambda x: x["pop"] if x["pop"] is not None else -1, default=None)
    wind_peak = max(wind_series, key=lambda x: x["wind_speed"] if x["wind_speed"] is not None else -1, default=None)

    summary = {
        "location_name": location_name,
        "geo": {
            "lat": safe_float(location.get("Latitude")),
            "lon": safe_float(location.get("Longitude")),
        },
        "rain": {
            "max_pop": max(rain_vals) if rain_vals else None,
            "avg_pop": round(sum(rain_vals) / len(rain_vals), 2) if rain_vals else None,
            "peak_period": {
                "start_time": rain_peak.get("start_time") if rain_peak else None,
                "end_time": rain_peak.get("end_time") if rain_peak else None,
                "pop": rain_peak.get("pop") if rain_peak else None,
            },
        },
        "wind": {
            "max_speed_mps": max(wind_vals) if wind_vals else None,
            "avg_speed_mps": round(sum(wind_vals) / len(wind_vals), 2) if wind_vals else None,
            "max_beaufort": max(beaufort_vals) if beaufort_vals else None,
            "dominant_direction": Counter(wind_dirs).most_common(1)[0][0] if wind_dirs else None,
            "peak_time": {
                "data_time": wind_peak.get("data_time") if wind_peak else None,
                "speed_mps": wind_peak.get("wind_speed") if wind_peak else None,
                "beaufort": wind_peak.get("beaufort") if wind_peak else None,
                "direction": wind_peak.get("wind_direction") if wind_peak else None,
            },
        },
    }

    if keep_timeseries:
        summary["timeseries"] = {
            "rain_3h": rain_series,
            "wind": wind_series,
        }

    return summary, rain_series, wind_series


def daily_city_summary(all_rain_series, all_wind_series):
    rain_bucket = defaultdict(list)
    wind_bucket = defaultdict(list)

    for _, rain_series in all_rain_series:
        for item in rain_series:
            start_dt = parse_iso_dt(item.get("start_time"))
            if start_dt and item.get("pop") is not None:
                rain_bucket[start_dt.date().isoformat()].append(item["pop"])

    for _, wind_series in all_wind_series:
        for item in wind_series:
            data_dt = parse_iso_dt(item.get("data_time"))
            if not data_dt:
                continue
            if item.get("wind_speed") is not None:
                wind_bucket[data_dt.date().isoformat()].append(("speed", item["wind_speed"]))
            if item.get("beaufort") is not None:
                wind_bucket[data_dt.date().isoformat()].append(("beaufort", item["beaufort"]))

    all_days = sorted(set(rain_bucket.keys()) | set(wind_bucket.keys()))
    out = []
    for day in all_days:
        pops = rain_bucket.get(day, [])
        wind_pairs = wind_bucket.get(day, [])
        speeds = [v for k, v in wind_pairs if k == "speed"]
        beauforts = [v for k, v in wind_pairs if k == "beaufort"]
        out.append(
            {
                "date": day,
                "rain": {
                    "city_max_pop": max(pops) if pops else None,
                    "city_avg_pop": round(sum(pops) / len(pops), 2) if pops else None,
                },
                "wind": {
                    "city_max_speed_mps": max(speeds) if speeds else None,
                    "city_avg_speed_mps": round(sum(speeds) / len(speeds), 2) if speeds else None,
                    "city_max_beaufort": max(beauforts) if beauforts else None,
                },
            }
        )
    return out


def top_locations(location_summaries, top_n):
    rain_sorted = sorted(
        location_summaries,
        key=lambda x: x.get("rain", {}).get("max_pop") if x.get("rain", {}).get("max_pop") is not None else -1,
        reverse=True,
    )
    wind_sorted = sorted(
        location_summaries,
        key=lambda x: x.get("wind", {}).get("max_speed_mps") if x.get("wind", {}).get("max_speed_mps") is not None else -1,
        reverse=True,
    )

    rain_top = [
        {
            "location_name": item["location_name"],
            "max_pop": item["rain"]["max_pop"],
            "peak_period": item["rain"]["peak_period"],
        }
        for item in rain_sorted[:top_n]
    ]
    wind_top = [
        {
            "location_name": item["location_name"],
            "max_speed_mps": item["wind"]["max_speed_mps"],
            "max_beaufort": item["wind"]["max_beaufort"],
            "peak_time": item["wind"]["peak_time"],
        }
        for item in wind_sorted[:top_n]
    ]
    return rain_top, wind_top


def build_reduced_payload(source_payload, top_n=5, keep_timeseries=False):
    root = source_payload["cwaopendata"]
    dataset = root["Dataset"]
    dataset_info = dataset.get("DatasetInfo", {})
    locations_obj = dataset.get("Locations", {})
    locations = locations_obj.get("Location", [])

    location_summaries = []
    all_rain_series = []
    all_wind_series = []
    for location in locations:
        location_summary, rain_series, wind_series = summarize_location(location, keep_timeseries=keep_timeseries)
        location_summaries.append(location_summary)
        all_rain_series.append((location_summary["location_name"], rain_series))
        all_wind_series.append((location_summary["location_name"], wind_series))

    rain_top, wind_top = top_locations(location_summaries, top_n=top_n)

    return {
        "source": {
            "dataid": root.get("Dataid"),
            "dataset_description": dataset_info.get("DatasetDescription"),
            "locations_name": locations_obj.get("LocationsName"),
            "issue_time": dataset_info.get("IssueTime"),
            "valid_time": dataset_info.get("ValidTime"),
            "update_time": dataset_info.get("Update"),
        },
        "focus": ["降雨", "風勢"],
        "city_daily_summary": daily_city_summary(all_rain_series, all_wind_series),
        "top_concern_locations": {
            "rain": rain_top,
            "wind": wind_top,
        },
        "locations": location_summaries,
    }


def main():
    args = parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"找不到輸入檔案: {input_path}")

    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_name(f"{input_path.stem}.rain_wind_reduced.json")

    source_payload = json.loads(input_path.read_text(encoding="utf-8"))
    reduced = build_reduced_payload(
        source_payload,
        top_n=max(1, args.top_n),
        keep_timeseries=args.keep_timeseries,
    )

    output_path.write_text(json.dumps(reduced, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"完成：已輸出精簡檔案 -> {output_path}")


if __name__ == "__main__":
    main()