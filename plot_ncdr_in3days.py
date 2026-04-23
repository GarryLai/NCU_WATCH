from datetime import datetime, timedelta
import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from geopandas import read_file as read_shp
from matplotlib.colors import BoundaryNorm, ListedColormap

QPF_THRESHOLDS = [1, 2, 6, 10, 15, 20, 30, 40, 50, 70, 90, 110, 130, 150, 200, 300]
QPF_COLORS = [
    "#EDF9FE", "#9CFCFF", "#03C8FF", "#059BFF", "#0363FF", "#059902", "#39FF03",
    "#FFFB03", "#FFC800", "#FF9500", "#FF0000", "#CC0000", "#990000", "#960099", "#C900CC",
    "#FB00FF", "#FDC9FF",
]
LST_OFFSET = timedelta(hours=8)


def parse_args():
    parser = argparse.ArgumentParser(description="繪製三天逐日累積降雨圖（每一天為 24 小時時雨量加總）")
    parser.add_argument("--csv", default="test_rain_G01.csv", help="NCDR 時雨量 CSV（含 H00~H84）")
    parser.add_argument("--json", default="test_rain_G01.json", help="NCDR JSON（含 RecDateTime）")
    parser.add_argument("--start-date", default=None, help="起算日期（YYYY-MM-DD）")
    parser.add_argument("--mode", choices=["daily", "12hr"], default="daily", help="累積模式：daily=每日24hr(3張)、12hr=半天12hr(6張)")
    parser.add_argument("--county-shp", default="/mnt/d/TW_GEOG/TW_CITY/COUNTY_MOI_1090820.shp", help="縣市界 SHP")
    parser.add_argument("--town-shp", default="/mnt/d/TW_GEOG/TW_TOWN/TOWN_MOI_1120317.shp", help="鄉鎮界 SHP")
    return parser.parse_args()


def get_discrete_cmap_norm():
    bounds = QPF_THRESHOLDS
    cmap = ListedColormap(QPF_COLORS)
    norm = BoundaryNorm(bounds, ncolors=len(QPF_COLORS), clip=False, extend="both")
    return cmap, norm, bounds


