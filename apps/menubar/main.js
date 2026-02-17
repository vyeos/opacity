const { app, BrowserWindow, Tray, ipcMain, nativeImage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { execFile } = require("node:child_process");

let tray = null;
let win = null;
const RUNTIME_CONFIG_KEYS = [
  "ENABLE_AI_ANALYSIS",
  "AI_API_KEY",
  "AI_API_BASE",
  "AI_MODEL",
  "ENABLE_X_COLLECTION",
  "X_BEARER_TOKEN",
  "X_FOLLOWED_USERNAMES",
  "X_MAX_ITEMS",
  "YOUTUBE_CHANNEL_IDS",
  "YOUTUBE_MAX_ITEMS",
  "RSS_FEEDS",
  "RSS_MAX_ITEMS",
  "ENABLE_TELEGRAM_DELIVERY",
  "ENABLE_TELEGRAM_WEBHOOK",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_WEBHOOK_PORT",
  "TELEGRAM_WEBHOOK_SECRET",
  "RUN_CONTINUOUS",
  "RUN_INTERVAL_MINUTES",
  "PRIORITY_THRESHOLD",
  "HOURLY_THRESHOLD",
  "SQLITE_DB_PATH"
];

function resolveAssetPath(relPath) {
  const devPath = path.resolve(process.cwd(), relPath);
  if (!app.isPackaged) return devPath;
  return path.join(process.resourcesPath, relPath);
}

function resolveDbPath() {
  const fromEnv = process.env.SQLITE_DB_PATH || "./data/opacity.db";
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
}

function resolveEnvPath() {
  const fromEnv = process.env.OPACITY_ENV_FILE || ".env";
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
}

function readEnvMap() {
  const envPath = resolveEnvPath();
  if (!fs.existsSync(envPath)) return {};

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const result = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }

  return result;
}

function serializeEnvValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

function writeEnvMap(nextValues) {
  const envPath = resolveEnvPath();
  const current = readEnvMap();
  const merged = { ...current, ...nextValues };

  const lines = [
    "# Updated by Opacity menubar settings",
    ...Object.entries(merged).map(([key, value]) => `${key}=${serializeEnvValue(value)}`)
  ];

  fs.writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");

  for (const [key, value] of Object.entries(nextValues)) {
    process.env[key] = serializeEnvValue(value);
  }
}

function getRuntimeConfig() {
  const current = readEnvMap();
  const result = {};
  for (const key of RUNTIME_CONFIG_KEYS) {
    result[key] = current[key] ?? process.env[key] ?? "";
  }
  return result;
}

