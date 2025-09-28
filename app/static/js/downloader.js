// app/static/js/downloader.js

// --- Estado y Variables Globales ---
let selectedQuality = "192";   // Calidad predeterminada
let pollInterval = null;       // Intervalo de sondeo activo (si existe)

// --- Mapa de traducciones para estados ---
const statusTextMap = {
    pending: 'Pendiente',
    queued: 'En cola',
    downloading: 'Descargando',
    processing: 'Procesando',
    completed: 'Completado',
    failed: 'Fallido'
};

// --- Función para mostrar mensajes (placeholder: aquí podrías usar un toast real) ---
function showToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// --- Lógica principal: iniciar descarga ---
async function handleStartDownload() {
    const urlInput = document.getElementById('url-input');
    const startBtn = document.getElementById('start-download-btn');
    const urls = urlInput.value.trim();

    if (!urls) return; // no hacer nada si está vacío

    startBtn.disabled = true;
    startBtn.textContent = 'Añadiendo...';

    try {
        // 👉 Enviamos al backend las URLs y la calidad seleccionada
        await fetch('/api/downloads/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urls_text: urls,
                quality_kbps: selectedQuality
            })
        });

        urlInput.value = '';   // limpiar input
        startPolling();        // asegurarnos de que empieza a sondear
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'Iniciar Descarga';
    }
}

// --- Función de sondeo: consulta el estado cada 2s ---
function startPolling() {
    if (pollInterval) return; // si ya está activo, no duplicar

    const poll = async () => {
        try {
            const response = await fetch('/api/downloads/status/session');
            if (!response.ok) return;
            
            const job = await response.json();
            if (job.urls && job.urls.length > 0) {
                updateDownloadQueueUI(job.urls);
            }
        } catch (error) {
            console.error("Error durante el sondeo:", error);
        }
    };

    poll(); // ejecutar inmediatamente al iniciar
    pollInterval = setInterval(poll, 2000); // repetir cada 2s
}

// --- Nueva función: reintentar descargas fallidas ---
async function handleRetryFailed() {
    console.log("Intentando reintentar descargas fallidas...");
    try {
        const response = await fetch('/api/downloads/retry', { method: 'POST' });
        if (!response.ok) {
            throw new Error('La respuesta del servidor no fue OK');
        }
        console.log("Orden de reintento enviada.");
        startPolling(); // reactivar el polling
    } catch (error) {
        console.error("Error al reintentar descargas:", error);
    }
}

// --- Actualización de la UI de la cola ---
function updateDownloadQueueUI(queueItems) {
    const queueContainer = document.getElementById('download-queue');
    const retryBtn = document.getElementById('retry-failed-btn');

    // Si había placeholder y ya hay items, lo quitamos
    if (queueContainer.querySelector('.placeholder') && queueItems.length > 0) {
        queueContainer.innerHTML = ''; 
    }

    // Recorremos los items del backend y actualizamos la UI
    queueItems.forEach((item, index) => {
        let itemEl = document.getElementById(`download-item-${index}`);

        // --- CREACIÓN (solo la primera vez que aparece el item) ---
        if (!itemEl) {
            itemEl = document.createElement('div');
            itemEl.id = `download-item-${index}`;
            itemEl.className = `download-item status-bg-${item.status}`;
            itemEl.innerHTML = `
                <img class="thumb" src="/static/covers/default_cover.png" alt="miniatura">
                <div class="info">
                    <div class="title">Obteniendo título...</div>
                    <div class="details"></div>
                    <div class="progress-bar"><div class="progress-bar-fill"></div></div>
                </div>
                <div class="status"></div>
            `;
            queueContainer.appendChild(itemEl);
        }

        // --- ACTUALIZACIÓN (cada ciclo de sondeo) ---
        const thumb = itemEl.querySelector('.thumb');
        const title = itemEl.querySelector('.title');
        const details = itemEl.querySelector('.details');
        const progressBarFill = itemEl.querySelector('.progress-bar-fill');
        const statusEl = itemEl.querySelector('.status');

        // Actualizamos valores dinámicos
        itemEl.className = `download-item status-bg-${item.status}`;
        thumb.src = item.thumbnail || '/static/covers/default_cover.png';
        title.textContent = item.title || 'Obteniendo título...';
        details.textContent = item.duration 
            ? new Date(item.duration * 1000).toISOString().substr(14, 5) 
            : '';
        
        // Usamos el mapa de traducción de estados
        statusEl.textContent = statusTextMap[item.status] || item.status;
        statusEl.className = `status status-${item.status}`;

        // 🔑 Clave de la animación → solo modificamos el ancho
        progressBarFill.style.width = `${item.progress || 0}%`;
    });

    // Activar/desactivar botón reintentar según si hay fallidos
    retryBtn.disabled = !queueItems.some(item => item.status === 'failed');
}

// --- Eventos: enganchar botones y acciones ---
function setupEventListeners() {
    // Selección de calidad
    document.querySelectorAll('.quality-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Quitamos "active" del que estaba seleccionado
            document.querySelector('.quality-btn.active')?.classList.remove('active');
            // Marcamos el nuevo
            button.classList.add('active');
            // Guardamos el valor de calidad seleccionado
            selectedQuality = button.dataset.quality;
        });
    });

    // Botón iniciar descarga
    document.getElementById('start-download-btn')
        .addEventListener('click', handleStartDownload);

    // Botón reintentar fallidos
    document.getElementById('retry-failed-btn')
        .addEventListener('click', handleRetryFailed);

    // Al cargar, marcar como activo el botón de 192 kbps
    const defaultBtn = document.querySelector('.quality-btn[data-quality="192"]');
    if (defaultBtn) {
        document.querySelector('.quality-btn.active')?.classList.remove('active');
        defaultBtn.classList.add('active');
    }
}

// --- Punto de Entrada ---
export function init() {
    console.log('Downloader view initialized!');
    startPolling();        // Empieza a sondear nada más cargar
    setupEventListeners(); // Engancha los listeners de botones
}
