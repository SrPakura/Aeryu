// app/static/js/songs.js

// --- 1. Variables Globales ---
// Variables para la sección principal de todas las canciones
let currentPage = 1,
    currentSortBy = 'title',
    currentSortOrder = 'asc',
    currentSearchQuery = '',
    currentViewMode = 'grid',
    currentPlaylists = [],

// Variables para el modal de favoritas
    favoritesModalSearchResults = [],
    favoritesModalSelectedSongs = new Array(5).fill(null),
    contextMenuState = { song: null };

// --- 2. Funciones de Utilidad ---

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// --- 3. Funciones de Renderizado / Display ---

function createSongCard(song) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.songId = song.id;
    card.innerHTML = `
        <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
        <h3>${song.title}</h3>
        <p>${song.artist || 'Artista Desconocido'}</p>
        <div class="play-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
    `;

    // --- CAMBIO CLAVE AQUÍ ---
    // Ahora llamamos a 'playSong' y le pasamos el objeto 'song' completo
    card.addEventListener('click', () => {
        window.AeryuPlayer.playSong(song);
    });
    // -------------------------

// --- NUEVO: Evento para menú contextual (clic derecho) ---
card.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Evita menú por defecto del navegador
    openContextMenu(event, song);
});

    return card;
}

function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.classList.add('card', 'playlist-card');
    card.dataset.playlistId = playlist.id;
    card.innerHTML = `
        <h3>${playlist.name}</h3>
        <div class="card-overlay">
            <button class="overlay-btn edit-btn" title="Editar nombre">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.39.39 0 00-.56 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="overlay-btn play-btn" title="Reproducir">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="overlay-btn delete-btn" title="Eliminar playlist">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
        </div>
    `;

    // --- AÑADIMOS LOS LISTENERS ---
    card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que se active el clic de la tarjeta entera
        window.location.hash = `#playlist/${playlist.id}`;
    });

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        editPlaylistName(playlist.id, playlist.name);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deletePlaylist(playlist.id);
    });

    // El clic en la tarjeta (fuera de los botones) también lleva a la vista de detalle
    card.addEventListener('click', () => {
        window.location.hash = `#playlist/${playlist.id}`;
    });

    return card;
}

function createSongListItem(song) {
    const item = document.createElement('div');
    item.classList.add('song-item');
    item.dataset.songId = song.id;
    item.innerHTML = `
        <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
        <div class="song-info">
            <div class="song-title">${song.title}</div>
            <div class="song-artist">${song.artist || 'Artista Desconocido'}</div>
        </div>
        <div class="song-album">${song.album || 'Álbum Desconocido'}</div>
        <div class="song-year">${song.year || '----'}</div>
        <div class="song-duration">${formatDuration(song.duration_ms)}</div>
    `;
    return item;
}

function displayFavoriteSongs(songs) {
    const grid = document.getElementById('favorite-songs-grid');
    grid.innerHTML = ''; 

    if (songs.length === 0) {
        grid.innerHTML = '<p class="no-songs-message">Aún no tienes canciones favoritas. <br>Haz clic en "Editar canciones favoritas" para añadir.</p>';
        grid.classList.remove('cards-grid'); 
        grid.style.textAlign = 'center'; 
    } else {
        grid.classList.add('cards-grid');
        grid.style.textAlign = 'left';

        const tempSongs = new Array(5).fill(null);
        songs.forEach(song => {
            if (song.position >= 1 && song.position <= 5) {
                tempSongs[song.position - 1] = song;
            }
        });

        tempSongs.forEach((song) => {
            if (song) {
                grid.appendChild(createSongCard(song));
            } else {
                const emptyCard = document.createElement('div');
                emptyCard.classList.add('card', 'empty-favorite');
                emptyCard.innerHTML = `
                    <div class="empty-cover"></div>
                    <h3>Espacio Vacío</h3>
                    <p>--</p>
                `;
                grid.appendChild(emptyCard);
            }
        });
    }
}