function runDbScript(script, args = [], maxBuffer = 1024 * 1024) {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    execFile("node", ["-e", script, dbPath, ...args], { maxBuffer }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function readSignals(limit = 30) {
  const queryScript = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS menubar_hidden (
      signal_id TEXT PRIMARY KEY,
      hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menubar_favorites (
      signal_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content_snippet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      summary TEXT,
      actionability_score REAL,
      urgency TEXT,
      favorited_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  \`);

  db.exec(\`
    DELETE FROM analysis
    WHERE signal_id IN (
      SELECT s.id
      FROM signals s
      LEFT JOIN menubar_favorites f ON f.signal_id = s.id
      WHERE f.signal_id IS NULL
      AND datetime(COALESCE(s.published_at, s.collected_at)) < datetime('now', '-30 days')
    );

    DELETE FROM deliveries
    WHERE signal_id IN (
      SELECT s.id
      FROM signals s
      LEFT JOIN menubar_favorites f ON f.signal_id = s.id
      WHERE f.signal_id IS NULL
      AND datetime(COALESCE(s.published_at, s.collected_at)) < datetime('now', '-30 days')
    );

    DELETE FROM menubar_hidden
    WHERE signal_id IN (
      SELECT s.id
      FROM signals s
      LEFT JOIN menubar_favorites f ON f.signal_id = s.id
      WHERE f.signal_id IS NULL
      AND datetime(COALESCE(s.published_at, s.collected_at)) < datetime('now', '-30 days')
    );

    DELETE FROM signals
    WHERE id IN (
      SELECT s.id
      FROM signals s
      LEFT JOIN menubar_favorites f ON f.signal_id = s.id
      WHERE f.signal_id IS NULL
      AND datetime(COALESCE(s.published_at, s.collected_at)) < datetime('now', '-30 days')
    );
  \`);

  const rows = db.prepare(\`
    SELECT
      s.id,
      s.source,
      s.author,
      s.title,
      s.url,
      s.content_snippet,
      s.published_at,
      a.summary,
      a.actionability_score,
      a.urgency
    FROM signals s
    LEFT JOIN analysis a ON a.signal_id = s.id
    LEFT JOIN menubar_hidden h ON h.signal_id = s.id
    WHERE h.signal_id IS NULL
    ORDER BY datetime(s.collected_at) DESC
    LIMIT ?
  \`).all(Number(process.argv[2]) || 30);
  process.stdout.write(JSON.stringify(rows));
} finally {
  db.close();
}
`;

  return runDbScript(queryScript, [String(limit)]).then((stdout) => {
    if (!stdout) return [];
    const rows = JSON.parse(stdout || "[]");
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      author: row.author,
      title: row.title,
      url: row.url,
      snippet: row.content_snippet,
      publishedAt: row.published_at,
      summary: row.summary,
      score: row.actionability_score,
      urgency: row.urgency
    }));
  });
}

function hideSignal(signalId) {
  const hideScript = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS menubar_hidden (
      signal_id TEXT PRIMARY KEY,
      hidden_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  \`);
  db.prepare("INSERT OR IGNORE INTO menubar_hidden (signal_id) VALUES (?)").run(process.argv[2]);
  process.stdout.write("ok");
} finally {
  db.close();
}
`;

  return runDbScript(hideScript, [String(signalId)], 1024 * 256).then((stdout) => Boolean(stdout));
}

function clearHiddenSignals() {
  const clearScript = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec("DELETE FROM menubar_hidden");
  process.stdout.write("ok");
} finally {
  db.close();
}
`;

  return runDbScript(clearScript, [], 1024 * 256).then((stdout) => Boolean(stdout));
}

function listFavoriteSignals(limit = 100) {
  const script = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS menubar_favorites (
      signal_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content_snippet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      summary TEXT,
      actionability_score REAL,
      urgency TEXT,
      favorited_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  \`);

  const rows = db.prepare(\`
    SELECT
      signal_id AS id,
      source,
      author,
      title,
      url,
      content_snippet,
      published_at,
      summary,
      actionability_score,
      urgency,
      favorited_at
    FROM menubar_favorites
    ORDER BY datetime(favorited_at) DESC
    LIMIT ?
  \`).all(Number(process.argv[2]) || 100);
  process.stdout.write(JSON.stringify(rows));
} finally {
  db.close();
}
`;

  return runDbScript(script, [String(limit)]).then((stdout) => {
    if (!stdout) return [];
    const rows = JSON.parse(stdout || "[]");
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      author: row.author,
      title: row.title,
      url: row.url,
      snippet: row.content_snippet,
      publishedAt: row.published_at,
      summary: row.summary,
      score: row.actionability_score,
      urgency: row.urgency,
      favoritedAt: row.favorited_at
    }));
  });
}

