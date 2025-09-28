// app/static/js/songs/modals.js
import * as api from './api.js';
import { debounce } from './utils.js';

// ========================================================================
// ESTADO Y LÓGICA DEL MODAL DE EDITAR FAVORITAS
// ========================================================================
let favoritesModalSelectedSongs = new Array(5).fill(null);

function renderFavoritesModalSlots() {
    const container = document.getElementById('current-favorites-editor');
    container.innerHTML = '';
    favoritesModalSelectedSongs.forEach((song, index) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'favorite-slot';
        if (!song) {
            slotDiv.classList.add('empty');
            slotDiv.innerHTML = `<div class="info">Posición ${index + 1}: Vacía</div>`;
        } else {
            slotDiv.dataset.songId = song.id;
            slotDiv.innerHTML = `
                <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
                <div class="info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist || 'Artista Desconocido'}</div>
                </div>
                <button class="remove-favorite-btn" data-index="${index}" aria-label="Quitar de favoritas">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            `;
        }
        container.appendChild(slotDiv);
    });
}

function renderFavoritesSearchResults(songs) {
    const container = document.getElementById('favorites-search-results');
    container.innerHTML = '';
    if (songs.length === 0) {
        container.innerHTML = '<p class="no-results">No se encontraron canciones.</p>';
        return;
    }
    songs.forEach(song => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
            <div class="info">
                <div class="title">${song.title}</div>
                <div class="artist">${song.artist || 'Artista Desconocido'}</div>
            </div>
            <button class="add-favorite-btn" aria-label="Añadir a favoritas">+</button>
        `;
        resultItem.querySelector('.add-favorite-btn').addEventListener('click', () => addSongToFavoritesModal(song));
        container.appendChild(resultItem);
    });
}

async function handleFavoriteSearch(query) {
    const resultsContainer = document.getElementById('favorites-search-results');
    if (!query.trim()) {
        resultsContainer.innerHTML = '<p class="no-results">Busca una canción para añadir...</p>';
        return;
    }
    resultsContainer.innerHTML = '<p class="no-results">Buscando...</p>';
    const data = await api.loadSongs(query, 'title', 'asc', 1);
    if (data) renderFavoritesSearchResults(data.songs);
}

function addSongToFavoritesModal(songToAdd) {
    if (favoritesModalSelectedSongs.some(fav => fav && fav.id === songToAdd.id)) {
        alert('¡Esta canción ya está en tus favoritas!');
        return;
    }
    const emptyIndex = favoritesModalSelectedSongs.findIndex(slot => slot === null);
    if (emptyIndex !== -1) {
        favoritesModalSelectedSongs[emptyIndex] = songToAdd;
        renderFavoritesModalSlots();
    } else {
        alert('Las 5 favoritas están llenas. Quita una antes de añadir otra.');
    }
}

function removeSongFromFavoritesModal(index) {
    favoritesModalSelectedSongs[index] = null;
    renderFavoritesModalSlots();
}

// ========================================================================
// LÓGICA DEL MODAL DE EDICIÓN DE CANCIÓN
// ========================================================================

async function handleEditFormSubmit(event, refreshSongsCallback) {
    event.preventDefault();
    const form = event.target;
    const songId = form.querySelector('#edit-song-id').value;
    const saveBtn = form.querySelector('button[type="submit"]');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const formData = new FormData(form);

    try {
        const success = await api.updateSong(songId, formData);
        if (success) {
            closeEditSongModal();
            refreshSongsCallback();
        } else {
            alert('Error: No se pudieron guardar los cambios.');
        }
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        alert('Error: Hubo un problema al conectar con el servidor.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
}

export async function openEditSongModal(songId) {
    const modal = document.getElementById('edit-song-modal');
    const form = document.getElementById('edit-song-form');

    const song = await api.getSong(songId);
    if (song) {
        form.querySelector('#edit-song-id').value = song.id;
        form.querySelector('#edit-title').value = song.title || '';
        form.querySelector('#edit-artist').value = song.artist || '';
        form.querySelector('#edit-album').value = song.album || '';
        form.querySelector('#edit-year').value = song.year || '';
        form.querySelector('#edit-cover-preview').src = song.cover_path ? `/${song.cover_path}` : '/static/covers/default_cover.png';
        modal.classList.remove('hidden');
    } else {
        alert('Error: No se pudo encontrar la canción.');
    }
}

function closeEditSongModal() {
    document.getElementById('edit-song-modal').classList.add('hidden');
}

// ✅ AÑADE ESTA NUEVA FUNCIÓN COMPLETA AQUÍ
export async function openEditPlaylistModal(playlist) {
    const modal = document.getElementById('edit-playlist-modal');
    const form = document.getElementById('edit-playlist-form');
    const grid = document.getElementById('edit-playlist-cover-selection-grid');
    const hiddenCoverIdInput = document.getElementById('edit-playlist-cover-id');

    // Rellenar el formulario con los datos actuales de la playlist
    form.reset();
    hiddenCoverIdInput.value = playlist.cover_id || '';
    form.querySelector('#edit-playlist-id').value = playlist.id;
    form.querySelector('#edit-playlist-name-input').value = playlist.name;
    
    modal.classList.remove('hidden');
    
    // Cargar todas las portadas disponibles
    grid.innerHTML = '<p>Cargando portadas...</p>';
    const songsData = await api.loadSongs('', 'title', 'asc', 1, 500);
    if (!songsData || !songsData.songs) {
        grid.innerHTML = '<p>No se pudieron cargar las portadas.</p>';
        return;
    }

    grid.innerHTML = '';
    const uniqueCovers = new Map();
    songsData.songs.forEach(song => {
        if (song.cover_id && !uniqueCovers.has(song.cover_id)) {
            uniqueCovers.set(song.cover_id, song.cover_path);
        }
    });

    uniqueCovers.forEach((path, id) => {
        const img = document.createElement('img');
        img.src = `/${path}`;
        img.className = 'cover-selection-item';
        img.dataset.coverId = id;

        // Si esta es la portada actual de la playlist, la pre-seleccionamos
        if (id === playlist.cover_id) {
            img.classList.add('selected');
        }

        img.addEventListener('click', () => {
            const currentlySelected = grid.querySelector('.selected');
            if (currentlySelected) {
                currentlySelected.classList.remove('selected');
            }
            img.classList.add('selected');
            hiddenCoverIdInput.value = img.dataset.coverId;
        });
        grid.appendChild(img);
    });
}


// ========================================================================
// LÓGICA DEL MODAL DE IMPORTACIÓN
// ========================================================================

async function handleImport(refreshFavorites, refreshAllSongs) {
    const fileInput = document.getElementById('mp3-file-input');
    const queueContainer = document.getElementById('upload-queue-container');
    const confirmBtn = document.getElementById('confirm-import-btn');

    const files = fileInput.files;
    if (files.length === 0) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Subiendo...';
    queueContainer.innerHTML = '';

    Array.from(files).forEach(file => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.id = `queue-item-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
        item.innerHTML = `<span>${file.name}</span><span class="queue-item-status status-pending">Pendiente...</span>`;
        queueContainer.appendChild(item);
    });

    const result = await api.importSong(files);

    if (result) {
        result.imported_songs.forEach(song => {
            const itemId = `queue-item-${song.original_filename.replace(/[^a-zA-Z0-9]/g, '')}`;
            const item = document.getElementById(itemId);
            if (item && !item.querySelector('.status-error')) {
                item.querySelector('.queue-item-status').textContent = 'Éxito ✔';
                item.querySelector('.queue-item-status').className = 'queue-item-status status-success';
            }
        });
        result.errors.forEach(error => {
            const itemId = `queue-item-${error.filename.replace(/[^a-zA-Z0-9]/g, '')}`;
            const item = document.getElementById(itemId);
            if (item) {
                item.querySelector('.queue-item-status').textContent = `Error: ${error.error}`;
                item.querySelector('.queue-item-status').className = 'queue-item-status status-error';
            }
        });
    }

    refreshFavorites();
    if (!document.getElementById('all-songs-list-section').classList.contains('hidden')) {
        refreshAllSongs();
    }

    confirmBtn.textContent = 'Subir más';
    confirmBtn.disabled = false;
    fileInput.value = '';
}

