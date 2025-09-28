// app/static/js/songs/api.js

export async function loadSongs(search, sortBy, order, page, pageSize = 22) {
    try {
        const response = await fetch(
            `/api/songs?search=${encodeURIComponent(search)}&sort=${sortBy}&order=${order}&page=${page}&page_size=${pageSize}`
        );
        if (!response.ok) throw new Error('Error al cargar las canciones');
        return await response.json();
    } catch (error) {
        console.error('API Error (loadSongs):', error);
        return null;
    }
}


export async function loadFavoriteSongs() {
    try {
        const response = await fetch('/api/songs/favorites');
        if (!response.ok) throw new Error('Error al cargar favoritas');
        return await response.json();
    } catch (error) {
        console.error('API Error (loadFavoriteSongs):', error);
        return null;
    }
}

export async function loadPlaylists() {
    try {
        const response = await fetch('/api/playlists');
        if (!response.ok) throw new Error('Error al cargar playlists');
        return await response.json();
    } catch (error) {
        console.error('API Error (loadPlaylists):', error);
        return null;
    }
}

export async function loadTopSongs() {
    try {
        const response = await fetch('/api/stats/top-songs');
        if (!response.ok) throw new Error('Error al cargar top songs');
        return await response.json();
    } catch (error) {
        console.error('API Error (loadTopSongs):', error);
        return null;
    }
}

export async function loadListeningTime(period = '7d') {
    try {
        const response = await fetch(`/api/stats/listening-time?period=${period}`);
        if (!response.ok) throw new Error('Error al cargar tiempo de escucha');
        return await response.json();
    } catch (error) {
        console.error('API Error (loadListeningTime):', error);
        return null;
    }
}

export async function addSongToPlaylist(songId, playlistId) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songId })
        });
        return response.ok;
    } catch (error) {
        console.error('API Error (addSongToPlaylist):', error);
        return false;
    }
}

export async function editPlaylistName(playlistId, newName) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        return response.ok;
    } catch (error) {
        console.error('API Error (editPlaylistName):', error);
        return false;
    }
}

export async function deletePlaylist(playlistId) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta playlist? Esta acción no se puede deshacer.")) {
        return false;
    }
    try {
        const response = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
        return response.ok;
    } catch (error) {
        console.error('API Error (deletePlaylist):', error);
        return false;
    }
}

export async function createPlaylist(formData) { // Ahora recibe formData
    try {
        const response = await fetch('/api/playlists', {
            method: 'POST',
            body: formData // Enviamos el FormData directamente
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error (createPlaylist):', error);
        return null;
    }
}

export async function saveFavorites(favorites) {
    try {
        const response = await fetch('/api/songs/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites: favorites })
        });
        return response.ok;
    } catch (error) {
        console.error('API Error (saveFavorites):', error);
        return false;
    }
}

export async function importSong(files) { // El argumento ahora es "files" (plural)
    const formData = new FormData();
    
    // --- INICIO DEL CAMBIO CLAVE ---
    // En lugar de enviar la lista entera, recorremos la lista
    // y añadimos cada archivo individualmente con la misma clave "file".
    for (const file of files) {
        formData.append('file', file);
    }
    // --- FIN DEL CAMBIO CLAVE ---

    try {
        const response = await fetch('/api/songs/', { // <-- ¡LA BARRA MÁGICA!
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al subir');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error (importSong):', error);
        // Devolvemos un objeto con formato de error para que el modal lo pueda procesar
        return { imported_songs: [], errors: [{ filename: 'General', error: error.message }] };
    }
}

export async function getSong(songId) {
    try {
        const response = await fetch(`/api/songs/${songId}`);
        if (!response.ok) throw new Error('Canción no encontrada');
        return await response.json();
    } catch (error) {
        console.error('API Error (getSong):', error);
        return null;
    }
}

export async function updateSong(songId, formData) {
    try {
        const response = await fetch(`/api/songs/${songId}`, {
            method: 'PUT',
            body: formData // Al usar FormData, el navegador pone el Content-Type correcto solo
        });
        return response.ok;
    } catch (error) {
        console.error('API Error (updateSong):', error);
        return false;
    }
}

export async function updatePlaylist(playlistId, formData) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}`, {
            method: 'PUT',
            body: formData
        });
        return response.ok;
    } catch (error) {
        console.error('API Error (updatePlaylist):', error);
        return false;
    }
}

export async function getPlaylist(playlistId) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}`);
        if (!response.ok) throw new Error('Playlist no encontrada');
        return await response.json();
    } catch (error) {
        console.error('API Error (getPlaylist):', error);
        return null;
    }
}

export async function deleteSong(songId) {
    try {
        const response = await fetch(`/api/songs/${songId}`, {
            method: 'DELETE'
        });
        return response.ok; // Devuelve true si el borrado fue exitoso (código 200)
    } catch (error) {
        console.error('API Error (deleteSong):', error);
        return false;
    }
}
