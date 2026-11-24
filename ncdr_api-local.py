import os
import re
import requests
import json
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

from flask import Flask, request, jsonify, Response, render_template, send_from_directory, abort
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache

# 1. 確保優先載入 .env 環境變數
load_dotenv()

# 2. 設定統一日誌
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger("ncu_watch_local")

def calculate_ttl(rec_date_time):
    """
    依據 NCDR 預報發布時間計算快取 TTL。
    NCDR 資料通常為 UTC 時間，頻率約 3 小時更新一次。
    """
    try:
        clean_str = str(rec_date_time).rstrip('Z')
        rec_dt = datetime.fromisoformat(clean_str).replace(tzinfo=timezone.utc)
        next_update = rec_dt + timedelta(hours=3)
        now = datetime.now(timezone.utc)
        ttl = int((next_update - now).total_seconds())
        # 快取介於 5 分鐘 (300s) 到 3 小時 (10800s) 之間
        return max(300, min(ttl, 10800))
    except Exception as e:
        logger.warning(f"Error calculating TTL for '{rec_date_time}': {e}, defaulting to 1800s")
        return 1800  # 計算失敗預設快取 30 分鐘

app = Flask(__name__)
try:
    app.config['SECRET_KEY'] = os.getenv('NCDR_API_SECRET_KEY', 'not_set')
except Exception as e:
    logger.error(f"Error occurred while setting SECRET_KEY: {e}")

csrf = CSRFProtect(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["120 per hour", "600 per day"],
    storage_uri="memory://"
)
cache_config = {
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": "cache",
    "CACHE_DEFAULT_TIMEOUT": 3600
}
cache = Cache(app, config=cache_config)

API_TOKEN_RAIN = os.getenv('NCDR_API_TOKEN_RAIN')
API_TOKEN_WIND = os.getenv('NCDR_API_TOKEN_WIND')
RAIN_TARGET_URL = 'https://dataapi2.ncdr.nat.gov.tw/NCDR/EnsembleG01'
WIND_TARGET_URL = 'https://dataapi2.ncdr.nat.gov.tw/NCDR/Ensemble05km'


def fetch_ncdr_json_metadata(url, token, params, token_name="NCDR_API_TOKEN"):
    """
    檢查 Token、呼叫上游 NCDR API、驗證 JSON 結構並判斷是否為錯誤訊息或空資料。
    回傳: (rec_date_time, json_data, error_response, status_code)
    """
    # 1. 檢查 Token 是否存在
    if not token or not token.strip():
        logger.error(f"[Config Error] 系統未讀取到 {token_name} 環境變數！請確認 .env 設定。")
        return None, None, jsonify({
            'error': f'伺服器環境變數未正確設定 {token_name}'
        }), 500

    headers = {'Authorization': f'Basic {token}'}

    # 2. 發送上游請求
    try:
        response = requests.get(url, headers=headers, params=params, stream=True, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"[Upstream Error] 連線 NCDR 失敗 ({url}): {e}")
        return None, None, jsonify({
            'error': '無法連線至 NCDR 上游伺服器',
            'details': str(e)
        }), 502

    # 3. 解析 JSON
    try:
        clean_text = response.text.lstrip('\ufeff')
        json_data = json.loads(clean_text)
    except json.JSONDecodeError:
        logger.error(f"[Upstream Non-JSON] NCDR 回傳非 JSON 內容: {response.text[:300]}")
        return None, None, jsonify({
            'error': '上游伺服器回傳格式異常 (非 JSON)',
            'preview': response.text[:200]
        }), 502

    # 4. 檢查 NCDR 常見錯誤欄位 (例如 Token 無效、IP 未授權)
    upstream_msg = (
        json_data.get('Message') or 
        json_data.get('message') or 
        json_data.get('Error') or 
        json_data.get('error')
    )
    if upstream_msg:
        logger.error(f"[Upstream Rejected] NCDR 拒絕存取，訊息: {upstream_msg} | 完整回應: {json_data}")
        return None, None, jsonify({
            'error': 'NCDR 上游驗證或請求失敗',
            'upstream_message': upstream_msg
        }), 502

    rec_date_time = json_data.get('RecDateTime')
    if not rec_date_time:
        logger.warning(f"[Upstream Warning] 回傳內容無 RecDateTime: {list(json_data.keys())}")
        rec_date_time = 'unknown'

    # 5. 檢查 Data 欄位是否存在
    if 'Data' not in json_data:
        logger.error(f"[Upstream Schema Error] 回傳 JSON 缺少 'Data' 欄位！Keys: {list(json_data.keys())} | 內容: {json_data}")
        return None, None, jsonify({
            'error': 'NCDR 回傳資料結構異常 (缺少 Data 欄位)',
            'raw_keys': list(json_data.keys()),
            'raw_response': json_data
        }), 502

    # 6. 檢查 Data 陣列是否為空
    data = json_data.get('Data')
    if data is None or (isinstance(data, list) and len(data) == 0):
        logger.warning(f"[Upstream Empty Data] NCDR 回應正常，但 Data 陣列為空 (RecDateTime: {rec_date_time})")
        return None, None, jsonify({
            'error': '目前該預報時段尚無資料 (Data is empty)',
            'rec_date_time': rec_date_time
        }), 404

    return rec_date_time, json_data, None, 200