// Función para mostrar todas las canciones en la sección
function displayAllSongs(songs) {
    const songsDisplayArea = document.getElementById('songs-display-area');
    songsDisplayArea.innerHTML = ''; 

    if (songs.length === 0) {
        songsDisplayArea.innerHTML = '<p class="no-results">No se encontraron canciones.</p>';
        songsDisplayArea.classList.remove('cards-grid', 'songs-list');
        return;
    }

    songsDisplayArea.classList.toggle('cards-grid', currentViewMode === 'grid');
    songsDisplayArea.classList.toggle('songs-list', currentViewMode === 'list');

    songs.forEach(song => {
        if (currentViewMode === 'grid') {
            songsDisplayArea.appendChild(createSongCard(song));
        } else {
            songsDisplayArea.appendChild(createSongListItem(song));
        }
    });
}

function displayPlaylists(playlists) {
    const grid = document.getElementById('playlists-grid');
    grid.innerHTML = '';

    if (!playlists || playlists.length === 0) {
        grid.innerHTML = '<p class="no-songs-message">Aún no has creado ninguna playlist.</p>';
        return;
    }

    playlists.forEach(playlist => {
        grid.appendChild(createPlaylistCard(playlist));
    });
}

// --- NUEVAS FUNCIONES PARA ESTADÍSTICAS ---
function displayTopSongs(songs) {
    const list = document.getElementById('top-songs-list');
    list.innerHTML = '';
    if (!songs || songs.length === 0) {
        list.innerHTML = '<p class="no-stats-message">Aún no hay datos suficientes.</p>';
        return;
    }

    songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.classList.add('stats-song-item');
        item.innerHTML = `
            <span class="stats-song-rank">${index + 1}</span>
            <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
            <div class="stats-song-info">
                <div class="stats-song-title">${song.title}</div>
                <div class="stats-song-artist">${song.artist || 'Artista Desconocido'}</div>
            </div>
            <span class="stats-song-plays">${song.play_count} plays</span>
        `;
        list.appendChild(item);
    });
}

function displayListeningTime(data) {
    const display = document.getElementById('listening-time-display');
    const label = document.getElementById('listening-time-period-label');
    
    const totalMinutes = Math.floor(data.total_ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    display.textContent = `${hours}h ${minutes}m`;

    const periodMap = { '7d': '7 días', '1m': 'último mes', '6m': 'últimos 6 meses', '12m': 'último año' };
    label.textContent = `en los ${periodMap[data.period]}`;
}

function updatePagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    document.getElementById('current-page-info').textContent = `Página ${page} de ${totalPages || 1}`;
    document.getElementById('prev-page-btn').disabled = page === 1;
    document.getElementById('next-page-btn').disabled = page === totalPages || totalPages === 0;
}

function openContextMenu(event, song) {
    contextMenuState.song = song;
    const menu = document.getElementById('song-context-menu');
    const playlistListDiv = document.getElementById('context-menu-playlist-list');
    
    playlistListDiv.innerHTML = '';

    if (currentPlaylists.length > 0) {
        currentPlaylists.forEach(playlist => {
            const item = document.createElement('div');
            item.textContent = playlist.name;
            item.classList.add('playlist-item-option');
            item.addEventListener('click', () => {
                addSongToPlaylist(song.id, playlist.id);
            });
            playlistListDiv.appendChild(item);
        });
    } else {
        const item = document.createElement('div');
        item.textContent = 'No hay playlists';
        item.style.padding = '10px 15px';
        item.style.fontStyle = 'italic';
        item.style.color = 'var(--text-secondary)';
        playlistListDiv.appendChild(item);
    }
    
    menu.style.top = `${event.pageY}px`;
    menu.style.left = `${event.pageX}px`;
    menu.classList.remove('hidden');
}

function closeContextMenu() {
    const menu = document.getElementById('song-context-menu');
    if (menu) menu.classList.add('hidden');
}

