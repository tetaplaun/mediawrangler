export {}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      fs: {
        getDrives: () => Promise<Array<{ name: string; path: string; type: "drive" }>>
        getQuickLinks: () => Promise<Array<{ id: string; name: string; path: string; type: "directory"; isCustom: boolean }>>
        listDir: (targetPath: string) => Promise<{
          path: string
          entries: Array<{
            name: string
            path: string
            type: "file" | "directory" | "drive"
            size: number | null
            modifiedMs: number | null
            ext: string | null
            mediaInfo?: {
              dimensions?: { width: number; height: number }
              frameRate?: number
              encodedDate?: string
              duration?: number
              bitRate?: number
              format?: string
              codec?: string
            }
          }>
          error?: string
        }>
        homeDir: () => Promise<string>
        joinPath: (base: string, name: string) => Promise<string>
        openPath: (targetPath: string) => Promise<{ ok: boolean; error?: string }>
        addQuickLink: (name: string, targetPath: string) => Promise<{ ok: boolean; data?: any; error?: string }>
        removeQuickLink: (id: string) => Promise<{ ok: boolean; error?: string }>
        updateQuickLink: (id: string, updates: { name?: string; path?: string }) => Promise<{ ok: boolean; data?: any; error?: string }>
        reorderQuickLinks: (orderedIds: string[]) => Promise<{ ok: boolean; error?: string }>
        setShowDefaultQuickLinks: (show: boolean) => Promise<{ ok: boolean; error?: string }>
        resetQuickLinks: () => Promise<{ ok: boolean; error?: string }>
        selectFolder: () => Promise<{ ok: boolean; path: string | null }>
        getMediaInfo: (filePath: string) => Promise<{ ok: boolean; data?: any; error?: string }>
        getMediaInfoBatch: (filePaths: string[]) => Promise<{ 
          ok: boolean; 
          data?: Array<{ path: string; mediaInfo?: any }>; 
          error?: string 
        }>
      }
    }
  }
}
