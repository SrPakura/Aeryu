// app/static/js/songs/utils.js

console.log("✅ 4. utils.js -> Módulo de utilidades importado.");

export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

export function formatDuration(ms) {
    if (ms === null || ms === undefined) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatTotalTime(ms) {
    if (!ms) return '0 min';
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return '< 1 min';
    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

// === NUEVA FUNCIÓN para tooltips de Chart.js ===
export function formatChartTooltip(ms) {
    if (!ms) return '0 minutos';
    const totalMinutes = Math.floor(ms / 60000);

    if (totalMinutes < 60) {
        return `${totalMinutes} minuto(s)`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

