# app/api/songs.py
from flask import Blueprint, request, jsonify, current_app
from app.core.db import get_db
from app.core.files import get_next_id, save_song_file, delete_song_file, save_cover_image, delete_cover_image, format_id_for_filename
from app.core.metadata import extract_metadata_from_mp3, get_cover_from_mp3
from PIL import Image
import tempfile # <--- ¡Añade esta línea!
import shutil # <--- ¡Añade esta línea!
import os
import io

bp = Blueprint('songs', __name__, url_prefix='/api/songs')

@bp.route('/', methods=['GET'])
def list_songs():
    """
    GET /api/songs
    Lista todas las canciones, con opciones de búsqueda, ordenamiento y paginación.
    """
    db = get_db()
    search_query = request.args.get('search', '')
    sort_by = request.args.get('sort', 'title') # 'title', 'artist', 'added_at'
    order = request.args.get('order', 'asc') # 'asc', 'desc'
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)

    offset = (page - 1) * page_size
    
    # Validación básica de parámetros de ordenamiento
    if sort_by not in ['title', 'artist', 'added_at', 'duration_ms', 'album', 'year']:
        sort_by = 'title'
    if order not in ['asc', 'desc']:
        order = 'asc'

    # ✅ Corregido: añadimos alias "s" también en count_query
    query = "SELECT s.*, c.path as cover_path FROM song s LEFT JOIN cover c ON s.cover_id = c.id"
    count_query = "SELECT COUNT(*) FROM song s"
    params = []

    if search_query:
        query += " WHERE s.title LIKE ? OR s.artist LIKE ? OR s.album LIKE ?"
        count_query += " WHERE s.title LIKE ? OR s.artist LIKE ? OR s.album LIKE ?"
        search_pattern = f"%{search_query}%"
        params.extend([search_pattern, search_pattern, search_pattern])

    query += f" ORDER BY {sort_by} {order} LIMIT ? OFFSET ?"
    params.extend([page_size, offset])

    songs = db.execute(query, params).fetchall()
    total_songs = db.execute(count_query, params[:-2]).fetchone()[0] # Excluir LIMIT y OFFSET

    # Convertir a formato de lista de diccionarios para jsonify
    song_list = []
    for song in songs:
        song_data = dict(song)
        song_data['id_formatted'] = format_id_for_filename(song_data['id']) # ID formateado para mostrar
        song_list.append(song_data)

    return jsonify({
        'songs': song_list,
        'total': total_songs,
        'page': page,
        'page_size': page_size
    })

@bp.route('/', methods=['POST'])
def upload_songs():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    mp3_files = request.files.getlist('file')
    
    if not mp3_files or mp3_files[0].filename == '':
        return jsonify({'error': 'No selected files'}), 400

    db = get_db()
    imported_songs = []
    errors = []

    for mp3_file in mp3_files:
        if not mp3_file or not mp3_file.filename.endswith('.mp3'):
            errors.append({'filename': mp3_file.filename, 'error': 'File must be an MP3'})
            continue

        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3", dir=current_app.instance_path) as temp_f:
                mp3_file.save(temp_f)
                temp_file_path = temp_f.name

            metadata = extract_metadata_from_mp3(temp_file_path)
            cover_data, cover_ext = get_cover_from_mp3(temp_file_path)

            cover_id = None
            if cover_data:
                try:
                    img = Image.open(io.BytesIO(cover_data))
                    img.thumbnail((500, 500))
                    output_buffer = io.BytesIO()
                    img.convert('RGB').save(output_buffer, format='JPEG', quality=85)
                    processed_cover_data = output_buffer.getvalue()
                    
                    next_cover_id = get_next_id(db, 'cover')
                    cover_filename = save_cover_image(processed_cover_data, next_cover_id, "jpeg") 
                    cover_path_in_db = os.path.join('static', 'covers', cover_filename)

                    db.execute(
                        "INSERT INTO cover (id, code, path) VALUES (?, ?, ?)",
                        (next_cover_id, f"P{format_id_for_filename(next_cover_id)}", cover_path_in_db)
                    )
                    cover_id = next_cover_id
                except Exception as img_e:
                    # --- ¡CAMBIO CLAVE AQUÍ! ---
                    # En lugar de ignorar el error, lo registramos.
                    # La canción se importará, pero sin portada y sabremos por qué.
                    print(f"DEBUG: Error processing cover for {mp3_file.filename}: {img_e}")
                    errors.append({'filename': mp3_file.filename, 'error': f'Cover Error: {img_e}'})
                    # --- FIN DEL CAMBIO ---

            # El resto del proceso de importación de la canción continúa...
            next_song_id = get_next_id(db, 'song')
            final_song_filename = f"{format_id_for_filename(next_song_id)}.mp3"
            final_song_filepath = os.path.join(current_app.config['MEDIA_FOLDER'], final_song_filename)
            shutil.move(temp_file_path, final_song_filepath)

            db.execute(
                "INSERT INTO song (id, title, artist, album, year, duration_ms, cover_id, file_basename, original_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (next_song_id, metadata['title'], metadata['artist'], metadata['album'], metadata['year'], metadata['duration_ms'], cover_id, final_song_filename, mp3_file.filename)
            )
            
            inserted_song = db.execute("SELECT s.*, c.path as cover_path FROM song s LEFT JOIN cover c ON s.cover_id = c.id WHERE s.id = ?", (next_song_id,)).fetchone()
            imported_songs.append(dict(inserted_song))

        except Exception as e:
            db.rollback()
            # Si el error es general (no de la portada), lo añadimos también
            if not any(d['filename'] == mp3_file.filename for d in errors):
                 errors.append({'filename': mp3_file.filename, 'error': str(e)})
            print(f"DEBUG: Error uploading song {mp3_file.filename}: {e}")
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    db.commit()
    return jsonify({ 'imported_songs': imported_songs, 'errors': errors }), 201

