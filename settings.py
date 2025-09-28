# app/api/settings.py
from flask import Blueprint, request, jsonify
from app.core.db import get_db, get_all_settings
from dotenv import find_dotenv, set_key
import os

# Creamos el Blueprint para la API de ajustes
bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@bp.route('/', methods=['GET'])
def get_settings():
    """
    GET /api/settings
    Lee la configuración desde la base de datos usando get_all_settings(),
    que ya convierte correctamente strings a booleanos reales.
    """
    settings = get_all_settings()   # 👈 Aquí usamos el traductor "maestro"
    return jsonify(settings)

@bp.route('/', methods=['PUT'])
def update_settings():
    """
    PUT /api/settings
    Recibe los nuevos ajustes y los guarda en la base de datos y en el .env.
    """
    new_settings = request.get_json()
    if not new_settings:
        return jsonify({'error': 'No settings provided'}), 400

    db = get_db()
    dotenv_path = find_dotenv()
    if not dotenv_path:
        project_root = os.path.join(os.path.dirname(bp.root_path), '..')
        dotenv_path = os.path.join(project_root, '.env')
        with open(dotenv_path, 'a'):
            os.utime(dotenv_path, None)

    try:
        for key, value in new_settings.items():
            value_as_string = str(value)
            
            db.execute(
                "INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)",
                (key, value_as_string)
            )
            
            set_key(dotenv_path, key.upper(), value_as_string)

        db.commit()
        return jsonify({'message': 'Settings updated successfully'}), 200

    except Exception as e:
        db.rollback()
        
        # --- ESTA ES LA PARTE NUEVA PARA DEPURAR ---
        # Importamos la herramienta para obtener el informe completo del error
        import traceback
        error_completo = traceback.format_exc()
        
        # Lo imprimimos en nuestra terminal para que quede registrado
        print("----------- ERROR DETALLADO AL GUARDAR AJUSTES -----------")
        print(error_completo)
        print("---------------------------------------------------------")

        # Y lo más importante: devolvemos el informe completo al navegador
        return jsonify({
            'error': 'Ha ocurrido un error interno en el servidor.',
            'traceback': error_completo
        }), 500