/**
 * Dashboard alimentado por CSV.
 * Filtro por categoria ao clicar na rosca ou nas barras.
 */

const PALETTE = {
  Alimentação: "#b8f0d8",
  Transporte: "#c9d4ff",
  Moradia: "#ffe9b8",
  "Casa e Reforma": "#ffe9b8",
  Lazer: "#ffd0dc",
  Saúde: "#b8e8ff",
  Farmácia: "#b8e8ff",
  Educação: "#e4ddff",
  Livros: "#e4ddff",
  Assinaturas: "#fff3bf",
  "Compras Online": "#ffd8e8",
  "Móveis e Decoração": "#ffe4cf",
  Supermercado: "#c9f2cb",
  Beleza: "#ffd4d1",
  Viagens: "#bfe8ff",
  Vestuário: "#d9d1ff",
  Pet: "#f7d8b5",
  Combustível: "#ffe0a8",
  "Contas e Utilidades": "#d4f4ee",
  Transferências: "#d8e2ea",
  Outros: "#d8e2ea",
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CSV_URL = "./fatura_categorizada.csv";

let TRANSACOES = [];
let FATURAS_6_MESES = [];
let PARCELAS_MENSAL = [];

const fmtBRL = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDataBR = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

const monthKeyFromIso = (iso) => iso.slice(0, 7);

let activeCategory = null;
let searchQuery = "";
let monthFilterKey = null;

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
  csvFileInput: document.getElementById("csvFileInput"),
};

const CHART_FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const THEME_KEY = "dashboard-theme";

function normalizeCategory(cat) {
  if (!cat) return "Outros";
  const map = {
    "Compras online": "Compras Online",
    "compras online": "Compras Online",
  };
  return map[cat.trim()] || cat.trim();
}

