# app/api/plays.py
from flask import Blueprint, request, jsonify
from app.core.db import get_db

bp = Blueprint('plays', __name__, url_prefix='/api/plays')

# @bp.route('/', methods=['POST'])
# def register_play():
#     """
#     POST /api/plays
#     Registra una nueva reproducción para una canción.
#     Recibe: { "song_id": <id> }
#     """
#     data = request.get_json()
#     song_id = data.get('song_id')

#     if not song_id:
#         return jsonify({'error': 'Song ID is required'}), 400

#     db = get_db()
#     try:
#         db.execute("INSERT INTO play (song_id) VALUES (?)", (song_id,))
#         db.commit()
#     except db.IntegrityError:
#         # Esto podría pasar si el song_id no existe, aunque es poco probable.
#         return jsonify({'error': 'Invalid song_id'}), 400
    
#     return jsonify({'message': 'Play registered successfully'}), 201

# --- ✅ NUEVA RUTA PARA LOS CHECKPOINTS ---
@bp.route('/checkpoint', methods=['POST'])
def register_checkpoint():
    """
    POST /api/plays/checkpoint
    Registra un fragmento de tiempo escuchado para una canción.
    Recibe: { "song_id": <id>, "ms_played": <milisegundos> }
    """
    data = request.get_json()
    song_id = data.get('song_id')
    ms_played = data.get('ms_played')

    if not song_id or ms_played is None:
        return jsonify({'error': 'song_id and ms_played are required'}), 400

    db = get_db()
    try:
        db.execute(
            "INSERT INTO play_checkpoint (song_id, ms_played) VALUES (?, ?)",
            (song_id, int(ms_played))
        )
        db.commit()
        return jsonify({'message': 'Checkpoint registered'}), 201
    except db.Error as e:
        return jsonify({'error': str(e)}), 500
