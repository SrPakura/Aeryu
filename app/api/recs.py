# app/api/recs.py
from flask import Blueprint, request, jsonify
from app.core import recommender
from app.core import db  # suponiendo que ya tienes helpers de SQL
import sqlite3

bp = Blueprint('recs', __name__, url_prefix='/api/recs')

@bp.route('/chat', methods=['POST'])
def chat_with_recommender():
    print("📥 /api/recs/chat -> petición recibida")

    data = request.get_json()
    print("📦 Datos recibidos del frontend:", data)

    user_message = data.get('message')
    history = data.get('history', None)

    if not user_message:
        print("❌ Error: no se proporcionó 'message'")
        return jsonify({'error': 'No message provided'}), 400

    print("💬 Mensaje del usuario:", user_message)
    if history:
        print("📜 Historial recibido:", history)

    raw_response = recommender.get_recommendations(user_message, history)
    print("🧾 Respuesta cruda de Gemini (primeros 200 chars):", raw_response[:200])

    parsed_response = recommender.parse_gemini_response(raw_response)
    print("✅ Respuesta parseada lista para el frontend:", parsed_response)

    return jsonify(parsed_response)


# -------------------------------
# NUEVO: Endpoint de feedback
# -------------------------------
@bp.route('/feedback', methods=['POST'])
def feedback():
    """
    Guarda feedback (like/dislike) en SQL y en el JSON de sesión.
    Espera JSON con {title, artist, feedback}
    """
    print("📥 /api/recs/feedback -> petición recibida")

    data = request.get_json()
    print("📦 Datos recibidos:", data)

    title = data.get("title")
    artist = data.get("artist")
    feedback_value = data.get("feedback")

    if not title or not artist or feedback_value not in ["like", "dislike"]:
        print("❌ Error: datos inválidos")
        return jsonify({"error": "Datos inválidos"}), 400

    # Guardar en SQL
    try:
        print(f"📝 Insertando en SQL -> {title} - {artist} ({feedback_value})")
        conn = sqlite3.connect("instance/app.db")
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO rec_feedback (song_title, artist, feedback)
            VALUES (?, ?, ?)
        """, (title, artist, feedback_value))
        conn.commit()
        conn.close()
        print("✅ Feedback guardado en SQL")
    except Exception as e:
        print("❌ Error al insertar en DB:", e)
        return jsonify({"error": f"DB error: {e}"}), 500

    # Guardar en JSON de sesión
    session = recommender.load_session()
    session.setdefault("feedback", []).append({
        "title": title,
        "artist": artist,
        "feedback": feedback_value
    })
    recommender.save_session(session)
    print("💾 Feedback guardado en JSON de sesión")

    return jsonify({"status": "ok", "message": f"Feedback {feedback_value} registrado para {title} - {artist}."})
