// app/static/js/playlist_detail.js

let currentPlaylistSongs = []; 
let playlistId_global = null; // Guardamos el ID de la playlist actual

// --- Funciones de Utilidad ---
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// --- Funciones de Renderizado ---
function renderPlaylistHeader(playlist) {
    document.getElementById('playlist-detail-name').textContent = playlist.name;
    document.getElementById('playlist-song-count').textContent = playlist.songs.length;
    document.getElementById('playlist-detail-cover').src = playlist.cover_path || '/static/covers/default_cover.png';
}

function renderSongList(songs) {
    const container = document.getElementById('playlist-songs-container');
    container.innerHTML = '';

    if (songs.length === 0) {
        container.innerHTML = '<p class="no-songs-message">Esta playlist está vacía. Añade canciones con clic derecho.</p>';
        return;
    }

    songs.forEach(song => {
        const item = document.createElement('div');
        item.classList.add('song-item');
        item.dataset.songId = song.id; // MUY IMPORTANTE para drag&drop
        item.innerHTML = `
            <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist || 'Artista Desconocido'}</div>
            </div>
            <div class="song-album">${song.album || 'Álbum Desconocido'}</div>
            <div class="song-year">${song.year || '----'}</div>
            <div class="song-duration">${formatDuration(song.duration_ms)}</div>
            <button class="icon-btn remove-song-btn" title="Eliminar de la playlist">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 
                             5 6.41 10.59 12 5 17.59 6.41 19 
                             12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        `;

        // Reproduce al hacer clic en la fila, excepto si es el botón de eliminar
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.remove-song-btn')) {
                window.AeryuPlayer.playSong(song);
            }
        });

        // Botón eliminar
        const removeBtn = item.querySelector('.remove-song-btn');
        removeBtn.addEventListener('click', () => {
            removeSongFromPlaylist(playlistId_global, song.id);
        });

        container.appendChild(item);
    });
}

// --- NUEVA SECCIÓN: Drag & Drop con SortableJS ---
function initSortable() {
    const container = document.getElementById('playlist-songs-container');
    new Sortable(container, {
        animation: 150,
        onEnd: async function (evt) {
            const items = evt.to.children;
            const newSongIds = Array.from(items).map(item => parseInt(item.dataset.songId));
            await saveNewOrder(playlistId_global, newSongIds);
        }
    });
}

async function saveNewOrder(playlistId, songIds) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_ids: songIds })
        });
        if (!response.ok) throw new Error("Error al guardar el nuevo orden");
        console.log("Nuevo orden guardado con éxito.");
    } catch (error) {
        console.error(error);
        alert("No se pudo guardar el nuevo orden.");
    }
}

// --- Eliminar canción de playlist ---
async function removeSongFromPlaylist(playlistId, songId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta canción de la playlist?')) {
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${playlistId}/items`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo eliminar la canción');
        }

        // Recargar la playlist al eliminar
        loadPlaylistDetails(playlistId);

    } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
    }
}

// --- Función Principal de Carga ---
async function loadPlaylistDetails(playlistId) {
    playlistId_global = playlistId; // Guardamos ID para drag&drop
    try {
        const response = await fetch(`/api/playlists/${playlistId}`);
        if (!response.ok) throw new Error('Playlist no encontrada');

        const playlist = await response.json();

        currentPlaylistSongs = playlist.songs;
        renderPlaylistHeader(playlist);
        renderSongList(playlist.songs);

        initSortable(); // Inicializamos el drag&drop

    } catch (error) {
        console.error('Error al cargar los detalles de la playlist:', error);
        document.getElementById('playlist-detail-name').textContent = 'Error al cargar';
    }
}

// --- Función de Inicialización ---
export function init(playlistId) {
    console.log(`Inicializando vista de detalle para playlist ID: ${playlistId}`);

    const playAllButton = document.getElementById('play-all-btn');
    playAllButton.addEventListener('click', () => {
        if (currentPlaylistSongs.length > 0) {
            window.AeryuPlayer.playQueue(currentPlaylistSongs);
        }
    });

    loadPlaylistDetails(playlistId);
}
