
// app/static/js/player.js - VERSIÓN 10 (Cola + Shuffle + Repeat + Checkpoints)

const AeryuPlayer = {
    // --- Elementos base ---
    audio: new Audio(),
    checkpointInterval: null, // ⏱️ Nuevo: temporizador para checkpoints

    // --- Estado del reproductor ---
    state: {
        currentSong: null,      // Canción actual
        isPlaying: false,       // ¿Está sonando?
        isRepeating: false,     // Modo infinito
        isShuffled: false,      // Modo aleatorio
        isSingleSong: false,    // Canción suelta vs playlist
        playRegistered: false,  // ¿Ya contamos el play?
        queue: [],              // Cola original
        activeQueue: [],        // Cola activa (barajada o no)
        queueIndex: -1,          // Índice en la cola activa
        lastVolume: 1, // Para recordar el volumen previo al mute
        isBotConnected: false // Para el señor botardo
    },

    // --- Constantes ---
    PLAY_THRESHOLD_SECONDS: 15, // Cuando registrar un "play" único

    // --- Elementos UI ---
    ui: {
        albumArt: document.getElementById('player-album-art'),
        title: document.getElementById('player-title'),
        artist: document.getElementById('player-artist'),
        progressContainer: document.getElementById('player-progress-container'),
        progressFill: document.getElementById('player-progress-fill'),
        currentTime: document.getElementById('player-current-time'),
        duration: document.getElementById('player-duration'),
        playPauseContainer: document.getElementById('player-album-art-container'),
        repeatBtn: document.getElementById('player-repeat-btn'),
        shuffleBtn: document.getElementById('player-shuffle-btn'),
        prevBtn: document.getElementById('player-prev-btn'),
        nextBtn: document.getElementById('player-next-btn'),
        volumeBtn: document.getElementById('player-volume-btn'),
        volumeSlider: document.getElementById('volume-slider'),
        discordBtn: document.getElementById('player-discord-btn'),
        playIcon: '<path class="overlay-icon" d="M321.93,265.42l-113.28,66.88c-18.23,10.77-40.64-3.25-40.64-25.42v-133.77c0-22.17,22.41-36.18,40.64-25.42l113.28,66.88c18.76,11.08,18.76,39.75,0,50.83Z"/>',
        pauseIcon: '<path class="overlay-icon" d="M168,400.65c-22.34,0-40.5-18.16-40.5-40.5V119.85c0-22.34,18.16-40.5,40.5-40.5s40.5,18.16,40.5,40.5v240.3c0,22.34-18.16,40.5-40.5,40.5Zm144,0c-22.34,0-40.5-18.16-40.5-40.5V119.85c0-22.34,18.16-40.5,40.5-40.5s40.5,18.16,40.5,40.5v240.3c0,22.34-18.16,40.5-40.5,40.5Z"/>'
    },

    // --- Inicialización ---
    init: function() {
        this.addEventListeners();
        this.setVolume(100); // Empieza al 100%
    },

    addEventListeners: function() {
        // 🎛️ Controles principales
        this.ui.playPauseContainer.addEventListener('click', () => {
            if (this.state.isPlaying) this.pause();
            else this.play();
        });
        this.ui.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.ui.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.ui.progressContainer.addEventListener('click', (e) => this.seek(e));
        this.ui.prevBtn.addEventListener('click', () => this.prevSong());
        this.ui.nextBtn.addEventListener('click', () => this.nextSong());

    // --- 👇 AÑADIMOS EL LISTENER PARA EL BOTÓN DE DISCORD 👇 ---
    if (this.ui.discordBtn) {
        this.ui.discordBtn.addEventListener('click', () => this.toggleDiscordConnection());
    }

        // 🔊 Volumen
        if (this.ui.volumeSlider) {
        this.ui.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }
        if (this.ui.volumeBtn) {
        this.ui.volumeBtn.addEventListener('click', () => this.toggleMute());
        }

        // 🎶 Eventos del audio
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.updatePlayPauseIcon();
        });
        this.audio.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.updatePlayPauseIcon();
        });
        this.audio.addEventListener('ended', () => this.handleSongEnd());
    },

// --- Control de volumen ---
setVolume: function(value) {
    const volumeLevel = parseInt(value) / 100;
    this.audio.volume = volumeLevel;
    this.state.lastVolume = volumeLevel;
    this.ui.volumeSlider.value = value;

    // Si el bot está conectado, le enviamos el nuevo nivel de volumen
    if (this.state.isBotConnected) {
        fetch('/api/discord/volume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volume: volumeLevel }) // Enviamos valor entre 0.0 y 1.0
        });
    }
},

