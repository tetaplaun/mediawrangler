import { app, BrowserWindow, ipcMain, shell, dialog, IpcMainInvokeEvent } from "electron"
import * as path from "path"
import * as fs from "fs"
import * as os from "os"
import { execFile, exec } from "child_process"
import { promisify } from "util"
import { quickLinksStore, type StoredQuickLink } from "./quickLinksStore"
import * as ffmpeg from "fluent-ffmpeg"
import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import sizeOf from "image-size"
import exifr from "exifr"

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const fsp = fs.promises
const execAsync = promisify(exec)

// Simple in-memory cache for analysis results
const analysisCache = new Map<string, { result: AnalyzeResult; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface Drive {
  name: string
  path: string
  type: "drive"
}

type QuickLink = StoredQuickLink

interface MediaInfo {
  dimensions?: { width: number; height: number }
  frameRate?: number
  encodedDate?: string
  duration?: number // in seconds
  bitRate?: number // in bps
  format?: string
  codec?: string
}

interface Entry {
  name: string
  path: string
  type: "file" | "directory" | "drive"
  size: number | null
  modifiedMs: number | null
  ext: string | null
  mediaInfo?: MediaInfo
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
    title: "Media Wrangler",
    titleBarStyle: "default",
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
    const indexPath = path.join(__dirname, "dist", "renderer", "index.html")
    mainWindow.loadFile(indexPath)
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.setTitle("Media Wrangler")
    mainWindow.show()
  })

  // Ensure the title stays as "Media Wrangler" even if the page tries to change it
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault()
    mainWindow.setTitle("Media Wrangler")
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

// Show native message box dialog
ipcMain.handle("app:showMessageBox", async (_e: IpcMainInvokeEvent, options: any) => {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  if (focusedWindow) {
    return await dialog.showMessageBox(focusedWindow, options)
  } else {
    return await dialog.showMessageBox(options)
  }
})

// ------ Media Info Functions ------

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "mkv",
  "avi",
  "webm",
  "m4v",
  "mpg",
  "mpeg",
  "wmv",
  "flv",
])
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "tiff",
  "ico",
  "heic",
  "heif",
  "dng",
  "raw",
  "cr2",
  "cr3",
  "nef",
  "arw",
  "orf",
  "rw2",
  "raf",
])

function isVideoFile(ext: string | null): boolean {
  return ext ? VIDEO_EXTENSIONS.has(ext.toLowerCase()) : false
}

function isImageFile(ext: string | null): boolean {
  return ext ? IMAGE_EXTENSIONS.has(ext.toLowerCase()) : false
}

function isMediaFile(ext: string | null): boolean {
  return isVideoFile(ext) || isImageFile(ext)
}

async function getDateFromExifTool(filePath: string): Promise<string | null> {
  try {
    // Use exiftool to extract date fields - it handles HEIC files properly
    const { stdout } = await execAsync(
      `exiftool -DateTimeOriginal -CreateDate -ModifyDate -CreationDate -MediaCreateDate -json "${filePath}"`
    )

    const data = JSON.parse(stdout)
    if (data && data[0]) {
      const exif = data[0]

      // Try various date fields in order of preference
      const dateStr =
        exif.DateTimeOriginal ||
        exif.CreateDate ||
        exif.MediaCreateDate ||
        exif.CreationDate ||
        exif.ModifyDate

      if (dateStr) {
        // ExifTool returns dates in format like "2024:08:23 14:30:45"
        // Convert to ISO format
        const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
        if (match) {
          const [_, year, month, day, hour, minute, second] = match
          return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toISOString()
        }
        return dateStr
      }
    }
    return null
  } catch (err) {
    // Silently fail if ExifTool is not available or has an error
    return null
  }
}

async function getVideoInfo(filePath: string): Promise<MediaInfo> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve({})
        return
      }

      const videoStream = metadata.streams?.find((s) => s.codec_type === "video")
      const mediaInfo: MediaInfo = {}

      // Dimensions
      if (videoStream?.width && videoStream?.height) {
        mediaInfo.dimensions = {
          width: videoStream.width,
          height: videoStream.height,
        }
      }

      // Frame rate
      if (videoStream?.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split("/").map(Number)
        if (num && den) {
          mediaInfo.frameRate = Math.round((num / den) * 100) / 100
        }
      }

      // Duration
      if (metadata.format?.duration) {
        mediaInfo.duration =
          typeof metadata.format.duration === "string"
            ? parseFloat(metadata.format.duration)
            : metadata.format.duration
      }

      // Bit rate
      if (metadata.format?.bit_rate) {
        mediaInfo.bitRate =
          typeof metadata.format.bit_rate === "string"
            ? parseInt(metadata.format.bit_rate)
            : metadata.format.bit_rate
      }

      // Format - clean up comma-separated list for MOV/MP4 family
      if (metadata.format?.format_name) {
        const formatName = metadata.format.format_name

        // Common MOV/MP4 family format string
        if (formatName === "mov,mp4,m4a,3gp,3g2,mj2") {
          // Use the file extension as the format for cleaner display
          const ext = path.extname(filePath).replace(/^\./, "").toUpperCase()
          mediaInfo.format = ext || "MP4"
        } else if (formatName.includes(",")) {
          // For other comma-separated formats, use the first one
          mediaInfo.format = formatName.split(",")[0].toUpperCase()
        } else {
          mediaInfo.format = formatName.toUpperCase()
        }
      }

      // Codec
      if (videoStream?.codec_name) {
        mediaInfo.codec = videoStream.codec_name.toUpperCase()
      }

      // Encoded date
      if (metadata.format?.tags?.creation_time) {
        const creationTime = metadata.format.tags.creation_time
        mediaInfo.encodedDate =
          typeof creationTime === "string" ? creationTime : String(creationTime)
      }

      resolve(mediaInfo)
    })
  })
}

