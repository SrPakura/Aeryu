// app/static/js/songs/ui.js
import { formatDuration, formatTotalTime, formatChartTooltip } from './utils.js';

// Guardamos la instancia del gráfico de Chart.js
let listeningTimeChart = null;

// --- Creación de Elementos ---

export function createSongCard(song) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.songId = song.id;
    // ✅ HEMOS AÑADIDO EL BOTÓN DE EDITAR
    card.innerHTML = `
        <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
        <h3>${song.title}</h3>
        <p>${song.artist || 'Artista Desconocido'}</p>
        <div class="play-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <button class="icon-btn edit-song-btn card-edit-btn" title="Editar metadatos">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
        </button>
    `;
    return card;
}

export function showInfoMessage(elementId, message) {
    const container = document.getElementById(elementId);
    if (container) {
        container.innerHTML = `<p class="no-results">${message}</p>`;
    }
}

export function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'card playlist-card';
    card.dataset.playlistId = playlist.id;
    card.dataset.playlistName = playlist.name;
    
    // VERSIÓN SIMPLIFICADA SIN EL card-overlay
    card.innerHTML = `
        <img class="playlist-cover" src="${playlist.cover_path ? '/' + playlist.cover_path : '/static/covers/default_cover.png'}" alt="Portada de ${playlist.name}">
        <h3>${playlist.name}</h3>
    `;
    return card;
}