async function addSongToPlaylist(songId, playlistId) {
    closeContextMenu();
    try {
        const response = await fetch(`/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songId })
        });
        if (!response.ok) throw new Error('Error al añadir la canción');
        alert('¡Canción añadida con éxito!');
    } catch (error) {
        console.error('Error al añadir canción a la playlist:', error);
        alert('Hubo un error al añadir la canción.');
    }
}

// --- 4. Funciones de Carga de Datos ---

async function loadFavoriteSongs() {
    const grid = document.getElementById('favorite-songs-grid');
    grid.innerHTML = '<div class="card skeleton"></div>'.repeat(5); 
    
    try {
        const response = await fetch('/api/songs/favorites');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        displayFavoriteSongs(data.favorites);
    } catch (error) {
        console.error('Error al cargar las canciones favoritas:', error);
        grid.innerHTML = '<p class="no-songs-message" style="color:red;">Error al cargar favoritas.</p>';
    }
}

// Función para cargar todas las canciones en la sección principal
async function loadAllSongs() {
    const songsDisplayArea = document.getElementById('songs-display-area');
    songsDisplayArea.innerHTML = '<p class="no-results">Cargando canciones...</p>'; 

    try {
        const response = await fetch(`/api/songs?search=${currentSearchQuery}&sort=${currentSortBy}&order=${currentSortOrder}&page=${currentPage}&page_size=10`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displayAllSongs(data.songs);
        updatePagination(data.total, data.page, data.page_size);
    } catch (error) {
        console.error('Error al cargar las canciones:', error);
        songsDisplayArea.innerHTML = '<p class="no-results" style="color:red;">Error al cargar las canciones. Inténtalo de nuevo.</p>';
    }
}

async function loadPlaylists() {
    const grid = document.getElementById('playlists-grid');
    grid.innerHTML = '<div class="card playlist-card skeleton"></div>'.repeat(5); // Esqueletos de carga

    try {
        const response = await fetch('/api/playlists');
        if (!response.ok) throw new Error('Error al cargar playlists');
        const data = await response.json();

        currentPlaylists = data.playlists; // Guardar playlists en la variable global
        displayPlaylists(data.playlists);  // Mostrar en pantalla

    } catch (error) {
        console.error('Error al cargar playlists:', error);
        grid.innerHTML = '<p class="no-songs-message" style="color: red;">No se pudieron cargar las playlists.</p>';
    }
}

// --- NUEVAS FUNCIONES DE CARGA PARA ESTADÍSTICAS ---
async function loadTopSongs() {
    try {
        const response = await fetch('/api/stats/top-songs');
        if (!response.ok) throw new Error('Error al cargar top songs');
        const data = await response.json();
        displayTopSongs(data.top_songs);
    } catch (error) {
        console.error(error);
        document.getElementById('top-songs-list').innerHTML = '<p class="no-stats-message" style="color: red;">Error.</p>';
    }
}

async function loadListeningTime(period = '7d') {
    try {
        const response = await fetch(`/api/stats/listening-time?period=${period}`);
        if (!response.ok) throw new Error('Error al cargar tiempo de escucha');
        const data = await response.json();
        displayListeningTime(data);
    } catch (error) {
        console.error(error);
        document.getElementById('listening-time-display').textContent = 'Error';
    }
}

// --- NUEVO: Acciones sobre playlists ---
async function editPlaylistName(playlistId, currentName) {
    const newName = prompt("Introduce el nuevo nombre para la playlist:", currentName);

    if (newName && newName.trim() !== "" && newName.trim() !== currentName) {
        try {
            const response = await fetch(`/api/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (!response.ok) throw new Error('Error al actualizar la playlist');
            loadPlaylists(); // Recargamos para ver el cambio
        } catch (error) {
            alert('No se pudo actualizar la playlist.');
            console.error(error);
        }
    }
}

