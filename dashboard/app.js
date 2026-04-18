/**
 * Dashboard demo — dados mockados (últimos 6 meses + 20 lançamentos).
 * Filtro por categoria ao clicar na rosca ou nas barras (estilo Power BI).
 */

/** Pastéis inspirados em penas de arara + folhagem (natureza) */
const PALETTE = {
  Alimentação: "#b8f0d8",
  Transporte: "#c9d4ff",
  Moradia: "#ffe9b8",
  Lazer: "#ffd0dc",
  Saúde: "#b8e8ff",
  Educação: "#e4ddff",
  Assinaturas: "#fff3bf",
  "Compras online": "#ffd8e8",
  Outros: "#d8e2ea",
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Últimos 6 meses (rótulo curto + chave YYYY-MM) — referência: Abr/2026 */
const FATURAS_6_MESES = [
  { key: "2025-11", label: "Nov/25", total: 4280.4 },
  { key: "2025-12", label: "Dez/25", total: 5122.9 },
  { key: "2026-01", label: "Jan/26", total: 3890.15 },
  { key: "2026-02", label: "Fev/26", total: 4765.5 },
  { key: "2026-03", label: "Mar/26", total: 4410.0 },
  { key: "2026-04", label: "Abr/26", total: 4688.75 },
];

/** Soma de parcelas comprometidas por mês (mock) */
const PARCELAS_MENSAL = [
  { key: "2025-11", label: "Nov/25", valor: 820.0 },
  { key: "2025-12", label: "Dez/25", valor: 940.5 },
  { key: "2026-01", label: "Jan/26", valor: 1105.2 },
  { key: "2026-02", label: "Fev/26", valor: 980.0 },
  { key: "2026-03", label: "Mar/26", valor: 1240.75 },
  { key: "2026-04", label: "Abr/26", valor: 1188.3 },
];

const TRANSACOES = [
  { data: "2026-04-14", descricao: "Supermercado Semanal", categoria: "Alimentação", valor: 312.45 },
  { data: "2026-04-12", descricao: "Uber / corridas", categoria: "Transporte", valor: 86.2 },
  { data: "2026-04-10", descricao: "Farmácia central", categoria: "Saúde", valor: 124.9 },
  { data: "2026-04-08", descricao: "Streaming + música", categoria: "Assinaturas", valor: 59.9 },
  { data: "2026-04-05", descricao: "Restaurante (jantar)", categoria: "Alimentação", valor: 178.0 },
  { data: "2026-04-03", descricao: "Parcela notebook 4/10", categoria: "Compras online", valor: 249.9 },
  { data: "2026-04-01", descricao: "Condomínio", categoria: "Moradia", valor: 620.0 },
  { data: "2026-03-28", descricao: "Academia", categoria: "Saúde", valor: 99.9 },
  { data: "2026-03-22", descricao: "Cinema + pipoca", categoria: "Lazer", valor: 72.0 },
  { data: "2026-03-18", descricao: "Curso online (parcela)", categoria: "Educação", valor: 149.5 },
  { data: "2026-03-15", descricao: "Combustível", categoria: "Transporte", valor: 260.0 },
  { data: "2026-03-10", descricao: "E-commerce — roupas", categoria: "Compras online", valor: 189.9 },
  { data: "2026-03-06", descricao: "Padaria / café", categoria: "Alimentação", valor: 42.3 },
  { data: "2026-03-02", descricao: "Plano móvel", categoria: "Assinaturas", valor: 89.99 },
  { data: "2026-02-26", descricao: "Manutenção hidráulica", categoria: "Moradia", valor: 350.0 },
  { data: "2026-02-20", descricao: "Show ingressos", categoria: "Lazer", valor: 220.0 },
  { data: "2026-02-14", descricao: "Mercado delivery", categoria: "Alimentação", valor: 267.8 },
  { data: "2026-02-09", descricao: "Transporte público + app", categoria: "Transporte", valor: 118.4 },
  { data: "2026-02-04", descricao: "Consulta particular", categoria: "Saúde", valor: 280.0 },
  { data: "2026-01-30", descricao: "Livros técnicos", categoria: "Educação", valor: 156.0 },
];

const fmtBRL = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDataBR = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

const monthKeyFromIso = (iso) => iso.slice(0, 7);

let activeCategory = null;
let searchQuery = "";

const els = {
  kpiTotal: document.getElementById("kpiTotal"),
  kpiTotalHint: document.getElementById("kpiTotalHint"),
  kpiCount: document.getElementById("kpiCount"),
  kpiTicket: document.getElementById("kpiTicket"),
  kpiParcelado: document.getElementById("kpiParcelado"),
  filterBar: document.getElementById("filterBar"),
  activeFilterLabel: document.getElementById("activeFilterLabel"),
  clearFilterBtn: document.getElementById("clearFilterBtn"),
  clearAllFiltersBtn: document.getElementById("clearAllFiltersBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  sessionUserLabel: document.getElementById("sessionUserLabel"),
  activeFilterChip: document.getElementById("activeFilterChip"),
  tableBody: document.getElementById("tableBody"),
  tableSubtitle: document.getElementById("tableSubtitle"),
  searchInput: document.getElementById("searchInput"),
  timeline: document.getElementById("timeline"),
};

const CHART_FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const THEME_KEY = "dashboard-theme";

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function getChartUi() {
  if (isDarkTheme()) {
    return {
      text: "#aeb6c9",
      grid: "rgba(255, 255, 255, 0.08)",
      tooltipBg: "rgba(16, 19, 28, 0.96)",
      tooltipBorder: "rgba(255, 255, 255, 0.1)",
      titleColor: "#e8ecf3",
      bodyColor: "#aeb6c9",
      donutBorder: "#141a26",
      lineBorder: "#8fd4c4",
      linePointFill: "#141a26",
      linePointBorder: "#8fd4c4",
      lineFillTop: "rgba(143, 212, 196, 0.38)",
      lineFillMid: "rgba(120, 170, 210, 0.14)",
    };
  }
  return {
    text: "#5c677a",
    grid: "rgba(42, 51, 65, 0.07)",
    tooltipBg: "rgba(255, 255, 255, 0.97)",
    tooltipBorder: "rgba(42, 51, 65, 0.1)",
    titleColor: "#2a3341",
    bodyColor: "#5c677a",
    donutBorder: "#ffffff",
    lineBorder: "#7ccfb8",
    linePointFill: "#ffffff",
    linePointBorder: "#6ab8a8",
    lineFillTop: "rgba(124, 207, 184, 0.38)",
    lineFillMid: "rgba(191, 232, 255, 0.2)",
  };
}

function getChartCommon() {
  const ui = getChartUi();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        labels: {
          color: ui.text,
          font: { family: CHART_FONT, size: 11, weight: "600" },
          usePointStyle: true,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: ui.tooltipBg,
        borderColor: ui.tooltipBorder,
        borderWidth: 1,
        titleColor: ui.titleColor,
        bodyColor: ui.bodyColor,
        titleFont: { family: CHART_FONT, size: 12, weight: "700" },
        bodyFont: { family: CHART_FONT, size: 12, weight: "500" },
        padding: 12,
        displayColors: true,
        cornerRadius: 12,
        boxPadding: 6,
        callbacks: {
          label(ctx) {
            const v = ctx.parsed;
            if (typeof v === "number") return ` ${fmtBRL(v)}`;
            if (v && typeof v.x === "number") return ` ${fmtBRL(v.y)}`;
            if (v && typeof v.y === "number") return ` ${fmtBRL(v.y)}`;
            return ` ${ctx.formattedValue}`;
          },
        },
      },
    },
  };
}

