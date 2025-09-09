const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  ping: async () => ipcRenderer.invoke("app:ping"),
  fs: {
    getDrives: () => ipcRenderer.invoke("fs:getDrives"),
    getQuickLinks: () => ipcRenderer.invoke("fs:getQuickLinks"),
    listDir: (targetPath) => ipcRenderer.invoke("fs:listDir", targetPath),
    homeDir: () => ipcRenderer.invoke("fs:homeDir"),
    joinPath: (base, name) => ipcRenderer.invoke("fs:joinPath", base, name),
    openPath: (targetPath) => ipcRenderer.invoke("fs:openPath", targetPath),
  },
})
