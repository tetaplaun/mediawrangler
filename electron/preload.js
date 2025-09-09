const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  ping: async () => ipcRenderer.invoke("app:ping"),
})