function aggregateByCategory(rows) {
  const map = new Map();
  for (const r of rows) {
    map.set(r.categoria, (map.get(r.categoria) || 0) + r.valor);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function topN(entries, n) {
  return entries.slice(0, n);
}

function colorForCategory(cat, dimOthers) {
  const base = PALETTE[cat] || PALETTE.Outros;
  if (!dimOthers || !activeCategory) return base;
  if (cat === activeCategory) return base;
  return withAlpha(base, 0.22);
}

function withAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getFilteredTransactions() {
  let rows = TRANSACOES;
  if (activeCategory) rows = rows.filter((r) => r.categoria === activeCategory);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.descricao.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q) ||
        r.data.includes(q)
    );
  }
  return rows;
}

function getBaseRowsForCharts() {
  return activeCategory ? TRANSACOES.filter((r) => r.categoria === activeCategory) : TRANSACOES;
}

function updateKpis(rowsForKpi) {
  const total = rowsForKpi.reduce((s, r) => s + r.valor, 0);
  const count = rowsForKpi.length;
  const ticket = count ? total / count : 0;
  const parceladoMes = PARCELAS_MENSAL.reduce((s, m) => s + m.valor, 0);

  els.kpiTotal.textContent = fmtBRL(total);
  els.kpiCount.textContent = String(count);
  els.kpiTicket.textContent = fmtBRL(ticket);
  els.kpiParcelado.textContent = fmtBRL(parceladoMes);

  if (activeCategory) {
    els.kpiTotalHint.textContent = `Filtrado: ${activeCategory}`;
  } else if (searchQuery.trim()) {
    els.kpiTotalHint.textContent = "Filtrado pela busca na tabela";
  } else {
    els.kpiTotalHint.textContent = "Todos os lançamentos mockados";
  }
}

