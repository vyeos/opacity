const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("opacity", {
  listSignals(limit = 30) {
    return ipcRenderer.invoke("signals:list", limit);
  }
});
