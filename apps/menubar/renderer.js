const list = document.getElementById("signalList");
const favoriteList = document.getElementById("favoriteList");
const filters = document.getElementById("filters");
const refreshBtn = document.getElementById("refreshBtn");
const quitBtn = document.getElementById("quitBtn");
const showInboxBtn = document.getElementById("showInboxBtn");
const showFavoritesBtn = document.getElementById("showFavoritesBtn");
const showSettingsBtn = document.getElementById("showSettingsBtn");
const inboxPage = document.getElementById("inboxPage");
const favoritesPage = document.getElementById("favoritesPage");
const settingsPage = document.getElementById("settingsPage");

const refreshIntervalInput = document.getElementById("refreshIntervalInput");
const pageSizeInput = document.getElementById("pageSizeInput");
const defaultSourceInput = document.getElementById("defaultSourceInput");
const compactModeInput = document.getElementById("compactModeInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const restoreHiddenBtn = document.getElementById("restoreHiddenBtn");
const saveStatus = document.getElementById("saveStatus");

const cfgEnableAi = document.getElementById("cfgEnableAi");
const cfgAiFields = document.getElementById("cfgAiFields");
const cfgAiApiKey = document.getElementById("cfgAiApiKey");
const cfgAiApiBase = document.getElementById("cfgAiApiBase");
const cfgAiModel = document.getElementById("cfgAiModel");
const cfgEnableX = document.getElementById("cfgEnableX");
const cfgXFields = document.getElementById("cfgXFields");
const cfgXBearer = document.getElementById("cfgXBearer");
const cfgXUsers = document.getElementById("cfgXUsers");
const cfgXMax = document.getElementById("cfgXMax");
const cfgYoutubeIds = document.getElementById("cfgYoutubeIds");
const cfgYoutubeMax = document.getElementById("cfgYoutubeMax");
const cfgRssFeeds = document.getElementById("cfgRssFeeds");
const cfgRssMax = document.getElementById("cfgRssMax");
const cfgEnableTelegramDelivery = document.getElementById("cfgEnableTelegramDelivery");
const cfgTelegramFields = document.getElementById("cfgTelegramFields");
const cfgTelegramBotToken = document.getElementById("cfgTelegramBotToken");
const cfgTelegramChatId = document.getElementById("cfgTelegramChatId");
const cfgEnableTelegramWebhook = document.getElementById("cfgEnableTelegramWebhook");
const cfgTelegramWebhookFields = document.getElementById("cfgTelegramWebhookFields");
const cfgTelegramWebhookPort = document.getElementById("cfgTelegramWebhookPort");
const cfgTelegramWebhookSecret = document.getElementById("cfgTelegramWebhookSecret");
const cfgRunContinuous = document.getElementById("cfgRunContinuous");
const cfgWorkerFields = document.getElementById("cfgWorkerFields");
const cfgRunInterval = document.getElementById("cfgRunInterval");
const cfgPriorityThreshold = document.getElementById("cfgPriorityThreshold");
const cfgHourlyThreshold = document.getElementById("cfgHourlyThreshold");
const cfgSqlitePath = document.getElementById("cfgSqlitePath");

const template = document.getElementById("signalTemplate");

const SETTINGS_KEY = "opacity_menubar_settings_v3";
const DEFAULT_SETTINGS = {
  refreshIntervalSec: 30,
  pageSize: 40,
  defaultSource: "all",
  compactMode: false
};

let allSignals = [];
let favoriteSignals = [];
let favoriteIds = new Set();
let activeSource = "all";
let activePage = "inbox";
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

function setPage(page) {
  activePage = page;
  const isInbox = page === "inbox";
  const isFavorites = page === "favorites";
  const isSettings = page === "settings";

  inboxPage.classList.toggle("hidden", !isInbox);
  favoritesPage.classList.toggle("hidden", !isFavorites);
  settingsPage.classList.toggle("hidden", !isSettings);

  showInboxBtn.classList.toggle("active-tab", isInbox);
  showFavoritesBtn.classList.toggle("active-tab", isFavorites);
  showSettingsBtn.classList.toggle("active-tab", isSettings);
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

function formatCompactDate(value) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short"
    }).format(new Date(value));
  } catch {
    return value || "unknown";
  }
}

function applyFilter() {
  if (activeSource === "all") return allSignals;
  return allSignals.filter((signal) => signal.source === activeSource);
}