function setFilter(category) {
  if (activeCategory && activeCategory === category) {
    activeCategory = null;
  } else {
    activeCategory = category;
  }
  syncFilterUi();
  renderTable();
  updateKpis(getFilteredTransactions());
  updateCharts();
}

function clearFilter() {
  activeCategory = null;
  syncFilterUi();
  renderTable();
  updateKpis(getFilteredTransactions());
  updateCharts();
}

function clearAllFilters() {
  activeCategory = null;
  monthFilterKey = null;
  searchQuery = "";
  els.searchInput.value = "";
  syncFilterUi();
  renderTable();
  updateKpis(getFilteredTransactions());
  updateCharts();
}

function syncFilterUi() {
  const has = Boolean(activeCategory);
  els.filterBar.hidden = !has;
  if (has) els.activeFilterLabel.textContent = activeCategory;
}

let chartDonut;
let chartHBar;
let chartLine;

function buildDonut() {
  const baseRows = getBaseRowsForCharts();
  const agg = aggregateByCategory(baseRows.length ? baseRows : TRANSACOES);
  const labels = agg.map(([c]) => c);
  const data = agg.map(([, v]) => v);
  const colors = labels.map((c) => colorForCategory(c, true));

  const ui = getChartUi();
  const cc = getChartCommon();
  const cfg = {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: ui.donutBorder,
          hoverOffset: 10,
          spacing: 2,
        },
      ],
    },
    options: {
      ...cc,
      cutout: "62%",
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const cat = chartDonut.data.labels[idx];
        setFilter(cat);
      },
      plugins: {
        ...cc.plugins,
        legend: { ...cc.plugins.legend, position: "right" },
      },
    },
  };

  if (chartDonut) {
    const cc2 = getChartCommon();
    chartDonut.data.labels = labels;
    chartDonut.data.datasets[0].data = data;
    chartDonut.data.datasets[0].backgroundColor = colors;
    chartDonut.data.datasets[0].borderColor = getChartUi().donutBorder;
    Object.assign(chartDonut.options.plugins.legend.labels, cc2.plugins.legend.labels);
    chartDonut.options.plugins.tooltip = { ...cc2.plugins.tooltip };
    chartDonut.update();
  } else {
    chartDonut = new Chart(document.getElementById("chartDonut"), cfg);
  }
}

