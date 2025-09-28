// app/static/js/songs/main.js

// --- 1. IMPORTACIONES ---
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import * as modals from './modals.js';

// --- 2. ESTADO DEL MÓDULO ---
let state = {
    currentPage: 1,
    currentSortBy: 'title',
    currentSortOrder: 'asc',
    currentSearchQuery: '',
    currentViewMode: 'grid',
    currentPlaylists: [],
    contextMenuSong: null,
    activePlaylistMode: 'none',
    activeSongMode: 'none' // NUEVO: 'none' o 'delete' para controlar el modo borrado
};

// --- 3. FUNCIONES DE COORDINACIÓN ---
// Maneja el borrado de canciones (confirmación + llamada a la API + refresco de vistas)
async function handleDeleteSong(songId) {
    const songToDelete = await api.getSong(songId);
    if (!songToDelete) return;

    if (confirm(`¿Estás seguro de que quieres eliminar "${songToDelete.title}"?\n\nEsta acción no se puede deshacer y borrará el archivo permanentemente.`)) {
        const success = await api.deleteSong(songId);
        if (success) {
            refreshAllSongs();
            refreshFavoriteSongs();
            refreshStats();
        } else {
            alert("Hubo un error al eliminar la canción.");
        }
    }
}

// Centralizamos la asignación de listeners para canciones (favoritas y todas)
async function addSongEventListeners(songElements) {
    songElements.forEach(({ element, song }) => {
        // Click normal -> reproducir o borrar, según el modo
        element.addEventListener('click', (e) => {
            if (state.activeSongMode === 'delete') {
                e.stopPropagation();
                handleDeleteSong(song.id);
            } else if (!e.target.closest('.edit-song-btn')) {
                window.AeryuPlayer.playSong(song);
            }
        });

        // Menú contextual (clic derecho)
        element.addEventListener('contextmenu', (e) => handleContextMenu(e, song));

        // Botón de editar metadatos
        const editBtn = element.querySelector('.edit-song-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modals.openEditSongModal(song.id);
            });
        }
    });
}

// Refresca las canciones favoritas
async function refreshFavoriteSongs() {
    const data = await api.loadFavoriteSongs();
    if (data) {
        const favoriteCards = ui.displayFavoriteSongs(data.favorites);
        addSongEventListeners(favoriteCards);
    }
}

// Refresca las playlists y sus modos (editar / borrar)
async function refreshPlaylists() {
    const data = await api.loadPlaylists();
    if (data) {
        state.currentPlaylists = data.playlists;
        const playlistCards = ui.displayPlaylists(data.playlists);
        
        playlistCards.forEach(({ element, playlist }) => {
            const coverImg = element.querySelector('.playlist-cover');
            
            element.addEventListener('click', async () => {
                switch (state.activePlaylistMode) {
                    case 'edit':
                        modals.openEditPlaylistModal(playlist);
                        break;
                    case 'delete':
                        handleDeletePlaylist(playlist.id);
                        break;
                    default:
                        window.location.hash = `#playlist/${playlist.id}`;
                        break;
                }
            });

            // Reproducir playlist directamente desde la portada
            coverImg.addEventListener('click', async (event) => {
                if (state.activePlaylistMode === 'none') {
                    event.stopPropagation();
                    const playlistWithSongs = await api.getPlaylist(playlist.id);
                    if (playlistWithSongs && playlistWithSongs.songs.length > 0) {
                        window.AeryuPlayer.playQueue(playlistWithSongs.songs);
                    }
                }
            });
        });
    }
}

// Refresca la lista completa de canciones
async function refreshAllSongs() {
    const displayArea = document.getElementById('songs-display-area');
    if (displayArea) displayArea.innerHTML = '<p class="no-results">Cargando canciones...</p>';

    const data = await api.loadSongs(
        state.currentSearchQuery,
        state.currentSortBy,
        state.currentSortOrder,
        state.currentPage,
        22
    );

    if (data) {
        const songElements = ui.displayAllSongs(data.songs, state.currentViewMode);
        addSongEventListeners(songElements);
        ui.updatePagination(data.total, data.page, data.page_size);
    }
}

// Refresca estadísticas de canciones y tiempo de escucha
async function refreshStats() {
    const topSongsData = await api.loadTopSongs();
    if (topSongsData) ui.displayTopSongs(topSongsData.top_songs);
    refreshListeningTime('7d'); // por defecto arranca en 7 días
}

// --- 4. MANEJADORES DE EVENTOS (Handlers) ---
function handleContextMenu(event, song) {
    event.preventDefault();
    state.contextMenuSong = song;
    ui.openContextMenu(event, state.currentPlaylists);
}

async function refreshListeningTime(period = '7d') {
    const data = await api.loadListeningTime(period);
    if (data) {
        ui.displayListeningTimeChart(data, period);
    }
}

