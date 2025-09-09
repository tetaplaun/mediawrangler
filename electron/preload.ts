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
    addQuickLink: (name: string, targetPath: string) => ipcRenderer.invoke("fs:addQuickLink", name, targetPath),
    removeQuickLink: (id: string) => ipcRenderer.invoke("fs:removeQuickLink", id),
    updateQuickLink: (id: string, updates: { name?: string; path?: string }) => ipcRenderer.invoke("fs:updateQuickLink", id, updates),
    reorderQuickLinks: (orderedIds: string[]) => ipcRenderer.invoke("fs:reorderQuickLinks", orderedIds),
    setShowDefaultQuickLinks: (show: boolean) => ipcRenderer.invoke("fs:setShowDefaultQuickLinks", show),
    resetQuickLinks: () => ipcRenderer.invoke("fs:resetQuickLinks"),
    selectFolder: () => ipcRenderer.invoke("fs:selectFolder"),
  },
})
