# app/core/recommender.py
import os
import re
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# --- CAMBIO 1: añadimos get_all_settings ---
from app.core.db import get_db, get_all_settings

# --- Rutas y logging ---
PROMPT_TEMPLATE_FILE = Path(__file__).parent / "prompt_template.json"
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger("recommender")

# --- Funciones para obtener datos frescos de la DB ---
def _get_song_library_from_db():
    db = get_db()
    try:
        songs = db.execute("SELECT title, artist FROM song ORDER BY artist, title").fetchall()
        if not songs:
            return "El usuario no tiene canciones en su biblioteca."
        return "\n".join([f"- {s['title']} - {s['artist'] or 'Desconocido'}" for s in songs])
    except Exception as e:
        log.error(f"Error al obtener la biblioteca de canciones: {e}")
        return "No se pudo cargar la biblioteca de canciones."

def _get_feedback_from_db():
    db = get_db()
    try:
        feedback = db.execute(
            "SELECT song_title, artist, feedback FROM rec_feedback ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
        if not feedback:
            return "Aún no hay feedback."
        return "\n".join([f"- {f['feedback'].upper()}: {f['song_title']} - {f['artist']}" for f in feedback])
    except Exception as e:
        log.error(f"Error al obtener el feedback: {e}")
        return "No se pudo cargar el feedback."

# --- Función principal de recomendación ---
def get_recommendations(user_message: str, conversation_history: list) -> str:
    log.info(f"Petición recibida. Mensaje: '{user_message}'")

    # --- CAMBIO 2: cargar API Key en tiempo real desde la DB ---
    settings = get_all_settings()
    api_key = settings.get('gemini_api_key')

    if not api_key:
        log.error("El cliente de Gemini no está configurado (falta API Key en ajustes).")
        return "Error: La API Key de Gemini no está configurada en los ajustes."

    client = genai.Client(api_key=api_key)

    try:
        # 1. Cargar la plantilla del prompt
        with open(PROMPT_TEMPLATE_FILE, "r", encoding="utf-8") as f:
            template_data = json.load(f)
        base_prompt = template_data["base_prompt"]

        # 2. --- CAMBIO 3: respetar los checkboxes y el textarea ---
        if settings.get('prompt_include_favorites', True):
            song_library = _get_song_library_from_db()
        else:
            song_library = "El usuario ha desactivado compartir su biblioteca."

        if settings.get('prompt_include_history', True):
            feedback = _get_feedback_from_db()
        else:
            feedback = "El usuario ha desactivado compartir su historial de feedback."

        extra_info = settings.get('prompt_extra', "Ninguna.")

        # 3. Construir el prompt de sistema
        system_prompt = base_prompt.format(
            song_library=song_library,
            feedback=feedback,
            extra_info=extra_info or "Ninguna."
        )
        
        # 4. Construir el historial para la API
        contents = [{'role': 'user', 'parts': [{'text': system_prompt}]}]
        contents.append({'role': 'model', 'parts': [{'text': 'Entendido. Estoy listo para recomendar música.'}]})

        for message in conversation_history:
            role = "model" if message["role"] == "assistant" else "user"
            contents.append({'role': role, 'parts': [{'text': message["text"]}]})
        
        contents.append({'role': 'user', 'parts': [{'text': user_message}]})

        log.info(f"🤖 PROMPT COMPLETO ENVIADO A GEMINI:\n---\n{contents}\n---")

        # 5. Configurar herramientas y llamar a la API
        grounding_tool = types.Tool(google_search=types.GoogleSearch())
        config = types.GenerateContentConfig(tools=[grounding_tool])

        log.info("Llamando a la API de Gemini...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config
        )
        
        reply_text = response.text
        log.info(f"Respuesta de Gemini recibida (primeros 200 chars): '{reply_text[:200]}...'")
        return reply_text

    except Exception as e:
        log.error(f"Error crítico al llamar a Gemini: {e}")
        return f"Error al contactar con el recomendador: {e}"

# --- Parseo de respuesta (sin cambios) ---
def parse_gemini_response(response_text: str) -> dict:
    song_pattern = re.compile(r"/1/(.*?)/1/")
    artist_pattern = re.compile(r"~1~(.*?)~1~")

    titles = song_pattern.findall(response_text)
    artists = artist_pattern.findall(response_text)

    clean_text = re.sub(r"(/1/|~1~)", "", response_text)

    recommendations = []
    for i in range(min(len(titles), len(artists))):
        recommendations.append({"title": titles[i].strip(), "artist": artists[i].strip()})

    log.info(f"Recomendaciones parseadas: {recommendations}")
    return {
        "reply_html": clean_text.strip(),
        "recommendations": recommendations
    }
