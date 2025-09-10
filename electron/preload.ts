import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  ping: async () => ipcRenderer.invoke("app:ping"),
  showMessageBox: (options: any) => ipcRenderer.invoke("app:showMessageBox", options),
  fs: {
    getDrives: () => ipcRenderer.invoke("fs:getDrives"),
    findRemovableDriveWithDCIM: () => ipcRenderer.invoke("fs:findRemovableDriveWithDCIM"),
    listDirectoriesOnly: (targetPath: string) =>
      ipcRenderer.invoke("fs:listDirectoriesOnly", targetPath),
    getQuickLinks: () => ipcRenderer.invoke("fs:getQuickLinks"),
    listDir: (targetPath: string) => ipcRenderer.invoke("fs:listDir", targetPath),
    homeDir: () => ipcRenderer.invoke("fs:homeDir"),
    joinPath: (base: string, name: string) => ipcRenderer.invoke("fs:joinPath", base, name),
    openPath: (targetPath: string) => ipcRenderer.invoke("fs:openPath", targetPath),
    addQuickLink: (name: string, targetPath: string) =>
      ipcRenderer.invoke("fs:addQuickLink", name, targetPath),
    removeQuickLink: (id: string) => ipcRenderer.invoke("fs:removeQuickLink", id),
    updateQuickLink: (id: string, updates: { name?: string; path?: string }) =>
      ipcRenderer.invoke("fs:updateQuickLink", id, updates),
    reorderQuickLinks: (orderedIds: string[]) =>
      ipcRenderer.invoke("fs:reorderQuickLinks", orderedIds),
    setShowDefaultQuickLinks: (show: boolean) =>
      ipcRenderer.invoke("fs:setShowDefaultQuickLinks", show),
    resetQuickLinks: () => ipcRenderer.invoke("fs:resetQuickLinks"),
    selectFolder: () => ipcRenderer.invoke("fs:selectFolder"),
    getMediaInfo: (filePath: string) => ipcRenderer.invoke("fs:getMediaInfo", filePath),
    getMediaInfoBatch: (filePaths: string[]) =>
      ipcRenderer.invoke("fs:getMediaInfoBatch", filePaths),
    updateFileDate: (filePath: string, dateString: string) =>
      ipcRenderer.invoke("fs:updateFileDate", filePath, dateString),
    createFolder: (folderPath: string) => ipcRenderer.invoke("fs:createFolder", folderPath),
    deleteItem: (itemPath: string) => ipcRenderer.invoke("fs:deleteItem", itemPath),
    analyzeSource: (sourcePath: string) => ipcRenderer.invoke("fs:analyzeSource", sourcePath),
    importMedia: (
      sourcePath: string,
      destinationPath: string,
      selectedDate?: string,
      createDateFolders?: boolean
    ) =>
      ipcRenderer.invoke(
        "fs:importMedia",
        sourcePath,
        destinationPath,
        selectedDate,
        createDateFolders
      ),
  },
  onImportProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("import-progress", (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners("import-progress")
  },
  onAnalyzeProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("analyze-progress", (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners("analyze-progress")
  },
  onFileCopyProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("file-copy-progress", (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners("file-copy-progress")
  },
})
