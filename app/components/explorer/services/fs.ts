import type { Drive, ListDirResult, QuickLink } from "../types/explorer"

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
}