function splitCsvLine(line, delimiter = ",") {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols.map((x) => x.trim());
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function normalizeWrappedCsvLine(line) {
  const raw = String(line || "").trim();
  const looksWrapped =
    raw.startsWith('"') && raw.endsWith('"') && (raw.includes(',""') || raw.includes('"",'));
  if (!looksWrapped) return raw;
  return raw.slice(1, -1).replace(/""/g, '"');
}

function normHeaderCell(s) {
  return String(s)
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColIndex(headerNorm, ...names) {
  for (const n of names) {
    const want = normHeaderCell(n);
    const i = headerNorm.indexOf(want);
    if (i !== -1) return i;
  }
  return -1;
}

function parseDateFlexible(value) {
  const s = String(value).replace(/"/g, "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const normalized = s.replace(/\./g, "/").replace(/-/g, "/");
  const [d, m, y] = normalized.split("/");
  if (!d || !m || !y) return null;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseMoneyBR(value) {
  let s = String(value).replace(/"/g, "").trim();
  if (!s) return 0;
  s = s.replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function labelFromMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_PT[m - 1]}/${String(y).slice(-2)}`;
}

function aggregateMonthlyTotals(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = monthKeyFromIso(row.data);
    map.set(key, (map.get(key) || 0) + row.valor);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({ key, label: labelFromMonthKey(key), total }));
}

function deriveTimeline(months) {
  return months.map((m) => ({ key: m.key, label: m.label, valor: m.total }));
}

function parseCsvText(text) {
  const raw = String(text).replace(/^\uFEFF/, "");
  const lines = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("O arquivo CSV está vazio ou só tem o cabeçalho.");
  }

  const delim = detectDelimiter(lines[0]);
  const headerCells = splitCsvLine(lines[0], delim);
  const headerNorm = headerCells.map(normHeaderCell);

  const idxData = findColIndex(headerNorm, "data", "date");
  const idxValor = findColIndex(headerNorm, "valor", "value", "amount");
  const idxDescricao = findColIndex(headerNorm, "descricao", "descrição", "description");
  const idxCategoria = findColIndex(headerNorm, "categoria", "category");

  if ([idxData, idxValor, idxDescricao, idxCategoria].some((x) => x === -1)) {
    throw new Error(
      "O CSV precisa ter as colunas: data, valor, descricao (ou descrição), categoria. Delimitador vírgula ou ponto e vírgula."
    );
  }

  const rows = lines
    .slice(1)
    .map((line) => normalizeWrappedCsvLine(line))
    .map((line) => splitCsvLine(line, delim))
    .map((cols) => ({
      data: parseDateFlexible(cols[idxData]),
      valor: parseMoneyBR(cols[idxValor]),
      descricao: cols[idxDescricao] || "Sem descrição",
      categoria: normalizeCategory(cols[idxCategoria]),
    }))
    .filter((row) => row.data && row.categoria);

  if (!rows.length) {
    throw new Error("Nenhuma linha válida após ler o CSV (confira formato de data e categorias).");
  }

  return rows;
}

async function fetchCsvText() {
  const urls = [CSV_URL, new URL(CSV_URL, document.baseURI || window.location.href).href];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.text();
      lastErr = new Error(`Falha ao carregar CSV (${res.status}).`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Não foi possível baixar o CSV.");
}

let csvImportBannerEl = null;
let csvImportToastEl = null;
let csvImportToastTimer = null;

function removeCsvImportBanner() {
  if (csvImportBannerEl && csvImportBannerEl.parentNode) {
    csvImportBannerEl.parentNode.removeChild(csvImportBannerEl);
  }
  csvImportBannerEl = null;
}

function showCsvImportToast(message) {
  if (csvImportToastTimer) {
    clearTimeout(csvImportToastTimer);
    csvImportToastTimer = null;
  }
  if (!csvImportToastEl) {
    csvImportToastEl = document.createElement("div");
    csvImportToastEl.className = "csv-import-toast";
    csvImportToastEl.setAttribute("role", "status");
    csvImportToastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(csvImportToastEl);
  }
  csvImportToastEl.textContent = message;
  csvImportToastEl.classList.add("is-visible");
  csvImportToastTimer = setTimeout(() => {
    if (!csvImportToastEl) return;
    csvImportToastEl.classList.remove("is-visible");
  }, 2500);
}

function showCsvImportBanner(message) {
  removeCsvImportBanner();
  const wrap = document.createElement("div");
  wrap.className = "csv-import-banner";
  wrap.setAttribute("role", "status");

  const inner = document.createElement("div");
  inner.className = "csv-import-banner__inner";

  const p1 = document.createElement("p");
  p1.className = "csv-import-banner__text";
  p1.textContent = message;

  const p2 = document.createElement("p");
  p2.className = "csv-import-banner__hint";
  p2.innerHTML =
    "Ao abrir o <code>index.html</code> direto pelo Windows, o navegador costuma bloquear a leitura do CSV. " +
    "Sirva a pasta <code>dashboard</code> com um servidor local (ex.: <code>npx serve .</code> nesta pasta) " +
    "ou escolha o arquivo abaixo.";

  const label = document.createElement("label");
  label.className = "btn btn--primary csv-import-banner__file";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.hidden = true;
  label.append("Escolher fatura_categorizada.csv", input);

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    importCsvFile(file, { closeBannerOnSuccess: true });
  });

  inner.append(p1, p2, label);
  wrap.appendChild(inner);
  document.body.prepend(wrap);
  csvImportBannerEl = wrap;
}

function readFileAsText(file, encoding) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo escolhido."));
    reader.readAsText(file, encoding);
  });
}

async function importCsvFile(file, options = {}) {
  if (!file) return;
  const closeBannerOnSuccess = Boolean(options.closeBannerOnSuccess);
  const encodings = ["UTF-8", "ISO-8859-1", "windows-1252"];
  let lastError = null;

  for (const encoding of encodings) {
    try {
      const text = await readFileAsText(file, encoding);
      applyDashboardFromCsvString(text);
      if (closeBannerOnSuccess) removeCsvImportBanner();
      showCsvImportToast("CSV importado com sucesso.");
      return;
    } catch (err) {
      lastError = err;
    }
  }

  renderLoadError(lastError?.message || "CSV inválido.");
}

function applyDashboardFromCsvString(text) {
  TRANSACOES = parseCsvText(text);
  FATURAS_6_MESES = aggregateMonthlyTotals(TRANSACOES).slice(-6);
  PARCELAS_MENSAL = deriveTimeline(FATURAS_6_MESES);
  monthFilterKey = null;
  activeCategory = null;
  searchQuery = "";
  if (els.searchInput) els.searchInput.value = "";
  syncFilterUi();
  renderTimeline();
  updateKpis(getFilteredTransactions());
  renderTable();
  updateCharts();
}

async function loadCsvData() {
  const text = await fetchCsvText();
  return parseCsvText(text);
}

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
    els.kpiTotalHint.textContent = "Todos os lançamentos do CSV";
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

function renderLoadError(message) {
  els.tableSubtitle.textContent = message;
  els.tableBody.innerHTML = "";
  els.timeline.innerHTML = `<div class="timeline__month"><span class="timeline__label">${message}</span><div></div><span class="timeline__value">—</span></div>`;
  els.kpiTotal.textContent = "—";
  els.kpiCount.textContent = "—";
  els.kpiTicket.textContent = "—";
  els.kpiParcelado.textContent = "—";
  els.kpiTotalHint.textContent = "Falha ao carregar CSV";
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
  const usersLink = document.getElementById("usersAdminLink");
  if (usersLink && DashboardAuth.isAdmin()) {
    usersLink.hidden = false;
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
  updateCharts();
});

if (els.csvFileInput) {
  els.csvFileInput.addEventListener("change", () => {
    const file = els.csvFileInput.files && els.csvFileInput.files[0];
    importCsvFile(file);
    els.csvFileInput.value = "";
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    clearAllFilters();
  }
});

async function initDashboard() {
  syncFilterUi();
  try {
    TRANSACOES = await loadCsvData();
    FATURAS_6_MESES = aggregateMonthlyTotals(TRANSACOES).slice(-6);
    PARCELAS_MENSAL = deriveTimeline(FATURAS_6_MESES);
    renderTimeline();
    updateKpis(getFilteredTransactions());
    renderTable();
    updateCharts();
  } catch (err) {
    const msg = err?.message || "Não foi possível carregar os dados.";
    renderLoadError(msg);
    showCsvImportBanner(msg);
  }
}

initDashboard();
