const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("opacity", {
  listSignals(limit = 30) {
    return ipcRenderer.invoke("signals:list", limit);
  },
  hideSignal(signalId) {
    return ipcRenderer.invoke("signals:hide", signalId);
  },
  openExternal(url) {
    return ipcRenderer.invoke("signals:openExternal", url);
  },
  quitApp() {
    return ipcRenderer.invoke("app:quit");
  }
});
