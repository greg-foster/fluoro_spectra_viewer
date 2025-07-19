from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os, json

app = Flask(__name__)
CORS(app)

DYE_DATA_DIR = os.path.join(os.path.dirname(__file__), 'dye_spectra_data')
FILTER_DIR = os.path.join(os.path.dirname(__file__), 'chroma_filter_spectra')
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), 'user_settings.json')
INSTRUMENT_CONFIGS_FILE = os.path.join(os.path.dirname(__file__), 'instrument_configs.json')

def humanize_dye_name(filename):
    # Remove .json, replace underscores with spaces, capitalize words
    base = filename[:-5] if filename.endswith('.json') else filename
    # Try to split at first underscore for "name_id" pattern
    if '_' in base:
        name_part = base.split('_')[0]
    else:
        name_part = base
    # Replace underscores with spaces, capitalize
    return name_part.replace('_', ' ').title()

@app.route('/api/dyes')
def get_dye_list():
    try:
        print('DEBUG: DYE_DATA_DIR =', DYE_DATA_DIR)
        dye_files = [f for f in os.listdir(DYE_DATA_DIR) if f.endswith('.json')]
        print('DEBUG: Found dye files:', dye_files)
        dye_list = []
        for f in dye_files:
            dye_id = f[:-5]  # strip .json
            try:
                with open(os.path.join(DYE_DATA_DIR, f), encoding='utf-8') as jf:
                    data = json.load(jf)
                dye_name = None
                if isinstance(data, dict) and 'data' in data and isinstance(data['data'], dict):
                    dye_keys = list(data['data'].keys())
                    if dye_keys:
                        info = data['data'][dye_keys[0]].get('info', {})
                        dye_name = info.get('name')
                name = dye_name or data.get('name') or humanize_dye_name(f)
            except Exception as ex:
                print(f'ERROR loading dye file {f}:', ex)
                name = humanize_dye_name(f)
            dye_list.append({"id": dye_id, "name": name})
        print('DEBUG: dye_list =', dye_list)
        return jsonify(dye_list)
    except Exception as e:
        print('FATAL ERROR in /api/dyes:', e)
        return jsonify([]), 500

