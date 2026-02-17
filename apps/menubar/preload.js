const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("opacity", {
  listSignals(limit = 30) {
    return ipcRenderer.invoke("signals:list", limit);
  },
  listFavorites(limit = 100) {
    return ipcRenderer.invoke("favorites:list", limit);
  },
  addFavorite(signalId) {
    return ipcRenderer.invoke("favorites:add", signalId);
  },
  removeFavorite(signalId) {
    return ipcRenderer.invoke("favorites:remove", signalId);
  },
  hideSignal(signalId) {
    return ipcRenderer.invoke("signals:hide", signalId);
  },
  clearHiddenSignals() {
    return ipcRenderer.invoke("signals:clearHidden");
  },
  getRuntimeConfig() {
    return ipcRenderer.invoke("config:get");
  },
  saveRuntimeConfig(values) {
    return ipcRenderer.invoke("config:save", values);
  },
  openExternal(url) {
    return ipcRenderer.invoke("signals:openExternal", url);
  },
  quitApp() {
    return ipcRenderer.invoke("app:quit");
  }
});
