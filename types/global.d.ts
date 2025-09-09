export {}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      fs: {
        getDrives: () => Promise<Array<{ name: string; path: string; type: string }>>
        getQuickLinks: () => Promise<Array<{ name: string; path: string; type: string }>>
        listDir: (targetPath: string) => Promise<{
          path: string
          entries: Array<{
            name: string
            path: string
            type: "file" | "directory" | "drive"
            size: number | null
            modifiedMs: number | null
            ext: string | null
          }>
          error?: string
        }>
        homeDir: () => Promise<string>
        joinPath: (base: string, name: string) => Promise<string>
        openPath: (targetPath: string) => Promise<{ ok: boolean; error?: string }>
      }
    }
  }
}