function buildHBar() {
  const baseRows = getBaseRowsForCharts();
  const agg = aggregateByCategory(baseRows.length ? baseRows : TRANSACOES);
  const top = topN(agg, 5);
  const labels = top.map(([c]) => c).reverse();
  const data = top.map(([, v]) => v).reverse();
  const colors = labels.map((c) => colorForCategory(c, true));

  const u0 = getChartUi();
  const cc0 = getChartCommon();
  const cfg = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Valor (R$)",
          data,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: "y",
      ...cc0,
      scales: {
        x: {
          grid: { color: u0.grid },
          ticks: {
            color: u0.text,
            font: { family: CHART_FONT, size: 11, weight: "500" },
            callback: (v) => fmtBRL(Number(v)),
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: u0.text, font: { family: CHART_FONT, size: 11, weight: "600" } },
        },
      },
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const cat = chartHBar.data.labels[idx];
        setFilter(cat);
      },
      plugins: {
        ...cc0.plugins,
        legend: { display: false },
      },
    },
  };

  if (chartHBar) {
    chartHBar.data.labels = labels;
    chartHBar.data.datasets[0].data = data;
    chartHBar.data.datasets[0].backgroundColor = colors;
    const u = getChartUi();
    const cc = getChartCommon();
    chartHBar.options.scales.x.grid.color = u.grid;
    chartHBar.options.scales.x.ticks.color = u.text;
    chartHBar.options.scales.y.ticks.color = u.text;
    chartHBar.options.plugins.tooltip = { ...cc.plugins.tooltip };
    chartHBar.update();
  } else {
    chartHBar = new Chart(document.getElementById("chartHBar"), cfg);
  }
}

function buildLine() {
  const labels = FATURAS_6_MESES.map((m) => m.label);
  const data = FATURAS_6_MESES.map((m) => m.total);
  const ui = getChartUi();
  const cc = getChartCommon();

  const cfg = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total da fatura",
          data,
          tension: 0.35,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          borderColor: ui.lineBorder,
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return null;
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            const u = getChartUi();
            g.addColorStop(0, u.lineFillTop);
            g.addColorStop(0.45, u.lineFillMid);
            g.addColorStop(1, "rgba(255, 255, 255, 0)");
            return g;
          },
          pointBackgroundColor: ui.linePointFill,
          pointBorderColor: ui.linePointBorder,
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      ...cc,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { color: ui.grid },
          ticks: { color: ui.text, font: { family: CHART_FONT, size: 11, weight: "500" } },
        },
        y: {
          grid: { color: ui.grid },
          ticks: {
            color: ui.text,
            font: { family: CHART_FONT, size: 11, weight: "500" },
            callback: (v) => fmtBRL(Number(v)),
          },
        },
      },
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const key = FATURAS_6_MESES[idx].key;
        filterTableByMonthKey(key);
      },
      plugins: {
        ...cc.plugins,
        legend: { display: false },
        tooltip: {
          ...cc.plugins.tooltip,
          callbacks: {
            ...cc.plugins.tooltip.callbacks,
            afterBody(items) {
              const i = items[0]?.dataIndex;
              if (i == null) return "";
              return "Clique para filtrar transações deste mês";
            },
          },
        },
      },
    },
  };

  if (chartLine) {
    chartLine.data.labels = labels;
    chartLine.data.datasets[0].data = data;
    const u2 = getChartUi();
    const ds = chartLine.data.datasets[0];
    ds.borderColor = u2.lineBorder;
    ds.pointBackgroundColor = u2.linePointFill;
    ds.pointBorderColor = u2.linePointBorder;
    chartLine.options.scales.x.grid.color = u2.grid;
    chartLine.options.scales.x.ticks.color = u2.text;
    chartLine.options.scales.y.grid.color = u2.grid;
    chartLine.options.scales.y.ticks.color = u2.text;
    const ttp = getChartCommon().plugins.tooltip;
    chartLine.options.plugins.tooltip = {
      ...ttp,
      callbacks: {
        ...ttp.callbacks,
        afterBody(items) {
          const i = items[0]?.dataIndex;
          if (i == null) return "";
          return "Clique para filtrar transações deste mês";
        },
      },
    };
    chartLine.update();
  } else {
    chartLine = new Chart(document.getElementById("chartLine"), cfg);
  }
}

let monthFilterKey = null;

function filterTableByMonthKey(key) {
  if (monthFilterKey === key) monthFilterKey = null;
  else monthFilterKey = key;
  renderTable();
  updateKpis(getFilteredTransactions());
}

