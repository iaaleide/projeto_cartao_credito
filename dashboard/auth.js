/**
 * Autenticação local (demonstração): cadastro único + login com sessão em sessionStorage.
 * A senha nunca é armazenada em texto puro — apenas hash SHA-256 com salt fixo.
 * Em produção use backend e HTTPS; aqui quem controla o navegador pode inspecionar o storage.
 */
(function (global) {
  const ACCOUNTS_KEY = "dashboard_accounts_v1";
  const SESSION_KEY = "dashboard_session_v1";
  const AUTH_SALT = "dashboard-arara-auth-v1";

  function bufToHex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function ensureCrypto() {
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error(
        "Este ambiente não oferece criptografia no navegador. Abra o dashboard por HTTPS ou em localhost."
      );
    }
  }

  async function hashCredential(username, password) {
    ensureCrypto();
    const msg = `${AUTH_SALT}\n${username}\n${password}`;
    const enc = new TextEncoder().encode(msg);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return bufToHex(digest);
  }

  function loadAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveAccounts(list) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }

  function hasRegisteredUser() {
    return loadAccounts().length > 0;
  }

  async function register(username, password) {
    if (loadAccounts().length > 0) {
      throw new Error("O cadastro inicial já foi concluído. Use o login.");
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      throw new Error("Usuário deve ter pelo menos 3 caracteres.");
    }
    if (password.length < 8) {
      throw new Error("Senha deve ter pelo menos 8 caracteres.");
    }
    const hash = await hashCredential(trimmed, password);
    saveAccounts([{ username: trimmed, hash }]);
    return trimmed;
  }

  async function login(username, password) {
    const u = username.trim();
    if (!u || !password) throw new Error("Preencha usuário e senha.");
    const list = loadAccounts();
    const row = list.find((x) => x.username.toLowerCase() === u.toLowerCase());
    if (!row) throw new Error("Usuário ou senha inválidos.");
    const h = await hashCredential(row.username, password);
    if (h !== row.hash) throw new Error("Usuário ou senha inválidos.");
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ u: row.username, t: Date.now() }));
    return row.username;
  }

  function isAuthenticated() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || typeof s.u !== "string") return false;
      const list = loadAccounts();
      return list.some((x) => x.username === s.u);
    } catch {
      return false;
    }
  }

  function currentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && typeof s.u === "string" ? s.u : null;
    } catch {
      return null;
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  global.DashboardAuth = {
    hasRegisteredUser,
    register,
    login,
    isAuthenticated,
    currentUser,
    logout,
  };
})(typeof window !== "undefined" ? window : globalThis);
