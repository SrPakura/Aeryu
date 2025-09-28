# app/core/files.py
import os
import shutil
from flask import current_app

def get_next_id(db, table_name):
    """
    Obtiene el próximo ID disponible para una tabla, basado en el máximo actual + 1.
    """
    cursor = db.execute(f"SELECT MAX(id) FROM {table_name}")
    max_id = cursor.fetchone()[0]
    return (max_id if max_id else 0) + 1

def format_id_for_filename(item_id, length=4):
    """
    Formatea un ID numérico a una cadena con ceros a la izquierda (ej: 1 -> "0001").
    """
    return str(item_id).zfill(length)

def save_song_file(file_stream, song_id):
    """
    Guarda un archivo de canción (MP3) en la carpeta 'media' con un nombre basado en su ID.
    Retorna el nombre del archivo guardado (ej: '0001.mp3').
    """
    media_folder = current_app.config['MEDIA_FOLDER']
    # Asegúrate de que la carpeta existe
    os.makedirs(media_folder, exist_ok=True)

    filename = f"{format_id_for_filename(song_id)}.mp3"
    filepath = os.path.join(media_folder, filename)

    # Guarda el archivo
    with open(filepath, 'wb') as f:
        # chunk_size es para manejar archivos grandes sin cargar todo en memoria
        while True:
            chunk = file_stream.read(8192) # Lee 8KB a la vez
            if not chunk:
                break
            f.write(chunk)
    
    return filename

def delete_song_file(file_basename):
    """
    Elimina un archivo de canción de la carpeta 'media'.
    """
    media_folder = current_app.config['MEDIA_FOLDER']
    filepath = os.path.join(media_folder, file_basename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False

def save_cover_image(image_data, cover_id, file_extension): # Cambiado 'file_stream' a 'image_data'
    """
    Guarda una imagen de portada en la carpeta 'static/covers' con un nombre basado en su ID.
    Recibe los datos binarios de la imagen (image_data) directamente.
    Retorna el nombre del archivo guardado (ej: 'P0001.png').
    """
    covers_folder = current_app.config['COVERS_FOLDER']
    os.makedirs(covers_folder, exist_ok=True) # Asegúrate de que la carpeta existe

    filename = f"P{format_id_for_filename(cover_id)}.{file_extension}"
    filepath = os.path.join(covers_folder, filename)

    with open(filepath, 'wb') as f:
        f.write(image_data) # <--- ¡Cambiado para escribir los bytes directamente!
    
    return filename

def delete_cover_image(cover_path):
    """
    Elimina un archivo de portada del sistema.
    cover_path es la ruta relativa guardada en la DB (ej: 'static/covers/P0001.png').
    """
    # app.root_path es la ruta absoluta a la carpeta 'app/'
    full_path = os.path.join(current_app.root_path, cover_path)
    if os.path.exists(full_path):
        os.remove(full_path)
        return True
    return False
