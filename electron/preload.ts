import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  ping: async () => ipcRenderer.invoke("app:ping"),
  fs: {
    getDrives: () => ipcRenderer.invoke("fs:getDrives"),
    getQuickLinks: () => ipcRenderer.invoke("fs:getQuickLinks"),
    listDir: (targetPath: string) => ipcRenderer.invoke("fs:listDir", targetPath),
    homeDir: () => ipcRenderer.invoke("fs:homeDir"),
    joinPath: (base: string, name: string) => ipcRenderer.invoke("fs:joinPath", base, name),
    openPath: (targetPath: string) => ipcRenderer.invoke("fs:openPath", targetPath),
  },
})
