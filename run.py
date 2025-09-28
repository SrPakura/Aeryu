# run.py
import os
import threading
import asyncio
import random
from datetime import datetime, timedelta
import click
from flask.cli import with_appcontext

from app import create_app
from app.core.db import get_db, get_all_settings   # 👈 añadimos get_all_settings para leer ajustes
from app.core.bridge import command_queue
from app.core.discord_bot import run_bot


# 🚀 Crear y configurar la aplicación Flask
app = create_app()


# --- Comando CLI para sembrar datos falsos ---
@click.command('seed-db')
@with_appcontext
def seed_db_command():
    """Siembra la base de datos con datos de escucha falsos para los últimos 6 meses."""
    db = get_db()

    song_ids_result = db.execute("SELECT id FROM song").fetchall()
    if not song_ids_result:
        click.echo('No hay canciones en la base de datos. Importa algunas antes de sembrar datos.')
        return

    song_ids = [row['id'] for row in song_ids_result]

    # Limpiamos registros anteriores
    db.execute("DELETE FROM play_checkpoint")

    total_added = 0
    for i in range(180):  # 180 días ≈ 6 meses
        day = datetime.now() - timedelta(days=i)
        plays_today = random.randint(20, 100)  # número de reproducciones por día

        for _ in range(plays_today):
            song_id = random.choice(song_ids)
            ms_played = random.randint(30000, 180000)  # entre 30s y 3min

            db.execute(
                "INSERT INTO play_checkpoint (song_id, ms_played, created_at) VALUES (?, ?, ?)",
                (song_id, ms_played, day)
            )
            total_added += 1

    db.commit()
    click.echo(f"¡Listo! Se han añadido {total_added} registros de escucha falsos.")


# Registramos el comando en Flask
app.cli.add_command(seed_db_command)


# --- Punto de entrada ---
if __name__ == '__main__':
    # 👇 CAMBIO IMPORTANTE: en vez de leer del .env, usamos los ajustes en la DB
    with app.app_context():
        settings = get_all_settings()
        DISCORD_TOKEN = settings.get('discord_token')
        DISCORD_SERVER_ID = settings.get('discord_server_id')
        MEDIA_FOLDER = app.config['MEDIA_FOLDER']

    # Si no hay credenciales en los ajustes, no arrancamos el bot
    if not DISCORD_TOKEN or not DISCORD_SERVER_ID:
        print("⚠️  No se encontró DISCORD_TOKEN o DISCORD_SERVER_ID en los ajustes. El bot no se iniciará.")
    else:
        # Lanzamos el bot de Discord en un hilo separado
        bot_thread = threading.Thread(
            target=lambda: asyncio.run(
                run_bot(DISCORD_TOKEN, command_queue, MEDIA_FOLDER, DISCORD_SERVER_ID)
            )
        )
        bot_thread.daemon = True
        bot_thread.start()
        print("Iniciando el bot de Discord en un hilo separado...")

    # Finalmente, arrancamos Flask
    print("Iniciando el servidor web de Flask...")
    app.run(debug=True, use_reloader=False)