@app.route('/api/instrument_configs', methods=['GET'])
def get_instrument_configs():
    try:
        if not os.path.exists(INSTRUMENT_CONFIGS_FILE):
            return jsonify([])
        with open(INSTRUMENT_CONFIGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print('ERROR reading instrument configs:', e)
        return jsonify([]), 500

@app.route('/api/instrument_configs', methods=['POST'])
def save_instrument_config():
    try:
        config = request.json
        if not config or 'name' not in config or 'filters' not in config:
            return jsonify({'error': 'Invalid config'}), 400
        configs = []
        if os.path.exists(INSTRUMENT_CONFIGS_FILE):
            with open(INSTRUMENT_CONFIGS_FILE, 'r', encoding='utf-8') as f:
                configs = json.load(f)
        configs.append(config)
        with open(INSTRUMENT_CONFIGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(configs, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        print('ERROR saving instrument config:', e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/dyes/<dye_id>')
def get_dye(dye_id):
    try:
        # Try direct match
        path = os.path.join(DYE_DATA_DIR, f'{dye_id}.json')
        if not os.path.exists(path):
            # Try case-insensitive match
            for f in os.listdir(DYE_DATA_DIR):
                if f.lower() == f'{dye_id}.json'.lower():
                    path = os.path.join(DYE_DATA_DIR, f)
                    break
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        # Always ensure brightness_coefficient is at the top level
        brightness = None
        if isinstance(data, dict):
            # 1. Try top-level
            if 'brightness_coefficient' in data:
                brightness = data['brightness_coefficient']
            # 2. Try nested under 'data' (legacy format)
            if brightness is None and 'data' in data and isinstance(data['data'], dict):
                for k in data['data']:
                    info = data['data'][k].get('info', {})
                    if 'brightness_coefficient' in info:
                        brightness = info['brightness_coefficient']
                        break
            # 3. If found, inject at top level
            if brightness is not None:
                data['brightness_coefficient'] = brightness
        return jsonify(data)
    except Exception as ex:
        print(f"ERROR in /api/dyes/<dye_id>: {ex}")
        return jsonify({}), 404

@app.route('/api/filters')
def list_filters():
    try:
        spectra_dir = os.path.join(os.path.dirname(__file__), 'chroma_filter_spectra')
        filter_files = [f for f in os.listdir(spectra_dir) if f.endswith('.json')]
        filter_list = []
        for f in filter_files:
            filter_id = f[:-5]  # strip .json
            # Try to get a human-friendly name from the file ("name" field), else from filename
            try:
                with open(os.path.join(spectra_dir, f), encoding='utf-8') as jf:
                    data = json.load(jf)
                name = data.get('name') or filter_id.replace('_', ' ').title()
            except Exception:
                name = filter_id.replace('_', ' ').title()
            filter_list.append({"id": filter_id, "name": name})
        return jsonify(filter_list)
    except Exception as e:
        print('Error loading filter list:', e)
        return jsonify([]), 500

@app.route('/api/settings', methods=['GET', 'POST'])
def user_settings():
    if request.method == 'POST':
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as fp:
            json.dump(request.json, fp, indent=2)
        return jsonify({'status': 'saved'})
    else:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as fp:
                return jsonify(json.load(fp))
        else:
            return jsonify({})

@app.route('/api/filters/<filter_id>')
def get_filter(filter_id):
    try:
        spectra_dir = os.path.join(os.path.dirname(__file__), 'chroma_filter_spectra')
        spectra_filename = f"{filter_id}.json"
        spectra_path = os.path.join(spectra_dir, spectra_filename)
        if not os.path.exists(spectra_path):
            return jsonify({'error': f'Spectra file {spectra_filename} not found'}), 404
        with open(spectra_path, encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print('Error loading filter spectra:', e)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/dyes/<dye_id>/brightness', methods=['POST'])
def set_brightness_coefficient(dye_id):
    try:
        payload = request.json
        if not payload or 'brightness_coefficient' not in payload:
            return jsonify({'error': 'Missing brightness_coefficient'}), 400
        brightness = payload['brightness_coefficient']
        path = os.path.join(DYE_DATA_DIR, f'{dye_id}.json')
        if not os.path.exists(path):
            # Try case-insensitive match
            for f in os.listdir(DYE_DATA_DIR):
                if f.lower() == f'{dye_id}.json'.lower():
                    path = os.path.join(DYE_DATA_DIR, f)
                    break
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        # Set at top level
        data['brightness_coefficient'] = brightness
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True, 'brightness_coefficient': brightness})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

CAMERA_DIR = os.path.join(os.path.dirname(__file__), 'cameras')

@app.route('/api/cameras')
def list_cameras():
    try:
        camera_files = [f for f in os.listdir(CAMERA_DIR) if f.endswith('.json')]
        camera_list = []
        for f in camera_files:
            cam_id = f[:-5]
            camera_list.append({'id': cam_id, 'name': cam_id})
        return jsonify(camera_list)
    except Exception as e:
        print('Error loading camera list:', e)
        return jsonify([]), 500

@app.route('/api/cameras/<camera_id>')
def get_camera_qe(camera_id):
    try:
        path = os.path.join(CAMERA_DIR, f'{camera_id}.json')
        if not os.path.exists(path):
            # Try case-insensitive match
            for f in os.listdir(CAMERA_DIR):
                if f.lower() == f'{camera_id}.json'.lower():
                    path = os.path.join(CAMERA_DIR, f)
                    break
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as ex:
        print(f"ERROR in /api/cameras/<camera_id>: {ex}")
        return jsonify([]), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
