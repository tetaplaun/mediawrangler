import type { Drive, ListDirResult, QuickLink, MediaInfo } from "../types/explorer"

export const fsService = {
  getDrives(): Promise<Drive[]> {
    return window.electronAPI.fs.getDrives()
  },
  getQuickLinks(): Promise<QuickLink[]> {
    return window.electronAPI.fs.getQuickLinks()
  },
  listDir(targetPath: string): Promise<ListDirResult> {
    return window.electronAPI.fs.listDir(targetPath)
  },
  homeDir(): Promise<string> {
    return window.electronAPI.fs.homeDir()
  },
  joinPath(base: string, name: string): Promise<string> {
    return window.electronAPI.fs.joinPath(base, name)
  },
  openPath(targetPath: string): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.fs.openPath(targetPath)
  },
  addQuickLink(name: string, targetPath: string): Promise<{ ok: boolean; data?: QuickLink; error?: string }> {
    return window.electronAPI.fs.addQuickLink(name, targetPath)
  },
  removeQuickLink(id: string): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.fs.removeQuickLink(id)
  },
  updateQuickLink(id: string, updates: { name?: string; path?: string }): Promise<{ ok: boolean; data?: QuickLink; error?: string }> {
    return window.electronAPI.fs.updateQuickLink(id, updates)
  },
  reorderQuickLinks(orderedIds: string[]): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.fs.reorderQuickLinks(orderedIds)
  },
  setShowDefaultQuickLinks(show: boolean): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.fs.setShowDefaultQuickLinks(show)
  },
  resetQuickLinks(): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.fs.resetQuickLinks()
  },
  selectFolder(): Promise<{ ok: boolean; path: string | null }> {
    return window.electronAPI.fs.selectFolder()
  },
  getMediaInfo(filePath: string): Promise<{ ok: boolean; data?: MediaInfo; error?: string }> {
    return window.electronAPI.fs.getMediaInfo(filePath)
  },
}
