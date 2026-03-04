import os
import requests
import json
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response

load_dotenv()

app = Flask(__name__)
API_TOKEN_RAIN = os.getenv('NCDR_API_TOKEN_RAIN')
API_TOKEN_WIND = os.getenv('NCDR_API_TOKEN_WIND')
RAIN_TARGET_URL = 'https://dataapi2.ncdr.nat.gov.tw/NCDR/EnsembleG01'
WIND_TARGET_URL = 'https://dataapi2.ncdr.nat.gov.tw/NCDR/Ensemble05km'

@app.route('/ncdr/EnG01', methods=['GET'])
def get_ensemble_g01():
    user_format = request.args.get('format', 'csv').lower()
    
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

@app.route('/ncdr/En05km', methods=['GET'])
def get_ensemble05km():
    headers = {
        'Authorization': f'Basic {API_TOKEN_WIND}'
    }
    allowed_formats = ['csv', 'json']
    allowed_variables = ['uv10', 'raintot']
    allowed_numbers = [f'N{i:02d}' for i in range(20)]  # N00 to N19

    user_format = request.args.get('format', 'csv').lower()
    user_variable = request.args.get('variable', 'none').lower()
    user_number = request.args.get('number', 'N00').upper()

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
        return download_response
    except Exception as e:
        return jsonify({'error': 'Failed to create download response', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)