// ========================================================================
// LÓGICA DEL MODAL DE CREAR PLAYLIST
// ========================================================================

async function openCreatePlaylistModal() {
    const modal = document.getElementById('create-playlist-modal');
    const form = document.getElementById('create-playlist-form');
    const grid = document.getElementById('playlist-cover-selection-grid');
    const hiddenCoverIdInput = document.getElementById('new-playlist-cover-id');

    form.reset();
    hiddenCoverIdInput.value = '';
    grid.innerHTML = '<p>Cargando portadas...</p>';
    modal.classList.remove('hidden');
    document.getElementById('new-playlist-name-input').focus();

    const songsData = await api.loadSongs('', 'title', 'asc', 1, 500);
    if (!songsData || !songsData.songs) {
        grid.innerHTML = '<p>No se pudieron cargar las portadas.</p>';
        return;
    }

    grid.innerHTML = '';
    const uniqueCovers = new Map();
    songsData.songs.forEach(song => {
        if (song.cover_id && !uniqueCovers.has(song.cover_id)) {
            uniqueCovers.set(song.cover_id, song.cover_path);
        }
    });

    uniqueCovers.forEach((path, id) => {
        const img = document.createElement('img');
        img.src = `/${path}`;
        img.className = 'cover-selection-item';
        img.dataset.coverId = id;

        img.addEventListener('click', () => {
            const currentlySelected = grid.querySelector('.selected');
            if (currentlySelected) {
                currentlySelected.classList.remove('selected');
            }
            img.classList.add('selected');
            hiddenCoverIdInput.value = img.dataset.coverId;
        });
        grid.appendChild(img);
    });
}