async function getImageInfo(filePath: string): Promise<MediaInfo> {
  const mediaInfo: MediaInfo = {}
  const ext = path.extname(filePath).toLowerCase()
  const isHEIC = ext === ".heic" || ext === ".heif"

  // Get dimensions and format using image-size (faster)
  try {
    const buffer = await fsp.readFile(filePath)
    const dimensions = sizeOf(buffer)

    if (dimensions.width && dimensions.height) {
      mediaInfo.dimensions = {
        width: dimensions.width,
        height: dimensions.height,
      }
    }

    if (dimensions.type) {
      mediaInfo.format = dimensions.type.toUpperCase()
    }
  } catch (err) {
    // Silently fail - dimensions not critical
  }

  // For HEIC files, try ExifTool first as it handles them properly
  if (isHEIC) {
    const exifToolDate = await getDateFromExifTool(filePath)
    if (exifToolDate) {
      mediaInfo.encodedDate = exifToolDate
    }
  }

  // If not HEIC or ExifTool failed, try exifr
  if (!mediaInfo.encodedDate) {
    try {
      const exifOptions = {
        pick: [
          "DateTimeOriginal",
          "CreateDate",
          "DateTime",
          "ModifyDate",
          "DateCreated",
          "DateTimeDigitized",
          "SubSecTimeOriginal",
          "SubSecTime",
        ],
      }

      const exifData = await exifr.parse(filePath, exifOptions)

      if (exifData) {
        // Try various date fields that might exist in EXIF
        const dateField =
          exifData.DateTimeOriginal ||
          exifData.CreateDate ||
          exifData.DateTimeDigitized ||
          exifData.DateTime ||
          exifData.ModifyDate ||
          exifData.DateCreated

        if (dateField) {
          // Convert Date object or string to ISO string
          if (dateField instanceof Date) {
            mediaInfo.encodedDate = dateField.toISOString()
          } else {
            mediaInfo.encodedDate = String(dateField)
          }
        }
      }
    } catch (err) {
      // Silently fail - exifr might not support all formats
    }

    // Fallback to ffprobe for HEIC files if still no date
    if (isHEIC && !mediaInfo.encodedDate) {
      try {
        await new Promise<void>((resolve) => {
          ffmpeg.ffprobe(filePath, async (err, metadata) => {
            if (err) {
              resolve()
              return
            }

            // Try to extract creation date from format tags
            if (metadata.format?.tags) {
              const tags = metadata.format.tags

              const dateField =
                tags.creation_time ||
                tags["com.apple.quicktime.creationdate"] ||
                tags["com.apple.quicktime.creation_date"] ||
                tags.creation_date ||
                tags.date

              if (dateField) {
                mediaInfo.encodedDate =
                  typeof dateField === "string" ? dateField : String(dateField)
              }
            }

            // Also check stream tags
            if (!mediaInfo.encodedDate && metadata.streams) {
              for (const stream of metadata.streams) {
                if (stream.tags) {
                  const streamDate =
                    stream.tags.creation_time ||
                    stream.tags["com.apple.quicktime.creationdate"] ||
                    stream.tags.creation_date
                  if (streamDate) {
                    mediaInfo.encodedDate =
                      typeof streamDate === "string" ? streamDate : String(streamDate)
                    break
                  }
                }
              }
            }

            if (!mediaInfo.encodedDate) {
              // Ultimate fallback: use file creation time
              try {
                const stats = await fsp.stat(filePath)
                // Use birthtime (creation time) if available, otherwise mtime
                const fileDate = stats.birthtime || stats.mtime
                if (fileDate) {
                  mediaInfo.encodedDate = fileDate.toISOString()
                }
              } catch (statErr) {
                // Silently fail - file stats not available
              }
            }

            resolve()
          })
        })
      } catch (ffprobeErr) {
        // Silently fail - ffprobe not critical
      }
    }
  }

  return mediaInfo
}

