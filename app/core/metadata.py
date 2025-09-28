# app/core/metadata.py
from mutagen import File as MFile
import os

def extract_metadata_from_mp3(file_path):
    """
    Extrae metadatos (título, artista, álbum, año, duración) de un archivo MP3.
    Si el archivo no tiene metadatos de título, usa el nombre del archivo sin extensión.
    """
    metadata = {
        'title': '',
        'artist': '',
        'album': '',
        'year': None,
        'duration_ms': 0
    }

    try:
        audio = MFile(file_path, easy=True)
        if audio:
            metadata['title'] = audio.get('title', [''])[0].strip()
            metadata['artist'] = audio.get('artist', [''])[0].strip()
            metadata['album'] = audio.get('album', [''])[0].strip()
            
            # Intentar obtener el año
            date_str = audio.get('date', [''])[0].strip()
            if date_str and date_str.isdigit(): # Si es un año numérico directo
                metadata['year'] = int(date_str)
            elif date_str and len(date_str) >= 4 and date_str[:4].isdigit(): # Si es una fecha completa como 'YYYY-MM-DD'
                metadata['year'] = int(date_str[:4])
            
            if audio.info:
                metadata['duration_ms'] = int(audio.info.length * 1000)

        # Si el título sigue vacío, usa el nombre del archivo (sin extensión)
        if not metadata['title']:
            base_name = os.path.basename(file_path)
            metadata['title'] = os.path.splitext(base_name)[0]

    except Exception as e:
        print(f"Error al extraer metadatos de {file_path}: {e}")
        # Si hay un error, al menos intenta usar el nombre del archivo como título
        base_name = os.path.basename(file_path)
        metadata['title'] = os.path.splitext(base_name)[0]

    return metadata

def extract_metadata_from_mp3(file_path):
    # ... (esta función no cambia)
    metadata = {
        'title': '', 'artist': '', 'album': '', 'year': None, 'duration_ms': 0
    }
    try:
        audio = MFile(file_path, easy=True)
        if audio:
            metadata['title'] = audio.get('title', [''])[0].strip()
            metadata['artist'] = audio.get('artist', [''])[0].strip()
            metadata['album'] = audio.get('album', [''])[0].strip()
            date_str = audio.get('date', [''])[0].strip()
            if date_str and date_str.isdigit():
                metadata['year'] = int(date_str)
            elif date_str and len(date_str) >= 4 and date_str[:4].isdigit():
                metadata['year'] = int(date_str[:4])
            if audio.info:
                metadata['duration_ms'] = int(audio.info.length * 1000)
        if not metadata['title']:
            base_name = os.path.basename(file_path)
            metadata['title'] = os.path.splitext(base_name)[0]
    except Exception as e:
        print(f"Error al extraer metadatos de {file_path}: {e}")
        base_name = os.path.basename(file_path)
        metadata['title'] = os.path.splitext(base_name)[0]
    return metadata

def get_cover_from_mp3(file_path):
    """
    Extrae la primera imagen de portada de un archivo MP3 si existe.
    VERSIÓN MEJORADA: Busca cualquier tag que empiece con 'APIC:'.
    """
    try:
        audio = MFile(file_path, easy=False)
        if not audio:
            return None, None

        # --- LÓGICA MEJORADA ---
        # Busca cualquier clave que comience con 'APIC:'
        cover_key = None
        for key in audio.keys():
            if key.startswith('APIC:'):
                cover_key = key
                break # Nos quedamos con la primera que encontremos
        
        if cover_key:
            apic = audio.get(cover_key)
            cover_ext = apic.mime.split('/')[-1]
            return apic.data, cover_ext
        else:
            return None, None
        # --- FIN DE LA LÓGICA MEJORADA ---
            
    except Exception as e:
        print(f"Error crítico al leer el archivo MP3 con Mutagen: {e}")
        return None, None
