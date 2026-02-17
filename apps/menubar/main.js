const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { execFile } = require("node:child_process");

let tray = null;
let win = null;

function resolveDbPath() {
  const fromEnv = process.env.SQLITE_DB_PATH || "./data/opacity.db";
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
}

function readSignals(limit = 30) {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    return Promise.resolve([]);
  }

  const queryScript = `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1]);
try {
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
    ORDER BY datetime(s.collected_at) DESC
    LIMIT ?
  \`).all(Number(process.argv[2]) || 30);
  process.stdout.write(JSON.stringify(rows));
} finally {
  db.close();
}
`;

  return new Promise((resolve, reject) => {
    execFile("node", ["-e", queryScript, dbPath, String(limit)], { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      try {
        const rows = JSON.parse(stdout || "[]");
        const signals = rows.map((row) => ({
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
        resolve(signals);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
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
  const iconPath = path.resolve(process.cwd(), "assets/logo.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });

  tray = new Tray(icon);
  tray.setToolTip("Opacity Inbox");
  tray.on("click", toggleWindow);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Inbox", click: () => toggleWindow() },
    { type: "separator" },
    { role: "quit", label: "Quit Opacity" }
  ]);

  tray.setContextMenu(contextMenu);
}

ipcMain.handle("signals:list", async (_event, limit = 30) => readSignals(limit));
ipcMain.handle("signals:openExternal", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return false;
  }
  await shell.openExternal(url);
  return true;
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