@app.route('/', methods=['GET'])
@limiter.exempt
def index():
    return render_template('index.html')


@app.route('/twtown2010.3.json', methods=['GET'])
@limiter.exempt
def get_twtown2010_3_json():
    # 使用 send_from_directory 避免由 Jinja2 模板引擎解析巨量 GeoJSON
    return send_from_directory(app.root_path, 'twtown2010.3.json', mimetype='application/json')


@app.route('/taoyuan_rainfall_24H_moving_<date_part>_<time_part>.json', methods=['GET'])
@limiter.exempt
def get_taoyuan_rainfall_moving_json(date_part, time_part):
    if not re.fullmatch(r'\d{8}', date_part) or not re.fullmatch(r'\d{4}', time_part):
        abort(404)

    filename = f'taoyuan_rainfall_24H_moving_{date_part}_{time_part}.json'
    file_path = os.path.join(app.root_path, filename)
    if not os.path.isfile(file_path):
        abort(404)

    return send_from_directory(app.root_path, filename, mimetype='application/json')


@app.route('/ncdr/obs_rain/latest', methods=['GET'])
@limiter.exempt
def get_latest_obs_rain_filename():
    pattern = re.compile(r'^taoyuan_rainfall_24H_moving_(\d{8})_(\d{4})\.json$')
    candidates = []

    for name in os.listdir(app.root_path):
        m = pattern.fullmatch(name)
        if not m:
            continue
        candidates.append((f"{m.group(1)}{m.group(2)}", name))

    if not candidates:
        return jsonify({'error': 'No observation rainfall JSON file found'}), 404

    candidates.sort(key=lambda x: x[0], reverse=True)
    latest = candidates[0][1]
    suffix = latest.removeprefix('taoyuan_rainfall_24H_moving_').removesuffix('.json')
    date_part, time_part = suffix.split('_', 1)
    return jsonify({
        'filename': latest,
        'url': f'/ncdr/obs_rain/file/{date_part}/{time_part}'
    })


@app.route('/ncdr/obs_rain/file/<date_part>/<time_part>', methods=['GET'])
@limiter.exempt
def get_obs_rain_file(date_part, time_part):
    if not re.fullmatch(r'\d{8}', date_part) or not re.fullmatch(r'\d{4}', time_part):
        abort(404)

    filename = f'taoyuan_rainfall_24H_moving_{date_part}_{time_part}.json'
    file_path = os.path.join(app.root_path, filename)
    if not os.path.isfile(file_path):
        abort(404)

    return send_from_directory(app.root_path, filename, mimetype='application/json')


@app.route('/ncdr/get_csrf_token', methods=['GET'])
@limiter.exempt
def get_csrf_token():
    return jsonify({'csrf_token': generate_csrf()})


