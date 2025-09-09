const { app, BrowserWindow, ipcMain, shell } = require("electron")
const path = require("path")
const fs = require("fs")
const fsp = fs.promises
const os = require("os")
const { execFile } = require("child_process")

/**
 * Create the main window
 */
function createMainWindow() {
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
function getDrivesViaPowerShell() {
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
async function getDrives() {
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

function getQuickLinks() {
  const home = os.homedir()
  const isWin = process.platform === "win32"
  const join = (...parts) => path.join(...parts)
  const quick = [
    { name: "Desktop", path: join(home, "Desktop"), type: "directory" },
    { name: "Documents", path: join(home, isWin ? "Documents" : "Documents"), type: "directory" },
    { name: "Downloads", path: join(home, "Downloads"), type: "directory" },
    { name: "Pictures", path: join(home, isWin ? "Pictures" : "Pictures"), type: "directory" },
    { name: "Music", path: join(home, isWin ? "Music" : "Music"), type: "directory" },
    { name: "Videos", path: join(home, isWin ? "Videos" : "Videos"), type: "directory" },
  ]
  return quick
}

async function listDirectory(targetPath) {
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

  let dirents
  try {
    dirents = await fsp.readdir(resolved, { withFileTypes: true })
  } catch (e) {
    return { path: resolved, entries: [], error: e?.message || String(e) }
  }

  const entries = await mapLimit(dirents, 24, async (d) => {
    const entryPath = path.join(resolved, d.name)
    const isDirectory = d.isDirectory()
    let stats = null
    if (!isDirectory) {
      try {
        stats = await fsp.stat(entryPath)
      } catch (_) {}
    }
    const ext = !isDirectory ? path.extname(d.name).replace(/^\./, "").toLowerCase() : null
    return {
      name: d.name,
      path: entryPath,
      type: isDirectory ? "directory" : "file",
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

ipcMain.handle("fs:listDir", async (_e, targetPath) => {
  return await listDirectory(targetPath)
})

ipcMain.handle("fs:homeDir", async () => {
  return os.homedir()
})

ipcMain.handle("fs:joinPath", async (_e, base, name) => {
  if (!base || base === "::drives") return name
  return path.join(base, name)
})

ipcMain.handle("fs:openPath", async (_e, targetPath) => {
  if (!targetPath) return { ok: false, error: "No path" }
  try {
    const result = await shell.openPath(targetPath)
    if (result) return { ok: false, error: result }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
})

// Simple concurrency limiter
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
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