async function deletePlaylist(playlistId) {
    if (confirm("¿Estás seguro de que quieres eliminar esta playlist? Esta acción no se puede deshacer.")) {
        try {
            const response = await fetch(`/api/playlists/${playlistId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar la playlist');
            loadPlaylists(); // Recargamos para ver que ha desaparecido
        } catch (error) {
            alert('No se pudo eliminar la playlist.');
            console.error(error);
        }
    }
}

// --- 5. Funciones de Lógica de UI / Event Handlers (Vista Principal) ---

function handleGlobalSearch(event) {
    currentSearchQuery = event.target.value;
    currentPage = 1; 
    // Si la sección de "Todas las canciones" está visible, se recargan los datos con el nuevo filtro
    if (!document.getElementById('all-songs-list-section').classList.contains('hidden')) {
        loadAllSongs();
    }
}

// Función que ahora TOGGLE la sección de todas las canciones
function toggleAllSongsSection() {
    const allSongsSection = document.getElementById('all-songs-list-section');
    allSongsSection.classList.toggle('hidden');
    const viewAllSongsBtn = document.getElementById('view-all-songs-btn');

    if (!allSongsSection.classList.contains('hidden')) {
        // Sección visible: Cargar canciones y cambiar texto del botón
        loadAllSongs();
        viewAllSongsBtn.textContent = 'Ocultar todas las canciones';
        // Asegurarse de que el input de búsqueda de la sección muestre la búsqueda global
        document.getElementById('songs-list-search-input').value = currentSearchQuery;
    } else {
        // Sección oculta: Restaurar texto del botón
        viewAllSongsBtn.textContent = 'Ver todas las canciones';
        // Reiniciar búsqueda global al ocultar la sección
        currentSearchQuery = ''; 
        document.getElementById('global-song-search-input').value = ''; 
    }
}

// Nuevo: Maneja la búsqueda dentro de la sección "Todas las canciones"
function handleSongsListSearch(event) {
    currentSearchQuery = event.target.value;
    currentPage = 1;
    loadAllSongs();
}

function handleSortChange() {
    currentSortBy = document.getElementById('sort-by').value;
    currentSortOrder = document.getElementById('sort-order').value;
    currentPage = 1;
    loadAllSongs();
}

function setViewMode(mode) {
    currentViewMode = mode;
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');

    gridBtn.classList.toggle('active', mode === 'grid');
    listBtn.classList.toggle('active', mode === 'list');

    loadAllSongs(); 
}

function changePage(direction) {
    currentPage += direction;
    loadAllSongs();
}

// --- 6. Funciones Específicas de Modales (Importación y Edición de Favoritas) ---

function openImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
    document.getElementById('mp3-file-input').value = ''; 
    document.getElementById('confirm-import-btn').disabled = true; 
    document.getElementById('upload-status').textContent = ''; 
}

function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
}

function toggleImportButton() {
    const input = document.getElementById('mp3-file-input');
    const button = document.getElementById('confirm-import-btn');
    button.disabled = !input.files.length; 
}

function openCreatePlaylistModal() {
    document.getElementById('create-playlist-modal').classList.remove('hidden');
    document.getElementById('new-playlist-name-input').value = '';
    document.getElementById('playlist-creation-status').textContent = '';
    document.getElementById('new-playlist-name-input').focus();
}

function closeCreatePlaylistModal() {
    document.getElementById('create-playlist-modal').classList.add('hidden');
}

async function createPlaylist() {
    const nameInput = document.getElementById('new-playlist-name-input');
    const statusDiv = document.getElementById('playlist-creation-status');
    const confirmBtn = document.getElementById('confirm-create-playlist-btn');
    const playlistName = nameInput.value.trim();

    if (!playlistName) {
        statusDiv.textContent = 'El nombre no puede estar vacío.';
        return;
    }

    confirmBtn.disabled = true;
    statusDiv.textContent = 'Creando...';

    try {
        const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: playlistName })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido');
        }

        statusDiv.textContent = '¡Playlist creada con éxito!';
        await loadPlaylists(); // Recargamos playlists
        setTimeout(closeCreatePlaylistModal, 1000); // Cerramos modal tras 1s

    } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
    } finally {
        confirmBtn.disabled = false;
    }
}

async function importSong() {
    const fileInput = document.getElementById('mp3-file-input');
    const uploadStatus = document.getElementById('upload-status');
    const confirmBtn = document.getElementById('confirm-import-btn');

    if (!fileInput.files.length) {
        uploadStatus.textContent = 'Por favor, selecciona un archivo MP3.';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file); 

    uploadStatus.textContent = `Subiendo "${file.name}"...`;
    confirmBtn.disabled = true; 

    try {
        const response = await fetch('/api/songs', {
            method: 'POST',
            body: formData 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al subir: ${response.status}`);
        }

        const newSong = await response.json();
        uploadStatus.textContent = `"${newSong.title}" subida con éxito!`;
        console.log('Canción subida:', newSong);
        
        loadFavoriteSongs(); 
        // Si la sección de todas las canciones está visible, también recargarla
        if (!document.getElementById('all-songs-list-section').classList.contains('hidden')) {
            loadAllSongs();
        }
        setTimeout(closeImportModal, 2000);

    } catch (error) {
        uploadStatus.textContent = `Error al subir la canción: ${error.message}`;
        console.error('Error al importar canción:', error);
        confirmBtn.disabled = false; 
    }
}