function renderTable() {
  const rows = TRANSACOES.filter((r) => {
    if (activeCategory && r.categoria !== activeCategory) return false;
    if (monthFilterKey && monthKeyFromIso(r.data) !== monthFilterKey) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (
        !r.descricao.toLowerCase().includes(q) &&
        !r.categoria.toLowerCase().includes(q) &&
        !r.data.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const sorted = [...rows].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  els.tableBody.innerHTML = "";
  const frag = document.createDocumentFragment();

  sorted.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${40 + i * 22}ms`;

    const dim =
      activeCategory &&
      r.categoria !== activeCategory &&
      !searchQuery &&
      !monthFilterKey;
    const hi = activeCategory && r.categoria === activeCategory;
    if (dim) tr.classList.add("is-dimmed");
    if (hi) tr.classList.add("is-highlight");

    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDataBR(r.data);

    const tdDesc = document.createElement("td");
    tdDesc.textContent = r.descricao;

    const tdCat = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = r.categoria;
    badge.style.borderColor = withAlpha(PALETTE[r.categoria] || PALETTE.Outros, 0.45);
    badge.style.background = withAlpha(PALETTE[r.categoria] || PALETTE.Outros, 0.12);
    tdCat.appendChild(badge);

    const tdVal = document.createElement("td");
    tdVal.className = "num";
    tdVal.textContent = fmtBRL(r.valor);

    tr.append(tdDate, tdDesc, tdCat, tdVal);
    frag.appendChild(tr);
  });

  els.tableBody.appendChild(frag);

  const parts = [];
  if (activeCategory) parts.push(activeCategory);
  if (monthFilterKey) {
    const m = FATURAS_6_MESES.find((x) => x.key === monthFilterKey);
    parts.push(m ? `mês ${m.label}` : monthFilterKey);
  }
  if (searchQuery.trim()) parts.push(`busca “${searchQuery.trim()}”`);

  const suffix = parts.length ? ` — filtro: ${parts.join(" · ")}` : "";
  els.tableSubtitle.textContent = `${sorted.length} de ${TRANSACOES.length} lançamentos${suffix}`;
}

function updateCharts() {
  buildDonut();
  buildHBar();
  buildLine();
}

function renderTimeline() {
  const max = Math.max(...PARCELAS_MENSAL.map((m) => m.valor), 1);
  els.timeline.innerHTML = "";

  PARCELAS_MENSAL.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "timeline__month";
    row.style.setProperty("--tl-delay", `${80 + i * 70}ms`);

    const lab = document.createElement("span");
    lab.className = "timeline__label";
    lab.textContent = m.label;

    const barWrap = document.createElement("div");
    barWrap.className = "timeline__bar";
    const fill = document.createElement("div");
    fill.className = "timeline__fill";
    barWrap.appendChild(fill);

    const val = document.createElement("span");
    val.className = "timeline__value";
    val.textContent = fmtBRL(m.valor);

    row.append(lab, barWrap, val);
    els.timeline.appendChild(row);

    requestAnimationFrame(() => {
      fill.style.width = `${(m.valor / max) * 100}%`;
    });
  });
}

function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
  } catch (_) {}
  return "light";
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
  syncThemeToggle();
}

function syncThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const dark = isDarkTheme();
  btn.setAttribute("aria-pressed", dark ? "true" : "false");
  btn.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
  btn.title = dark ? "Tema claro" : "Tema escuro";
}

const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  if (!document.documentElement.dataset.theme) {
    applyTheme(getStoredTheme());
  } else {
    syncThemeToggle();
  }
  themeToggle.addEventListener("click", () => {
    applyTheme(isDarkTheme() ? "light" : "dark");
    updateCharts();
  });
} else {
  syncThemeToggle();
}

els.clearFilterBtn.addEventListener("click", clearFilter);
els.clearAllFiltersBtn.addEventListener("click", clearAllFilters);
els.activeFilterChip.addEventListener("click", clearFilter);

if (typeof DashboardAuth !== "undefined") {
  const u = DashboardAuth.currentUser();
  if (els.sessionUserLabel && u) {
    els.sessionUserLabel.textContent = u;
    els.sessionUserLabel.title = `Conectado como ${u}`;
  }
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", () => {
      DashboardAuth.logout();
      window.location.href = "login.html";
    });
  }
}

els.searchInput.addEventListener("input", () => {
  searchQuery = els.searchInput.value;
  renderTable();
  updateKpis(getFilteredTransactions());
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    clearAllFilters();
  }
});

syncFilterUi();
renderTimeline();
updateKpis(getFilteredTransactions());
renderTable();
updateCharts();