function closeCreatePlaylistModal() {
    document.getElementById('create-playlist-modal').classList.add('hidden');
}


// ========================================================================
// FUNCIÓN PRINCIPAL QUE CONECTA TODOS LOS LISTENERS
// ========================================================================
export function setupModalListeners(refreshFavorites, refreshPlaylists, refreshAllSongs) {
    
    // --- Cierre genérico de modales ---
    document.querySelectorAll('[data-close-modal]').forEach(element => {
        element.addEventListener('click', () => {
            const modalId = element.dataset.closeModal;
            if (document.getElementById(modalId)) {
                document.getElementById(modalId).classList.add('hidden');
            }
        });
    });

    // --- Modal de Editar Canción ---
    const editForm = document.getElementById('edit-song-form');
    if (editForm) {
        editForm.addEventListener('submit', (event) => handleEditFormSubmit(event, refreshAllSongs));
    }

    // --- Modal de Importación ---
    const importBtn = document.getElementById('import-songs-btn');
    if (importBtn) importBtn.addEventListener('click', () => document.getElementById('import-modal').classList.remove('hidden'));
    
    const confirmImportBtn = document.getElementById('confirm-import-btn');
    if (confirmImportBtn) confirmImportBtn.addEventListener('click', () => handleImport(refreshFavorites, refreshAllSongs));

    const mp3FileInput = document.getElementById('mp3-file-input');
    if (mp3FileInput) mp3FileInput.addEventListener('change', () => {
        confirmImportBtn.disabled = mp3FileInput.files.length === 0;
    });

    // --- Modal de Crear Playlist ---
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    if (addPlaylistBtn) addPlaylistBtn.addEventListener('click', openCreatePlaylistModal);

    const createPlaylistForm = document.getElementById('create-playlist-form');
    if (createPlaylistForm) {
        createPlaylistForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const statusDiv = document.getElementById('playlist-creation-status');
            const confirmBtn = document.getElementById('confirm-create-playlist-btn');
            confirmBtn.disabled = true;
            statusDiv.textContent = 'Creando...';
            const formData = new FormData(createPlaylistForm);
            const newPlaylist = await api.createPlaylist(formData);
            if (newPlaylist) {
                statusDiv.textContent = '¡Playlist creada!';
                closeCreatePlaylistModal();
                refreshPlaylists();
            } else {
                statusDiv.textContent = 'Error al crear la playlist.';
            }
            confirmBtn.disabled = false;
        });
    }

    // --- ✅ Modal de Editar Playlist ---
    const editPlaylistForm = document.getElementById('edit-playlist-form');
    if (editPlaylistForm) {
        editPlaylistForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const playlistId = editPlaylistForm.querySelector('#edit-playlist-id').value;
            const formData = new FormData(editPlaylistForm);
            
            const success = await api.updatePlaylist(playlistId, formData);
            if (success) {
                document.getElementById('edit-playlist-modal').classList.add('hidden');
                refreshPlaylists();
            } else {
                alert('Error al actualizar la playlist.');
            }
        });
    }

    // --- Modal de Editar Favoritas ---
    const editFavsBtn = document.getElementById('edit-favorites-btn');
    if (editFavsBtn) editFavsBtn.addEventListener('click', async () => {
        document.getElementById('edit-favorites-modal').classList.remove('hidden');
        document.getElementById('favorites-search-input').value = '';
        document.getElementById('favorites-search-results').innerHTML = '<p class="no-results">Busca una canción para añadir...</p>';
        const data = await api.loadFavoriteSongs();
        favoritesModalSelectedSongs.fill(null);
        if (data) {
            data.favorites.forEach(fav => {
                if (fav.position >= 1 && fav.position <= 5) {
                    favoritesModalSelectedSongs[fav.position - 1] = fav;
                }
            });
        }
        renderFavoritesModalSlots();
    });
    
    const favsSearchInput = document.getElementById('favorites-search-input');
    if (favsSearchInput) favsSearchInput.addEventListener('input', debounce((e) => handleFavoriteSearch(e.target.value), 300));
    
    const currentFavsEditor = document.getElementById('current-favorites-editor');
    if (currentFavsEditor) currentFavsEditor.addEventListener('click', (e) => {
        if (e.target.closest('.remove-favorite-btn')) {
            removeSongFromFavoritesModal(e.target.closest('.remove-favorite-btn').dataset.index);
        }
    });

    const saveFavsBtn = document.getElementById('save-favorites-btn');
    if (saveFavsBtn) saveFavsBtn.addEventListener('click', async () => {
        const newFavorites = [];
        favoritesModalSelectedSongs.forEach((song, index) => {
            if (song) newFavorites.push({ song_id: song.id, position: index + 1 });
        });
        const success = await api.saveFavorites(newFavorites);
        if (success) {
            alert('¡Favoritas guardadas!');
            document.getElementById('edit-favorites-modal').classList.add('hidden');
            refreshFavorites();
        }
    });
}
