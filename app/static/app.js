// app/static/app.js

console.log("✅ 1. app.js -> Módulo principal cargado.");

// Importa el reproductor
import AeryuPlayer from './js/player.js';

// Hacemos que el reproductor sea 'público' para que otros archivos lo vean
window.AeryuPlayer = AeryuPlayer;

document.addEventListener('DOMContentLoaded', () => {
    console.log("📥 DOMContentLoaded -> Iniciando aplicación");

    // Inicia el reproductor al cargar la página
    console.log("🎵 Iniciando reproductor Aeryu");
    AeryuPlayer.init();

    const contentArea = document.getElementById('content-area');
    const navLinks = document.querySelectorAll('a[data-page]');
    const navItems = document.querySelectorAll('.main-nav li, .settings-nav li');
    const controlButtons = document.querySelectorAll('.control-btn');

    // --- 3. DICCIONARIO DE RUTAS ---
    const routes = {
        'songs': { 
            html: 'songs.html',
            css: 'css/songs.css',
            js: 'js/songs/main.js'
        },
        'downloader': { 
            html: 'downloader.html',
            css: 'css/downloader.css',
            js: 'js/downloader.js'
        },
        'recommender': { 
            html: 'recommender.html',
            css: 'css/recs.css',
            js: 'js/recs.js'
        },
        'settings': { 
            html: 'settings.html',
            css: 'css/settings.css',
            js: 'js/settings.js'
        }
    };

    // --- 4. FUNCIÓN PARA CARGAR CONTENIDO ---
    async function loadContent(page, param) { // Ahora acepta un segundo argumento
        const route = routes[page];
        if (!route) {
            console.error("❌ loadContent -> ruta no encontrada:", page);
            return;
        }

        console.log(`📄 loadContent -> Cargando página: ${page}, HTML: ${route.html}, JS: ${route.js}`);

        try {
            const htmlResponse = await fetch(`/partials/${route.html}`);
            if (!htmlResponse.ok) throw new Error(`HTML load failed: ${htmlResponse.status}`);
            const htmlText = await htmlResponse.text();
            console.log(`✅ HTML cargado (${route.html}), longitud:`, htmlText.length);
            contentArea.innerHTML = htmlText;

            // Carga de CSS
            const oldLink = document.getElementById('page-css');
            if (oldLink) oldLink.remove();
            const link = document.createElement('link');
            link.id = 'page-css';
            link.rel = 'stylesheet';
            link.href = `/static/${route.css}`;
            document.head.appendChild(link);
            console.log(`🎨 CSS cargado: ${route.css}`);

            // Carga de JS dinámico
            console.log("📦 app.js -> intentando importar módulo:", route.js);
            const module = await import(`/static/${route.js}?ts=${Date.now()}`);
            console.log("✅ app.js -> módulo importado:", module);

            if (module.init) {
                console.log("🚀 app.js -> llamando a init() de", route.js, "con param:", param);
                module.init(param); 
            } else {
                console.warn("⚠️ app.js -> no hay init() en", route.js);
            }
        } catch (error) {
            console.error("❌ Error en loadContent:", error);
        }
    }

    function updateActiveIndicator(activePage) {
        console.log("🔖 updateActiveIndicator -> Página activa:", activePage);
        navItems.forEach(item => {
            const link = item.querySelector('a');
            const isMatch = link && link.dataset.page === activePage;
            item.classList.toggle('active', isMatch);
        });
    }

    function router() {
        const hash = window.location.hash.substring(1) || 'songs';
        const [page, param] = hash.split('/'); 
        console.log("🧭 router -> Hash:", hash, "-> Página:", page, "Param:", param);

        // Añadimos la nueva ruta al diccionario de rutas
        routes['playlist'] = {
            html: 'playlist_detail.html',
            css: 'css/songs.css',
            js: 'js/playlist_detail.js'
        };

        loadContent(page, param);
        updateActiveIndicator(page);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            console.log("🖱️ Click en navLink ->", page);
            if (page) {
                window.location.hash = page;
            }
        });
    });

    window.addEventListener('hashchange', () => {
        console.log("🔄 Evento hashchange -> nuevo hash:", window.location.hash);
        router();
    });

    // --- 7. ARRANQUE INICIAL ---
    window.location.hash = window.location.hash || '#songs';
    console.log("🚀 Arranque inicial -> Hash actual:", window.location.hash);
    router();
});
