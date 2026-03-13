import os
import requests
import json
from flask import Flask, request, jsonify, Response, render_template
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from datetime import datetime, timedelta

def calculate_ttl(rec_date_time):
    try:
        rec_dt = datetime.strptime(rec_date_time, '%Y-%m-%dT%H:%M:%S')
        next_update = rec_dt + timedelta(hours=3)
        now = datetime.now()
        ttl = int((next_update - now).total_seconds())
        return max(300, min(ttl, 3600))  # Ensure TTL is between 5 minutes and 1 hour
    except Exception as e:
        print(f"Error calculating TTL: {e}")
        return 600  # Default to 1 hour if there's an error

app = Flask(__name__)
try:
    app.config['SECRET_KEY'] = os.getenv('NCDR_API_SECRET_KEY', 'not_set')
except Exception as e:
    print(f"Error occurred while setting SECRET_KEY: {e}")
csrf = CSRFProtect(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["24 per day", "6 per hour"],
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

@app.route('/', methods=['GET'])
@limiter.exempt
def index():
    return render_template('index.html')

@app.route('/twtown2010.3.json', methods=['GET'])
@limiter.exempt
def get_twtown2010_3_json():
    return render_template('twtown2010.3.json')

@app.route('/ncdr/get_csrf_token', methods=['GET'])
def get_csrf_token():
    return jsonify({'csrf_token': generate_csrf()})

@app.route('/ncdr/EnG01', methods=['POST'])
@limiter.limit("2 per minute")
def get_ensemble_g01():
    user_format = request.form.get('format', 'csv').lower()

    cache_key = f"EnG01_{user_format}"
    cached_response = cache.get(cache_key)
    if cached_response:
        return cached_response
    
    headers = {'Authorization': f'Basic {API_TOKEN_RAIN}'}

    try:
        response = requests.get(RAIN_TARGET_URL, headers=headers, params={'DataFormat': 'json'})
        response.raise_for_status()
        json_data = json.loads(response.text.lstrip('\ufeff'))  # Remove BOM if present
        rec_date_time = json_data.get('RecDateTime', 'unknown')
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to get REC_DATE_TIME from JSON', 'details': str(e)}), 500
    
    if user_format not in ['csv', 'json']:
        return jsonify({'error': 'Invalid format. Supported formats are csv and json.'}), 400
    elif user_format == 'csv':
        try:
            response = requests.get(RAIN_TARGET_URL, headers=headers, params={'DataFormat': 'csv'})
            response.raise_for_status()
            csv_data = response.text
            merged_data = f"RecDateTime,{rec_date_time}\n{csv_data}" # merge REC_DATE_TIME into csv
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
            return jsonify({'error': 'Failed to generate merged CSV', 'details': str(e)}), 500
    else:  # json
        try:
            return Response(response.text, 
                            mimetype='application/json',
                            headers={'Content-Disposition': f'attachment; filename=EnG01_{rec_date_time}.json'}
            )
        except Exception as e:
            return jsonify({'error': 'Failed to fetch JSON data', 'details': str(e)}), 500

@app.route('/ncdr/En05km', methods=['POST'])
@limiter.limit("2 per minute")
def get_ensemble05km():
    headers = {
        'Authorization': f'Basic {API_TOKEN_WIND}'
    }
    allowed_formats = ['csv', 'json']
    allowed_variables = ['uv10', 'raintot']
    allowed_numbers = [f'N{i:02d}' for i in range(20)]  # N00 to N19

    user_format = request.form.get('format', 'csv').lower()
    user_variable = request.form.get('variable', 'none').lower()
    user_number = request.form.get('number', 'N00').upper()

    cache_key = f"En05km_{user_format}_{user_variable}_{user_number}"
    cached_response = cache.get(cache_key)
    if cached_response:
        return cached_response

    if user_format not in allowed_formats:
        return jsonify({'error': f'Invalid format. Supported formats are {allowed_formats}.'}), 400
    if user_variable not in allowed_variables:
        return jsonify({'error': f'Invalid variable. Supported variables are {allowed_variables}.'}), 400
    if user_number not in allowed_numbers:
        return jsonify({'error': f'Invalid number. Supported numbers are {allowed_numbers}.'}), 400 

    params = {
        'DataFormat': 'json',
        'Variable': user_variable,
        'Number': user_number,
        'Layer': '010m' if user_variable == 'uv10' else '0000',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.get(WIND_TARGET_URL, headers=headers, params=params, stream=True)
        response.raise_for_status()
        json_data = json.loads(response.text.lstrip('\ufeff'))  # Remove BOM if present
        rec_date_time = json_data.get('RecDateTime', 'unknown')
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Failed to get REC_DATE_TIME from JSON', 'details': str(e)}), 500

    try:
        text = response.text
        if user_format == 'csv':
            try:
                params['DataFormat'] = 'csv'
                response = requests.get(WIND_TARGET_URL, headers=headers, params=params)
                response.raise_for_status()
                text = response.text
            except requests.exceptions.RequestException as e:
                return jsonify({'error': 'Failed to fetch CSV data', 'details': str(e)}), 500
            text = f"RecDateTime,{rec_date_time}\n{text}"  # Prepend REC_DATE_TIME to CSV data
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
        return jsonify({'error': 'Failed to create download response', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)