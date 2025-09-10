"use client"

import { useState, useEffect } from "react"
import { formatBytes } from "../utils/format"

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
    }
  }, [isOpen])

  useEffect(() => {
    // Set up progress listeners
    const removeImportListener = window.electronAPI.onImportProgress((progress: ImportProgress) => {
      setImportProgress(progress)
    })
    const removeAnalyzeListener = window.electronAPI.onAnalyzeProgress((progress: AnalyzeProgress) => {
      setAnalyzeProgress(progress)
    })
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
      if (result.ok) {
        setAnalysisResult(result.data)
      } else {
        setError(result.error || "Failed to analyze source")
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed")
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
      
      if (result.ok) {
        const { imported, total, errors } = result.data
        
        if (errors && errors.length > 0) {
          setError(`Imported ${imported}/${total} files. Some errors occurred:\n${errors.join("\n")}`)
        } else {
          // Success - close dialog
          onImportComplete?.()
          onClose()
        }
      } else {
        setError(result.error || "Import failed")
      }
    } catch (err: any) {
      setError(err.message || "Import failed")
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

  if (!isOpen) return null

  const selectedInfo = getSelectedFilesInfo()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-900 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Import Media Files</h2>
        
        {/* Source Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Source Folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={sourcePath}
              readOnly
              className="flex-1 px-3 py-2 bg-neutral-800 rounded border border-neutral-700 text-sm"
              placeholder="Select source folder..."
            />
            <button
              onClick={handleSelectSource}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              disabled={analyzing || importing}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Destination Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Destination Folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={destinationPath}
              readOnly
              className="flex-1 px-3 py-2 bg-neutral-800 rounded border border-neutral-700 text-sm"
              placeholder="Select destination folder..."
            />
            <button
              onClick={handleSelectDestination}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              disabled={analyzing || importing}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Analyze Button and Progress */}
        {sourcePath && !analysisResult && (
          <>
            <button
              onClick={handleAnalyze}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium mb-4"
              disabled={analyzing}
            >
              {analyzing ? "Analyzing..." : "Analyze Source"}
            </button>
            
            {/* Analysis Progress */}
            {analyzing && analyzeProgress && (
              <div className="mb-4 p-4 bg-neutral-800 rounded">
                <h3 className="font-medium mb-2">Scanning Directory</h3>
                <div className="space-y-2 text-sm text-neutral-400">
                  <p>Scanned files: {analyzeProgress.scannedFiles}</p>
                  <p>Scanned directories: {analyzeProgress.scannedDirs}</p>
                  <p>Found media files: {analyzeProgress.foundMediaFiles}</p>
                  <p className="text-xs truncate">Current: {analyzeProgress.currentPath}</p>
                </div>
                {analyzeProgress.type === "scanning" && (
                  <div className="mt-3">
                    <div className="w-full bg-neutral-700 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: "100%" }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="mb-4 p-4 bg-neutral-800 rounded">
            <h3 className="font-medium mb-2">Analysis Results</h3>
            <div className="text-sm text-neutral-400 space-y-1">
              <p>Total files: {analysisResult.totalFiles}</p>
              <p>Total size: {formatBytes(analysisResult.totalSize)}</p>
              <p>Dates found: {analysisResult.dates.length}</p>
            </div>

            {/* Date Selection */}
            {analysisResult.dates.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Select Date (optional)</label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-700 rounded border border-neutral-600 text-sm"
                  disabled={importing}
                >
                  <option value="">All dates</option>
                  {analysisResult.dates.map((date) => {
                    const count = analysisResult.filesByDate[date]?.length || 0
                    return (
                      <option key={date} value={date}>
                        {date} ({count} files)
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Selected Files Info */}
            <div className="mt-4 p-3 bg-neutral-700 rounded">
              <p className="text-sm">
                Selected: {selectedInfo.count} files ({formatBytes(selectedInfo.size)})
              </p>
            </div>

            {/* Date Folder Option */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={createDateFolders}
                  onChange={(e) => setCreateDateFolders(e.target.checked)}
                  className="w-4 h-4 rounded bg-neutral-700 border-neutral-600"
                  disabled={importing}
                />
                <span>Organize files in date folders</span>
              </label>
              <p className="text-xs text-neutral-400 mt-1 ml-6">
                {createDateFolders 
                  ? "Files will be organized: destination/YYYY-MM-DD/IMAGES and destination/YYYY-MM-DD/VIDEOS"
                  : "Files will be organized: destination/IMAGES and destination/VIDEOS"}
              </p>
            </div>
          </div>
        )}

        {/* Import Progress */}
        {importing && importProgress && (
          <div className="mb-4 p-4 bg-neutral-800 rounded">
            <h3 className="font-medium mb-2">Import Progress</h3>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{importProgress.current} / {importProgress.total}</span>
                <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-neutral-400 truncate">
              Copying: {importProgress.currentFile}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded">
            <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm font-medium"
            disabled={importing}
          >
            Cancel
          </button>
          {analysisResult && destinationPath && (
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              disabled={importing || selectedInfo.count === 0}
            >
              {importing ? "Importing..." : `Import ${selectedInfo.count} Files`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}