# app/api/player.py
from flask import Blueprint, jsonify, request
from app.core.db import get_db

bp = Blueprint('player', __name__, url_prefix='/api/player')

# --- "Memoria" simple del reproductor ---
# Esto actuará como nuestro cerebro temporal. Guardará el estado
# mientras la aplicación esté en marcha. Más adelante lo haremos más robusto.
player_state = {
    'current_song': None,
    'is_playing': False,
    'progress_ms': 0,
    'volume': 1.0,
    'mode': 'normal', # 'normal', 'loop', 'shuffle'
    'queue': []
}

@bp.route('/state', methods=['GET'])
def get_state():
    """
    GET /api/player/state
    Devuelve el estado actual completo del reproductor.
    El frontend llamará a esto para saber qué mostrar.
    """
    return jsonify(player_state)

@bp.route('/play', methods=['POST'])
def play_song():
    """
    POST /api/player/play
    Inicia la reproducción de una canción o reanuda la actual.
    """
    data = request.get_json()
    song_id = data.get('song_id')

    if song_id:
        db = get_db()
        song = db.execute(
            "SELECT s.*, c.path as cover_path FROM song s LEFT JOIN cover c ON s.cover_id = c.id WHERE s.id = ?",
            (song_id,)
        ).fetchone()

        if not song:
            return jsonify({'error': 'Song not found'}), 404
        
        player_state['current_song'] = dict(song)
        player_state['is_playing'] = True
        player_state['progress_ms'] = 0
        # Aquí más adelante se cargará la cola de reproducción (playlist, álbum, etc.)
        # Por ahora, la cola solo tiene la canción actual.
        player_state['queue'] = [song_id]

    elif player_state['current_song']:
        # Si no se envía un song_id, simplemente reanuda la reproducción.
        player_state['is_playing'] = True
    else:
        return jsonify({'error': 'No song specified and no current song to resume'}), 400

    return jsonify(player_state)

@bp.route('/pause', methods=['POST'])
def pause_song():
    """
    POST /api/player/pause
    Pausa la reproducción.
    """
    player_state['is_playing'] = False
    return jsonify(player_state)

@bp.route('/seek', methods=['POST'])
def seek_song():
    """
    POST /api/player/seek
    Actualiza el progreso de la canción (al hacer clic en la barra).
    """
    data = request.get_json()
    progress = data.get('progress_ms')
    if progress is not None:
        player_state['progress_ms'] = int(progress)
    return jsonify(player_state)
