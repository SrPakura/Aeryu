-- Este archivo es la receta completa para construir nuestra base de datos desde cero.
-- Cada vez que ejecutamos el comando `flask init-db`, este script se lee y se ejecuta.
-- Su trabajo es:
-- 1. Borrar todas las tablas viejas para empezar de limpio.
-- 2. Crear la estructura de tablas nueva y vacía.

-- === FASE 1: LIMPIEZA TOTAL ===
-- Antes de crear nada, nos aseguramos de borrar las tablas si ya existían.
-- `IF EXISTS` evita que dé error si la tabla no existe. Es una medida de seguridad.
DROP TABLE IF EXISTS song;
DROP TABLE IF EXISTS cover;
DROP TABLE IF EXISTS favorite_song;
DROP TABLE IF EXISTS playlist;
DROP TABLE IF EXISTS playlist_item;
DROP TABLE IF EXISTS play; -- Esta tabla ya no se usa, pero la borramos por si quedaban restos.

-- LA LÍNEA QUE ARREGLAMOS: Ahora el script también borra la tabla del historial de escucha.
DROP TABLE IF EXISTS play_checkpoint;

DROP TABLE IF EXISTS stats_daily;
DROP TABLE IF EXISTS rec_feedback;
DROP TABLE IF EXISTS setting;


-- === FASE 2: CREACIÓN DE LAS TABLAS ===

-- -- Tabla `song`: El corazón de la app, donde guardamos cada canción. --
CREATE TABLE song (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- Un número único para identificar cada canción (1, 2, 3...). Se genera solo.
  title TEXT NOT NULL,                  -- El título de la canción (es obligatorio que tenga uno).
  artist TEXT DEFAULT '',               -- El artista de la canción.
  album TEXT DEFAULT '',                -- El álbum al que pertenece.
  year INTEGER,                         -- El año de lanzamiento.
  duration_ms INTEGER DEFAULT 0,        -- Cuánto dura la canción en milisegundos.
  cover_id INTEGER,                     -- El "conector" que le dice al programa qué portada de la tabla `cover` debe usar.
  file_basename TEXT NOT NULL UNIQUE,   -- El nombre del archivo físico (ej: "0001.mp3"). No puede haber dos iguales.
  original_filename TEXT,             -- El nombre original que tenía el archivo que subió el usuario (ej: "mi_cancion_favorita.mp3").
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- La fecha y hora exactas en que se añadió la canción. Se pone sola.

  -- Esto conecta la canción con una portada. `ON DELETE SET NULL` significa que si la portada se borra, la canción no se borra, solo pierde su portada.
  FOREIGN KEY (cover_id) REFERENCES cover(id) ON DELETE SET NULL
);

-- -- Tabla `cover`: Un almacén para todas las carátulas. --
-- La idea es que varias canciones o playlists puedan usar la misma imagen sin tener que guardarla varias veces.
CREATE TABLE cover (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- Un número único para cada imagen de portada.
  code TEXT UNIQUE,                     -- Un código de texto único para la portada (ej: "P0001").
  path TEXT NOT NULL                    -- La ruta donde está guardado el archivo de imagen (ej: "static/covers/P0001.png").
);

-- -- Tabla `favorite_song`: Los 5 espacios fijos para las canciones favoritas. --
CREATE TABLE favorite_song (
  position INTEGER PRIMARY KEY,         -- La posición (del 1 al 5). Solo puede haber una canción por posición.
  song_id INTEGER UNIQUE,               -- El conector a la canción que ocupa esa posición. Una canción solo puede estar en un hueco a la vez.

  -- Esto conecta el hueco con una canción. `ON DELETE CASCADE` es un "efecto dominó": si la canción se borra de la app, este hueco favorito se vacía automáticamente.
  FOREIGN KEY (song_id) REFERENCES song(id) ON DELETE CASCADE
);

-- -- Tablas de Playlists: Usamos dos tablas para que funcionen correctamente. --

-- -- Tabla `playlist`: Guarda la información general de cada lista de reproducción (su nombre, su portada...). --
CREATE TABLE playlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- Un número único para cada playlist.
  name TEXT NOT NULL,                   -- El nombre que le da el usuario.
  cover_id INTEGER,                     -- El conector a su portada en la tabla `cover`.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Cuándo se creó la lista.

  FOREIGN KEY (cover_id) REFERENCES cover(id) ON DELETE SET NULL
);

-- -- Tabla `playlist_item`: Guarda QUÉ canciones hay DENTRO de cada playlist y en QUÉ orden. --
CREATE TABLE playlist_item (
  playlist_id INTEGER NOT NULL,         -- Conector que dice a qué playlist pertenece este item.
  song_id INTEGER NOT NULL,             -- Conector que dice qué canción es.
  position INTEGER NOT NULL,            -- El orden dentro de la lista (la 1ª, la 2ª, etc.).

  PRIMARY KEY (playlist_id, position),  -- La combinación de playlist y posición es única (no puede haber dos "primera canción" en la misma lista).

  -- Efecto dominó: si se borra una playlist (`playlist_id`), todos sus `playlist_item` se borran. Si se borra una canción (`song_id`), se elimina de todas las playlists en las que estaba.
  FOREIGN KEY (playlist_id) REFERENCES playlist(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES song(id) ON DELETE CASCADE
);

-- -- Tabla `play_checkpoint`: El registro de escucha para las estadísticas. --
-- Cada vez que se escucha un trozo de una canción (ej: 15 segundos), se guarda un pequeño registro aquí.
CREATE TABLE play_checkpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- Un ID único para cada trocito de escucha.
  song_id INTEGER NOT NULL,             -- El conector a la canción que se estaba escuchando.
  ms_played INTEGER NOT NULL,           -- Cuántos milisegundos se escucharon en ese trozo.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- Cuándo se escuchó.

  -- Efecto dominó: Si se borra una canción, también se borra todo su historial de escucha.
  FOREIGN KEY (song_id) REFERENCES song(id) ON DELETE CASCADE
);

-- -- Tablas para futuras funcionalidades (Aún no las hemos programado del todo) --

-- Tabla `stats_daily`: Un posible resumen diario para estadísticas a muy largo plazo.
CREATE TABLE stats_daily (
  date TEXT PRIMARY KEY,          -- La fecha en formato 'AAAA-MM-DD'.
  total_ms INTEGER DEFAULT 0
);

-- Tabla `rec_feedback`: Para guardar si al usuario le ha gustado ("like") o no ("dislike") una recomendación de la IA.
CREATE TABLE rec_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  source TEXT,                    -- De dónde vino la recomendación (ej: "modelo IA").
  feedback TEXT CHECK (feedback IN ('like','dislike')) NOT NULL, -- Solo puede ser 'like' o 'dislike'.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla `setting`: Para guardar los ajustes de la aplicación (ej: color del tema, API keys, etc.).
CREATE TABLE setting (
  key TEXT PRIMARY KEY,           -- El nombre del ajuste (ej: "theme_color").
  value TEXT                      -- El valor del ajuste (ej: "#8C00FF").
);