# app/api/playlists.py
from flask import Blueprint, request, jsonify
from app.core.db import get_db  # <-- Esta es la que faltaba
from app.core.files import get_next_id, save_cover_image, format_id_for_filename
from PIL import Image
import os
import io

bp = Blueprint('playlists', __name__, url_prefix='/api/playlists')

@bp.route('/', methods=['GET'])
def list_playlists():
    """
    GET /api/playlists/
    Devuelve todas las playlists creadas.
    """
    db = get_db()
    playlists = db.execute(
        """
        SELECT p.id, p.name, p.created_at, c.path as cover_path
        FROM playlist p
        LEFT JOIN cover c ON p.cover_id = c.id
        ORDER BY p.created_at DESC
        """
    ).fetchall()
    playlist_list = [dict(p) for p in playlists]
    return jsonify({'playlists': playlist_list})


@bp.route('/', methods=['POST'])
def create_playlist():
    """
    POST /api/playlists/
    Crea una nueva playlist. Puede recibir una portada personalizada,
    un cover_id existente, o ninguno.
    """
    # --- LOGS DE DEPURACIÓN ---
    print("\n--- INICIANDO CREACIÓN DE PLAYLIST ---")
    print(f"Datos del formulario (request.form): {request.form}")
    print(f"Archivos recibidos (request.files): {request.files}")
    # ---------------------------

    db = get_db()
    name = request.form.get('name')
    if not name or len(name.strip()) == 0:
        return jsonify({'error': 'Playlist name is required'}), 400

    cover_id = None

    # Lógica para determinar la portada
    if 'cover' in request.files and request.files['cover'].filename != '':
        print("-> Detectado nuevo archivo de portada para subir.")
        new_cover_file = request.files['cover']
        try:
            image_data = new_cover_file.read()
            img = Image.open(io.BytesIO(image_data))
            img.thumbnail((500, 500))
            output_buffer = io.BytesIO()
            img.convert('RGB').save(output_buffer, format='JPEG', quality=85)
            processed_cover_data = output_buffer.getvalue()

            next_cover_id_val = get_next_id(db, 'cover')
            cover_filename = save_cover_image(processed_cover_data, next_cover_id_val, "jpeg")
            cover_path_in_db = os.path.join('static', 'covers', cover_filename)

            cursor = db.execute(
                "INSERT INTO cover (id, code, path) VALUES (?, ?, ?)",
                (next_cover_id_val, f"P{format_id_for_filename(next_cover_id_val)}", cover_path_in_db)
            )
            cover_id = cursor.lastrowid
            print(f"-> Portada nueva procesada y guardada con ID: {cover_id}")
        except Exception as e:
            print(f"-> ERROR al procesar la imagen: {e}")
            return jsonify({'error': 'Could not process uploaded cover image'}), 500
    
    elif 'cover_id' in request.form and request.form.get('cover_id'):
        cover_id = int(request.form.get('cover_id'))
        print(f"-> Detectada selección de portada existente con ID: {cover_id}")

    else:
        print("-> No se ha proporcionado ninguna portada.")

    try:
        print(f"-> A punto de insertar en la BD: Nombre='{name.strip()}', Cover_ID={cover_id}")
        cursor = db.execute(
            "INSERT INTO playlist (name, cover_id) VALUES (?, ?)",
            (name.strip(), cover_id)
        )
        db.commit()
        new_playlist_id = cursor.lastrowid
        print(f"-> Playlist creada con éxito. ID de la nueva playlist: {new_playlist_id}")
        new_playlist = db.execute(
            "SELECT p.id, p.name, p.created_at, c.path as cover_path FROM playlist p LEFT JOIN cover c ON p.cover_id = c.id WHERE p.id = ?",
            (new_playlist_id,)
        ).fetchone()
        return jsonify(dict(new_playlist)), 201
    except db.Error as e:
        db.rollback()
        print(f"-> ERROR de base de datos al crear la playlist: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:playlist_id>/items', methods=['POST'])
def add_song_to_playlist(playlist_id):
    """
    POST /api/playlists/<id>/items
    Añade una canción a la playlist especificada.
    Recibe: { "song_id": <id> }
    """
    data = request.get_json()
    song_id = data.get('song_id')
    if not song_id:
        return jsonify({'error': 'Song ID is required'}), 400

    db = get_db()
    try:
        last_pos_result = db.execute(
            "SELECT MAX(position) FROM playlist_item WHERE playlist_id = ?",
            (playlist_id,)
        ).fetchone()
        next_position = (last_pos_result[0] or 0) + 1

        db.execute(
            "INSERT INTO playlist_item (playlist_id, song_id, position) VALUES (?, ?, ?)",
            (playlist_id, song_id, next_position)
        )
        db.commit()
        return jsonify({
            'message': 'Song added to playlist',
            'playlist_id': playlist_id,
            'song_id': song_id,
            'position': next_position
        }), 201
    except db.IntegrityError:
        db.rollback()
        return jsonify({
            'error': 'Invalid song_id or playlist_id, or song is already in the playlist at that position.'
        }), 400
    except db.Error as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/<int:playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    """
    GET /api/playlists/<id>
    Devuelve los detalles de una playlist y la lista de sus canciones.
    """
    db = get_db()

    playlist = db.execute(
        "SELECT p.id, p.name, c.path as cover_path FROM playlist p LEFT JOIN cover c ON p.cover_id = c.id WHERE p.id = ?",
        (playlist_id,)
    ).fetchone()

    if playlist is None:
        return jsonify({'error': 'Playlist not found'}), 404

    songs = db.execute(
        """
        SELECT s.*, c.path as cover_path, pi.position
        FROM playlist_item pi
        JOIN song s ON pi.song_id = s.id
        LEFT JOIN cover c ON s.cover_id = c.id
        WHERE pi.playlist_id = ?
        ORDER BY pi.position ASC
        """,
        (playlist_id,)
    ).fetchall()

    playlist_data = dict(playlist)
    playlist_data['songs'] = [dict(song) for song in songs]

    return jsonify(playlist_data)


@bp.route('/<int:playlist_id>/items', methods=['DELETE'])
def remove_song_from_playlist(playlist_id):
    """
    DELETE /api/playlists/<id>/items
    Elimina una canción de una playlist y reordena las posiciones.
    Recibe: { "song_id": <id> }
    """
    data = request.get_json()
    song_id_to_delete = data.get('song_id')

    if not song_id_to_delete:
        return jsonify({'error': 'Song ID is required'}), 400

    db = get_db()
    try:
        cursor = db.execute(
            "DELETE FROM playlist_item WHERE playlist_id = ? AND song_id = ?",
            (playlist_id, song_id_to_delete)
        )

        if cursor.rowcount == 0:
            return jsonify({'error': 'Song not found in this playlist'}), 404

        # Reorganizamos posiciones
        remaining_songs = db.execute(
            "SELECT song_id FROM playlist_item WHERE playlist_id = ? ORDER BY position ASC",
            (playlist_id,)
        ).fetchall()

        for index, song in enumerate(remaining_songs):
            db.execute(
                "UPDATE playlist_item SET position = ? WHERE playlist_id = ? AND song_id = ?",
                (index + 1, playlist_id, song['song_id'])
            )

        db.commit()
        return jsonify({'message': 'Song removed and playlist reordered'}), 200

    except db.Error as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500


# --- NUEVAS FUNCIONES ---

@bp.route('/<int:playlist_id>', methods=['PUT'])
def update_playlist(playlist_id):
    """
    PUT /api/playlists/<id>
    Actualiza el nombre y/o la portada de una playlist existente.
    Recibe datos como 'multipart/form-data'.
    """
    db = get_db()

    # 1. Obtenemos la playlist actual para saber su portada antigua
    playlist = db.execute("SELECT cover_id FROM playlist WHERE id = ?", (playlist_id,)).fetchone()
    if not playlist:
        return jsonify({'error': 'Playlist not found'}), 404
    old_cover_id = playlist['cover_id']
    new_cover_id = None # Aún no sabemos si habrá nueva portada

    try:
        # 2. Procesamos la nueva portada, si se ha enviado una
        # Esta lógica es idéntica a la de create_playlist
        if 'cover' in request.files and request.files['cover'].filename != '':
            new_cover_file = request.files['cover']
            image_data = new_cover_file.read()
            img = Image.open(io.BytesIO(image_data))
            img.thumbnail((500, 500))
            output_buffer = io.BytesIO()
            img.convert('RGB').save(output_buffer, format='JPEG', quality=85)
            processed_cover_data = output_buffer.getvalue()

            next_cover_id_val = get_next_id(db, 'cover')
            cover_filename = save_cover_image(processed_cover_data, next_cover_id_val, "jpeg")
            cover_path_in_db = os.path.join('static', 'covers', cover_filename)

            cursor = db.execute(
                "INSERT INTO cover (id, code, path) VALUES (?, ?, ?)",
                (next_cover_id_val, f"P{format_id_for_filename(next_cover_id_val)}", cover_path_in_db)
            )
            new_cover_id = cursor.lastrowid
        
        # Si no se subió archivo, miramos si se seleccionó una portada existente
        elif 'cover_id' in request.form and request.form.get('cover_id'):
            new_cover_id = int(request.form.get('cover_id'))

        # 3. Preparamos y actualizamos los datos de la playlist
        update_fields = []
        params = []

        if 'name' in request.form and request.form.get('name').strip():
            update_fields.append('name = ?')
            params.append(request.form.get('name').strip())

        # Si hemos determinado una nueva portada, la añadimos a la actualización
        if new_cover_id is not None:
            update_fields.append('cover_id = ?')
            params.append(new_cover_id)

        # Si no hay nada que actualizar, no hacemos nada
        if not update_fields:
            return jsonify({'message': 'No changes provided'}), 200

        params.append(playlist_id)
        query = f"UPDATE playlist SET {', '.join(update_fields)} WHERE id = ?"
        
        db.execute(query, params)
        db.commit()

        # 4. Limpiamos la portada antigua si se reemplazó y ya no se usa
        if old_cover_id and new_cover_id is not None and old_cover_id != new_cover_id:
            usage_count = db.execute(
                "SELECT COUNT(*) FROM song WHERE cover_id = ? UNION ALL SELECT COUNT(*) FROM playlist WHERE cover_id = ?",
                (old_cover_id, old_cover_id)
            ).fetchall()
            total_usage = sum(count[0] for count in usage_count)

            if total_usage == 0:
                cover_to_delete = db.execute("SELECT path FROM cover WHERE id = ?", (old_cover_id,)).fetchone()
                if cover_to_delete:
                    delete_cover_image(cover_to_delete['path'])
                    db.execute("DELETE FROM cover WHERE id = ?", (old_cover_id,))
                    db.commit()

        return jsonify({'message': 'Playlist updated successfully'})

    except Exception as e:
        db.rollback()
        print(f"Error updating playlist {playlist_id}: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:playlist_id>', methods=['DELETE'])
def delete_playlist(playlist_id):
    """
    DELETE /api/playlists/<id>
    Elimina una playlist completa (y sus canciones gracias a ON DELETE CASCADE).
    """
    db = get_db()
    db.execute("DELETE FROM playlist WHERE id = ?", (playlist_id,))
    db.commit()
    return jsonify({'message': 'Playlist deleted successfully'})