async function getMediaInfo(filePath: string, ext: string | null): Promise<MediaInfo | undefined> {
  if (!isMediaFile(ext)) {
    return undefined
  }

  try {
    let mediaInfo: MediaInfo | undefined

    if (isVideoFile(ext)) {
      // Add timeout to video processing (longer for large files)
      const videoPromise = getVideoInfo(filePath)
      const timeoutPromise = new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), 60000) // 60 second timeout for videos (for very large files)
      })
      mediaInfo = await Promise.race([videoPromise, timeoutPromise])
    } else if (isImageFile(ext)) {
      // Add timeout to image processing
      const imagePromise = getImageInfo(filePath)
      const timeoutPromise = new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), 5000) // 5 second timeout for images
      })
      mediaInfo = await Promise.race([imagePromise, timeoutPromise])
    }

    return mediaInfo
  } catch (err) {
    console.error("Error getting media info:", err)
    return undefined
  }
}

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

    // Don't fetch media info during initial load for performance
    // Media info will be loaded asynchronously after directory listing

    return {
      name: d.name,
      path: entryPath,
      type: isDirectory ? ("directory" as const) : ("file" as const),
      size: !isDirectory && stats ? stats.size : null,
      modifiedMs: stats ? stats.mtimeMs : null,
      ext,
      mediaInfo: undefined, // Will be loaded asynchronously
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

/**
 * Find removable drives that contain a DCIM directory (typical for camera SD cards)
 */
async function findRemovableDriveWithDCIM(): Promise<string | null> {
  const drives = await getDrives()

  // Skip system drives (C: on Windows, / on Unix)
  const systemDriveRoots = process.platform === "win32" ? ["C:"] : ["/"]

  for (const drive of drives) {
    if (systemDriveRoots.some((root) => drive.path.startsWith(root))) {
      continue // Skip system drives
    }

    try {
      const dcimPath = path.join(drive.path, "DCIM")
      await fsp.access(dcimPath)
      // If we can access DCIM directory, this is likely a camera drive
      return dcimPath
    } catch (_) {
      // DCIM directory not found or not accessible, continue checking other drives
    }
  }

  return null
}

ipcMain.handle("fs:findRemovableDriveWithDCIM", async () => {
  return await findRemovableDriveWithDCIM()
})

/**
 * Analyze source structure to determine import strategy
 */
async function analyzeSourceForImport(sourcePath: string): Promise<{
  sourceType: "dji_camera" | "standard_dcim" | "unknown"
  djiFolders: string[]
  panoramaFolders: string[]
  panoramaFolderDates: Record<string, string>
  dcimPath: string | null
}> {
  const result = {
    sourceType: "unknown" as "dji_camera" | "standard_dcim" | "unknown",
    djiFolders: [] as string[],
    panoramaFolders: [] as string[],
    panoramaFolderDates: {} as Record<string, string>,
    dcimPath: null as string | null,
  }

  try {
    const sourceResult = await listDirectory(sourcePath)
    if (!sourceResult.entries) return result

    // Check for DCIM directory
    const dcimEntry = sourceResult.entries.find(
      (entry) => entry.type === "directory" && entry.name.toUpperCase() === "DCIM"
    )

    let targetPath = sourcePath
    if (dcimEntry) {
      result.dcimPath = path.join(sourcePath, dcimEntry.name)
      targetPath = result.dcimPath
    }

    // Analyze the target directory
    const targetResult = await listDirectory(targetPath)
    if (!targetResult.entries) return result

    // Find DJI folders and PANORAMA folder
    const djiFolders = targetResult.entries.filter(
      (entry) => entry.type === "directory" && /^DJI_\d{3}$/.test(entry.name)
    )

    const panoramaFolder = targetResult.entries.find(
      (entry) => entry.type === "directory" && entry.name.toUpperCase() === "PANORAMA"
    )

    result.djiFolders = djiFolders.map((f) => f.name)

    // Get panorama subfolders if PANORAMA exists (optimized - only reads directory metadata)
    if (panoramaFolder) {
      try {
        const panoramaPath = path.join(targetPath, panoramaFolder.name)
        const panoramaResult = await listDirectoriesOnly(panoramaPath)
        result.panoramaFolders = panoramaResult.entries.map((f) => f.name)

        // Store folder dates to avoid re-fetching later
        panoramaResult.entries.forEach((folder) => {
          if (folder.modifiedMs !== null) {
            const date = new Date(folder.modifiedMs)
            result.panoramaFolderDates[folder.name] = date.toISOString().split("T")[0]
          }
        })
      } catch (err) {
        console.error("Failed to read PANORAMA directory:", err)
      }
    }

    // Determine source type
    if (result.djiFolders.length > 0 || result.panoramaFolders.length > 0) {
      result.sourceType = "dji_camera"
    } else {
      result.sourceType = "standard_dcim"
    }

    return result
  } catch (err) {
    console.error("Failed to analyze source for import:", err)
    return result
  }
}

// Note: getFolderDate is no longer needed as we get dates from listDirectoriesOnly

/**
 * Import DJI media files (images and videos from DJI_XXX folders)
 */
async function importDjiFiles(
  sourcePath: string,
  destinationPath: string,
  djiFolders: string[],
  event?: IpcMainInvokeEvent,
  totalOffset: number = 0,
  grandTotal: number = 0,
  selectedDate?: string,
  createDateFolders: boolean = false
): Promise<{
  imported: number
  errors: ImportError[]
  skipped: ImportError[]
}> {
  const result = { imported: 0, errors: [] as ImportError[], skipped: [] as ImportError[] }

  // Analyze DJI folders for media files
  const filesByDate: Record<string, MediaFileInfo[]> = {}
  let totalFiles = 0

  for (const djiFolder of djiFolders) {
    const djiPath = path.join(sourcePath, djiFolder)
    try {
      const folderAnalysis = await analyzeSourceDirectory(djiPath)
      // Merge results
      Object.entries(folderAnalysis.filesByDate).forEach(([date, files]) => {
        if (!filesByDate[date]) filesByDate[date] = []
        filesByDate[date].push(...files)
      })
      totalFiles += folderAnalysis.totalFiles
    } catch (err) {
      console.error(`Failed to analyze DJI folder ${djiFolder}:`, err)
    }
  }

  // Filter files by date if specified
  let filesToImport: MediaFileInfo[] = []
  if (selectedDate) {
    filesToImport = filesByDate[selectedDate] || []
  } else {
    Object.values(filesByDate).forEach((files) => {
      filesToImport.push(...files)
    })
  }

  if (filesToImport.length === 0) {
    return result
  }

  // Group files by date for organized copying
  const groupedFiles: Record<string, MediaFileInfo[]> = {}
  filesToImport.forEach((file) => {
    if (!groupedFiles[file.date]) {
      groupedFiles[file.date] = []
    }
    groupedFiles[file.date].push(file)
  })

  // Copy files with date-based organization
  for (const [date, files] of Object.entries(groupedFiles)) {
    let imagesDir: string
    let videosDir: string

    if (createDateFolders) {
      imagesDir = path.join(destinationPath, date, "IMAGES")
      videosDir = path.join(destinationPath, date, "VIDEOS")
    } else {
      imagesDir = path.join(destinationPath, "IMAGES")
      videosDir = path.join(destinationPath, "VIDEOS")
    }

    // Create directories
    try {
      await fsp.mkdir(imagesDir, { recursive: true })
      await fsp.mkdir(videosDir, { recursive: true })
    } catch (dirError) {
      const dirErrorObj = categorizeError(dirError, `Directory creation for ${date}`)
      result.errors.push(dirErrorObj)
      continue
    }

    // Copy files
    let filesProcessed = 0
    await mapLimit(files, 8, async (file) => {
      try {
        const targetDir = file.type === "image" ? imagesDir : videosDir
        let targetPath = path.join(targetDir, file.name)

        // Handle duplicates
        let counter = 1
        while (
          await fsp
            .access(targetPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const ext = path.extname(file.name)
          const baseName = path.basename(file.name, ext)
          targetPath = path.join(targetDir, `${baseName}_${counter}${ext}`)
          counter++
        }

        // Send progress update BEFORE copying to show current file
        if (event && grandTotal > 0) {
          const progress: ImportProgress = {
            current: totalOffset + result.imported,
            total: grandTotal,
            currentFile: file.name,
          }
          event.sender.send("import-progress", progress)
        }
        
        await copyFileWithRetry(file.path, targetPath)
        result.imported++
        filesProcessed++
      } catch (fileError) {
        const fileErrorObj = categorizeError(fileError, file.path)
        result.errors.push(fileErrorObj)
        filesProcessed++
      }
    })
  }

  return result
}

/**
 * Import panorama folders with folder-based date filtering
 */
async function importPanoramaFolders(
  sourcePath: string,
  destinationPath: string,
  panoramaFolders: string[],
  panoramaFolderDates: Record<string, string>,
  event?: IpcMainInvokeEvent,
  totalOffset: number = 0,
  grandTotal: number = 0,
  selectedDate?: string
): Promise<{
  imported: number
  errors: ImportError[]
  skipped: ImportError[]
}> {
  const result = { imported: 0, errors: [] as ImportError[], skipped: [] as ImportError[] }

  if (panoramaFolders.length === 0) {
    return result
  }

  // Create PANO_SOURCES directory
  const panoSourcesDir = path.join(destinationPath, "PANO_SOURCES")
  try {
    await fsp.mkdir(panoSourcesDir, { recursive: true })
  } catch (dirError) {
    const dirErrorObj = categorizeError(dirError, `PANO_SOURCES directory creation`)
    result.errors.push(dirErrorObj)
    return result
  }

  // Process each panorama folder
  let foldersProcessed = 0
  for (const panoFolder of panoramaFolders) {
    const sourcePanoPath = path.join(sourcePath, panoFolder)
    const targetPanoPath = path.join(panoSourcesDir, panoFolder)

    try {
      // Use pre-fetched folder date for filtering
      const folderDate = panoramaFolderDates[panoFolder]

      // Skip if date filtering is enabled and doesn't match
      if (selectedDate && folderDate && folderDate !== selectedDate) {
        // Silently skip without tracking
        foldersProcessed++
        continue
      }

      // Send progress update BEFORE copying to show current folder
      if (event && grandTotal > 0) {
        const progress: ImportProgress = {
          current: totalOffset + result.imported,
          total: grandTotal,
          currentFile: `Panorama folder: ${panoFolder}`,
        }
        event.sender.send("import-progress", progress)
      }
      
      // Copy the entire folder recursively
      await copyDirectoryRecursive(sourcePanoPath, targetPanoPath)
      result.imported++
      foldersProcessed++
    } catch (folderError) {
      const folderErrorObj = categorizeError(folderError, sourcePanoPath)
      result.errors.push(folderErrorObj)
      foldersProcessed++
    }
  }

  return result
}

/**
 * Get only directory entries (folders) with their metadata, without reading contents
 */
async function listDirectoriesOnly(targetPath: string): Promise<{
  path: string
  entries: Array<{
    name: string
    path: string
    type: "directory"
    size: number | null
    modifiedMs: number | null
    ext: string | null
  }>
}> {
  try {
    const entries = await fsp.readdir(targetPath, { withFileTypes: true })

    const directories = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const fullPath = path.join(targetPath, entry.name)
          try {
            const stats = await fsp.stat(fullPath)
            return {
              name: entry.name,
              path: fullPath,
              type: "directory" as const,
              size: stats.size,
              modifiedMs: stats.mtimeMs,
              ext: null,
            }
          } catch (err) {
            // If we can't read stats, still include the directory
            return {
              name: entry.name,
              path: fullPath,
              type: "directory" as const,
              size: null,
              modifiedMs: null,
              ext: null,
            }
          }
        })
    )

    return {
      path: targetPath,
      entries: directories,
    }
  } catch (err) {
    console.error(`Failed to list directories in ${targetPath}:`, err)
    return {
      path: targetPath,
      entries: [],
    }
  }
}