// --- Rediseño Modal de Editar Favoritas ---

async function openEditFavoritesModal() {
    document.getElementById('edit-favorites-modal').classList.remove('hidden');
    
    // Resetear a null y limpiar interfaz
    favoritesModalSelectedSongs = new Array(5).fill(null); 
    document.getElementById('favorites-search-input').value = '';
    document.getElementById('favorites-search-results').innerHTML = '<p class="no-results">Busca una canción para añadir...</p>';
    favoritesModalSearchResults = [];

    try {
        const favoritesResponse = await fetch('/api/songs/favorites');
        if (!favoritesResponse.ok) throw new Error('Failed to load current favorites.');
        const favoritesData = await favoritesResponse.json();
        favoritesData.favorites.forEach(fav => {
            if (fav.position >= 1 && fav.position <= 5) {
                favoritesModalSelectedSongs[fav.position - 1] = { 
                    id: fav.id, 
                    title: fav.title, 
                    artist: fav.artist, 
                    cover_path: fav.cover_path 
                };
            }
        });
        renderFavoritesModalSlots();

    } catch (error) {
        console.error('Error al abrir el modal de editar favoritas:', error);
        document.getElementById('current-favorites-editor').innerHTML = '<p class="no-results" style="color:red;">Error al cargar favoritas.</p>';
    }
}

function closeEditFavoritesModal() {
    document.getElementById('edit-favorites-modal').classList.add('hidden');
}

function renderFavoritesModalSlots() {
    const container = document.getElementById('current-favorites-editor');
    container.innerHTML = ''; 

    favoritesModalSelectedSongs.forEach((song, index) => {
        const slotDiv = document.createElement('div');
        slotDiv.classList.add('favorite-slot');
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
                <button class="remove-favorite-btn" aria-label="Quitar de favoritas">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            `;
            slotDiv.querySelector('.remove-favorite-btn').addEventListener('click', () => removeSongFromFavoritesModal(index));
        }
        container.appendChild(slotDiv);
    });
}

async function searchSongsForFavoritesModal(query) {
    const resultsContainer = document.getElementById('favorites-search-results');
    if (!query.trim()) {
        resultsContainer.innerHTML = '<p class="no-results">Busca una canción para añadir...</p>';
        favoritesModalSearchResults = [];
        return;
    }

    resultsContainer.innerHTML = '<p class="no-results">Buscando...</p>';

    try {
        const response = await fetch(`/api/songs?search=${query}&page_size=20`); 
        if (!response.ok) throw new Error('Failed to search songs for favorites.');
        const data = await response.json();
        favoritesModalSearchResults = data.songs;
        renderFavoritesSearchResults(data.songs);
    } catch (error) {
        console.error('Error searching songs for favorites:', error);
        resultsContainer.innerHTML = '<p class="no-results" style="color:red;">Error al buscar canciones.</p>';
    }
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
        resultItem.classList.add('search-result-item');
        resultItem.dataset.songId = song.id;
        resultItem.innerHTML = `
            <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
            <div class="info">
                <div class="title">${song.title}</div>
                <div class="artist">${song.artist || 'Artista Desconocido'}</div>
            </div>
            <button class="add-favorite-btn" aria-label="Añadir a favoritas">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
        `;
        resultItem.querySelector('.add-favorite-btn').addEventListener('click', () => addSongToFavoritesModal(song));
        container.appendChild(resultItem);
    });
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
        const slotToReplace = prompt(`Las 5 favoritas están llenas. ¿Qué posición (1-5) quieres reemplazar?
        (Escribe el número de posición para reemplazar, o "cancelar" para no añadirla)`);
        const index = parseInt(slotToReplace) - 1;
        if (!isNaN(index) && index >= 0 && index < 5) {
            if (favoritesModalSelectedSongs[index]) {
                if (confirm(`¿Estás seguro de que quieres reemplazar "${favoritesModalSelectedSongs[index].title}" por "${songToAdd.title}"?`)) {
                    favoritesModalSelectedSongs[index] = songToAdd;
                    renderFavoritesModalSlots();
                }
            } else { 
                favoritesModalSelectedSongs[index] = songToAdd;
                renderFavoritesModalSlots();
            }
        } else if (slotToReplace && slotToReplace.toLowerCase() !== 'cancelar') {
            alert('Posición inválida. Por favor, ingresa un número del 1 al 5.');
        }
    }
}

function removeSongFromFavoritesModal(index) {
    favoritesModalSelectedSongs[index] = null;
    renderFavoritesModalSlots();
}

async function saveFavorites() {
    const newFavorites = [];

    favoritesModalSelectedSongs.forEach((song, index) => {
        if (song) {
            newFavorites.push({ song_id: song.id, position: index + 1 });
        }
    });
    
    try {
        const response = await fetch('/api/songs/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorites: newFavorites })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al guardar favoritas: ${response.status}`);
        }

        alert('Favoritas guardadas con éxito!');
        closeEditFavoritesModal();
        loadFavoriteSongs(); 
    } catch (error) {
        console.error('Error al guardar favoritas:', error);
        alert(`Error: ${error.message}`);
    }
}