function renderCard(signal, mode) {
  const node = template.content.cloneNode(true);
  node.querySelector(".source").textContent = signal.source.toUpperCase();
  node.querySelector(".date").textContent = settings.compactMode
    ? formatCompactDate(signal.publishedAt)
    : formatDate(signal.publishedAt);
  node.querySelector(".title").textContent = signal.title;
  node.querySelector(".snippet").textContent = signal.snippet || "No description.";

  const link = node.querySelector(".link");
  link.href = signal.url;
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await window.opacity.openExternal(signal.url);
  });

  const favoriteBtn = node.querySelector(".favorite-btn");
  const removeBtn = node.querySelector(".remove-btn");

  if (mode === "favorites") {
    favoriteBtn.classList.add("hidden");
    removeBtn.textContent = "Remove Favorite";
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      const removed = await window.opacity.removeFavorite(signal.id);
      if (removed) {
        await refresh();
      } else {
        removeBtn.disabled = false;
      }
    });
  } else {
    const alreadyFavorite = favoriteIds.has(signal.id);
    favoriteBtn.textContent = alreadyFavorite ? "Favorited" : "Favorite";
    favoriteBtn.disabled = alreadyFavorite;
    favoriteBtn.classList.toggle("is-favorite", alreadyFavorite);
    favoriteBtn.addEventListener("click", async () => {
      favoriteBtn.disabled = true;
      const added = await window.opacity.addFavorite(signal.id);
      if (added) {
        await refresh();
      } else {
        favoriteBtn.disabled = false;
      }
    });

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
  }

  return node;
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
    list.appendChild(renderCard(signal, "inbox"));
  }
}