@app.route('/ncdr/EnG01', methods=['POST'])
@limiter.limit("60 per minute")
def get_ensemble_g01():
    user_format = request.form.get('format', 'csv').lower()
    if user_format not in ['csv', 'json']:
        return jsonify({'error': 'Invalid format. Supported formats are csv and json.'}), 400

    cache_key = f"EnG01_{user_format}"
    cached_response = cache.get(cache_key)
    if cached_response:
        return cached_response

    # 取得並驗證上游 JSON
    rec_date_time, json_data, err_resp, status_code = fetch_ncdr_json_metadata(
        RAIN_TARGET_URL,
        API_TOKEN_RAIN,
        {'DataFormat': 'json'},
        token_name="NCDR_API_TOKEN_RAIN"
    )
    if err_resp:
        return err_resp, status_code

    headers = {'Authorization': f'Basic {API_TOKEN_RAIN}'}

    if user_format == 'csv':
        try:
            response = requests.get(RAIN_TARGET_URL, headers=headers, params={'DataFormat': 'csv'}, timeout=30)
            response.raise_for_status()
            csv_data = response.text
            merged_data = f"RecDateTime,{rec_date_time}\n{csv_data}"
            download_response = Response(
                merged_data,
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename=EnG01_{rec_date_time}.csv'
                }
            )
            cache.set(cache_key, download_response, timeout=calculate_ttl(rec_date_time))
            return download_response
        except Exception as e:
            logger.error(f"Failed to generate merged CSV for EnG01: {e}")
            return jsonify({'error': 'Failed to generate merged CSV', 'details': str(e)}), 500
    else:  # json
        try:
            json_text = json.dumps(json_data)
            download_response = Response(
                json_text, 
                mimetype='application/json',
                headers={'Content-Disposition': f'attachment; filename=EnG01_{rec_date_time}.json'}
            )
            cache.set(cache_key, download_response, timeout=calculate_ttl(rec_date_time))
            return download_response
        except Exception as e:
            logger.error(f"Failed to produce JSON response for EnG01: {e}")
            return jsonify({'error': 'Failed to produce JSON response', 'details': str(e)}), 500


@app.route('/ncdr/En05km', methods=['POST'])
@limiter.limit("120 per minute")
def get_ensemble05km():
    allowed_formats = ['csv', 'json']
    allowed_variables = ['uv10', 'raintot']
    allowed_numbers = [f'N{i:02d}' for i in range(20)]  # N00 to N19

    user_format = request.form.get('format', 'csv').lower()
    user_variable = request.form.get('variable', 'none').lower()
    user_number = request.form.get('number', 'N00').upper()

    if user_format not in allowed_formats:
        return jsonify({'error': f'Invalid format. Supported formats are {allowed_formats}.'}), 400
    if user_variable not in allowed_variables:
        return jsonify({'error': f'Invalid variable. Supported variables are {allowed_variables}.'}), 400
    if user_number not in allowed_numbers:
        return jsonify({'error': f'Invalid number. Supported numbers are {allowed_numbers}.'}), 400 

    cache_key = f"En05km_{user_format}_{user_variable}_{user_number}"
    cached_response = cache.get(cache_key)
    if cached_response:
        return cached_response

    params = {
        'DataFormat': 'json',
        'Variable': user_variable,
        'Number': user_number,
        'Layer': '010m' if user_variable == 'uv10' else '0000',
        'Content-Type': 'application/json'
    }

    # 取得並驗證上游 JSON
    rec_date_time, json_data, err_resp, status_code = fetch_ncdr_json_metadata(
        WIND_TARGET_URL,
        API_TOKEN_WIND,
        params,
        token_name="NCDR_API_TOKEN_WIND"
    )
    if err_resp:
        return err_resp, status_code

    headers = {'Authorization': f'Basic {API_TOKEN_WIND}'}

    try:
        if user_format == 'csv':
            try:
                params['DataFormat'] = 'csv'
                response = requests.get(WIND_TARGET_URL, headers=headers, params=params, timeout=30)
                response.raise_for_status()
                text = response.text
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to fetch CSV data for En05km: {e}")
                return jsonify({'error': 'Failed to fetch CSV data from NCDR', 'details': str(e)}), 502
            text = f"RecDateTime,{rec_date_time}\n{text}"
        else:
            text = json.dumps(json_data)

        filename = f"En05km-{user_variable[:4].upper()}-{user_number}_{rec_date_time}.{user_format}"
        download_response = Response(
            text,
            mimetype='application/json' if user_format == 'json' else 'text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={filename}'
            }
        )
        cache.set(cache_key, download_response, timeout=calculate_ttl(rec_date_time))
        return download_response
    except Exception as e:
        logger.error(f"Failed to create download response for En05km: {e}")
        return jsonify({'error': 'Failed to create download response', 'details': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
