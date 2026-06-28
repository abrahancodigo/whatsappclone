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

  let currentUser = null;
  let chatData = null;
  const socket = io({ withCredentials: true });

  async function init() {
    try {
      const meRes = await fetch('/api/me');
      const meData = await meRes.json();
      if (!meData.user) {
        window.location.href = '/';
        return;
      }
      currentUser = meData.user;

      const chatRes = await fetch(`/api/chats/by-code/${encodeURIComponent(code)}`);
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

      if (!chatInfo.isMember) {
        await fetch('/api/chats/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: chatData.code })
        });
      }

      await loadMessages();

      socket.emit('join_chat', { chatId: chatData.id });
    } catch (err) {
      chatStatus.textContent = 'Error al cargar el chat';
    }
  }

  async function loadMessages() {
    try {
      const res = await fetch(`/api/chats/${chatData.id}/messages`);
      const data = await res.json();
      if (!res.ok) return;
      messagesEl.innerHTML = '';
      data.messages.forEach(m => appendBubble(m));
      scrollToBottom();
    } catch (_) {}
  }

  function appendBubble(msg) {
    const div = document.createElement('div');
    const isMe = msg.username === currentUser.username;
    div.className = 'bubble ' + (isMe ? 'me' : 'other');
    const time = msg.created_at ? formatTime(msg.created_at) : '';
    div.innerHTML = `
      <div class="who">${escHtml(msg.username)}</div>
      <div class="text">${escHtml(msg.content)}</div>
      <div class="time">${time}</div>
    `;
    messagesEl.appendChild(div);
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
      return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

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
    messageInput.value = '';
  });

  socket.on('connect', () => {
    chatStatus.textContent = '';
    if (chatData) socket.emit('join_chat', { chatId: chatData.id });
  });

  socket.on('disconnect', () => {
    chatStatus.textContent = 'Reconectando...';
  });

  socket.on('message', (msg) => {
    appendBubble(msg);
    scrollToBottom();
  });

  socket.on('user_joined', ({ username }) => {
    if (username !== currentUser.username) {
      appendSystem(`${username} se unio al chat`);
    }
  });

  socket.on('participants', ({ usernames }) => {
    chatStatus.textContent = usernames.join(', ');
    setTimeout(() => { chatStatus.textContent = ''; }, 5000);
  });

  init();
})();
