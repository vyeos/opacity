const list = document.getElementById("signalList");
const filters = document.getElementById("filters");
const refreshBtn = document.getElementById("refreshBtn");
const settingsBtn = document.getElementById("settingsBtn");
const quitBtn = document.getElementById("quitBtn");
const settingsPanel = document.getElementById("settingsPanel");
const refreshIntervalInput = document.getElementById("refreshIntervalInput");
const pageSizeInput = document.getElementById("pageSizeInput");
const defaultSourceInput = document.getElementById("defaultSourceInput");
const compactModeInput = document.getElementById("compactModeInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const restoreHiddenBtn = document.getElementById("restoreHiddenBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const template = document.getElementById("signalTemplate");

const SETTINGS_KEY = "opacity_menubar_settings_v1";
const DEFAULT_SETTINGS = {
  refreshIntervalSec: 30,
  pageSize: 40,
  defaultSource: "all",
  compactMode: false
};

let allSignals = [];
let activeSource = "all";
let refreshTimer = null;
let initializedFilter = false;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);

    return {
      refreshIntervalSec: Number(parsed.refreshIntervalSec) >= 10 ? Number(parsed.refreshIntervalSec) : DEFAULT_SETTINGS.refreshIntervalSec,
      pageSize: Number(parsed.pageSize) >= 10 ? Number(parsed.pageSize) : DEFAULT_SETTINGS.pageSize,
      defaultSource: typeof parsed.defaultSource === "string" ? parsed.defaultSource : DEFAULT_SETTINGS.defaultSource,
      compactMode: Boolean(parsed.compactMode)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettingsToUi() {
  refreshIntervalInput.value = String(settings.refreshIntervalSec);
  pageSizeInput.value = String(settings.pageSize);
  compactModeInput.checked = settings.compactMode;

  if (settings.compactMode) {
    document.body.classList.add("compact");
  } else {
    document.body.classList.remove("compact");
  }
}

function resetRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refresh, settings.refreshIntervalSec * 1000);
}

function getSourceOptions() {
  const sources = new Set(["all"]);
  for (const signal of allSignals) sources.add(signal.source);
  return Array.from(sources);
}

function renderDefaultSourceOptions() {
  const options = getSourceOptions();
  defaultSourceInput.innerHTML = "";

  for (const source of options) {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source.toUpperCase();
    defaultSourceInput.appendChild(option);
  }

  if (!options.includes(settings.defaultSource)) {
    settings.defaultSource = "all";
  }
  defaultSourceInput.value = settings.defaultSource;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || "unknown";
  }
}

function applyFilter() {
  if (activeSource === "all") return allSignals;
  return allSignals.filter((signal) => signal.source === activeSource);
}

function renderSignals() {
  const signals = applyFilter();
  list.innerHTML = "";

  if (!signals.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No signals for this source yet.";
    list.appendChild(empty);
    return;
  }

  for (const signal of signals) {
    const node = template.content.cloneNode(true);
    node.querySelector(".source").textContent = signal.source.toUpperCase();
    node.querySelector(".date").textContent = formatDate(signal.publishedAt);
    node.querySelector(".title").textContent = signal.title;
    node.querySelector(".snippet").textContent = signal.snippet || "No description.";

    const link = node.querySelector(".link");
    link.href = signal.url;
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await window.opacity.openExternal(signal.url);
    });

    const removeBtn = node.querySelector(".remove-btn");
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      const removed = await window.opacity.hideSignal(signal.id);
      if (removed) {
        allSignals = allSignals.filter((item) => item.id !== signal.id);
        renderDefaultSourceOptions();
        renderFilters();
        renderSignals();
      } else {
        removeBtn.disabled = false;
      }
    });

    list.appendChild(node);
  }
}

function renderFilters() {
  filters.innerHTML = "";

  const sourceCounts = allSignals.reduce(
    (acc, signal) => {
      acc[signal.source] = (acc[signal.source] || 0) + 1;
      return acc;
    },
    { all: allSignals.length }
  );

  for (const [source, count] of Object.entries(sourceCounts)) {
    const btn = document.createElement("button");
    btn.className = `filter-btn${activeSource === source ? " active" : ""}`;
    btn.textContent = `${source.toUpperCase()} (${count})`;
    btn.addEventListener("click", () => {
      activeSource = source;
      renderFilters();
      renderSignals();
    });
    filters.appendChild(btn);
  }
}

async function refresh() {
  try {
    allSignals = await window.opacity.listSignals(settings.pageSize);

    if (!initializedFilter) {
      activeSource = settings.defaultSource;
      initializedFilter = true;
    }

    if (activeSource !== "all" && !allSignals.some((signal) => signal.source === activeSource)) {
      activeSource = "all";
    }

    renderDefaultSourceOptions();
    renderFilters();
    renderSignals();
  } catch (error) {
    list.innerHTML = "";
    filters.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `Failed to load signals: ${error.message || error}`;
    list.appendChild(empty);
  }
}

refreshBtn.addEventListener("click", refresh);
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});
closeSettingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
});
quitBtn.addEventListener("click", async () => {
  await window.opacity.quitApp();
});

saveSettingsBtn.addEventListener("click", async () => {
  settings.refreshIntervalSec = Math.max(10, Math.min(600, Number(refreshIntervalInput.value) || DEFAULT_SETTINGS.refreshIntervalSec));
  settings.pageSize = Math.max(10, Math.min(200, Number(pageSizeInput.value) || DEFAULT_SETTINGS.pageSize));
  settings.defaultSource = defaultSourceInput.value || "all";
  settings.compactMode = compactModeInput.checked;

  saveSettings();
  applySettingsToUi();
  resetRefreshTimer();

  activeSource = settings.defaultSource;
  await refresh();
  settingsPanel.classList.add("hidden");
});

restoreHiddenBtn.addEventListener("click", async () => {
  restoreHiddenBtn.disabled = true;
  try {
    await window.opacity.clearHiddenSignals();
    await refresh();
  } finally {
    restoreHiddenBtn.disabled = false;
  }
});

applySettingsToUi();
refresh();
resetRefreshTimer();
