(() => {
  const usernameDisplay = document.getElementById('username-display');
  const logoutBtn = document.getElementById('logout-btn');
  const createName = document.getElementById('create-name');
  const createBtn = document.getElementById('create-btn');
  const joinCode = document.getElementById('join-code');
  const joinBtn = document.getElementById('join-btn');
  const chatList = document.getElementById('chat-list');
  const emptyMsg = document.getElementById('empty-msg');

  let currentUser = null;

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

  function getCsrfToken() {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  }

  async function init() {
    try {
      const res = await apiFetch('/api/me');
      const data = await res.json();
      if (!data.user) {
        window.location.href = '/';
        return;
      }
      currentUser = data.user;
      usernameDisplay.textContent = currentUser.username;
      loadChats();
    } catch (_) {
      window.location.href = '/';
    }
  }

  async function loadChats() {
    try {
      const res = await apiFetch('/api/chats');
      const data = await res.json();
      renderChats(data.chats);
    } catch (_) {}
  }

  function renderChats(chats) {
    chatList.innerHTML = '';
    if (!chats.length) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    chats.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <span class="name">${escHtml(c.name)}</span>
          <span class="meta">&nbsp;&middot; ${c.members} miembro${c.members !== 1 ? 's' : ''}</span>
          ${c.isOwner ? '<span class="badge-owner">Admin</span>' : ''}
        </div>
        <div class="actions">
          <code class="code-badge">${escHtml(c.code)}</code>
          <button class="btn-small go-btn" data-code="${escHtml(c.code)}">Abrir</button>
          ${c.isOwner
            ? `<button class="btn-small btn-danger del-btn" data-id="${c.id}" title="Eliminar chat">&times;</button>`
            : `<button class="btn-small btn-outline leave-btn" data-id="${c.id}" title="Salir del chat">Salir</button>`
          }
        </div>
      `;
      chatList.appendChild(li);
    });

    chatList.querySelectorAll('.go-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `/chat.html?c=${btn.dataset.code}`;
      });
    });

    chatList.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eliminar este chat? Todos los mensajes se perderan.')) return;
        try {
          await apiFetch(`/api/chats/${btn.dataset.id}`, { method: 'DELETE' });
          loadChats();
        } catch (_) {
          alert('Error al eliminar');
        }
      });
    });

    chatList.querySelectorAll('.leave-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Salir de este chat?')) return;
        try {
          await apiFetch(`/api/chats/${btn.dataset.id}/leave`, { method: 'POST' });
          loadChats();
        } catch (_) {
          alert('Error al salir');
        }
      });
    });
  }

  createBtn.addEventListener('click', async () => {
    const name = createName.value.trim();
    if (!name) return;
    createBtn.disabled = true;
    try {
      const res = await apiFetch('/api/chats', { method: 'POST', body: { name } });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error');
        return;
      }
      createName.value = '';
      window.location.href = data.link;
    } catch (_) {
      alert('Error de conexion');
    } finally {
      createBtn.disabled = false;
    }
  });

  joinBtn.addEventListener('click', async () => {
    const code = joinCode.value.trim();
    if (!code) return;
    joinBtn.disabled = true;
    try {
      const res = await apiFetch('/api/chats/join', { method: 'POST', body: { code } });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error');
        return;
      }
      joinCode.value = '';
      window.location.href = data.link;
    } catch (_) {
      alert('Error de conexion');
    } finally {
      joinBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (!confirm('Eliminar tu cuenta? Se borraran todos tus datos permanentemente.')) return;
    if (!confirm('Estas seguro? Esta accion no se puede deshacer.')) return;
    try {
      await apiFetch('/api/me', { method: 'DELETE' });
      window.location.href = '/';
    } catch (_) {
      alert('Error al eliminar cuenta');
    }
  });

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  init();
})();