export function createSongListItem(song) {
    const item = document.createElement('div');
    item.className = 'song-item';
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
        <button class="icon-btn edit-song-btn" title="Editar metadatos">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
        </button>
    `;
    return item;
}

// --- Renderizado de Secciones ---

export function displayFavoriteSongs(songs) {
    const grid = document.getElementById('favorite-songs-grid');
    grid.innerHTML = '';
    const favoriteCards = [];

    if (songs.length === 0) {
        grid.innerHTML = '<p class="no-songs-message">Aún no tienes canciones favoritas.<br>Haz clic en "Editar canciones favoritas" para añadir.</p>';
    } else {
        const tempSongs = new Array(5).fill(null);
        songs.forEach(song => {
            if (song.position >= 1 && song.position <= 5) {
                tempSongs[song.position - 1] = song;
            }
        });
        tempSongs.forEach(song => {
            if (song) {
                const card = createSongCard(song);
                grid.appendChild(card);
                favoriteCards.push({ element: card, song: song });
            } else {
                const emptyCard = document.createElement('div');
                emptyCard.className = 'card empty-favorite';
                emptyCard.innerHTML = `<div class="empty-cover"></div><h3>Espacio Vacío</h3><p>--</p>`;
                grid.appendChild(emptyCard);
            }
        });
    }
    return favoriteCards;
}

export function displayAllSongs(songs, viewMode) {
    const displayArea = document.getElementById('songs-display-area');
    displayArea.innerHTML = '';
    const songElements = [];

    if (songs.length === 0) {
        displayArea.innerHTML = '<p class="no-results">No se encontraron canciones.</p>';
        return [];
    }
    
    displayArea.className = viewMode === 'grid' ? 'cards-grid' : 'songs-list';
    songs.forEach(song => {
        const element = viewMode === 'grid' ? createSongCard(song) : createSongListItem(song);
        displayArea.appendChild(element);
        songElements.push({ element, song });
    });
    return songElements;
}

export function displayPlaylists(playlists) {
    const grid = document.getElementById('playlists-grid');
    grid.innerHTML = '';
    const playlistCards = [];
    if (!playlists || playlists.length === 0) {
        grid.innerHTML = '<p class="no-songs-message">Aún no has creado ninguna playlist.</p>';
        return [];
    }

    playlists.forEach(playlist => {
        const card = createPlaylistCard(playlist);
        grid.appendChild(card);
        playlistCards.push({ element: card, playlist: playlist });
    });
    return playlistCards;
}

export function displayTopSongs(songs) {
    const list = document.getElementById('top-songs-list');
    list.innerHTML = '';
    if (!songs || songs.length === 0) {
        list.innerHTML = '<p class="no-stats-message">Aún no hay datos suficientes.</p>';
        return;
    }

    songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'stats-song-item';
        item.innerHTML = `
            <span class="stats-song-rank">${index + 1}</span>
            <img src="${song.cover_path ? '/' + song.cover_path : '/static/covers/default_cover.png'}" alt="${song.title}">
            <div class="stats-song-info">
              <div class="stats-song-title">${song.title}</div>
                <div class="stats-song-artist">${song.artist || 'Artista Desconocido'}</div>
            </div>
            <span class="stats-song-plays">${formatTotalTime(song.total_ms_played)}</span>
        `;
        list.appendChild(item);
    });
}

// === Nueva versión: eje Y hasta 8h y pasos de 1h ===
export function displayListeningTimeChart(chartData, period) {
    // --- Preparativos iniciales ---
    const ctx = document.getElementById('listening-time-chart').getContext('2d');
    const visibleTextColor = 'rgba(255, 255, 255, 0.7)';
    const subtleLineColor = 'rgba(255, 255, 255, 0.15)';
    
    // Nuestros "traductores" para mostrar fechas en un formato amigable.
    const fullDayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // --- LÓGICA CLAVE: Adaptamos la altura del gráfico ---
    // El objetivo es que la escala (el eje Y) se ajuste al período de tiempo que estamos viendo.
    
    let maxHours = 8; // Por defecto, para la vista de 7 días, el máximo son 8 horas.
    
    if (period === '1m') {
        // Si vemos 1 mes (datos por semana), el máximo será 8 horas/día * 7 días = 56 horas.
        maxHours = 30; 
    } else if (period === '6m' || period === '12m') {
        // Si vemos 6 o 12 meses (datos por mes), el máximo será 56 horas/semana * 4 semanas = 224 horas.
        maxHours = 80; 
    }
    
    // Para que el gráfico siempre se vea ordenado, calculamos el tamaño de cada "escalón" (tick)
    // para que siempre haya 8 divisiones en el eje, sin importar la altura máxima.
    const stepSizeHours = maxHours / 8;
    // --- FIN DE LA LÓGICA DE ADAPTACIÓN ---

    // Si ya existía un gráfico, lo borramos antes de dibujar el nuevo para evitar solapamientos.
    if (listeningTimeChart) {
        listeningTimeChart.destroy();
    }

    // Creamos la nueva instancia del gráfico con toda la configuración.
    listeningTimeChart = new Chart(ctx, {
        type: 'bar', // Tipo de gráfico: barras.
        data: {
            labels: chartData.labels, // Las etiquetas del eje X (L, M, X... o S37, S38...)
            datasets: [{
                label: 'Tiempo de Escucha',
                data: chartData.values, // Los datos de tiempo que van en cada barra.
                backgroundColor: 'rgba(140, 0, 255, 0.6)',
                borderColor: 'rgba(140, 0, 255, 1)',
                borderWidth: 1,
                borderRadius: 5,
            }]
        },
        options: {
            maintainAspectRatio: false, // Permite que el gráfico se adapte al contenedor.
            responsive: true, // Hace que el gráfico se ajuste al tamaño de la ventana.
            plugins: {
                legend: { display: false }, // Ocultamos la leyenda "Tiempo de Escucha".
                tooltip: {
                    // Configuración del cuadro de info que aparece al pasar el ratón.
                    callbacks: {
                        title: function(context) {
                            const label = context[0].label;
                            if (period === '7d') {
                                return fullDayNames[context[0].dataIndex];
                            }
                            if (period === '1m') {
                                return `Semana ${label.split('-')[1]}`;
                            }
                            if (period === '6m' || period === '12m') {
                                const monthIndex = parseInt(label.split('-')[1], 10) - 1;
                                return monthNames[monthIndex];
                            }
                            return label;
                        },
                        label: function(context) {
                            // Usamos nuestra función de `utils.js` para formatear el tiempo.
                            return formatChartTooltip(context.raw);
                        }
                    }
                }
            },
            scales: {
                // Configuración del eje Y (vertical)
                y: {
                    beginAtZero: true,
                    // Aquí usamos nuestras variables dinámicas para la altura y los escalones.
                    max: maxHours * 3600000, // El máximo en milisegundos.
                    grid: { color: subtleLineColor },
                    ticks: {
                        stepSize: stepSizeHours * 3600000, // El tamaño de cada escalón en milisegundos.
                        color: visibleTextColor,
                        callback: function(value) {
                            // Mostramos las etiquetas del eje como "28h", "56h", etc.
                            // Usamos Math.round para evitar decimales raros.
                            return Math.round(value / 3600000) + 'h';
                        }
                    }
                },
                // Configuración del eje X (horizontal)
                x: {
                    grid: { display: false },
                    ticks: {
                        color: visibleTextColor,
                        // Aquí "traducimos" las etiquetas del eje para que sean más cortas y legibles.
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            if (period === '1m') {
                                return `S${label.split('-')[1]}`; // S37, S38...
                            }
                             if (period === '6m' || period === '12m') {
                                const monthIndex = parseInt(label.split('-')[1], 10) - 1;
                                return monthNames[monthIndex].substring(0, 3); // Ene, Feb, Mar...
                            }
                            return label; // L, M, X...
                        }
                    }
                }
            }
        }
    });
}

// --- UI Auxiliar ---

export function updatePagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    document.getElementById('current-page-info').textContent = `Página ${page} de ${totalPages || 1}`;
    document.getElementById('prev-page-btn').disabled = page <= 1;
    document.getElementById('next-page-btn').disabled = page >= totalPages;
}

export function openContextMenu(event, playlists) {
    const menu = document.getElementById('song-context-menu');
    const playlistListDiv = document.getElementById('context-menu-playlist-list');
    playlistListDiv.innerHTML = '';
    if (playlists.length > 0) {
        playlists.forEach(playlist => {
            const item = document.createElement('div');
            item.textContent = playlist.name;
            item.className = 'playlist-item-option';
            item.dataset.playlistId = playlist.id;
            playlistListDiv.appendChild(item);
        });
    } else {
        playlistListDiv.innerHTML = '<li class="context-menu-title" style="font-style: italic;">No hay playlists</li>';
    }
    
    menu.style.top = `${event.pageY}px`;
    menu.style.left = `${event.pageX}px`;
    menu.classList.remove('hidden');
}

export function closeContextMenu() {
    const menu = document.getElementById('song-context-menu');
    if(menu) menu.classList.add('hidden');
}

export function toggleAllSongsSection(isVisible) {
    const allSongsSection = document.getElementById('all-songs-list-section');
    const viewAllSongsBtn = document.getElementById('view-all-songs-btn');
    
    allSongsSection.classList.toggle('hidden', !isVisible);
    viewAllSongsBtn.textContent = isVisible ? 'Ocultar todas las canciones' : 'Ver todas las canciones';
}
