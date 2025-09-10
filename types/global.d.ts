export {}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      showMessageBox: (options: {
        type?: "none" | "info" | "error" | "question" | "warning"
        title?: string
        message: string
        detail?: string
        buttons?: string[]
        defaultId?: number
        cancelId?: number
      }) => Promise<{ response: number; checkboxChecked?: boolean }>
      fs: {
        getDrives: () => Promise<Array<{ name: string; path: string; type: "drive" }>>
        findRemovableDriveWithDCIM: () => Promise<string | null>
        listDirectoriesOnly: (targetPath: string) => Promise<{
          path: string
          entries: Array<{
            name: string
            path: string
            type: "directory"
            size: number | null
            modifiedMs: number | null
            ext: string | null
          }>
        }>
        getQuickLinks: () => Promise<
          Array<{ id: string; name: string; path: string; type: "directory"; isCustom: boolean }>
        >
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
        addQuickLink: (
          name: string,
          targetPath: string
        ) => Promise<{ ok: boolean; data?: any; error?: string }>
        removeQuickLink: (id: string) => Promise<{ ok: boolean; error?: string }>
        updateQuickLink: (
          id: string,
          updates: { name?: string; path?: string }
        ) => Promise<{ ok: boolean; data?: any; error?: string }>
        reorderQuickLinks: (orderedIds: string[]) => Promise<{ ok: boolean; error?: string }>
        setShowDefaultQuickLinks: (show: boolean) => Promise<{ ok: boolean; error?: string }>
        resetQuickLinks: () => Promise<{ ok: boolean; error?: string }>
        selectFolder: () => Promise<{ ok: boolean; path: string | null }>
        getMediaInfo: (filePath: string) => Promise<{ ok: boolean; data?: any; error?: string }>
        getMediaInfoBatch: (filePaths: string[]) => Promise<{
          ok: boolean
          data?: Array<{ path: string; mediaInfo?: any }>
          error?: string
        }>
        updateFileDate: (
          filePath: string,
          dateString: string
        ) => Promise<{ ok: boolean; error?: string }>
        createFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>
        deleteItem: (itemPath: string) => Promise<{ ok: boolean; error?: string }>
        analyzeSource: (sourcePath: string) => Promise<{
          ok: boolean
          data?: {
            filesByDate: Record<
              string,
              Array<{
                path: string
                name: string
                type: "image" | "video"
                size: number
                date: string
                encodedDate?: string
                modifiedMs: number
              }>
            >
            totalFiles: number
            totalSize: number
            dates: string[]
          }
          error?: string
        }>
        importMedia: (
          sourcePath: string,
          destinationPath: string,
          selectedDate?: string,
          createDateFolders?: boolean
        ) => Promise<{
          ok: boolean
          data?: {
            imported: number
            total: number
            errors?: string[]
            skipped?: Array<{
              file: string
              error: string
              type: "permission" | "disk_space" | "file_corrupted" | "path_too_long" | "unknown"
              canRetry: boolean
              retryCount: number
            }>
            warnings?: string[]
          }
          error?: string
        }>
        access: (filePath: string) => Promise<boolean>
        copyFileWithRetry: (
          sourcePath: string,
          targetPath: string,
          maxRetries?: number
        ) => Promise<{
          success: boolean
          error?: string
        }>
      }
      onImportProgress: (
        callback: (progress: { current: number; total: number; currentFile: string }) => void
      ) => () => void
      onAnalyzeProgress: (
        callback: (progress: {
          type: "scanning" | "complete"
          scannedFiles: number
          scannedDirs: number
          foundMediaFiles: number
          currentPath: string
        }) => void
      ) => () => void
      onFileCopyProgress: (
        callback: (progress: {
          fileName: string
          transferred: number
          total: number
          percentage: number
          speed: number
          eta: number
          status: "copying" | "completed" | "failed" | "retrying"
        }) => void
      ) => () => void
    }
  }
}