function addFavoriteSignal(signalId) {
  const script = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS menubar_favorites (
      signal_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      author TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      content_snippet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      summary TEXT,
      actionability_score REAL,
      urgency TEXT,
      favorited_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  \`);

  const row = db.prepare(\`
    SELECT
      s.id AS signal_id,
      s.source,
      s.author,
      s.title,
      s.url,
      s.content_snippet,
      s.published_at,
      a.summary,
      a.actionability_score,
      a.urgency
    FROM signals s
    LEFT JOIN analysis a ON a.signal_id = s.id
    WHERE s.id = ?
    LIMIT 1
  \`).get(process.argv[2]);

  if (!row) {
    process.stdout.write("missing");
  } else {
    db.prepare(\`
      INSERT INTO menubar_favorites (
        signal_id, source, author, title, url, content_snippet, published_at,
        summary, actionability_score, urgency, favorited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(signal_id) DO UPDATE SET
        source = excluded.source,
        author = excluded.author,
        title = excluded.title,
        url = excluded.url,
        content_snippet = excluded.content_snippet,
        published_at = excluded.published_at,
        summary = excluded.summary,
        actionability_score = excluded.actionability_score,
        urgency = excluded.urgency,
        favorited_at = datetime('now')
    \`).run(
      row.signal_id,
      row.source,
      row.author,
      row.title,
      row.url,
      row.content_snippet,
      row.published_at,
      row.summary ?? null,
      row.actionability_score ?? null,
      row.urgency ?? null
    );
    process.stdout.write("ok");
  }
} finally {
  db.close();
}
`;

  return runDbScript(script, [String(signalId)], 1024 * 256).then((stdout) => stdout === "ok");
}

function removeFavoriteSignal(signalId) {
  const script = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
  db.exec("CREATE TABLE IF NOT EXISTS menubar_favorites (signal_id TEXT PRIMARY KEY, source TEXT NOT NULL, author TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, content_snippet TEXT NOT NULL, published_at TEXT NOT NULL, summary TEXT, actionability_score REAL, urgency TEXT, favorited_at TEXT NOT NULL DEFAULT (datetime('now')));");
  db.prepare("DELETE FROM menubar_favorites WHERE signal_id = ?").run(process.argv[2]);
  process.stdout.write("ok");
} finally {
  db.close();
}
`;

  return runDbScript(script, [String(signalId)], 1024 * 256).then((stdout) => Boolean(stdout));
}

function createWindow() {
  win = new BrowserWindow({
    width: 430,
    height: 620,
    show: false,
    frame: false,
    resizable: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("blur", () => {
    if (win && !win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return;

  if (win.isVisible()) {
    win.hide();
    return;
  }

  const trayBounds = tray.getBounds();
  const windowBounds = win.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 8);

  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

function createTray() {
  const iconPath = resolveAssetPath("assets/logo.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });

  tray = new Tray(icon);
  tray.setToolTip("Opacity Inbox");
  tray.on("click", toggleWindow);
}

ipcMain.handle("signals:list", async (_event, limit = 30) => readSignals(limit));
ipcMain.handle("favorites:list", async (_event, limit = 100) => listFavoriteSignals(limit));
ipcMain.handle("favorites:add", async (_event, signalId) => {
  if (typeof signalId !== "string" || signalId.length === 0) {
    return false;
  }
  return addFavoriteSignal(signalId);
});
ipcMain.handle("favorites:remove", async (_event, signalId) => {
  if (typeof signalId !== "string" || signalId.length === 0) {
    return false;
  }
  return removeFavoriteSignal(signalId);
});
ipcMain.handle("signals:hide", async (_event, signalId) => {
  if (typeof signalId !== "string" || signalId.length === 0) {
    return false;
  }
  return hideSignal(signalId);
});
ipcMain.handle("signals:clearHidden", async () => clearHiddenSignals());
ipcMain.handle("config:get", async () => getRuntimeConfig());
ipcMain.handle("config:save", async (_event, values) => {
  if (!values || typeof values !== "object") return false;
  const sanitized = {};
  for (const key of RUNTIME_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      sanitized[key] = values[key];
    }
  }
  writeEnvMap(sanitized);
  return true;
});
ipcMain.handle("signals:openExternal", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return false;
  }
  await shell.openExternal(url);
  return true;
});
ipcMain.handle("app:quit", () => {
  app.quit();
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
