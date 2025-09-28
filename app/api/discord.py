# app/api/discord.py

import threading
import asyncio
from flask import Blueprint, jsonify, request, current_app

# 👇 Importamos lo necesario
from app.core.db import get_all_settings   # Ahora leemos token y server_id desde la DB
from app.core.bridge import command_queue
from app.core.discord_bot import run_bot

# Creamos el Blueprint de la API de Discord
bp = Blueprint('discord', __name__, url_prefix='/api/discord')

# Guardamos el hilo del bot para saber si ya está en marcha
bot_thread = None


@bp.route('/connect', methods=['POST'])
def connect_bot():
    """
    Arranca el bot si no está corriendo y le envía la orden de conectarse
    al canal de voz. También pasa el estado del reproductor si lo hay.
    """
    global bot_thread

    # 👇 CAMBIO 1: Leemos token e ID del servidor desde la DB en vez de .env
    settings = get_all_settings()
    DISCORD_TOKEN = settings.get("discord_token")
    DISCORD_SERVER_ID = settings.get("discord_server_id")

    if not DISCORD_TOKEN or not DISCORD_SERVER_ID:
        return jsonify({
            'status': 'error',
            'message': '⚠️ El Token o el ID del Servidor no están configurados en Ajustes.'
        }), 500

    # Si el bot aún no está corriendo, lo arrancamos en un hilo
    if bot_thread is None or not bot_thread.is_alive():
        print("Bot no está activo. Iniciando hilo del bot desde la API...")

        media_folder = current_app.config['MEDIA_FOLDER']

        # 👇 CAMBIO 2: Pasamos también el SERVER_ID a run_bot
        bot_thread = threading.Thread(
            target=lambda: asyncio.run(
                run_bot(DISCORD_TOKEN, command_queue, media_folder, DISCORD_SERVER_ID)
            )
        )
        bot_thread.daemon = True
        bot_thread.start()

        # Esperamos un poco para que el bot termine de conectar
        threading.Event().wait(2)

    # 👇 Recibimos el estado actual del player desde el frontend (player.js)
    player_state = request.get_json().get('state')

    print("Enviando orden 'connect' al bot...")
    command_queue.put({'action': 'connect', 'state': player_state})

    return jsonify({'status': 'connection_initiated'})


@bp.route('/disconnect', methods=['POST'])
def disconnect_bot():
    """Envía la orden de desconexión al bot."""
    print("Enviando orden 'disconnect' al bot...")
    command_queue.put({'action': 'disconnect'})
    return jsonify({'status': 'disconnection_initiated'})


@bp.route('/play', methods=['POST'])
def play_song():
    """Recibe una canción desde la web y le ordena al bot reproducirla."""
    song_data = request.get_json().get('song')
    if not song_data:
        return jsonify({'status': 'error', 'message': 'No song data provided'}), 400

    command_queue.put({'action': 'play', 'song': song_data})
    print(f"API: Orden 'play' para '{song_data.get('title')}' puesta en la cola.")

    return jsonify({'status': 'play_command_sent'})


@bp.route('/pause', methods=['POST'])
def pause_playback():
    """Envía la orden de pausar al bot."""
    command_queue.put({'action': 'pause'})
    return jsonify({'status': 'pause_command_sent'})


@bp.route('/resume', methods=['POST'])
def resume_playback():
    """Envía la orden de reanudar al bot."""
    command_queue.put({'action': 'resume'})
    return jsonify({'status': 'resume_command_sent'})


@bp.route('/volume', methods=['POST'])
def set_volume():
    """Envía la orden de cambiar el volumen al bot."""
    volume = request.get_json().get('volume')
    if volume is not None:
        command_queue.put({'action': 'volume', 'value': float(volume)})
        return jsonify({'status': 'volume_command_sent'})
    return jsonify({'status': 'error', 'message': 'No volume provided'}), 400