/**
 * Recursively copy a directory
 */
async function copyDirectoryRecursive(source: string, target: string): Promise<void> {
  await fsp.mkdir(target, { recursive: true })

  const entries = await fsp.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, targetPath)
    } else {
      await copyFileWithRetry(sourcePath, targetPath)
    }
  }
}

ipcMain.handle("fs:getQuickLinks", async () => {
  return getQuickLinks()
})

ipcMain.handle("fs:listDirectoriesOnly", async (_e: IpcMainInvokeEvent, targetPath: string) => {
  return await listDirectoriesOnly(targetPath)
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
ipcMain.handle(
  "fs:addQuickLink",
  async (_e: IpcMainInvokeEvent, name: string, targetPath: string) => {
    try {
      const link = quickLinksStore.add(name, targetPath)
      return { ok: true, data: link }
    } catch (error: any) {
      return { ok: false, error: error?.message || String(error) }
    }
  }
)

ipcMain.handle("fs:removeQuickLink", async (_e: IpcMainInvokeEvent, id: string) => {
  try {
    const success = quickLinksStore.remove(id)
    return { ok: success, error: success ? undefined : "Quick link not found" }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle(
  "fs:updateQuickLink",
  async (_e: IpcMainInvokeEvent, id: string, updates: { name?: string; path?: string }) => {
    try {
      const link = quickLinksStore.update(id, updates)
      if (!link) {
        return { ok: false, error: "Quick link not found" }
      }
      return { ok: true, data: link }
    } catch (error: any) {
      return { ok: false, error: error?.message || String(error) }
    }
  }
)

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

ipcMain.handle("fs:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Folder",
    properties: ["openDirectory"],
  })

  if (result.canceled || !result.filePaths.length) {
    return { ok: false, path: null }
  }

  return { ok: true, path: result.filePaths[0] }
})

ipcMain.handle("fs:getMediaInfo", async (_e: IpcMainInvokeEvent, filePath: string) => {
  try {
    const ext = path.extname(filePath).replace(/^\./, "").toLowerCase()
    const mediaInfo = await getMediaInfo(filePath, ext)
    return { ok: true, data: mediaInfo }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:createFolder", async (_e: IpcMainInvokeEvent, folderPath: string) => {
  try {
    await fsp.mkdir(folderPath, { recursive: true })
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:deleteItem", async (_e: IpcMainInvokeEvent, itemPath: string) => {
  try {
    const stats = await fsp.stat(itemPath)
    if (stats.isDirectory()) {
      await fsp.rm(itemPath, { recursive: true, force: true })
    } else {
      await fsp.unlink(itemPath)
    }
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle("fs:getMediaInfoBatch", async (_e: IpcMainInvokeEvent, filePaths: string[]) => {
  try {
    // Process media files with optimized concurrency for better performance
    const results = await mapLimit(filePaths, 100, async (filePath) => {
      try {
        const ext = path.extname(filePath).replace(/^\./, "").toLowerCase()
        if (!isMediaFile(ext)) {
          return { path: filePath, mediaInfo: undefined }
        }
        const mediaInfo = await getMediaInfo(filePath, ext)
        return { path: filePath, mediaInfo }
      } catch (err) {
        console.error(`Error getting media info for ${filePath}:`, err)
        return { path: filePath, mediaInfo: undefined }
      }
    })

    return { ok: true, data: results }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

// Clear analysis cache
ipcMain.handle("fs:clearAnalysisCache", async () => {
  try {
    analysisCache.clear()
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle(
  "fs:updateFileDate",
  async (_e: IpcMainInvokeEvent, filePath: string, dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return { ok: false, error: "Invalid date format" }
      }

      // Use utimes to update the file's modification time
      // We set both atime and mtime to the encoded date
      await fsp.utimes(filePath, date, date)
      return { ok: true }
    } catch (error: any) {
      return { ok: false, error: error?.message || String(error) }
    }
  }
)

// Import functionality
interface MediaFileInfo {
  path: string
  name: string
  type: "image" | "video"
  size: number
  date: string
  encodedDate?: string
  modifiedMs: number
}

interface AnalyzeResult {
  filesByDate: Record<string, MediaFileInfo[]>
  totalFiles: number
  totalSize: number
  dates: string[]
}

async function analyzeSourceDirectory(
  sourcePath: string,
  event?: IpcMainInvokeEvent
): Promise<AnalyzeResult> {
  const filesByDate: Record<string, MediaFileInfo[]> = {}
  let totalFiles = 0
  let totalSize = 0
  let scannedFiles = 0
  let scannedDirs = 0

  // Add timeout to prevent infinite hanging
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Analysis timeout after 15 minutes")), 15 * 60 * 1000)
  })

  async function scanDirectory(dirPath: string, depth = 0): Promise<void> {
    // Prevent infinite recursion
    if (depth > 50) {
      console.warn(`Maximum directory depth reached at: ${dirPath}`)
      return
    }

    try {
      const dirents = await fsp.readdir(dirPath, { withFileTypes: true })

      await mapLimit(dirents, 5, async (dirent) => {
        const fullPath = path.join(dirPath, dirent.name)

        if (dirent.isDirectory()) {
          scannedDirs++

          // Skip PANORAMA directories to avoid scanning thousands of panorama source files
          if (dirent.name.toUpperCase() === "PANORAMA") {
            return
          }

          // Send progress update less frequently to avoid overwhelming the UI
          if (event && scannedDirs % 5 === 0) {
            event.sender.send("analyze-progress", {
              type: "scanning",
              scannedFiles,
              scannedDirs,
              foundMediaFiles: totalFiles,
              currentPath: fullPath,
            })
          }

          await scanDirectory(fullPath, depth + 1)
        } else if (dirent.isFile()) {
          scannedFiles++
          const ext = path.extname(dirent.name).replace(/^\./, "").toLowerCase()

          if (isMediaFile(ext)) {
            try {
              const stats = await fsp.stat(fullPath)
              const mediaInfo = await getMediaInfo(fullPath, ext)

              // Determine the date to use for grouping
              let dateStr: string
              if (mediaInfo?.encodedDate) {
                dateStr = new Date(mediaInfo.encodedDate).toISOString().split("T")[0]
              } else {
                // Fallback to file modification date
                dateStr = new Date(stats.mtime).toISOString().split("T")[0]
              }

              const fileInfo: MediaFileInfo = {
                path: fullPath,
                name: dirent.name,
                type: isImageFile(ext) ? "image" : "video",
                size: stats.size,
                date: dateStr,
                encodedDate: mediaInfo?.encodedDate,
                modifiedMs: stats.mtimeMs,
              }

              if (!filesByDate[dateStr]) {
                filesByDate[dateStr] = []
              }
              filesByDate[dateStr].push(fileInfo)
              totalFiles++
              totalSize += stats.size

              // Send progress update for found media files (less frequent)
              if (event && totalFiles % 10 === 0) {
                event.sender.send("analyze-progress", {
                  type: "scanning",
                  scannedFiles,
                  scannedDirs,
                  foundMediaFiles: totalFiles,
                  currentPath: fullPath,
                })
              }
            } catch (fileError) {
              console.error(`Error processing file ${fullPath}:`, fileError)
              // Continue processing other files
            }
          }
        }
      })
    } catch (err) {
      console.error(`Error scanning directory ${dirPath}:`, err)
    }
  }

  console.log(`Starting analysis of: ${sourcePath}`)

  try {
    await Promise.race([scanDirectory(sourcePath), timeoutPromise])

    console.log(
      `Analysis completed: ${totalFiles} media files found, ${scannedDirs} directories scanned`
    )

    // Send final progress update
    if (event) {
      event.sender.send("analyze-progress", {
        type: "complete",
        scannedFiles,
        scannedDirs,
        foundMediaFiles: totalFiles,
        currentPath: sourcePath,
      })
    }
  } catch (error) {
    console.error("Analysis failed:", error)

    // Send error progress update
    if (event) {
      event.sender.send("analyze-progress", {
        type: "complete",
        scannedFiles,
        scannedDirs,
        foundMediaFiles: totalFiles,
        currentPath: sourcePath,
      })
    }

    // If it was a timeout, throw the error to be handled by the caller
    if (error instanceof Error && error.message.includes("timeout")) {
      throw error
    }
  }

  const dates = Object.keys(filesByDate).sort()

  return {
    filesByDate,
    totalFiles,
    totalSize,
    dates,
  }
}

interface ImportProgress {
  current: number
  total: number
  currentFile: string
}

interface ImportError {
  file: string
  error: string
  type: "permission" | "disk_space" | "file_corrupted" | "path_too_long" | "unknown"
  canRetry: boolean
  retryCount: number
}

interface DetailedImportResult {
  imported: number
  total: number
  errors: ImportError[]
  skipped: ImportError[]
  warnings: string[]
}

function categorizeError(error: unknown, fileName: string): ImportError {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Check for specific error types
  if (
    errorMessage.includes("EACCES") ||
    errorMessage.includes("EPERM") ||
    errorMessage.includes("permission")
  ) {
    return {
      file: fileName,
      error: errorMessage,
      type: "permission",
      canRetry: true,
      retryCount: 0,
    }
  }

  if (
    errorMessage.includes("ENOSPC") ||
    errorMessage.includes("disk") ||
    errorMessage.includes("space")
  ) {
    return {
      file: fileName,
      error: errorMessage,
      type: "disk_space",
      canRetry: false,
      retryCount: 0,
    }
  }

  if (
    errorMessage.includes("ENAMETOOLONG") ||
    errorMessage.includes("path") ||
    errorMessage.includes("length")
  ) {
    return {
      file: fileName,
      error: errorMessage,
      type: "path_too_long",
      canRetry: false,
      retryCount: 0,
    }
  }

  if (
    errorMessage.includes("corrupt") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("format")
  ) {
    return {
      file: fileName,
      error: errorMessage,
      type: "file_corrupted",
      canRetry: true,
      retryCount: 0,
    }
  }

  return {
    file: fileName,
    error: errorMessage,
    type: "unknown",
    canRetry: true,
    retryCount: 0,
  }
}

async function copyFileWithRetry(
  sourcePath: string,
  targetPath: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: ImportError }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fsp.copyFile(sourcePath, targetPath)

      // Preserve original file dates
      const stats = await fsp.stat(sourcePath)
      await fsp.utimes(targetPath, stats.atime, stats.mtime)

      return { success: true }
    } catch (error) {
      const fileName = path.basename(sourcePath)
      const importError = categorizeError(error, fileName)

      // If this is the last attempt or error is not retryable
      if (attempt === maxRetries || !importError.canRetry) {
        importError.retryCount = attempt
        return { success: false, error: importError }
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  return {
    success: false,
    error: categorizeError("Max retries exceeded", path.basename(sourcePath)),
  }
}

ipcMain.handle("fs:analyzeSource", async (event: IpcMainInvokeEvent, sourcePath: string) => {
  try {
    // Check cache first
    const cacheKey = sourcePath
    const cached = analysisCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached analysis for: ${sourcePath}`)
      return { ok: true, data: cached.result }
    }

    // Perform fresh analysis with timeout (clear cache first to ensure fresh analysis)
    analysisCache.delete(cacheKey)

    const analysisPromise = analyzeSourceDirectory(sourcePath, event)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Analysis timeout")), 20 * 60 * 1000) // 20 minute timeout
    })

    const result = await Promise.race([analysisPromise, timeoutPromise])

    // Cache the result
    analysisCache.set(cacheKey, { result, timestamp: Date.now() })

    return { ok: true, data: result }
  } catch (error: any) {
    console.error("Analysis IPC handler error:", error)
    return { ok: false, error: error?.message || "Analysis failed" }
  }
})

ipcMain.handle(
  "fs:importMedia",
  async (
    event: IpcMainInvokeEvent,
    sourcePath: string,
    destinationPath: string,
    selectedDate?: string,
    createDateFolders: boolean = false
  ) => {
    try {
      console.log(`Starting enhanced import from ${sourcePath} to ${destinationPath}`)

      // Analyze source structure to determine import strategy
      const sourceAnalysis = await analyzeSourceForImport(sourcePath)
      console.log(`Source analysis:`, sourceAnalysis)

      let totalImported = 0
      let totalErrors: ImportError[] = []
      let totalSkipped: ImportError[] = []
      let totalWarnings: string[] = []

      // Handle different source types
      if (sourceAnalysis.sourceType === "dji_camera") {
        console.log("Detected DJI camera source, using specialized import strategy")

        // Pre-calculate grand total for progress reporting
        let djiFilesToImport = 0
        let panoramaFoldersToImport = 0
        
        // Count DJI files to import
        if (sourceAnalysis.djiFolders.length > 0) {
          for (const djiFolder of sourceAnalysis.djiFolders) {
            const djiPath = path.join(sourceAnalysis.dcimPath || sourcePath, djiFolder)
            try {
              const folderAnalysis = await analyzeSourceDirectory(djiPath)
              if (selectedDate) {
                djiFilesToImport += (folderAnalysis.filesByDate[selectedDate] || []).length
              } else {
                djiFilesToImport += folderAnalysis.totalFiles
              }
            } catch (err) {
              console.error(`Failed to count files in DJI folder ${djiFolder}:`, err)
            }
          }
        }
        
        // Count panorama folders to import (with date filtering)
        if (sourceAnalysis.panoramaFolders.length > 0) {
          if (selectedDate) {
            panoramaFoldersToImport = sourceAnalysis.panoramaFolders.filter(
              folder => sourceAnalysis.panoramaFolderDates[folder] === selectedDate
            ).length
          } else {
            panoramaFoldersToImport = sourceAnalysis.panoramaFolders.length
          }
        }
        
        const grandTotal = djiFilesToImport + panoramaFoldersToImport
        console.log(`Grand total items to import: ${grandTotal} (${djiFilesToImport} DJI files, ${panoramaFoldersToImport} panorama folders)`)

        // Import DJI files (if any DJI folders exist)
        if (sourceAnalysis.djiFolders.length > 0 && djiFilesToImport > 0) {
          console.log(`Importing DJI files from folders: ${sourceAnalysis.djiFolders.join(", ")}`)
          const djiResult = await importDjiFiles(
            sourceAnalysis.dcimPath || sourcePath,
            destinationPath,
            sourceAnalysis.djiFolders,
            event,
            0, // totalOffset
            grandTotal, // grandTotal
            selectedDate,
            createDateFolders
          )

          totalImported += djiResult.imported
          totalErrors.push(...djiResult.errors)
          // Skipped items are not tracked
        }

        // Import panorama folders (if any exist)
        if (sourceAnalysis.panoramaFolders.length > 0 && panoramaFoldersToImport > 0) {
          console.log(`Importing panorama folders: ${sourceAnalysis.panoramaFolders.join(", ")}`)
          const panoramaResult = await importPanoramaFolders(
            path.join(sourceAnalysis.dcimPath || sourcePath, "PANORAMA"),
            destinationPath,
            sourceAnalysis.panoramaFolders,
            sourceAnalysis.panoramaFolderDates,
            event,
            totalImported, // totalOffset (files already imported)
            grandTotal, // grandTotal
            selectedDate
          )

          totalImported += panoramaResult.imported
          totalErrors.push(...panoramaResult.errors)
          // Skipped items are not tracked
        }

        if (sourceAnalysis.djiFolders.length === 0 && sourceAnalysis.panoramaFolders.length === 0) {
          return { ok: false, error: "No DJI folders or panorama folders found to import" }
        }
      } else {
        // Standard DCIM import - fall back to original logic
        console.log("Using standard DCIM import strategy")

        // Check cache first to avoid redundant re-analysis
        let analysis: AnalyzeResult
        const cacheKey = sourcePath
        const cached = analysisCache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log(`Using cached analysis for import: ${sourcePath}`)
          analysis = cached.result
        } else {
          console.log(
            `Cache expired or not found, performing fresh analysis for import: ${sourcePath}`
          )
          analysis = await analyzeSourceDirectory(sourcePath)
          // Update cache with fresh analysis
          analysisCache.set(cacheKey, { result: analysis, timestamp: Date.now() })
        }

        // Filter files by date if specified
        let filesToImport: MediaFileInfo[] = []
        if (selectedDate) {
          filesToImport = analysis.filesByDate[selectedDate] || []
        } else {
          // Import all files
          Object.values(analysis.filesByDate).forEach((files) => {
            filesToImport.push(...files)
          })
        }

        if (filesToImport.length === 0) {
          return { ok: false, error: "No files to import" }
        }

        // Group files by date for organized copying
        const filesByDate: Record<string, MediaFileInfo[]> = {}
        filesToImport.forEach((file) => {
          if (!filesByDate[file.date]) {
            filesByDate[file.date] = []
          }
          filesByDate[file.date].push(file)
        })

        for (const [date, files] of Object.entries(filesByDate)) {
          // Determine directory structure based on createDateFolders option
          let imagesDir: string
          let videosDir: string

          if (createDateFolders) {
            // Create date-based subdirectories
            const dateFolder = date // Format: YYYY-MM-DD
            imagesDir = path.join(destinationPath, dateFolder, "IMAGES")
            videosDir = path.join(destinationPath, dateFolder, "VIDEOS")
          } else {
            // Create IMAGES and VIDEOS directly in destination
            imagesDir = path.join(destinationPath, "IMAGES")
            videosDir = path.join(destinationPath, "VIDEOS")
          }

          // Create directories if they don't exist
          try {
            await fsp.mkdir(imagesDir, { recursive: true })
            await fsp.mkdir(videosDir, { recursive: true })
          } catch (dirError) {
            const dirErrorObj = categorizeError(dirError, `Directory creation for ${date}`)
            totalErrors.push(dirErrorObj)
            continue // Skip this date group
          }

          // Copy files with optimized concurrency for better performance
          await mapLimit(files, 8, async (file) => {
            try {
              const targetDir = file.type === "image" ? imagesDir : videosDir
              let targetPath = path.join(targetDir, file.name)

              // Handle duplicates by adding a number suffix
              let counter = 1
              let originalTargetPath = targetPath
              while (
                await fsp
                  .access(targetPath)
                  .then(() => true)
                  .catch(() => false)
              ) {
                const ext = path.extname(file.name)
                const nameWithoutExt = path.basename(file.name, ext)
                targetPath = path.join(targetDir, `${nameWithoutExt}_${counter}${ext}`)
                counter++

                // Prevent infinite loops
                if (counter > 100) {
                  // Silently skip without tracking
                  return
                }
              }

              // Check if this is a duplicate (different file with same name)
              if (targetPath !== originalTargetPath) {
                totalWarnings.push(
                  `Duplicate filename: ${file.name} → ${path.basename(targetPath)}`
                )
              }

              // Send progress update BEFORE copying to show current file
              const progress: ImportProgress = {
                current: totalImported,
                total: filesToImport.length,
                currentFile: file.name,
              }
              event.sender.send("import-progress", progress)
              
              // Copy the file with retry mechanism
              const copyResult = await copyFileWithRetry(file.path, targetPath)

              if (copyResult.success) {
                totalImported++
              } else if (copyResult.error) {
                if (copyResult.error.canRetry) {
                  totalErrors.push(copyResult.error)
                }
                // Non-retryable errors are silently skipped
              }
            } catch (err: unknown) {
              const fileName = path.basename(file.path)
              const importError = categorizeError(err, fileName)
              if (importError.canRetry) {
                totalErrors.push(importError)
              }
              // Non-retryable errors are silently skipped
            }
          })
        }
      }

      const totalProcessed = totalImported + totalErrors.length + totalSkipped.length

      const result: DetailedImportResult = {
        imported: totalImported,
        total: totalProcessed,
        errors: totalErrors,
        skipped: totalSkipped,
        warnings: totalWarnings,
      }

      return {
        ok: true,
        data: result,
      }
    } catch (error: unknown) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
)

// Retry mechanism for individual files
ipcMain.handle(
  "fs:copyFileWithRetry",
  async (
    _event: IpcMainInvokeEvent,
    sourcePath: string,
    targetPath: string,
    maxRetries: number = 3
  ) => {
    try {
      const result = await copyFileWithRetry(sourcePath, targetPath, maxRetries)
      return result
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
)

// Check if file exists (for duplicate handling)
ipcMain.handle("fs:access", async (_event: IpcMainInvokeEvent, filePath: string) => {
  try {
    await fsp.access(filePath)
    return true
  } catch {
    return false
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
