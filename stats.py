# app/api/stats.py
from flask import Blueprint, jsonify, request
from app.core.db import get_db
from datetime import datetime, timedelta

bp = Blueprint('stats', __name__, url_prefix='/api/stats')

@bp.route('/top-songs', methods=['GET'])
def get_top_songs():
    """
    GET /api/stats/top-songs
    Devuelve las 6 canciones con más tiempo de escucha acumulado.
    """
    db = get_db()
    top_songs = db.execute(
        """
        SELECT s.id, s.title, s.artist, c.path as cover_path, SUM(pc.ms_played) as total_ms_played
        FROM play_checkpoint pc
        JOIN song s ON pc.song_id = s.id
        LEFT JOIN cover c ON s.cover_id = c.id
        GROUP BY s.id
        ORDER BY total_ms_played DESC
        LIMIT 6
        """
    ).fetchall()
    
    # ✅ ESTA ES LA LÍNEA QUE ESTABA MAL INDENTADA
    # Ahora está correctamente dentro de la función get_top_songs.
    return jsonify({'top_songs': [dict(song) for song in top_songs]})


@bp.route('/listening-time', methods=['GET'])
def get_listening_time():
    """
    GET /api/stats/listening-time?period=7d
    Calcula el tiempo de escucha agrupado por días, semanas o meses.
    Soporta: 7d, 1m, 6m, 12m
    """
    period = request.args.get('period', '7d')
    db = get_db()
    
    query_configs = {
        '7d': {
            'query': "SELECT strftime('%w', created_at) as day, SUM(ms_played) as total_ms FROM play_checkpoint WHERE created_at >= date('now', '-6 days') GROUP BY day ORDER BY day",
            'labels': ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
            'label_map': {'0': 'D', '1': 'L', '2': 'M', '3': 'X', '4': 'J', '5': 'V', '6': 'S'}
        },
        '1m': {
             # Agrupa por semana del año
            'query': "SELECT strftime('%Y-%W', created_at) as week, SUM(ms_played) as total_ms FROM play_checkpoint WHERE created_at >= date('now', '-28 days') GROUP BY week ORDER BY week",
        },
        '6m': {
            'query': "SELECT strftime('%Y-%m', created_at) as month, SUM(ms_played) as total_ms FROM play_checkpoint WHERE created_at >= date('now', '-5 months') GROUP BY month ORDER BY month",
        },
        '12m': {
            'query': "SELECT strftime('%Y-%m', created_at) as month, SUM(ms_played) as total_ms FROM play_checkpoint WHERE created_at >= date('now', '-11 months') GROUP BY month ORDER BY month",
        }
    }

    config = query_configs.get(period)
    if not config:
        return jsonify({'error': 'Invalid period'}), 400

    results = db.execute(config['query']).fetchall()
    
    # Formatear la respuesta para que Chart.js la entienda
    data_map = {row[0]: row[1] for row in results}
    
    final_data = {
        'labels': [],
        'values': []
    }

    if period == '7d':
        # Ordenar días de la semana correctamente (L, M, X...)
        day_order = ['1', '2', '3', '4', '5', '6', '0']
        for day_key in day_order:
            final_data['labels'].append(config['label_map'][day_key])
            final_data['values'].append(data_map.get(day_key, 0))
    else:
         # Para meses y semanas, simplemente usamos los resultados
        for key, value in data_map.items():
            final_data['labels'].append(key)
            final_data['values'].append(value)

    return jsonify(final_data)