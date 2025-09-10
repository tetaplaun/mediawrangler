"use client"

import React, { useState, useEffect, useCallback } from "react"
import { formatBytes } from "../utils/format"
import path from "path"

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

interface ImportTemplate {
  id: string
  name: string
  sourcePath: string
  destinationPath: string
  createDateFolders: boolean
  selectedDate?: string
  createdAt: number
}

interface ImportHistory {
  id: string
  templateName?: string
  sourcePath: string
  destinationPath: string
  createDateFolders: boolean
  selectedDate?: string
  results: DetailedImportResult
  timestamp: number
}

interface AnalyzeProgress {
  type: "scanning" | "complete"
  scannedFiles: number
  scannedDirs: number
  foundMediaFiles: number
  currentPath: string
}

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

export function ImportDialog({ isOpen, onClose, onImportComplete }: ImportDialogProps) {
  const [sourcePath, setSourcePath] = useState<string>("")
  const [destinationPath, setDestinationPath] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [createDateFolders, setCreateDateFolders] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null)
  const [analyzeProgress, setAnalyzeProgress] = useState<AnalyzeProgress | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string>("")
  const [dragOver, setDragOver] = useState<{ source: boolean; destination: boolean }>({
    source: false,
    destination: false,
  })
  const [retryingErrors, setRetryingErrors] = useState<Set<string>>(new Set())
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, type: "source" | "destination") => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver((prev) => ({ ...prev, [type]: true }))
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, type: "source" | "destination") => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver((prev) => ({ ...prev, [type]: false }))
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, type: "source" | "destination") => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver((prev) => ({ ...prev, [type]: false }))

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const filePath = files[0].path
      if (type === "source") {
        setSourcePath(filePath)
        setAnalysisResult(null)
        setSelectedDate("")
      } else {
        setDestinationPath(filePath)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setSourcePath("")
      setDestinationPath("")
      setSelectedDate("")
      setCreateDateFolders(false)
      setAnalysisResult(null)
      setAnalyzeProgress(null)
      setImportProgress(null)
      setError("")
      setDragOver({ source: false, destination: false })
      setRetryingErrors(new Set())
      setShowTemplates(false)
      setShowHistory(false)
      setTemplateName("")
      setSavingTemplate(false)
    }
  }, [isOpen])

  useEffect(() => {
    // Set up progress listeners
    const removeImportListener = window.electronAPI.onImportProgress((progress: ImportProgress) => {
      setImportProgress(progress)
    })
    const removeAnalyzeListener = window.electronAPI.onAnalyzeProgress(
      (progress: AnalyzeProgress) => {
        setAnalyzeProgress(progress)
      }
    )
    return () => {
      removeImportListener()
      removeAnalyzeListener()
    }
  }, [])

  const handleSelectSource = async () => {
    const result = await window.electronAPI.fs.selectFolder()
    if (result.ok && result.path) {
      setSourcePath(result.path)
      setAnalysisResult(null)
      setSelectedDate("")
    }
  }

  const handleSelectDestination = async () => {
    const result = await window.electronAPI.fs.selectFolder()
    if (result.ok && result.path) {
      setDestinationPath(result.path)
    }
  }

  const handleAnalyze = async () => {
    if (!sourcePath) return

    setAnalyzing(true)
    setError("")
    setAnalyzeProgress(null)
    try {
      const result = await window.electronAPI.fs.analyzeSource(sourcePath)
      if (result.ok && result.data) {
        setAnalysisResult(result.data)
      } else {
        setError(result.error || "Failed to analyze source")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(false)
      setAnalyzeProgress(null)
    }
  }

  const handleImport = async () => {
    if (!sourcePath || !destinationPath) return

    setImporting(true)
    setError("")
    setImportProgress(null)

    try {
      const result = await window.electronAPI.fs.importMedia(
        sourcePath,
        destinationPath,
        selectedDate || undefined,
        createDateFolders
      )

      if (result.ok && result.data) {
        const { imported, total, errors, skipped, warnings } =
          result.data as unknown as DetailedImportResult

        // Create detailed error message
        let errorMessage = ""
        if (errors && errors.length > 0) {
          errorMessage += `Failed to import ${errors.length} file(s):\n`
          errors.forEach((err: ImportError) => {
            errorMessage += `• ${err.file}: ${err.error} (${err.type})\n`
          })
        }

        if (skipped && skipped.length > 0) {
          errorMessage += `\nSkipped ${skipped.length} file(s):\n`
          skipped.forEach((skip: ImportError) => {
            errorMessage += `• ${skip.file}: ${skip.error}\n`
          })
        }

        if (warnings && warnings.length > 0) {
          errorMessage += `\nWarnings:\n`
          warnings.forEach((warning: string) => {
            errorMessage += `• ${warning}\n`
          })
        }

        // Save to history
        saveImportHistory({ imported, total, errors, skipped, warnings })

        if (errorMessage) {
          setError(`Imported ${imported}/${total} files.\n${errorMessage}`)
        } else {
          // Success - close dialog
          onImportComplete?.()
          onClose()
        }
      } else {
        setError(result.error || "Import failed")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }

  const getSelectedFilesInfo = () => {
    if (!analysisResult) return { count: 0, size: 0 }

    if (!selectedDate) {
      return { count: analysisResult.totalFiles, size: analysisResult.totalSize }
    }

    const files = analysisResult.filesByDate[selectedDate] || []
    const size = files.reduce((sum, file) => sum + file.size, 0)
    return { count: files.length, size }
  }

  const handleRetryError = async (error: ImportError) => {
    if (!error.canRetry) return

    setRetryingErrors((prev) => new Set(prev).add(error.file))

    try {
      // Find the original file info from analysis
      let originalFile: MediaFileInfo | undefined
      Object.values(analysisResult?.filesByDate || {}).forEach((files) => {
        const found = files.find((f) => f.name === error.file)
        if (found) originalFile = found
      })

      if (!originalFile) {
        setError(`Could not find original file: ${error.file}`)
        return
      }

      // Determine target directory
      const date = selectedDate || originalFile.date
      let imagesDir: string
      let videosDir: string

      if (createDateFolders) {
        imagesDir = path.join(destinationPath, date, "IMAGES")
        videosDir = path.join(destinationPath, date, "VIDEOS")
      } else {
        imagesDir = path.join(destinationPath, "IMAGES")
        videosDir = path.join(destinationPath, "VIDEOS")
      }

      const targetDir = originalFile.type === "image" ? imagesDir : videosDir
      let targetPath = path.join(targetDir, originalFile.name)

      // Handle duplicates
      let counter = 1
      while (
        await window.electronAPI.fs
          .access(targetPath)
          .then(() => true)
          .catch(() => false)
      ) {
        const ext = path.extname(originalFile.name)
        const nameWithoutExt = path.basename(originalFile.name, ext)
        targetPath = path.join(targetDir, `${nameWithoutExt}_${counter}${ext}`)
        counter++
        if (counter > 100) break
      }

      // Attempt to copy with retry
      const copyResult = await window.electronAPI.fs.copyFileWithRetry(
        originalFile.path,
        targetPath,
        3
      )

      if (copyResult?.success) {
        // Update error state to remove this error
        setError((prev) => prev.replace(new RegExp(`• ${error.file}:[^\n]*\n`, "g"), ""))

        // Show success message briefly
        setError((prev) =>
          prev
            ? `${prev}\n✓ Successfully retried: ${error.file}`
            : `✓ Successfully retried: ${error.file}`
        )
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            setError((prev) => prev.replace(`\n✓ Successfully retried: ${error.file}`, ""))
          }, 3000)
        }
      } else {
        setError(`Retry failed for ${error.file}: ${copyResult?.error || "Unknown error"}`)
      }
    } catch (err: unknown) {
      setError(
        `Retry failed for ${error.file}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    } finally {
      setRetryingErrors((prev) => {
        const newSet = new Set(prev)
        newSet.delete(error.file)
        return newSet
      })
    }
  }

  const handleSaveTemplate = async () => {
    if (!sourcePath || !destinationPath || !templateName.trim()) return

    setSavingTemplate(true)
    try {
      const template: ImportTemplate = {
        id: Date.now().toString(),
        name: templateName.trim(),
        sourcePath,
        destinationPath,
        createDateFolders,
        selectedDate,
        createdAt: Date.now(),
      }

      const updatedTemplates = [...templates, template]
      setTemplates(updatedTemplates)

      // Save to localStorage (in a real app, this would be saved to a database)
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("importTemplates", JSON.stringify(updatedTemplates))
      }

      setTemplateName("")
      setError("✓ Template saved successfully!")
      if (typeof window !== "undefined") {
        window.setTimeout(() => setError(""), 3000)
      }
    } catch (err: unknown) {
      setError(`Failed to save template: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleLoadTemplate = (template: ImportTemplate) => {
    setSourcePath(template.sourcePath)
    setDestinationPath(template.destinationPath)
    setCreateDateFolders(template.createDateFolders)
    setSelectedDate(template.selectedDate || "")
    setAnalysisResult(null)
    setShowTemplates(false)
    setError("✓ Template loaded successfully!")
    if (typeof window !== "undefined") {
      window.setTimeout(() => setError(""), 3000)
    }
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter((t) => t.id !== templateId)
    setTemplates(updatedTemplates)
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("importTemplates", JSON.stringify(updatedTemplates))
    }
  }

  const saveImportHistory = (results: DetailedImportResult) => {
    const historyEntry: ImportHistory = {
      id: Date.now().toString(),
      sourcePath,
      destinationPath,
      createDateFolders,
      selectedDate,
      results,
      timestamp: Date.now(),
    }

    const updatedHistory = [historyEntry, ...importHistory.slice(0, 9)] // Keep last 10
    setImportHistory(updatedHistory)
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("importHistory", JSON.stringify(updatedHistory))
    }
  }

  // Load templates and history on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const savedTemplates = window.localStorage.getItem("importTemplates")
        if (savedTemplates) {
          setTemplates(JSON.parse(savedTemplates))
        }

        const savedHistory = window.localStorage.getItem("importHistory")
        if (savedHistory) {
          setImportHistory(JSON.parse(savedHistory))
        }
      }
    } catch (err) {
      console.error("Failed to load templates/history:", err)
    }
  }, [])

  if (!isOpen) return null

  const selectedInfo = getSelectedFilesInfo()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Import Media Files</h2>
            <p className="text-neutral-400 text-sm mt-1">
              Organize and import your photos and videos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Templates Button */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
              disabled={importing}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Templates
            </button>

            {/* History Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-2"
              disabled={importing}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              History
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors"
              disabled={importing}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Source & Destination Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium mb-3 text-neutral-200">
                Source Folder
              </label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                  dragOver.source
                    ? "border-blue-400 bg-blue-500/10"
                    : sourcePath
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-neutral-600 hover:border-neutral-500"
                }`}
                onDragOver={(e) => handleDragOver(e, "source")}
                onDragLeave={(e) => handleDragLeave(e, "source")}
                onDrop={(e) => handleDrop(e, "source")}
              >
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 mb-3 text-neutral-400">
                    <svg
                      className="w-full h-full"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    {sourcePath ? (
                      <div>
                        <p className="text-sm text-green-400 font-medium">Source Selected</p>
                        <p className="text-xs text-neutral-400 truncate max-w-full">{sourcePath}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-neutral-300">Drop folder here or click browse</p>
                        <p className="text-xs text-neutral-500">Supports images and videos</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSelectSource}
                    className="mt-4 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    disabled={analyzing || importing}
                  >
                    Browse Folder
                  </button>
                </div>
              </div>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="block text-sm font-medium mb-3 text-neutral-200">
                Destination Folder
              </label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                  dragOver.destination
                    ? "border-blue-400 bg-blue-500/10"
                    : destinationPath
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-neutral-600 hover:border-neutral-500"
                }`}
                onDragOver={(e) => handleDragOver(e, "destination")}
                onDragLeave={(e) => handleDragLeave(e, "destination")}
                onDrop={(e) => handleDrop(e, "destination")}
              >
                <div className="text-center">
                  <div className="mx-auto w-12 h-12 mb-3 text-neutral-400">
                    <svg
                      className="w-full h-full"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    {destinationPath ? (
                      <div>
                        <p className="text-sm text-green-400 font-medium">Destination Selected</p>
                        <p className="text-xs text-neutral-400 truncate max-w-full">
                          {destinationPath}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-neutral-300">Drop folder here or click browse</p>
                        <p className="text-xs text-neutral-500">Where files will be imported</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSelectDestination}
                    className="mt-4 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    disabled={analyzing || importing}
                  >
                    Browse Folder
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Analyze Section */}
          {sourcePath && !analysisResult && (
            <div className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
              <div className="text-center">
                <h3 className="text-lg font-medium text-white mb-2">Ready to Analyze</h3>
                <p className="text-neutral-400 text-sm mb-6">
                  Scan the source folder to find all media files and organize them by date
                </p>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    {analyzing ? "Analyzing Source..." : "Analyze Source Folder"}
                  </div>
                </button>
              </div>

              {/* Analysis Progress */}
              {analyzing && analyzeProgress && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="font-medium">Scanning Directory</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-neutral-700/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">
                        {analyzeProgress.scannedFiles.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400">Files Scanned</div>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">
                        {analyzeProgress.scannedDirs.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400">Directories</div>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">
                        {analyzeProgress.foundMediaFiles.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400">Media Files</div>
                    </div>
                    <div className="bg-neutral-700/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">
                        {analyzeProgress.scannedDirs.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400">Directories</div>
                    </div>
                  </div>

                  <div className="bg-neutral-700/30 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-neutral-300">Progress</span>
                      <span className="text-neutral-400">Scanning...</span>
                    </div>
                    <div className="w-full bg-neutral-600 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-400 h-full rounded-full animate-pulse"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-neutral-500 truncate">
                      {analyzeProgress.currentPath}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-6">
              {/* Results Overview */}
              <div className="bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 rounded-xl p-6 border border-neutral-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Analysis Complete
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {analysisResult.totalFiles.toLocaleString()}
                    </div>
                    <div className="text-sm text-neutral-400">Media Files Found</div>
                  </div>
                  <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatBytes(analysisResult.totalSize)}
                    </div>
                    <div className="text-sm text-neutral-400">Total Size</div>
                  </div>
                  <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {analysisResult.dates.length}
                    </div>
                    <div className="text-sm text-neutral-400">Date Groups</div>
                  </div>
                </div>

                {/* Date Selection */}
                {analysisResult.dates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-3 text-neutral-200">
                      Filter by Date (Optional)
                    </label>
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-700 rounded-lg border border-neutral-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      disabled={importing}
                    >
                      <option value="">All dates ({analysisResult.totalFiles} files)</option>
                      {analysisResult.dates.map((date) => {
                        const count = analysisResult.filesByDate[date]?.length || 0
                        const size =
                          analysisResult.filesByDate[date]?.reduce((sum, f) => sum + f.size, 0) || 0
                        return (
                          <option key={date} value={date}>
                            {date} • {count} files • {formatBytes(size)}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Import Options */}
              <div className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
                <h4 className="text-lg font-medium text-white mb-4">Import Options</h4>

                {/* Selected Files Summary */}
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4 mb-4 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-white">Files to Import</h5>
                      <p className="text-sm text-neutral-400">
                        {selectedInfo.count.toLocaleString()} files •{" "}
                        {formatBytes(selectedInfo.size)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{selectedInfo.count}</div>
                      <div className="text-xs text-neutral-400">selected</div>
                    </div>
                  </div>
                </div>

                {/* Organization Options */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-neutral-200 cursor-pointer flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={createDateFolders}
                          onChange={(e) => setCreateDateFolders(e.target.checked)}
                          className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          disabled={importing}
                        />
                        Organize in Date Folders
                      </label>
                      <p className="text-xs text-neutral-400 mt-1 ml-6">
                        {createDateFolders
                          ? "Files organized as: destination/YYYY-MM-DD/IMAGES and destination/YYYY-MM-DD/VIDEOS"
                          : "Files organized as: destination/IMAGES and destination/VIDEOS"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importing && importProgress && (
            <div className="bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 rounded-xl p-6 border border-neutral-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-400 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Importing Files
                </h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {Math.round((importProgress.current / importProgress.total) * 100)}%
                  </div>
                  <div className="text-xs text-neutral-400">complete</div>
                </div>
              </div>

              {/* Progress Circle and Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Circular Progress */}
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-neutral-600"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 54}`}
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - importProgress.current / importProgress.total)}`}
                        className="text-blue-500 transition-all duration-300"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xl font-bold text-white">{importProgress.current}</div>
                        <div className="text-xs text-neutral-400">of {importProgress.total}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-700/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">{importProgress.current}</div>
                      <div className="text-xs text-neutral-400">Files Copied</div>
                    </div>
                    <div className="bg-neutral-700/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">
                        {importProgress.total - importProgress.current}
                      </div>
                      <div className="text-xs text-neutral-400">Files Remaining</div>
                    </div>
                  </div>

                  {/* Linear Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-300">Progress</span>
                      <span className="text-neutral-400">
                        {importProgress.current} of {importProgress.total} files
                      </span>
                    </div>
                    <div className="w-full bg-neutral-600 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(importProgress.current / importProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Current File */}
              <div className="bg-neutral-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-300 mb-1">Currently copying:</div>
                    <div className="text-sm text-white font-medium truncate">
                      {importProgress.currentFile}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-400 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-400 mb-1">Import Results</h4>
                  <div className="text-sm text-red-300 whitespace-pre-wrap">
                    {error.split("\n").map((line, index) => {
                      // Check if this is an error line that can be retried
                      const errorMatch = line.match(
                        /^• (.+?): (.+) \((permission|file_corrupted|unknown)\)$/
                      )
                      if (errorMatch) {
                        const [, fileName, errorMsg, errorType] = errorMatch
                        const isRetrying = retryingErrors.has(fileName)
                        const canRetry =
                          errorType === "permission" ||
                          errorType === "file_corrupted" ||
                          errorType === "unknown"
                        const typedErrorType = errorType as ImportError["type"]

                        return (
                          <div key={index} className="flex items-center justify-between py-1">
                            <span>{line}</span>
                            {canRetry && !isRetrying && (
                              <button
                                onClick={() =>
                                  handleRetryError({
                                    file: fileName,
                                    error: errorMsg,
                                    type: typedErrorType,
                                    canRetry: true,
                                    retryCount: 0,
                                  })
                                }
                                className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                              >
                                Retry
                              </button>
                            )}
                            {isRetrying && (
                              <div className="ml-2 flex items-center gap-1">
                                <svg
                                  className="w-3 h-3 animate-spin"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                <span className="text-xs">Retrying...</span>
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Check for success messages
                      if (line.startsWith("✓")) {
                        return (
                          <div key={index} className="text-green-400 py-1">
                            {line}
                          </div>
                        )
                      }

                      // Check for warnings
                      if (line.includes("Warnings:")) {
                        return (
                          <div key={index} className="text-yellow-400 font-medium py-1">
                            {line}
                          </div>
                        )
                      }

                      return (
                        <div key={index} className="py-1">
                          {line}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-300 p-1 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Templates Panel */}
          {showTemplates && (
            <div className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Import Templates
                </h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Save New Template */}
              <div className="mb-4 p-4 bg-neutral-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Save Current Configuration</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name..."
                    className="flex-1 px-3 py-2 bg-neutral-600 rounded border border-neutral-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={savingTemplate}
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={
                      !templateName.trim() || !sourcePath || !destinationPath || savingTemplate
                    }
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-600 rounded text-sm font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {savingTemplate ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {/* Saved Templates */}
              <div className="space-y-2">
                {templates.length === 0 ? (
                  <p className="text-neutral-400 text-sm text-center py-4">
                    No templates saved yet
                  </p>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-neutral-700/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">{template.name}</h4>
                        <p className="text-xs text-neutral-400 truncate">
                          {template.sourcePath} → {template.destinationPath}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadTemplate(template)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* History Panel */}
          {showHistory && (
            <div className="bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Import History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Import History */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {importHistory.length === 0 ? (
                  <p className="text-neutral-400 text-sm text-center py-4">No import history yet</p>
                ) : (
                  importHistory.map((entry) => (
                    <div key={entry.id} className="p-3 bg-neutral-700/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-white">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400">
                            {entry.results.imported}/{entry.results.total} imported
                          </span>
                          {entry.results.errors.length > 0 && (
                            <span className="text-xs text-red-400">
                              {entry.results.errors.length} errors
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400">
                        <div>Source: {entry.sourcePath}</div>
                        <div>Destination: {entry.destinationPath}</div>
                        {entry.selectedDate && <div>Date filter: {entry.selectedDate}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-700">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              disabled={importing}
            >
              Cancel
            </button>

            {analysisResult && destinationPath && (
              <button
                onClick={handleImport}
                disabled={importing || selectedInfo.count === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-neutral-600 disabled:to-neutral-700 rounded-lg text-white font-medium transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Import {selectedInfo.count.toLocaleString()} Files
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
