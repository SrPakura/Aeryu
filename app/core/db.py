# app/core/db.py
import sqlite3
import click
from flask import current_app, g # current_app es la app Flask, g es un objeto global para la petición

def get_db():
    # Si la conexión a la base de datos no existe en el objeto 'g' de la petición, la crea
    if 'db' not in g:
        # current_app.config['DATABASE'] contiene la ruta a nuestra base de datos SQLite
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES # Ayuda a convertir tipos como DATETIME
        )
        g.db.row_factory = sqlite3.Row # Permite acceder a las columnas por nombre (como un diccionario)

    return g.db

def close_db(e=None):
    # Cierra la conexión a la base de datos si existe
    db = g.pop('db', None)

    if db is not None:
        db.close()

def init_db():
    # Obtiene una conexión a la base de datos
    db = get_db()

    # Lee el archivo 'schema.sql' y ejecuta las instrucciones SQL para crear las tablas
    with current_app.open_resource('core/schema.sql') as f:
        db.executescript(f.read().decode('utf8'))

# Define un comando de línea de comandos para inicializar la base de datos
@click.command('init-db')
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')

def init_app(app):
    # Registra la función 'close_db' para que se ejecute después de cada petición
    app.teardown_appcontext(close_db)
    # Registra el comando 'init-db' para que pueda ser llamado desde la CLI
    app.cli.add_command(init_db_command)

def get_all_settings():
    """
    Lee todos los ajustes de la tabla 'setting' y los devuelve
    como un diccionario Python.
    """
    try:
        db = get_db()
        settings_from_db = db.execute("SELECT key, value FROM setting").fetchall()
        
        # Convierte la lista de filas de la base de datos en un diccionario simple
        settings_dict = {row['key']: row['value'] for row in settings_from_db}
        
        # El HTML y JavaScript envían los checkboxes como 'true' o 'false' en texto.
        # Aquí los convertimos a verdaderos valores Booleanos (True/False) de Python
        # para que nuestros condicionales (if) funcionen correctamente.
        for key, value in settings_dict.items():
            if isinstance(value, str):
                if value.lower() == 'true':
                    settings_dict[key] = True
                elif value.lower() == 'false':
                    settings_dict[key] = False

        return settings_dict
    except Exception as e:
        # Si hay cualquier error (ej: la base de datos no está lista),
        # devolvemos un diccionario vacío para que la app no falle.
        print(f"Error al leer los ajustes de la base de datos: {e}")
        return {}