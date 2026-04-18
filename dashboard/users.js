(function () {
  const el = (id) => document.getElementById(id);
  const tbody = el("usersTableBody");
  const addForm = el("addUserForm");
  const usersErr = el("usersErr");
  const usersMsg = el("usersMsg");
  const usersCountHint = el("usersCountHint");

  function showErr(msg) {
    if (!usersErr) return;
    usersErr.textContent = msg || "";
    usersErr.hidden = !msg;
    if (msg && usersMsg) {
      usersMsg.hidden = true;
      usersMsg.textContent = "";
    }
  }

  function showMsg(msg) {
    if (!usersMsg) return;
    usersMsg.textContent = msg || "";
    usersMsg.hidden = !msg;
    if (msg && usersErr) {
      usersErr.hidden = true;
      usersErr.textContent = "";
    }
  }

  function fmtDate(ts) {
    if (typeof ts !== "number") return "—";
    try {
      return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "—";
    }
  }

  function render() {
    showErr("");
    showMsg("");
    let rows;
    try {
      rows = DashboardAuth.listUsers();
    } catch (e) {
      tbody.innerHTML = "";
      showErr(e.message || "Não foi possível carregar a lista.");
      return;
    }

    const me = DashboardAuth.currentUser();
    const adminCount = rows.filter((r) => r.role === "admin").length;

    usersCountHint.textContent = `${rows.length} usuário(s) — você está logado como ${me}`;

    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach((u) => {
      const tr = document.createElement("tr");
      tr.dataset.username = u.username;

      const tdUser = document.createElement("td");
      const strong = document.createElement("strong");
      strong.textContent = u.username;
      tdUser.appendChild(strong);
      if (u.username === me) {
        const you = document.createElement("span");
        you.className = "users-you";
        you.textContent = " (você)";
        tdUser.appendChild(you);
      }

      const tdRole = document.createElement("td");
      const sel = document.createElement("select");
      sel.className = "input users-role-select";
      sel.setAttribute("aria-label", `Perfil de ${u.username}`);
      [["user", "Usuário"], ["admin", "Administrador"]].forEach(([val, lab]) => {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = lab;
        if (u.role === val) o.selected = true;
        sel.appendChild(o);
      });
      if (u.role === "admin" && adminCount === 1 && u.username === me) {
        sel.querySelector('option[value="user"]').disabled = true;
        sel.title = "É necessário haver outro administrador antes de rebaixar o seu perfil.";
      }
      tdRole.appendChild(sel);

      const tdDate = document.createElement("td");
      tdDate.textContent = fmtDate(u.createdAt);

      const tdPw = document.createElement("td");
      const pwWrap = document.createElement("div");
      pwWrap.className = "users-pw-row";
      const inp = document.createElement("input");
      inp.type = "password";
      inp.className = "input users-pw-input";
      inp.placeholder = "Nova senha";
      inp.autocomplete = "new-password";
      inp.maxLength = 128;
      const btnPw = document.createElement("button");
      btnPw.type = "button";
      btnPw.className = "btn btn--ghost users-btn-tight";
      btnPw.textContent = "Salvar";
      btnPw.dataset.action = "resetpw";
      pwWrap.append(inp, btnPw);
      tdPw.appendChild(pwWrap);

      const tdAct = document.createElement("td");
      tdAct.className = "users-col-actions";
      const btnRm = document.createElement("button");
      btnRm.type = "button";
      btnRm.className = "btn btn--ghost users-btn-danger";
      btnRm.textContent = "Excluir";
      btnRm.dataset.action = "remove";
      if (u.username === me) {
        btnRm.disabled = true;
        btnRm.title = "Não é possível excluir o próprio usuário.";
      }
      tdAct.appendChild(btnRm);

      tr.append(tdUser, tdRole, tdDate, tdPw, tdAct);
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showErr("");
    showMsg("");
    const u = el("newUsername").value;
    const p = el("newPassword").value;
    const r = el("newRole").value;
    try {
      await DashboardAuth.addUser(u, p, r);
      el("newUsername").value = "";
      el("newPassword").value = "";
      el("newRole").value = "user";
      showMsg("Usuário adicionado.");
      render();
    } catch (err) {
      showErr(err.message || "Não foi possível adicionar.");
    }
  });

  tbody.addEventListener("change", (e) => {
    const sel = e.target.closest(".users-role-select");
    if (!sel) return;
    const tr = sel.closest("tr");
    if (!tr) return;
    const username = tr.dataset.username;
    const newRole = sel.value;
    showErr("");
    showMsg("");
    try {
      DashboardAuth.setUserRole(username, newRole);
      showMsg(`Perfil de ${username} atualizado.`);
      render();
    } catch (err) {
      showErr(err.message || "Não foi possível alterar o perfil.");
      render();
    }
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const username = tr.dataset.username;

    if (btn.dataset.action === "remove") {
      if (!window.confirm(`Excluir o usuário "${username}"? Esta ação não pode ser desfeita.`)) return;
      showErr("");
      showMsg("");
      try {
        DashboardAuth.removeUser(username);
        showMsg(`Usuário ${username} removido.`);
        render();
      } catch (err) {
        showErr(err.message || "Não foi possível excluir.");
      }
      return;
    }

    if (btn.dataset.action === "resetpw") {
      const inp = tr.querySelector(".users-pw-input");
      const pw = inp && inp.value;
      if (!pw) {
        showErr("Informe a nova senha antes de salvar.");
        return;
      }
      showErr("");
      showMsg("");
      try {
        await DashboardAuth.adminResetPassword(username, pw);
        inp.value = "";
        showMsg(`Senha de ${username} atualizada.`);
      } catch (err) {
        showErr(err.message || "Não foi possível alterar a senha.");
      }
    }
  });

  render();
})();
