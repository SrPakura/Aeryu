// app/static/js/settings.js

// --- SELECTORES DE ELEMENTOS ---
let ui;

// --- FUNCIONES DE API ---
// Carga la configuración actual desde el servidor
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('No se pudo cargar la configuración.');
        
        const settings = await response.json();
        console.log('Ajustes cargados:', settings);

        // Rellenamos el formulario con los valores cargados
        ui.sendLibrary.checked = settings.prompt_include_favorites ?? true;
        ui.sendFeedback.checked = settings.prompt_include_history ?? true;
        ui.customPrompt.value = settings.prompt_extra || '';
        ui.geminiKey.value = settings.gemini_api_key || '';
        ui.discordToken.value = settings.discord_token || '';
        ui.discordServerId.value = settings.discord_server_id || '';

    } catch (error) {
        console.error('Error al cargar ajustes:', error);
    }
}

// Guarda la configuración actual en el servidor
async function saveSettings() {
    const settingsData = {
        prompt_include_favorites: ui.sendLibrary.checked,
        prompt_include_history: ui.sendFeedback.checked,
        prompt_extra: ui.customPrompt.value.trim(),
        gemini_api_key: ui.geminiKey.value.trim(),
        discord_token: ui.discordToken.value.trim(),
        discord_server_id: ui.discordServerId.value.trim()
    };

    console.log('Guardando ajustes:', settingsData);
    ui.saveBtn.disabled = true;
    ui.saveBtn.textContent = 'Guardando...';

    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsData)
        });
        if (!response.ok) throw new Error('No se pudieron guardar los cambios.');

        ui.saveBtn.textContent = '¡Guardado!';
        setTimeout(() => {
            ui.saveBtn.textContent = '¡Haz click para guardar los cambios!';
            ui.saveBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error al guardar ajustes:', error);
        ui.saveBtn.textContent = 'Error al guardar';
    }
}

// --- NUEVA FUNCIÓN PARA EL MODAL SECRETO ---
function setupSecretModal() {
    const modal = document.getElementById('pakura-modal');
    const openBtn = document.getElementById('secret-pakura-btn');
    const closeBtn = document.getElementById('close-pakura-modal');

    if (modal && openBtn && closeBtn) {
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Cierra el modal si se hace clic fuera del contenido
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
}

// --- PUNTO DE ENTRADA ---
export function init() {
    ui = {
        sendLibrary: document.getElementById('setting-send-library'),
        sendFeedback: document.getElementById('setting-send-feedback'),
        customPrompt: document.getElementById('setting-custom-prompt'),
        geminiKey: document.getElementById('setting-gemini-key'),
        discordToken: document.getElementById('setting-discord-token'),
        discordServerId: document.getElementById('setting-discord-server-id'),
        saveBtn: document.getElementById('save-settings-btn')
    };

    ui.saveBtn.addEventListener('click', saveSettings);
    
    // Configura los listeners para los botones de visibilidad de contraseñas
    document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
        });
    });

    // Cargamos los ajustes guardados al iniciar la página
    loadSettings();
    
    // Iniciamos la lógica del modal secreto
    setupSecretModal();
}