@bp.route('/<int:song_id>', methods=['PUT'])
def update_song(song_id):
    """
    PUT /api/songs/<id>
    Actualiza los metadatos de una canción, incluyendo la portada.
    Recibe datos como 'multipart/form-data'.
    """
    db = get_db()
    
    # 1. Obtenemos la información actual de la canción antes de hacer cambios
    song = db.execute("SELECT cover_id FROM song WHERE id = ?", (song_id,)).fetchone()
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    old_cover_id = song['cover_id']
    new_cover_id = None

    try:
        # 2. Procesamos la nueva portada, si se ha enviado una
        if 'cover' in request.files:
            new_cover_file = request.files['cover']
            if new_cover_file.filename != '':
                # Procesamos la imagen (reducir tamaño y convertir a JPEG)
                image_data = new_cover_file.read()
                img = Image.open(io.BytesIO(image_data))
                img.thumbnail((500, 500))
                output_buffer = io.BytesIO()
                img.convert('RGB').save(output_buffer, format='JPEG', quality=85)
                processed_cover_data = output_buffer.getvalue()

                # Guardamos la nueva portada
                next_cover_id_val = get_next_id(db, 'cover')
                cover_filename = save_cover_image(processed_cover_data, next_cover_id_val, "jpeg")
                cover_path_in_db = os.path.join('static', 'covers', cover_filename)

                # Insertamos el registro en la tabla de portadas
                db.execute(
                    "INSERT INTO cover (id, code, path) VALUES (?, ?, ?)",
                    (next_cover_id_val, f"P{format_id_for_filename(next_cover_id_val)}", cover_path_in_db)
                )
                new_cover_id = next_cover_id_val

        # 3. Preparamos y actualizamos los datos de texto
        update_fields = []
        params = []
        
        # Leemos los datos desde request.form en lugar de get_json()
        if 'title' in request.form:
            update_fields.append('title = ?')
            params.append(request.form['title'])
        if 'artist' in request.form:
            update_fields.append('artist = ?')
            params.append(request.form['artist'])
        if 'album' in request.form:
            update_fields.append('album = ?')
            params.append(request.form['album'])
        if 'year' in request.form and request.form['year']:
            update_fields.append('year = ?')
            params.append(int(request.form['year']))
        
        # Si hemos creado una nueva portada, la añadimos a la actualización
        if new_cover_id:
            update_fields.append('cover_id = ?')
            params.append(new_cover_id)

        if not update_fields:
            return jsonify({'error': 'No fields to update'}), 400

        # Construimos y ejecutamos la consulta SQL
        params.append(song_id)
        query = f"UPDATE song SET {', '.join(update_fields)} WHERE id = ?"
        
        db.execute(query, params)
        db.commit()

        # 4. Limpiamos la portada antigua si ya no se usa
        if old_cover_id and new_cover_id:
            usage_count = db.execute(
                "SELECT COUNT(*) FROM song WHERE cover_id = ?", (old_cover_id,)
            ).fetchone()[0]
            
            if usage_count == 0:
                cover_to_delete = db.execute("SELECT path FROM cover WHERE id = ?", (old_cover_id,)).fetchone()
                if cover_to_delete:
                    delete_cover_image(cover_to_delete['path'])
                    db.execute("DELETE FROM cover WHERE id = ?", (old_cover_id,))
                    db.commit()
        
        # 5. Devolvemos la canción actualizada
        updated_song = db.execute(
            "SELECT s.*, c.path as cover_path FROM song s LEFT JOIN cover c ON s.cover_id = c.id WHERE s.id = ?",
            (song_id,)
        ).fetchone()
        return jsonify(dict(updated_song))

    except Exception as e:
        db.rollback()
        # Imprimimos el error en la terminal para depuración
        print(f"Error updating song {song_id}: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:song_id>', methods=['DELETE'])
def delete_song(song_id):
    """
    DELETE /api/songs/<id>
    Elimina una canción y su archivo físico.
    """
    db = get_db()
    cursor = db.cursor()

    try:
        # Primero, obtener información de la canción para borrar el archivo físico
        song = db.execute("SELECT file_basename, cover_id FROM song WHERE id = ?", (song_id,)).fetchone()
        if not song:
            return jsonify({'message': 'Song not found'}), 404
        
        file_basename = song['file_basename']
        cover_id = song['cover_id']

        # Eliminar el registro de la DB
        cursor.execute("DELETE FROM song WHERE id = ?", (song_id,))
        db.commit()

        # Eliminar el archivo físico MP3
        delete_song_file(file_basename)

        # Opcional: Eliminar la portada si ya no es usada por ninguna otra canción/playlist
        if cover_id:
            # Verificar si la portada es usada por otras canciones o playlists
            cover_usage_count = db.execute(
                "SELECT COUNT(*) FROM song WHERE cover_id = ? UNION ALL SELECT COUNT(*) FROM playlist WHERE cover_id = ?",
                (cover_id, cover_id)
            ).fetchall()
            total_usage = sum([count[0] for count in cover_usage_count])

            if total_usage == 0: # Si ya no es usada, borrarla
                cover_info = db.execute("SELECT path FROM cover WHERE id = ?", (cover_id,)).fetchone()
                if cover_info:
                    delete_cover_image(cover_info['path'])
                    cursor.execute("DELETE FROM cover WHERE id = ?", (cover_id,))
                    db.commit()


        return jsonify({'message': 'Song deleted successfully'}), 200

    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/favorites', methods=['GET'])
def list_favorites():
    """
    GET /api/songs/favorites
    Lista las 5 canciones favoritas.
    """
    db = get_db()
    # Obtener las canciones favoritas, incluyendo la portada
    favorites = db.execute(
        """
        SELECT fs.position, s.*, c.path as cover_path 
        FROM favorite_song fs
        JOIN song s ON fs.song_id = s.id
        LEFT JOIN cover c ON s.cover_id = c.id
        ORDER BY fs.position ASC
        """
    ).fetchall()

    fav_list = []
    for fav in favorites:
        fav_data = dict(fav)
        fav_data['id_formatted'] = format_id_for_filename(fav_data['id'])
        fav_list.append(fav_data)

    return jsonify({'favorites': fav_list})

@bp.route('/favorites', methods=['PUT'])
def update_favorites():
    """
    PUT /api/songs/favorites
    Actualiza el listado de las 5 canciones favoritas.
    Recibe un JSON como: { "favorites": [ { "song_id": 1, "position": 1 }, { "song_id": 5, "position": 2 } ] }
    """
    db = get_db()
    cursor = db.cursor()
    data = request.get_json()
    new_favorites = data.get('favorites', [])

    if not isinstance(new_favorites, list) or len(new_favorites) > 5:
        return jsonify({'error': 'Invalid favorite songs list. Max 5 items expected.'}), 400

    try:
        # Borrar las favoritas existentes para insertar las nuevas
        cursor.execute("DELETE FROM favorite_song")

        for fav_item in new_favorites:
            song_id = fav_item.get('song_id')
            position = fav_item.get('position')

            if not isinstance(song_id, int) or not isinstance(position, int) or not (1 <= position <= 5):
                raise ValueError(f"Invalid song_id or position for favorite: {fav_item}")
            
            # Verificar que el song_id realmente existe
            existing_song = db.execute("SELECT id FROM song WHERE id = ?", (song_id,)).fetchone()
            if not existing_song:
                raise ValueError(f"Song with ID {song_id} does not exist.")

            cursor.execute(
                "INSERT INTO favorite_song (song_id, position) VALUES (?, ?)",
                (song_id, position)
            )
        db.commit()
        return jsonify({'message': 'Favorites updated successfully'}), 200
    except ValueError as ve:
        db.rollback()
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:song_id>', methods=['GET'])
def get_song(song_id):
    """
    GET /api/songs/<id>
    Obtiene los detalles de una única canción.
    """
    db = get_db()
    song = db.execute(
        "SELECT s.*, c.path as cover_path FROM song s LEFT JOIN cover c ON s.cover_id = c.id WHERE s.id = ?",
        (song_id,)
    ).fetchone()

    if song is None:
        return jsonify({'error': 'Song not found'}), 404
    
    return jsonify(dict(song))
