/**
 * Autenticação local (demonstração): múltiplos usuários, papéis admin/usuário,
 * hash SHA-256 da senha e sessão em sessionStorage.
 * Em produção use backend + HTTPS; dados no navegador podem ser alterados.
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

  function readStorageAccounts() {
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

  /** Migra contas antigas (sem role) e preenche createdAt quando faltar. */
  function normalizeAccounts(list) {
    return list.map((row, index) => {
      const role =
        row.role === "admin" || row.role === "user" ? row.role : index === 0 ? "admin" : "user";
      const createdAt = typeof row.createdAt === "number" ? row.createdAt : Date.now();
      return {
        username: row.username,
        hash: row.hash,
        role,
        createdAt,
      };
    });
  }

  function accountsNeedNormalize(raw, normalized) {
    if (raw.length !== normalized.length) return true;
    for (let i = 0; i < raw.length; i++) {
      const o = raw[i];
      const n = normalized[i];
      if (o.username !== n.username || o.hash !== n.hash) return true;
      if (o.role !== n.role) return true;
      if (typeof o.createdAt !== "number") return true;
    }
    return false;
  }

  function loadAccounts() {
    const raw = readStorageAccounts();
    if (!raw.length) return [];
    const normalized = normalizeAccounts(raw);
    if (accountsNeedNormalize(raw, normalized)) {
      saveAccounts(normalized);
    }
    return normalized;
  }

  function hasRegisteredUser() {
    return loadAccounts().length > 0;
  }

  function isAuthenticated() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || typeof s.u !== "string") return false;
      return loadAccounts().some((x) => x.username === s.u);
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

  function getAccount(username) {
    return loadAccounts().find((x) => x.username === username) || null;
  }

  function currentUserRole() {
    const u = currentUser();
    if (!u) return null;
    return getAccount(u)?.role || null;
  }

  function isAdmin() {
    return currentUserRole() === "admin";
  }

  function assertAdmin() {
    if (!isAuthenticated()) throw new Error("Sessão inválida.");
    if (!isAdmin()) throw new Error("Apenas administradores podem realizar esta ação.");
  }

  async function register(username, password) {
    if (loadAccounts().length > 0) {
      throw new Error("O cadastro inicial já foi concluído. Peça a um administrador para criar seu acesso.");
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      throw new Error("Usuário deve ter pelo menos 3 caracteres.");
    }
    if (password.length < 8) {
      throw new Error("Senha deve ter pelo menos 8 caracteres.");
    }
    const hash = await hashCredential(trimmed, password);
    saveAccounts([{ username: trimmed, hash, role: "admin", createdAt: Date.now() }]);
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

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function listUsers() {
    assertAdmin();
    return loadAccounts().map(({ username, role, createdAt }) => ({
      username,
      role,
      createdAt,
    }));
  }

  async function addUser(username, password, role = "user") {
    assertAdmin();
    let r = role === "admin" ? "admin" : "user";
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      throw new Error("Usuário deve ter pelo menos 3 caracteres.");
    }
    if (password.length < 8) {
      throw new Error("Senha deve ter pelo menos 8 caracteres.");
    }
    const list = loadAccounts();
    if (list.some((x) => x.username.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Já existe um usuário com esse nome.");
    }
    const hash = await hashCredential(trimmed, password);
    list.push({ username: trimmed, hash, role: r, createdAt: Date.now() });
    saveAccounts(list);
  }

  function removeUser(targetUsername) {
    assertAdmin();
    const me = currentUser();
    if (!me) throw new Error("Sessão inválida.");
    if (targetUsername === me) {
      throw new Error("Você não pode excluir o seu próprio usuário.");
    }
    const list = loadAccounts();
    if (list.length <= 1) {
      throw new Error("Não é possível excluir o único usuário cadastrado.");
    }
    const idx = list.findIndex((x) => x.username === targetUsername);
    if (idx === -1) throw new Error("Usuário não encontrado.");
    const victim = list[idx];
    const admins = list.filter((x) => x.role === "admin");
    if (victim.role === "admin" && admins.length === 1) {
      throw new Error("Não é possível excluir o único administrador.");
    }
    list.splice(idx, 1);
    saveAccounts(list);
  }

  function setUserRole(targetUsername, newRole) {
    assertAdmin();
    const r = newRole === "admin" ? "admin" : "user";
    const list = loadAccounts();
    const idx = list.findIndex((x) => x.username === targetUsername);
    if (idx === -1) throw new Error("Usuário não encontrado.");
    const row = list[idx];
    const admins = list.filter((x) => x.role === "admin");
    if (row.role === "admin" && r === "user" && admins.length === 1) {
      throw new Error("É obrigatório manter pelo menos um administrador.");
    }
    list[idx] = { ...row, role: r };
    saveAccounts(list);
  }

  async function adminResetPassword(targetUsername, newPassword) {
    assertAdmin();
    if (newPassword.length < 8) {
      throw new Error("Nova senha deve ter pelo menos 8 caracteres.");
    }
    const list = loadAccounts();
    const idx = list.findIndex((x) => x.username === targetUsername);
    if (idx === -1) throw new Error("Usuário não encontrado.");
    const row = list[idx];
    const hash = await hashCredential(row.username, newPassword);
    list[idx] = { ...row, hash };
    saveAccounts(list);
  }

  global.DashboardAuth = {
    hasRegisteredUser,
    register,
    login,
    isAuthenticated,
    currentUser,
    currentUserRole,
    isAdmin,
    logout,
    listUsers,
    addUser,
    removeUser,
    setUserRole,
    adminResetPassword,
  };
})(typeof window !== "undefined" ? window : globalThis);