// --- 7. Funciones Principales de Inicialización ---

function setupMainViewListeners() {
    // Búsqueda global y botones principales
    document.getElementById('global-song-search-input').addEventListener('input', debounce(handleGlobalSearch, 300));
    document.getElementById('import-songs-btn').addEventListener('click', openImportModal);
    document.getElementById('view-all-songs-btn').addEventListener('click', toggleAllSongsSection);
    document.getElementById('edit-favorites-btn').addEventListener('click', openEditFavoritesModal);

    // Controles de la lista de canciones
    document.getElementById('songs-list-search-input').addEventListener('input', debounce(handleSongsListSearch, 300));
    document.getElementById('sort-by').addEventListener('change', handleSortChange);
    document.getElementById('sort-order').addEventListener('change', handleSortChange);
    document.getElementById('view-grid-btn').addEventListener('click', () => setViewMode('grid'));
    document.getElementById('view-list-btn').addEventListener('click', () => setViewMode('list'));
    document.getElementById('prev-page-btn').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page-btn').addEventListener('click', () => changePage(1));

    // Listener global para cerrar el menú contextual
    window.addEventListener('click', () => closeContextMenu());
}

function setupModalListeners() {
    // Modal de importación
    document.querySelector('#import-modal .close-button').addEventListener('click', closeImportModal);
    document.getElementById('mp3-file-input').addEventListener('change', toggleImportButton);
    document.getElementById('confirm-import-btn').addEventListener('click', importSong);
    
    // Modal de editar favoritas
    document.querySelector('#edit-favorites-modal .close-button').addEventListener('click', closeEditFavoritesModal);
    document.getElementById('cancel-favorites-btn').addEventListener('click', closeEditFavoritesModal); 
    document.getElementById('save-favorites-btn').addEventListener('click', saveFavorites);
    document.getElementById('favorites-search-input').addEventListener('input', debounce((event) => searchSongsForFavoritesModal(event.target.value), 300));
    
    // Modal de crear playlist
    document.getElementById('add-playlist-btn').addEventListener('click', openCreatePlaylistModal);
    document.getElementById('close-playlist-modal-btn').addEventListener('click', closeCreatePlaylistModal);
    document.getElementById('confirm-create-playlist-btn').addEventListener('click', createPlaylist);
}

function setupStatsListeners() {
    // Listeners para los botones de período de estadísticas
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadListeningTime(button.dataset.period);
        });
    });
}

export function init() {
    console.log('Songs view initialized!');
    
    // Configuración de listeners divididos
    setupMainViewListeners();
    setupModalListeners();
    setupStatsListeners();
    
    // Carga inicial de datos
    loadFavoriteSongs(); 
    loadPlaylists();
    loadTopSongs();
    loadListeningTime('7d');
    
    // Ocultar sección de todas las canciones por defecto
    const allSongsSection = document.getElementById('all-songs-list-section');
    if (!allSongsSection.classList.contains('hidden')) {
        allSongsSection.classList.add('hidden');
    }
    document.getElementById('view-all-songs-btn').textContent = 'Ver todas las canciones';
}

// --- NUEVO: Listener global para cerrar el menú contextual ---
window.addEventListener('click', (event) => {
    const menu = document.getElementById('song-context-menu');
    if (menu && !menu.contains(event.target)) {
        closeContextMenu();
    }
});