def build_grid(df, value_col):
    lon = df["Lon"].to_numpy(float)
    lat = df["Lat"].to_numpy(float)
    val = df[value_col].to_numpy(float)

    if len(df) == 0:
        raise ValueError("輸入資料為空，無法繪圖。")

    reset_idx = np.where(np.diff(lon) < 0)[0]
    if reset_idx.size > 0:
        row_lengths = np.diff(np.r_[-1, reset_idx, len(lon) - 1])
        if np.all(row_lengths == row_lengths[0]):
            ncols = int(row_lengths[0])
            nrows = int(len(lon) // ncols)
            if nrows * ncols == len(lon):
                x_arr = lon.reshape(nrows, ncols)
                y_arr = lat.reshape(nrows, ncols)
                c_arr = val.reshape(nrows, ncols)
                return x_arr, y_arr, np.ma.masked_invalid(c_arr)

    nx = int(np.sqrt(len(lon)))
    ny = int(np.ceil(len(lon) / max(nx, 1)))
    xg = np.linspace(lon.min(), lon.max(), max(nx, 2))
    yg = np.linspace(lat.min(), lat.max(), max(ny, 2))
    x_arr, y_arr = np.meshgrid(xg, yg)

    dx = x_arr[..., None] - lon[None, None, :]
    dy = y_arr[..., None] - lat[None, None, :]
    nearest_idx = np.argmin(dx * dx + dy * dy, axis=2)
    c_arr = val[nearest_idx]
    return x_arr, y_arr, np.ma.masked_invalid(c_arr)


def load_reference_datetime(json_path):
    with open(json_path, "r", encoding="utf-8-sig") as f:
        payload = json.load(f)

    rec_str = payload.get("RecDateTime")
    if not rec_str:
        raise KeyError(f"{json_path} 找不到 RecDateTime。")

    rec_str = str(rec_str).replace("Z", "")
    try:
        rec_dt = datetime.fromisoformat(rec_str)
    except ValueError as exc:
        raise ValueError(f"RecDateTime 格式無法解析: {rec_str}") from exc

    return rec_dt


def collect_hour_columns(df):
    hour_cols = [f"H{i:02d}" for i in range(85)]
    missing = [col for col in hour_cols if col not in df.columns]
    if missing:
        raise KeyError(f"CSV 缺少欄位: {', '.join(missing[:5])}{'...' if len(missing) > 5 else ''}")
    return hour_cols


def build_date_hour_map(rec_dt, hour_cols):
    date_to_hours = {}
    for idx, col in enumerate(hour_cols):
        valid_date = (rec_dt + timedelta(hours=idx)).date()
        date_to_hours.setdefault(valid_date, []).append(col)
    return date_to_hours


def find_valid_start_dates(date_to_hours, n_days=3, hours_per_day=24):
    all_dates = sorted(date_to_hours.keys())
    valid = []
    for start_day in all_dates:
        ok = True
        for shift in range(n_days):
            d = start_day + timedelta(days=shift)
            if len(date_to_hours.get(d, [])) != hours_per_day:
                ok = False
                break
        if ok:
            valid.append(start_day)
    return valid


def parse_start_date(user_input, valid_start_dates, rec_dt, end_dt):
    if user_input is None:
        if not valid_start_dates:
            raise ValueError("找不到可用的三日完整 24 小時區間，請檢查資料時間範圍。")
        selected = valid_start_dates[0]
        print(
            "未指定 --start-date，將使用第一個可行日期: "
            f"{selected}（可用: {', '.join(d.isoformat() for d in valid_start_dates)}）"
        )
        return selected

    try:
        selected = datetime.strptime(user_input, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("--start-date 格式錯誤，請使用 YYYY-MM-DD。") from exc

    if selected < rec_dt.date() or selected > end_dt.date():
        raise ValueError(
            "輸入日期超出資料時間範圍。"
            f"可參考範圍: {rec_dt.date()} ~ {end_dt.date()}"
        )

    if selected not in valid_start_dates:
        suggestion = ", ".join(d.isoformat() for d in valid_start_dates) if valid_start_dates else "無"
        raise ValueError(
            "輸入日期無法形成連續三天完整 24 小時累積。"
            f"可用起算日期: {suggestion}"
        )

    return selected


def compute_three_days_accumulation(df, date_to_hours, start_day):
    out = df[["Lon", "Lat", "Land"]].copy()
    labels = []
    for shift in range(3):
        target_day = start_day + timedelta(days=shift)
        cols = date_to_hours.get(target_day, [])
        if len(cols) != 24:
            raise ValueError(f"{target_day} 非完整 24 小時（實際 {len(cols)} 小時），無法計算日累積。")
        label = f"D{shift + 1}_{target_day.strftime('%Y%m%d')}"
        out[label] = df[cols].sum(axis=1, min_count=1)
        labels.append((target_day, label, cols[0], cols[-1]))
    return out, labels


def build_hour_datetime_map(rec_dt, hour_cols):
    return {col: rec_dt + timedelta(hours=idx) for idx, col in enumerate(hour_cols)}


def collect_hours_for_three_days(date_to_hours, start_day):
    ordered = []
    for shift in range(3):
        target_day = start_day + timedelta(days=shift)
        cols = date_to_hours.get(target_day, [])
        if len(cols) != 24:
            raise ValueError(f"{target_day} 非完整 24 小時（實際 {len(cols)} 小時），無法計算累積。")
        ordered.extend(cols)
    return ordered


def compute_windows_accumulation(df, ordered_hours, hour_to_dt, window_size, mode):
    if len(ordered_hours) != 72:
        raise ValueError(f"預期三天共 72 小時，實際取得 {len(ordered_hours)} 小時。")

    out = df[["Lon", "Lat", "Land"]].copy()
    labels = []
    n_windows = len(ordered_hours) // window_size
    for i in range(n_windows):
        cols = ordered_hours[i * window_size:(i + 1) * window_size]
        h0, h1 = cols[0], cols[-1]
        start_dt = hour_to_dt[h0]
        end_dt = hour_to_dt[h1]

        if mode == "12hr":
            value_col = f"P{i + 1}_{start_dt.strftime('%Y%m%d%H')}_{end_dt.strftime('%Y%m%d%H')}"
            display_end_dt = end_dt
            panel_title = f"{start_dt:%m/%d}\n{start_dt:%H}~{display_end_dt:%H}"
        else:
            value_col = f"D{i + 1}_{start_dt.strftime('%Y%m%d')}"
            panel_title = f"{start_dt:%Y-%m-%d}"

        out[value_col] = df[cols].sum(axis=1, min_count=1)
        labels.append((panel_title, value_col, h0, h1))

    return out, labels


def ask_start_date_if_needed(start_date_arg):
    if start_date_arg is not None:
        return start_date_arg
    user_input = input("請輸入起算日期（YYYY-MM-DD，直接 Enter 使用預設可行日期）: ").strip()
    return user_input or None


def build_output_png_name(rec_dt_utc, panel_labels, mode):
    ts = rec_dt_utc.strftime("%Y%m%d_%H%M")
    if not panel_labels:
        raise ValueError("panel_labels 為空，無法建立輸出檔名。")
    hour_range = f"{panel_labels[0][2]}-{panel_labels[-1][3]}"
    return f"taoyuan_3days_{mode}_{ts}UTC_{hour_range}.png"


def main():
    args = parse_args()

    rain_df = pd.read_csv(args.csv)
    hour_cols = collect_hour_columns(rain_df)

    rec_dt_utc = load_reference_datetime(args.json)
    end_dt_utc = rec_dt_utc + timedelta(hours=len(hour_cols) - 1)
    rec_dt_lst = rec_dt_utc + LST_OFFSET
    end_dt_lst = end_dt_utc + LST_OFFSET

    date_to_hours = build_date_hour_map(rec_dt_lst, hour_cols)
    valid_start_dates = find_valid_start_dates(date_to_hours, n_days=3, hours_per_day=24)

    requested_start = ask_start_date_if_needed(args.start_date)
    start_day = parse_start_date(requested_start, valid_start_dates, rec_dt_lst, end_dt_lst)

    print(
        " | ".join([
            f"Mode={args.mode}",
            f"InitUTC={rec_dt_utc:%Y-%m-%d %H:%M}",
            f"InitLST={rec_dt_lst:%Y-%m-%d %H:%M}",
            f"StartDateLST={start_day}",
        ])
    )

    hour_to_dt = build_hour_datetime_map(rec_dt_lst, hour_cols)
    ordered_hours = collect_hours_for_three_days(date_to_hours, start_day)

    if args.mode == "12hr":
        daily_df, panel_labels = compute_windows_accumulation(
            rain_df,
            ordered_hours,
            hour_to_dt,
            window_size=12,
            mode="12hr",
        )
    else:
        daily_df, panel_labels = compute_windows_accumulation(
            rain_df,
            ordered_hours,
            hour_to_dt,
            window_size=24,
            mode="daily",
        )

    print(f"Panels={len(panel_labels)} | HourRange={panel_labels[0][2]}-{panel_labels[-1][3]}")

    tw_bdy = read_shp(args.county_shp, encoding="utf-8")
    tw_twn = read_shp(args.town_shp, encoding="utf-8")

    if args.mode == "12hr":
        fig, axes = plt.subplots(1, 6, figsize=(20, 3.8), constrained_layout=True, sharey=True)
    else:
        fig, axes = plt.subplots(1, 3, figsize=(11, 3.8), constrained_layout=True, sharey=True)
    cmap, norm, bounds = get_discrete_cmap_norm()
    axes_arr = np.atleast_1d(axes).ravel()

    lon_min, lon_max = 120.95, 121.50
    lat_min, lat_max = 24.55, 25.15
    grid_pad = 0.01

    mesh = None
    for ax, (panel_title, value_col, _, _) in zip(axes_arr, panel_labels):
        tw_bdy.plot(ax=ax, color="none", edgecolor="black", zorder=3)
        tw_bdy.loc[tw_bdy.COUNTYNAME == "桃園市"].boundary.plot(ax=ax, color="black", linewidth=3, zorder=4)
        tw_twn.loc[tw_twn.COUNTYNAME == "桃園市"].boundary.plot(ax=ax, color="black", linewidth=0.5, linestyle=(0, (1, 5)), zorder=4)

        roi = daily_df[
            (daily_df["Lon"] >= lon_min - grid_pad) & (daily_df["Lon"] <= lon_max + grid_pad) &
            (daily_df["Lat"] >= lat_min - grid_pad) & (daily_df["Lat"] <= lat_max + grid_pad)
        ].copy()

        if roi.empty:
            raise ValueError("桃園範圍內沒有網格點，請檢查經緯度或範圍設定。")

        x_arr, y_arr, c_arr = build_grid(roi, value_col)
        mesh = ax.contourf(
            x_arr,
            y_arr,
            c_arr,
            levels=bounds,
            cmap=cmap,
            norm=norm,
            extend="both",
            zorder=2,
        )

        ax.set_aspect("equal")
        ax.set_xlim(lon_min, lon_max)
        ax.set_ylim(lat_min, lat_max)
        ax.set_xticks(np.arange(lon_min+0.05, lon_max, 0.2))
        ax.set_yticks(np.arange(lat_min+0.05, lat_max, 0.2))
        ax.set_xticklabels([f"{x:.1f}°E" for x in ax.get_xticks()], ha="left")
        ax.set_yticklabels([f"{y:.1f}°N" for y in ax.get_yticks()], rotation=90, va="center")
        if args.mode == "12hr":
            ax.text(
                0.02,
                0.02,
                panel_title,
                transform=ax.transAxes,
                ha="left",
                va="bottom",
                fontsize=10,
                fontweight="bold",
                color="black",
                zorder=6,
            )
        else:
            ax.text(
                0.02,
                0.98,
                panel_title,
                transform=ax.transAxes,
                ha="left",
                va="top",
                fontsize=14,
                fontweight="bold",
                color="black",
                zorder=6,
            )

    if mesh is None:
        raise RuntimeError("繪圖失敗，未建立色階圖層。")

    if args.mode == "12hr":
        cbar = fig.colorbar(
            mesh,
            ax=axes_arr.tolist(),
            ticks=QPF_THRESHOLDS,
            fraction=0.02,
            pad=0.01,
            extend="both",
        )
    else:
        cbar = fig.colorbar(
            mesh,
            ax=axes_arr.tolist(),
            ticks=QPF_THRESHOLDS,
            fraction=0.035,
            pad=0.02,
            extend="both",
        )
    cbar.set_label("Accumulated Rainfall (mm)")

    if args.mode == "12hr":
        fig.suptitle(f"NCDR G01 3-Day 12hr Accumulation | Init Time={rec_dt_lst:%Y-%m-%d %H:%M} LST")
    else:
        fig.suptitle(f"NCDR G01 3-Day Daily Rainfall | Init Time={rec_dt_lst:%Y-%m-%d %H:%M} LST")

    output_name = build_output_png_name(rec_dt_utc, panel_labels, args.mode)
    output_path = Path.cwd() / output_name
    fig.savefig(output_path, dpi=200, bbox_inches="tight")
    print(f"已輸出 PNG: {output_path}")
    plt.close(fig)


if __name__ == "__main__":
    main()