async function handleEditPlaylist(playlistId, currentName) {
    const newName = prompt("Introduce el nuevo nombre para la playlist:", currentName);
    if (newName && newName.trim() !== "" && newName.trim() !== currentName) {
        const success = await api.editPlaylistName(playlistId, newName);
        if (success) refreshPlaylists();
    }
}

async function handleDeletePlaylist(playlistId) {
    const success = await api.deletePlaylist(playlistId);
    if (success) refreshPlaylists();
}

function handleViewModeChange(mode) {
    state.currentViewMode = mode;
    document.getElementById('view-grid-btn').classList.toggle('active', mode === 'grid');
    document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
    refreshAllSongs();
}

// --- 5. LISTENERS EXTRA (Stats) ---
function setupStatsListeners() {
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', () => {
            periodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            refreshListeningTime(button.dataset.period);
        });
    });
}

// --- 6. INICIALIZACIÓN ---
export function init() {
    ui.toggleAllSongsSection(false);
    modals.setupModalListeners(refreshFavoriteSongs, refreshPlaylists, refreshAllSongs);

    // Botones de playlists (editar / borrar)
    const playlistSection = document.getElementById('playlist-section');
    const editPlaylistBtn = document.getElementById('edit-playlist-btn');
    const deletePlaylistBtn = document.getElementById('delete-playlist-btn');

    editPlaylistBtn.addEventListener('click', () => {
        const isAlreadyActive = state.activePlaylistMode === 'edit';
        state.activePlaylistMode = isAlreadyActive ? 'none' : 'edit';
        
        playlistSection.classList.toggle('edit-mode-active', !isAlreadyActive);
        playlistSection.classList.remove('delete-mode-active');
        
        editPlaylistBtn.classList.toggle('active', !isAlreadyActive);
        deletePlaylistBtn.classList.remove('active');
    });

    deletePlaylistBtn.addEventListener('click', () => {
        const isAlreadyActive = state.activePlaylistMode === 'delete';
        state.activePlaylistMode = isAlreadyActive ? 'none' : 'delete';

        playlistSection.classList.toggle('delete-mode-active', !isAlreadyActive);
        playlistSection.classList.remove('edit-mode-active');
        
        deletePlaylistBtn.classList.toggle('active', !isAlreadyActive);
        editPlaylistBtn.classList.remove('active');
    });

    // Botón de modo borrado de canciones
    const deleteModeBtn = document.getElementById('delete-song-mode-btn');
    const allSongsSection = document.getElementById('all-songs-list-section');
    
    deleteModeBtn.addEventListener('click', () => {
        const isAlreadyActive = state.activeSongMode === 'delete';
        state.activeSongMode = isAlreadyActive ? 'none' : 'delete';

        deleteModeBtn.classList.toggle('active', !isAlreadyActive);
        allSongsSection.classList.toggle('delete-mode-active', !isAlreadyActive);
    });

    // Listeners de la vista principal (buscador, orden, paginación, vista)
    document.getElementById('view-all-songs-btn').addEventListener('click', () => {
        const isHidden = document.getElementById('all-songs-list-section').classList.contains('hidden');
        ui.toggleAllSongsSection(isHidden);
        if (isHidden) refreshAllSongs();
    });

    document.getElementById('songs-list-search-input').addEventListener(
        'input',
        utils.debounce((event) => {
            state.currentSearchQuery = event.target.value;
            state.currentPage = 1;
            refreshAllSongs();
        }, 300)
    );
    
    document.getElementById('sort-by').addEventListener('change', (e) => { state.currentSortBy = e.target.value; refreshAllSongs(); });
    document.getElementById('sort-order').addEventListener('change', (e) => { state.currentSortOrder = e.target.value; refreshAllSongs(); });
    document.getElementById('prev-page-btn').addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage--; refreshAllSongs(); } });
    document.getElementById('next-page-btn').addEventListener('click', () => { state.currentPage++; refreshAllSongs(); });
    document.getElementById('view-grid-btn').addEventListener('click', () => handleViewModeChange('grid'));
    document.getElementById('view-list-btn').addEventListener('click', () => handleViewModeChange('list'));
    
    // Listener del menú contextual de playlists
    document.getElementById('context-menu-playlist-list').addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('playlist-item-option')) {
            const playlistId = target.dataset.playlistId;
            if (state.contextMenuSong && playlistId) {
                api.addSongToPlaylist(state.contextMenuSong.id, playlistId);
            }
        }
        ui.closeContextMenu();
    });
    
    window.addEventListener('click', (event) => {
        if (!event.target.closest('.context-menu, .card')) {
            ui.closeContextMenu();
        }
    });

    setupStatsListeners();

    // Carga inicial de datos
    refreshFavoriteSongs(); 
    refreshPlaylists();
    refreshStats();
}
