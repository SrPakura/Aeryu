# app/__init__.py
from flask import Flask, render_template, send_from_directory, current_app
import os

def create_app(test_config=None):
    # Crea y configura la aplicación Flask
    app = Flask(__name__, instance_relative_config=True)
    
    # Configuración por defecto
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'app.db'),
        MEDIA_FOLDER=os.path.join(app.root_path, 'media'),
        COVERS_FOLDER=os.path.join(app.root_path, 'static', 'covers'),
    )

    if test_config is None:
        # Carga config.py si existe (cuando no estamos en test)
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Si es test, aplica el diccionario de configuración
        if isinstance(test_config, dict):
            app.config.from_mapping(test_config)

    # Asegura que la carpeta 'instance' existe
    try:
        os.makedirs(app.instance_path, exist_ok=True) 
    except OSError:
        pass

    # Asegura que las carpetas de media y covers existen
    try:
        os.makedirs(app.config['MEDIA_FOLDER'], exist_ok=True)
        os.makedirs(app.config['COVERS_FOLDER'], exist_ok=True)
    except OSError:
        pass

    # Ruta principal → renderiza el index.html
    @app.route('/')
    def index():
        return render_template('index.html')

    # 🔥 Ruta para servir los parciales del SPA
    @app.route('/partials/<path:filename>')
    def serve_partial(filename):
        return render_template(f'partials/{filename}')

    # === Registra la base de datos ===
    from .core import db
    db.init_app(app)

    # === Registra los Blueprints (APIs) ===
    from .api import songs
    app.register_blueprint(songs.bp)

    from .api import plays
    app.register_blueprint(plays.bp)

    from .api import player
    app.register_blueprint(player.bp)

    from .api import playlists
    app.register_blueprint(playlists.bp)

    from .api import stats
    app.register_blueprint(stats.bp)

    from .api import discord
    app.register_blueprint(discord.bp)

    from .api import downloads
    app.register_blueprint(downloads.bp)

    from .api import recs
    app.register_blueprint(recs.bp)

    # --- 👇 LÍNEAS NUEVAS ---
    from .api import settings
    app.register_blueprint(settings.bp)
    # --- 👆 FIN DE LAS LÍNEAS ---

    # 🔥 Ruta para servir los archivos de música
    @app.route('/media/<path:filename>')
    def serve_media(filename):
        media_folder = current_app.config['MEDIA_FOLDER']
        return send_from_directory(media_folder, filename)
    # -------------------------

    return app