toggleMute: function() {
    if (this.audio.volume > 0) {
        this.setVolume(0);
    } else {
        const restore = this.state.lastVolume > 0 ? this.state.lastVolume * 100 : 100;
        this.setVolume(restore);
    }
},

    // --- Reproducción de colas ---
    playQueue: function(songs, startIndex = 0) {
        if (!songs || songs.length === 0) return;

        this.state.queue = [...songs];          
        this.state.activeQueue = [...songs];    
        this.state.isSingleSong = songs.length === 1;
        this.state.queueIndex = startIndex;

        if (this.state.isShuffled && !this.state.isSingleSong) {
            this.generateShuffledQueue(startIndex);
        }

        this.playCurrentSong();
    },

playCurrentSong: function() {
    const song = this.state.activeQueue[this.state.queueIndex];
    if (!song) return;

    this.state.currentSong = song;
    this.state.playRegistered = false;
    this.updateUI(); 
    this._handleCheckpoints(true);

    // --- 👇 LÓGICA AÑADIDA PARA EL BOT DE DISCORD 👇 ---
    if (this.state.isBotConnected) {
        console.log(`Enviando orden de reproducir a Discord: ${song.title}`);
        fetch('/api/discord/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: song }) 
        });
        this.audio.muted = true; 
    } else {
        this.audio.muted = false;
    }
    // --- 👆 FIN DE LA LÓGICA AÑADIDA 👆 ---

    this.audio.src = `/media/${song.file_basename}`;
    this.audio.play().catch(error => console.error("Error de reproducción automática:", error));

    fetch('/api/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id })
    });
},

    playSong: function(song) {
        this.playQueue([song]); // Canción suelta = playlist de 1
    },

    play: function() { // Esta función se usa para REANUDAR
    if (!this.state.currentSong) return;
    this.audio.play();

    // Si el bot está conectado, le enviamos la orden de reanudar
    if (this.state.isBotConnected) {
        fetch('/api/discord/resume', { method: 'POST' });
    }
},

    pause: function() {
    this.audio.pause();
    this._handleCheckpoints(false);

    // Si el bot está conectado, le enviamos la orden de pausar
    if (this.state.isBotConnected) {
        fetch('/api/discord/pause', { method: 'POST' });
    }
},

    // --- Navegación en cola ---
    nextSong: function() {
        if (this.state.activeQueue.length === 0) return;
        this.state.queueIndex++;

        if (this.state.queueIndex >= this.state.activeQueue.length) {
            if (this.state.isRepeating) {
                if (this.state.isShuffled) this.generateShuffledQueue();
                this.state.queueIndex = 0;
                this.playCurrentSong();
            } else {
                this.state.queueIndex = this.state.activeQueue.length - 1;
                console.log("Fin de la cola.");
            }
        } else {
            this.playCurrentSong();
        }
    },

    prevSong: function() {
        if (this.state.activeQueue.length === 0) return;
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        this.state.queueIndex--;
        if (this.state.queueIndex < 0) {
            this.state.queueIndex = 0;
            return;
        }
        this.playCurrentSong();
    },

    handleSongEnd: function() {
        // ⏹️ Detiene checkpoints
        this._handleCheckpoints(false);

        if (this.state.isSingleSong) {
            if (this.state.isRepeating) {
                this.audio.currentTime = 0;
                this.audio.play();
            }
            return;
        }

        const isLastSong = this.state.queueIndex >= this.state.activeQueue.length - 1;
        if (isLastSong) {
            if (this.state.isRepeating) {
                if (this.state.isShuffled) this.generateShuffledQueue();
                this.state.queueIndex = 0;
                this.playCurrentSong();
            }
        } else {
            this.state.queueIndex++;
            this.playCurrentSong();
        }
    },

    // --- Modos ---
    toggleRepeat: function() {
        this.state.isRepeating = !this.state.isRepeating;
        this.ui.repeatBtn.classList.toggle('active', this.state.isRepeating);
    },

    toggleShuffle: function() {
        if (this.state.isSingleSong) return; // nada en canción única
        this.state.isShuffled = !this.state.isShuffled;
        this.ui.shuffleBtn.classList.toggle('active', this.state.isShuffled);

        if (this.state.isShuffled) {
            this.generateShuffledQueue(this.state.queueIndex);
        } else {
            this.state.activeQueue = [...this.state.queue];
            this.state.queueIndex = this.state.activeQueue.findIndex(s => s.id === this.state.currentSong.id);
        }
    },

    generateShuffledQueue: function(startIndex = 0) {
        const shuffled = [...this.state.queue];

        if (startIndex > 0 && startIndex < shuffled.length) {
            const [startSong] = shuffled.splice(startIndex, 1);
            shuffled.unshift(startSong);
        }

        for (let i = shuffled.length - 1; i > 1; i--) {
            const j = Math.floor(Math.random() * (i - 1)) + 1;
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        this.state.activeQueue = shuffled;
        this.state.queueIndex = 0;
    },

    // --- Checkpoints ---
    _handleCheckpoints: function(start) {
        // Limpia timers previos
        if (this.checkpointInterval) {
            clearInterval(this.checkpointInterval);
            this.checkpointInterval = null;
        }

        // Si arranca y hay canción activa
        if (start && this.state.currentSong) {
            const CHECKPOINT_FREQUENCY_MS = 15000; // 15s

            this.checkpointInterval = setInterval(() => {
                if (!this.audio.paused) {
                    fetch('/api/plays/checkpoint', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            song_id: this.state.currentSong.id,
                            ms_played: CHECKPOINT_FREQUENCY_MS
                        })
                    });
                }
            }, CHECKPOINT_FREQUENCY_MS);
        }
    },

    // --- Barra de progreso ---
    seek: function(event) {
        if (!this.audio.duration) return;
        const clickPositionX = event.offsetX;
        const barWidth = this.ui.progressContainer.offsetWidth;
        const seekPercentage = clickPositionX / barWidth;
        this.audio.currentTime = this.audio.duration * seekPercentage;

        fetch('/api/player/seek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress_ms: this.audio.currentTime * 1000 })
        });
    },

    // --- UI ---
    updateUI: function() {
        if (this.state.currentSong) {
            this.ui.albumArt.src = this.state.currentSong.cover_path
                ? `/${this.state.currentSong.cover_path}`
                : '/static/covers/default_cover.png';
            this.ui.title.textContent = this.state.currentSong.title;
            this.ui.artist.textContent = this.state.currentSong.artist || 'Artista Desconocido';
        }
        this.updatePlayPauseIcon();
    },

    updatePlayPauseIcon: function() {
        const iconContainer = document.getElementById('player-play-pause-icon');
        const bgPath = iconContainer.querySelector('.overlay-bg').outerHTML;
        iconContainer.innerHTML = bgPath + (this.state.isPlaying ? this.ui.pauseIcon : this.ui.playIcon);
    },

    updateProgress: function() {
        if (!this.audio.duration) return;
        const progressPercent = (this.audio.currentTime / this.audio.duration) * 100;
        this.ui.progressFill.style.width = `${progressPercent}%`;
        this.ui.currentTime.textContent = this.formatTime(this.audio.currentTime);

    },

    updateDuration: function() {
        this.ui.duration.textContent = this.formatTime(this.audio.duration);
    },

    formatTime: function(seconds) {
        const floorSeconds = Math.floor(seconds) || 0;
        const min = Math.floor(floorSeconds / 60);
        const sec = floorSeconds % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    },

