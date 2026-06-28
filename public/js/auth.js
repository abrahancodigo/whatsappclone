(() => {
  const form = document.getElementById('auth-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const msgEl = document.getElementById('msg');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  let mode = 'login';

  function switchTab(m) {
    mode = m;
    tabLogin.classList.toggle('active', m === 'login');
    tabRegister.classList.toggle('active', m === 'register');
    submitBtn.textContent = m === 'login' ? 'Entrar' : 'Registrarse';
    msgEl.className = 'msg';
    msgEl.textContent = '';
  }

  window.switchTab = switchTab;

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'msg ' + type;
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.user) window.location.href = '/dashboard.html';
    } catch (_) {}
  }

  checkSession();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showMsg('Completa todos los campos', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? 'Entrando...' : 'Registrando...';

    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg(data.error || 'Error', 'error');
        return;
      }

      window.location.href = '/dashboard.html';
    } catch (err) {
      showMsg('Error de conexion', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Entrar' : 'Registrarse';
    }
  });
})();
