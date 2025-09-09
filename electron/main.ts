import { app, BrowserWindow, ipcMain, shell, IpcMainInvokeEvent } from "electron"
import * as path from "path"
import * as fs from "fs"
import * as os from "os"
import { execFile } from "child_process"
import { quickLinksStore, type StoredQuickLink } from "./quickLinksStore"

const fsp = fs.promises

interface Drive {
  name: string
  path: string
  type: "drive"
}

type QuickLink = StoredQuickLink

interface Entry {
  name: string
  path: string
  type: "file" | "directory" | "drive"
  size: number | null
  modifiedMs: number | null
  ext: string | null
}

interface ListDirectoryResult {
  path: string
  entries: Entry[]
  error?: string
}

/**
 * Create the main window
 */
function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b0b0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "renderer", "index.html")
    mainWindow.loadFile(indexPath)
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  return mainWindow
}

app.whenReady().then(() => {
  createMainWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// Example secure IPC ping
ipcMain.handle("app:ping", async () => {
  return "pong"
})

// ------ Filesystem IPC ------

/**
 * Try to get drives via PowerShell for Windows. Returns null on failure.
 */
function getDrivesViaPowerShell(): Promise<Drive[] | null> {
  return new Promise((resolve) => {
    const psCmd = "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", psCmd],
      { windowsHide: true, timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null)
        const lines = stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => /^[A-Za-z]:\\?$/.test(l))
        if (lines.length === 0) return resolve(null)
        resolve(
          lines.map((p) => ({
            name: p.replace(/\\$/, ""),
            path: p.endsWith("\\") ? p : p + "\\",
            type: "drive",
          }))
        )
      }
    )
  })
}

/**
 * Return available drive root paths on Windows (e.g., C:\\, D:\\)
 * Fallback: if not Windows, return only root '/'
 */
async function getDrives(): Promise<Drive[]> {
  if (process.platform !== "win32") {
    return [{ name: "Root", path: "/", type: "drive" }]
  }

  // Try PowerShell for non-blocking enumeration first
  try {
    const ps = await getDrivesViaPowerShell()
    if (ps && Array.isArray(ps) && ps.length) return ps
  } catch (_) {}

  // Fallback: probe letters asynchronously with limited concurrency
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  const candidates = letters.map((letter) => `${letter}:\\`)
  const results = await mapLimit(candidates, 8, async (drivePath) => {
    try {
      await fsp.access(drivePath)
      return { ok: true, drivePath }
    } catch (_) {
      return { ok: false, drivePath }
    }
  })
  return results
    .filter((r) => r.ok)
    .map((r) => ({ name: r.drivePath.replace(/\\$/, ""), path: r.drivePath, type: "drive" }))
}

function getQuickLinks(): QuickLink[] {
  return quickLinksStore.getAll()
}

async function listDirectory(targetPath: string): Promise<ListDirectoryResult> {
  // Special pseudo-path for drives view
  if (targetPath === "::drives") {
    const drives = await getDrives()
    return {
      path: "::drives",
      entries: drives.map((d) => ({
        name: d.name,
        path: d.path,
        type: "drive",
        size: null,
        modifiedMs: null,
        ext: null,
      })),
    }
  }

  let resolved = targetPath
  try {
    if (!resolved || resolved === "~") resolved = os.homedir()
    // Normalize and ensure it exists
    resolved = path.resolve(resolved)
  } catch (e) {
    resolved = os.homedir()
  }

  let dirents: fs.Dirent[]
  try {
    dirents = await fsp.readdir(resolved, { withFileTypes: true })
  } catch (e: any) {
    return { path: resolved, entries: [], error: e?.message || String(e) }
  }

  const entries = await mapLimit(dirents, 24, async (d) => {
    const entryPath = path.join(resolved, d.name)
    const isDirectory = d.isDirectory()
    let stats: fs.Stats | null = null
    if (!isDirectory) {
      try {
        stats = await fsp.stat(entryPath)
      } catch (_) {}
    }
    const ext = !isDirectory ? path.extname(d.name).replace(/^\./, "").toLowerCase() : null
    return {
      name: d.name,
      path: entryPath,
      type: isDirectory ? ("directory" as const) : ("file" as const),
      size: !isDirectory && stats ? stats.size : null,
      modifiedMs: stats ? stats.mtimeMs : null,
      ext,
    }
  })

  // Default sort: folders first, then by name
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })

  return { path: resolved, entries }
}

ipcMain.handle("fs:getDrives", async () => {
  return await getDrives()
})

ipcMain.handle("fs:getQuickLinks", async () => {
  return getQuickLinks()
})

ipcMain.handle("fs:listDir", async (_e: IpcMainInvokeEvent, targetPath: string) => {
  return await listDirectory(targetPath)
})

ipcMain.handle("fs:homeDir", async () => {
  return os.homedir()
})

ipcMain.handle("fs:joinPath", async (_e: IpcMainInvokeEvent, base: string, name: string) => {
  if (!base || base === "::drives") return name
  return path.join(base, name)
})

ipcMain.handle("fs:openPath", async (_e: IpcMainInvokeEvent, targetPath: string) => {
  if (!targetPath) return { ok: false, error: "No path" }
  try {
    const result = await shell.openPath(targetPath)
    if (result) return { ok: false, error: result }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
})

// Quick link management IPC handlers
ipcMain.handle("fs:addQuickLink", async (_e: IpcMainInvokeEvent, name: string, targetPath: string) => {
  try {
    const link = quickLinksStore.add(name, targetPath)
    return { ok: true, data: link }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:removeQuickLink", async (_e: IpcMainInvokeEvent, id: string) => {
  try {
    const success = quickLinksStore.remove(id)
    return { ok: success, error: success ? undefined : "Quick link not found" }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:updateQuickLink", async (_e: IpcMainInvokeEvent, id: string, updates: { name?: string; path?: string }) => {
  try {
    const link = quickLinksStore.update(id, updates)
    if (!link) {
      return { ok: false, error: "Quick link not found" }
    }
    return { ok: true, data: link }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:reorderQuickLinks", async (_e: IpcMainInvokeEvent, orderedIds: string[]) => {
  try {
    quickLinksStore.reorder(orderedIds)
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:setShowDefaultQuickLinks", async (_e: IpcMainInvokeEvent, show: boolean) => {
  try {
    quickLinksStore.setShowDefaults(show)
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:resetQuickLinks", async () => {
  try {
    quickLinksStore.reset()
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

// Simple concurrency limiter
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (true) {
      const i = index++
      if (i >= items.length) break
      results[i] = await mapper(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