// --- 👇 NUEVA FUNCIÓN PARA GESTIONAR LA CONEXIÓN CON DISCORD 👇 ---
toggleDiscordConnection: async function() {
    const btn = this.ui.discordBtn;

    if (this.state.isBotConnected) {
        // --- Si está conectado, lo desconectamos ---
        btn.classList.remove('active', 'connecting'); // Quitamos estilos de "conectado"
        try {
            // Avisamos al backend que queremos desconectar al bot
            await fetch('/api/discord/disconnect', { method: 'POST' });

            // Actualizamos estado local
            this.state.isBotConnected = false;

            // 👇 Línea clave: volvemos a activar el sonido en la web.
            // Como el audio estuvo avanzando en silencio, ahora lo escuchamos
            // desde casi el mismo punto en que estaba sonando en Discord.
            this.audio.muted = false; 

            console.log("Orden de desconexión enviada. Audio vuelve a la web.");
        } catch (error) {
            console.error("Error al enviar orden de desconexión:", error);
        }

    } else {
        // --- Si no está conectado, lo conectamos ---
        btn.classList.add('connecting'); // Ponemos animación de "conectando"
        try {
            // 👇 Obtenemos el estado actual del reproductor
            // Esto incluye:
            // - La canción actual (this.state.currentSong)
            // - El segundo exacto en el que va (this.audio.currentTime)
            const playerState = {
                song: this.state.currentSong,
                progress: this.audio.currentTime // en segundos
            };

            // Enviamos al backend la orden de "connect" junto con el estado actual
            const response = await fetch('/api/discord/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: playerState }) // 👈 Aquí va el estado
            });

            if (response.ok) {
                // Si todo va bien, actualizamos estado y estilos
                this.state.isBotConnected = true;
                btn.classList.remove('connecting');
                btn.classList.add('active'); // Botón fijo en blanco (conectado)
                console.log("Orden de conexión enviada con éxito.");
            } else {
                throw new Error('La conexión falló desde el backend.');
            }
        } catch (error) {
            // Si algo falla, limpiamos estilos y marcamos como desconectado
            console.error("Error al enviar orden de conexión:", error);
            btn.classList.remove('connecting', 'active');
            this.state.isBotConnected = false;
        }
    }
},

};

export default AeryuPlayer;
