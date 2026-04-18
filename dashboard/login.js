(function () {
  const el = (id) => document.getElementById(id);

  const registerPanel = el("registerPanel");
  const loginPanel = el("loginPanel");
  const authTitle = el("authTitle");
  const authSubtitle = el("authSubtitle");
  const authError = el("authError");

  const regUser = el("regUser");
  const regPass = el("regPass");
  const regPass2 = el("regPass2");
  const regForm = el("registerForm");

  const logUser = el("logUser");
  const logPass = el("logPass");
  const logForm = el("loginForm");

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || "";
    authError.hidden = !msg;
  }

  function routePanels() {
    if (typeof DashboardAuth === "undefined") {
      showError("Erro ao carregar autenticação. Recarregue a página.");
      return;
    }
    if (DashboardAuth.isAuthenticated()) {
      window.location.replace("index.html");
      return;
    }
    const has = DashboardAuth.hasRegisteredUser();
    if (has) {
      registerPanel.hidden = true;
      loginPanel.hidden = false;
      authTitle.textContent = "Entrar";
      authSubtitle.textContent =
        "Use o usuário e a senha cadastrados neste dispositivo. Administradores podem criar novos acessos em Usuários, no dashboard.";
    } else {
      registerPanel.hidden = false;
      loginPanel.hidden = true;
      authTitle.textContent = "Cadastro inicial";
      authSubtitle.textContent =
        "Crie o primeiro acesso autorizado. Depois disso, novos cadastros por esta tela ficam desativados.";
    }
  }

  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    if (regPass.value !== regPass2.value) {
      showError("As senhas não coincidem.");
      return;
    }
    try {
      await DashboardAuth.register(regUser.value, regPass.value);
      await DashboardAuth.login(regUser.value, regPass.value);
      window.location.replace("index.html");
    } catch (err) {
      showError(err.message || "Não foi possível concluir o cadastro.");
    }
  });

  logForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    try {
      await DashboardAuth.login(logUser.value, logPass.value);
      window.location.replace("index.html");
    } catch (err) {
      showError(err.message || "Não foi possível entrar.");
    }
  });

  routePanels();
})();
