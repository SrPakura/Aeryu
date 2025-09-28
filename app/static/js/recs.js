// app/static/js/recs.js - VERSIÓN FINAL CORREGIDA

// --- ESTADO Y ELEMENTOS DE LA UI ---
let conversationHistory = [];
let ui;
let isTyping = false;

// --- ICONOS SVG ---
const icons = {
    like: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path></svg>',
    dislike: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14-.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41-.17-.79-.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"></path></svg>',
    search: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1h-2v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg>'
};

// --- LÓGICA DE RENDERIZADO Y ANIMACIÓN ---

function formatResponseToHTML(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\s*[\*-]\s*(.*)$/gm, '<li>$1</li>');
    html = html.replace(/((<li>.*<\/li>\s*)+)/gs, '<ul>$1</ul>');
    const paragraphs = html.split(/\n\s*\n/).map(p => {
        if (p.trim().startsWith('<ul>')) return p;
        return `<p>${p.trim().replace(/\n/g, '<br>')}</p>`;
    }).join('');
    return paragraphs;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function typewriterHTML(sourceHTML, destBubble) {
    destBubble.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sourceHTML;
    let wordCount = 0;

    async function walkAndType(sourceNode, destNode) {
        for (const child of sourceNode.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '') {
                const words = child.textContent.match(/\S+\s*/g) || [];
                for (const word of words) {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'typewriter-word';
                    wordSpan.textContent = word;
                    destNode.appendChild(wordSpan);
                    void wordSpan.offsetWidth;
                    wordSpan.classList.add('visible');
                    wordCount++;
                    if (wordCount % 5 === 0) {
                        ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
                    }
                    await delay(70);
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const clone = child.cloneNode(false);
                destNode.appendChild(clone);
                await walkAndType(child, clone);
            }
        }
    }

    await walkAndType(tempDiv, destBubble);
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function createMessageElement(text, type) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `chat-message ${type}-message`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';

    const contentPromise = (type === 'assistant')
        ? typewriterHTML(formatResponseToHTML(text), bubble)
        : Promise.resolve(bubble.textContent = text);

    if (type === 'user') {
        messageWrapper.appendChild(bubble);
        messageWrapper.appendChild(avatar);
    } else {
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(bubble);
    }
    
    ui.chatMessages.appendChild(messageWrapper);
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
    setTimeout(() => messageWrapper.classList.add('visible'), 50);

    return contentPromise;
}

function renderRecommendations(recommendations) {
    ui.recommendationsList.innerHTML = '';
    if (!recommendations || recommendations.length === 0) return;
    recommendations.forEach((rec, index) => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        card.innerHTML = `
            <div class="recommendation-info">
                <div class="title">${rec.title}</div>
                <div class="artist">${rec.artist}</div>
            </div>
            <div class="recommendation-actions">
                <button class="icon-btn like-btn" title="Me gusta">${icons.like}</button>
                <button class="icon-btn dislike-btn" title="No me gusta">${icons.dislike}</button>
                <button class="icon-btn search-btn" title="Buscar en YouTube">${icons.search}</button>
            </div>`;
        setTimeout(() => { card.classList.add('visible'); }, index * 300);
        card.querySelector('.search-btn').addEventListener('click', () => {
            const query = encodeURIComponent(`${rec.title} ${rec.artist}`);
            window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
        });
        card.querySelector('.like-btn').addEventListener('click', (e) => handleFeedback(e, rec, 'like'));
        card.querySelector('.dislike-btn').addEventListener('click', (e) => handleFeedback(e, rec, 'dislike'));
        ui.recommendationsList.appendChild(card);
    });
}

function showLoadingIndicator() {
    const loadingElement = document.createElement('div');
    loadingElement.id = 'loading-indicator';
    loadingElement.className = 'chat-message assistant-message';
    loadingElement.innerHTML = `
        <div class="avatar"></div>
        <div class="message-bubble">
            <span class="typing-indicator"></span>
        </div>`;
    ui.chatMessages.appendChild(loadingElement);
    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function handleFeedback(event, rec, feedbackType) {
    const card = event.currentTarget.closest('.recommendation-card');
    card.querySelectorAll('.icon-btn').forEach(btn => btn.disabled = true);
    event.currentTarget.style.backgroundColor = 'var(--accent-color)';
    await fetch('/api/recs/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: rec.title, artist: rec.artist, feedback: feedbackType })
    });
}

async function handleSendMessage() {
    if (isTyping) return;
    const messageText = ui.chatInput.value.trim();
    if (messageText === '') return;

    isTyping = true;
    ui.chatInput.disabled = true;
    ui.chatSendBtn.disabled = true;

    try {
        await createMessageElement(messageText, 'user');
        conversationHistory.push({ role: "user", text: messageText });
        ui.chatInput.value = '';
        
        if (ui.recsView.classList.contains('initial-state')) {
            ui.initialPrompt.style.opacity = '0';
            setTimeout(() => {
                ui.recsView.classList.remove('initial-state');
                setTimeout(() => ui.sidebar.classList.add('visible'), 50);
            }, 500);
        }

        showLoadingIndicator();

        const response = await fetch('/api/recs/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageText, history: conversationHistory })
        });

        document.getElementById('loading-indicator')?.remove();
        if (!response.ok) throw new Error((await response.json()).error || 'Error del servidor.');
        
        const data = await response.json();
        
        await createMessageElement(data.reply_html, 'assistant');
        
        conversationHistory.push({ role: "assistant", text: data.reply_html });
        renderRecommendations(data.recommendations);

    } catch (error) {
        document.getElementById('loading-indicator')?.remove();
        await createMessageElement(`Error: ${error.message}`, 'assistant');
    } finally {
        isTyping = false;
        ui.chatInput.disabled = false;
        ui.chatSendBtn.disabled = false;
        ui.chatInput.focus();
    }
}

// --- PUNTO DE ENTRADA ---
export function init() {
    ui = {
        recsView: document.getElementById('recs-view-container'),
        initialPrompt: document.getElementById('initial-prompt-container'),
        chatInput: document.getElementById('chat-input'),
        chatSendBtn: document.getElementById('chat-send-btn'),
        chatMessages: document.getElementById('chat-messages'),
        sidebar: document.getElementById('recommendations-sidebar'),
        recommendationsList: document.getElementById('recommendations-list')
    };
    conversationHistory = [];
    ui.chatSendBtn.addEventListener('click', handleSendMessage);
    ui.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
}