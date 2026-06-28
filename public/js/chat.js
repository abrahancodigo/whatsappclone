(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('c');
  if (!code) {
    window.location.href = '/dashboard.html';
    return;
  }

  const chatTitle = document.getElementById('chat-title');
  const shareCode = document.getElementById('share-code');
  const shareLink = document.getElementById('share-link');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const messagesEl = document.getElementById('messages');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('message-input');
  const chatStatus = document.getElementById('chat-status');
  const typingEl = document.getElementById('typing-indicator');
  const onlineEl = document.getElementById('online-count');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let currentUser = null;
  let chatData = null;
  let typingTimeout = null;
  let typingUsers = new Map();
  let isLoadingMore = false;
  let hasMoreMessages = true;

  const socket = io({
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  // Sound notification
  const notifAudio = (() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    } catch (_) { return null; }
  })();

  function playNotifSound() {
    if (!notifAudio) return;
    try {
      const osc = notifAudio.createOscillator();
      const gain = notifAudio.createGain();
      osc.connect(gain);
      gain.connect(notifAudio.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, notifAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, notifAudio.currentTime + 0.3);
      osc.start(notifAudio.currentTime);
      osc.stop(notifAudio.currentTime + 0.3);
    } catch (_) {}
  }

  // CSRF helper
  function getCsrfToken() {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;
    options.credentials = 'same-origin';
    return fetch(url, options);
  }

  async function init() {
    try {
      const meRes = await apiFetch('/api/me');
      const meData = await meRes.json();
      if (!meData.user) {
        window.location.href = '/';
        return;
      }
      currentUser = meData.user;

      const chatRes = await apiFetch(`/api/chats/by-code/${encodeURIComponent(code)}`);
      const chatInfo = await chatRes.json();
      if (!chatRes.ok) {
        alert(chatInfo.error || 'Chat no encontrado');
        window.location.href = '/dashboard.html';
        return;
      }
      chatData = chatInfo.chat;

      chatTitle.textContent = chatData.name;
      shareCode.textContent = chatData.code;
      shareLink.value = window.location.origin + `/chat.html?c=${chatData.code}`;

      document.title = `${chatData.name} - Mensajeria`;

      if (!chatInfo.isMember) {
        await apiFetch('/api/chats/join', { method: 'POST', body: { code: chatData.code } });
      }

      await loadMessages();

      socket.emit('join_chat', { chatId: chatData.id });
    } catch (err) {
      chatStatus.textContent = 'Error al cargar el chat';
    }
  }

  async function loadMessages() {
    try {
      const res = await apiFetch(`/api/chats/${chatData.id}/messages?limit=30`);
      const data = await res.json();
      if (!res.ok) return;
      messagesEl.innerHTML = '';
      data.messages.forEach(m => appendBubble(m));
      hasMoreMessages = data.hasMore;
      if (!hasMoreMessages && loadMoreBtn) loadMoreBtn.style.display = 'none';
      scrollToBottom();
    } catch (_) {}
  }

  async function loadMoreMessages() {
    if (isLoadingMore || !hasMoreMessages) return;
    isLoadingMore = true;
    if (loadMoreBtn) loadMoreBtn.textContent = 'Cargando...';

    const firstBubble = messagesEl.querySelector('.bubble[data-id]');
    const beforeId = firstBubble ? firstBubble.dataset.id : null;
    if (!beforeId) {
      isLoadingMore = false;
      if (loadMoreBtn) loadMoreBtn.textContent = 'Cargar mas mensajes';
      return;
    }

    try {
      const res = await apiFetch(`/api/chats/${chatData.id}/messages?limit=30&before=${beforeId}`);
      const data = await res.json();
      if (!res.ok) return;

      const prevHeight = messagesEl.scrollHeight;
      data.messages.forEach(m => prependBubble(m));
      hasMoreMessages = data.hasMore;
      if (!hasMoreMessages && loadMoreBtn) loadMoreBtn.style.display = 'none';
      messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
    } catch (_) {}

    isLoadingMore = false;
    if (loadMoreBtn) loadMoreBtn.textContent = 'Cargar mas mensajes';
  }

  function appendBubble(msg) {
    const div = document.createElement('div');
    const isMe = msg.username === currentUser.username;
    div.className = 'bubble ' + (isMe ? 'me' : 'other');
    div.dataset.id = msg.id;
    const time = msg.created_at ? formatTime(msg.created_at) : '';
    div.innerHTML = `
      <div class="who">${escHtml(msg.username)}</div>
      <div class="text">${escHtml(msg.content)}</div>
      <div class="time">${time}</div>
    `;
    messagesEl.appendChild(div);
  }

  function prependBubble(msg) {
    const div = document.createElement('div');
    const isMe = msg.username === currentUser.username;
    div.className = 'bubble ' + (isMe ? 'me' : 'other');
    div.dataset.id = msg.id;
    const time = msg.created_at ? formatTime(msg.created_at) : '';
    div.innerHTML = `
      <div class="who">${escHtml(msg.username)}</div>
      <div class="text">${escHtml(msg.content)}</div>
      <div class="time">${time}</div>
    `;
    const loadMoreContainer = document.getElementById('load-more-container');
    if (loadMoreContainer && loadMoreContainer.nextSibling) {
      messagesEl.insertBefore(div, loadMoreContainer.nextSibling);
    } else {
      messagesEl.prepend(div);
    }
  }

  function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'bubble sys';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return time;
      if (isYesterday) return `ayer ${time}`;
      return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
    } catch (_) {
      return '';
    }
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Typing indicator
  function updateTypingDisplay() {
    if (typingUsers.size === 0) {
      typingEl.textContent = '';
      typingEl.style.display = 'none';
      return;
    }
    const names = Array.from(typingUsers.values());
    typingEl.style.display = 'block';
    if (names.length === 1) {
      typingEl.textContent = `${names[0]} esta escribiendo...`;
    } else if (names.length === 2) {
      typingEl.textContent = `${names[0]} y ${names[1]} estan escribiendo...`;
    } else {
      typingEl.textContent = `${names.length} usuarios estan escribiendo...`;
    }
  }

  // Presence display
  function updateOnlineDisplay(users) {
    if (!users || !onlineEl) return;
    const others = users.filter(u => u.id !== currentUser.id);
    if (others.length === 0) {
      onlineEl.textContent = '';
    } else if (others.length <= 3) {
      onlineEl.textContent = 'En linea: ' + others.map(u => u.username).join(', ');
    } else {
      onlineEl.textContent = `${others.length + 1} en linea`;
    }
  }

  // Event listeners
  copyLinkBtn.addEventListener('click', () => {
    shareLink.select();
    navigator.clipboard.writeText(shareLink.value).then(() => {
      copyLinkBtn.textContent = 'Copiado!';
      setTimeout(() => { copyLinkBtn.textContent = 'Copiar'; }, 2000);
    });
  });

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !chatData) return;
    socket.emit('send_message', { chatId: chatData.id, content });
    socket.emit('stop_typing', { chatId: chatData.id });
    messageInput.value = '';
    clearTimeout(typingTimeout);
  });

  messageInput.addEventListener('input', () => {
    if (!chatData) return;
    socket.emit('typing', { chatId: chatData.id });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop_typing', { chatId: chatData.id });
    }, 2000);
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreMessages);
  }

  // Socket events
  socket.on('connect', () => {
    chatStatus.textContent = '';
    if (chatData) socket.emit('join_chat', { chatId: chatData.id });
  });

  socket.on('disconnect', () => {
    chatStatus.textContent = 'Reconectando...';
    onlineEl.textContent = '';
  });

  socket.on('reconnect', () => {
    chatStatus.textContent = '';
    if (chatData) socket.emit('join_chat', { chatId: chatData.id });
    loadMessages();
  });

  socket.on('reconnect_attempt', (attempt) => {
    chatStatus.textContent = `Reconectando (intento ${attempt})...`;
  });

  socket.on('reconnect_failed', () => {
    chatStatus.textContent = 'No se pudo reconectar. Recarga la pagina.';
  });

  socket.on('message', (msg) => {
    appendBubble(msg);
    scrollToBottom();
    if (msg.username !== currentUser.username) {
      playNotifSound();
      if (document.hidden) {
        document.title = `(${msg.username}) ${chatData.name} - Mensajeria`;
      }
    }
  });

  socket.on('user_joined', ({ username }) => {
    if (username !== currentUser.username) {
      appendSystem(`${username} se unio al chat`);
    }
  });

  socket.on('user_left', ({ username }) => {
    appendSystem(`${username} salio del chat`);
  });

  socket.on('chat_deleted', () => {
    alert('Este chat ha sido eliminado');
    window.location.href = '/dashboard.html';
  });

  socket.on('user_typing', ({ userId, username }) => {
    typingUsers.set(userId, username);
    updateTypingDisplay();
  });

  socket.on('user_stop_typing', ({ userId }) => {
    typingUsers.delete(userId);
    updateTypingDisplay();
  });

  socket.on('presence', ({ online }) => {
    updateOnlineDisplay(online);
  });

  // Restore title when page is visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && chatData) {
      document.title = `${chatData.name} - Mensajeria`;
    }
  });

  init();
})();