function renderFavorites() {
  favoriteList.innerHTML = "";
  if (!favoriteSignals.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No favorites yet.";
    favoriteList.appendChild(empty);
    return;
  }

  for (const signal of favoriteSignals) {
    favoriteList.appendChild(renderCard(signal, "favorites"));
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

function envIsTrue(value) {
  return String(value || "").toLowerCase() === "true";
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
}

function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("error", isError);
}

function applyRuntimeConfigFormState() {
  cfgAiApiKey.disabled = !cfgEnableAi.checked;
  cfgAiApiBase.disabled = !cfgEnableAi.checked;
  cfgAiModel.disabled = !cfgEnableAi.checked;
  cfgAiFields.classList.toggle("hidden", !cfgEnableAi.checked);

  cfgXBearer.disabled = !cfgEnableX.checked;
  cfgXUsers.disabled = !cfgEnableX.checked;
  cfgXMax.disabled = !cfgEnableX.checked;
  cfgXFields.classList.toggle("hidden", !cfgEnableX.checked);

  cfgTelegramBotToken.disabled = !cfgEnableTelegramDelivery.checked;
  cfgTelegramChatId.disabled = !cfgEnableTelegramDelivery.checked;
  cfgEnableTelegramWebhook.disabled = !cfgEnableTelegramDelivery.checked;
  cfgTelegramWebhookPort.disabled = !cfgEnableTelegramDelivery.checked;
  cfgTelegramWebhookSecret.disabled = !cfgEnableTelegramDelivery.checked || !cfgEnableTelegramWebhook.checked;
  cfgTelegramFields.classList.toggle("hidden", !cfgEnableTelegramDelivery.checked);
  cfgTelegramWebhookFields.classList.toggle("hidden", !cfgEnableTelegramDelivery.checked || !cfgEnableTelegramWebhook.checked);

  cfgRunInterval.disabled = !cfgRunContinuous.checked;
  cfgWorkerFields.classList.toggle("hidden", !cfgRunContinuous.checked);
}

async function loadRuntimeConfig() {
  try {
    const cfg = await window.opacity.getRuntimeConfig();
    cfgEnableAi.checked = envIsTrue(cfg.ENABLE_AI_ANALYSIS);
    cfgAiApiKey.value = cfg.AI_API_KEY || "";
    cfgAiApiBase.value = cfg.AI_API_BASE || "";
    cfgAiModel.value = cfg.AI_MODEL || "";

    cfgEnableX.checked = envIsTrue(cfg.ENABLE_X_COLLECTION);
    cfgXBearer.value = cfg.X_BEARER_TOKEN || "";
    cfgXUsers.value = cfg.X_FOLLOWED_USERNAMES || "";
    cfgXMax.value = cfg.X_MAX_ITEMS || "";

    cfgYoutubeIds.value = cfg.YOUTUBE_CHANNEL_IDS || "";
    cfgYoutubeMax.value = cfg.YOUTUBE_MAX_ITEMS || "";
    cfgRssFeeds.value = cfg.RSS_FEEDS || "";
    cfgRssMax.value = cfg.RSS_MAX_ITEMS || "";

    cfgEnableTelegramDelivery.checked = envIsTrue(cfg.ENABLE_TELEGRAM_DELIVERY);
    cfgTelegramBotToken.value = cfg.TELEGRAM_BOT_TOKEN || "";
    cfgTelegramChatId.value = cfg.TELEGRAM_CHAT_ID || "";
    cfgEnableTelegramWebhook.checked = envIsTrue(cfg.ENABLE_TELEGRAM_WEBHOOK);
    cfgTelegramWebhookPort.value = cfg.TELEGRAM_WEBHOOK_PORT || "";
    cfgTelegramWebhookSecret.value = cfg.TELEGRAM_WEBHOOK_SECRET || "";

    cfgRunContinuous.checked = envIsTrue(cfg.RUN_CONTINUOUS);
    cfgRunInterval.value = cfg.RUN_INTERVAL_MINUTES || "";
    cfgPriorityThreshold.value = cfg.PRIORITY_THRESHOLD || "";
    cfgHourlyThreshold.value = cfg.HOURLY_THRESHOLD || "";
    cfgSqlitePath.value = cfg.SQLITE_DB_PATH || "";

    applyRuntimeConfigFormState();
    setSaveStatus("");
  } catch (error) {
    setSaveStatus(`Failed to load .env settings: ${error.message || error}`, true);
  }
}

function collectRuntimeConfigPayload() {
  return {
    ENABLE_AI_ANALYSIS: cfgEnableAi.checked ? "true" : "false",
    AI_API_KEY: cfgAiApiKey.value.trim(),
    AI_API_BASE: cfgAiApiBase.value.trim(),
    AI_MODEL: cfgAiModel.value.trim(),

    ENABLE_X_COLLECTION: cfgEnableX.checked ? "true" : "false",
    X_BEARER_TOKEN: cfgXBearer.value.trim(),
    X_FOLLOWED_USERNAMES: parseCsv(cfgXUsers.value),
    X_MAX_ITEMS: cfgXMax.value.trim(),

    YOUTUBE_CHANNEL_IDS: parseCsv(cfgYoutubeIds.value),
    YOUTUBE_MAX_ITEMS: cfgYoutubeMax.value.trim(),
    RSS_FEEDS: parseCsv(cfgRssFeeds.value),
    RSS_MAX_ITEMS: cfgRssMax.value.trim(),

    ENABLE_TELEGRAM_DELIVERY: cfgEnableTelegramDelivery.checked ? "true" : "false",
    TELEGRAM_BOT_TOKEN: cfgTelegramBotToken.value.trim(),
    TELEGRAM_CHAT_ID: cfgTelegramChatId.value.trim(),
    ENABLE_TELEGRAM_WEBHOOK: cfgEnableTelegramWebhook.checked ? "true" : "false",
    TELEGRAM_WEBHOOK_PORT: cfgTelegramWebhookPort.value.trim(),
    TELEGRAM_WEBHOOK_SECRET: cfgTelegramWebhookSecret.value.trim(),

    RUN_CONTINUOUS: cfgRunContinuous.checked ? "true" : "false",
    RUN_INTERVAL_MINUTES: cfgRunInterval.value.trim(),
    PRIORITY_THRESHOLD: cfgPriorityThreshold.value.trim(),
    HOURLY_THRESHOLD: cfgHourlyThreshold.value.trim(),
    SQLITE_DB_PATH: cfgSqlitePath.value.trim()
  };
}

async function refresh() {
  try {
    const [signals, favorites] = await Promise.all([
      window.opacity.listSignals(settings.pageSize),
      window.opacity.listFavorites(500)
    ]);
    allSignals = signals;
    favoriteSignals = favorites;
    favoriteIds = new Set(favorites.map((item) => item.id));

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
    renderFavorites();
  } catch (error) {
    list.innerHTML = "";
    favoriteList.innerHTML = "";
    filters.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `Failed to load signals: ${error.message || error}`;
    list.appendChild(empty);
  }
}

refreshBtn.addEventListener("click", refresh);
showInboxBtn.addEventListener("click", () => setPage("inbox"));
showFavoritesBtn.addEventListener("click", () => setPage("favorites"));
showSettingsBtn.addEventListener("click", async () => {
  setPage("settings");
  settingsPage.scrollTop = 0;
  await loadRuntimeConfig();
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

  const payload = collectRuntimeConfigPayload();
  try {
    const saved = await window.opacity.saveRuntimeConfig(payload);
    if (!saved) {
      setSaveStatus("Save failed. Check values and try again.", true);
      return;
    }
    setSaveStatus("Saved to .env. Restart pipeline/webhook processes to apply runtime changes.");
    await refresh();
  } catch (error) {
    setSaveStatus(`Save failed: ${error.message || error}`, true);
  }
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

cfgEnableAi.addEventListener("change", applyRuntimeConfigFormState);
cfgEnableX.addEventListener("change", applyRuntimeConfigFormState);
cfgEnableTelegramDelivery.addEventListener("change", applyRuntimeConfigFormState);
cfgEnableTelegramWebhook.addEventListener("change", applyRuntimeConfigFormState);
cfgRunContinuous.addEventListener("change", applyRuntimeConfigFormState);

applySettingsToUi();
setPage(activePage);
refresh();
resetRefreshTimer();
