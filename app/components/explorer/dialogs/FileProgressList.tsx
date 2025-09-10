"use client"

import React, { useState, useEffect, useMemo } from "react"
import { FileProgressItem } from "./FileProgressItem"

interface FileCopyProgress {
  fileName: string
  transferred: number
  total: number
  percentage: number
  speed: number
  eta: number
  status: "copying" | "completed" | "failed" | "retrying"
}

interface FileProgressListProps {
  maxVisible?: number
  showCompleted?: boolean
}

function EmptyProgressState({ hasStartedImport }: { hasStartedImport: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center min-h-[120px]">
      <svg
        className={`w-12 h-12 text-neutral-500 mb-3 ${hasStartedImport ? "animate-pulse" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p className="text-sm text-neutral-400 mb-1">
        {hasStartedImport ? "Waiting for files..." : "Preparing to import files..."}
      </p>
      <p className="text-xs text-neutral-500">
        {hasStartedImport
          ? "All files have been processed"
          : "Progress will appear here as files are processed"}
      </p>
    </div>
  )
}

export function FileProgressList({ maxVisible = 10, showCompleted = true }: FileProgressListProps) {
  const [fileProgress, setFileProgress] = useState<Map<string, FileCopyProgress>>(new Map())
  const [expanded, setExpanded] = useState(false)
  const [hasStartedImport, setHasStartedImport] = useState(false)

  useEffect(() => {
    // Listen for file copy progress events
    const removeListener = window.electronAPI.onFileCopyProgress((progress: FileCopyProgress) => {
      setFileProgress((prev) => {
        const newMap = new Map(prev)
        newMap.set(progress.fileName, progress)
        return newMap
      })

      // Mark that import has started when we receive first progress event
      if (!hasStartedImport) {
        setHasStartedImport(true)
      }
    })

    return removeListener
  }, [hasStartedImport])

  const filteredProgress = useMemo(() => {
    const items = Array.from(fileProgress.values())

    if (!showCompleted) {
      return items.filter((item) => item.status !== "completed")
    }

    return items
  }, [fileProgress, showCompleted])

  const sortedProgress = useMemo(() => {
    return filteredProgress.sort((a, b) => {
      // Sort by status priority: copying > retrying > failed > completed
      const statusPriority = { copying: 0, retrying: 1, failed: 2, completed: 3 }
      const aPriority = statusPriority[a.status]
      const bPriority = statusPriority[b.status]

      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }

      // Then by file name
      return a.fileName.localeCompare(b.fileName)
    })
  }, [filteredProgress])

  const displayProgress = expanded ? sortedProgress : sortedProgress.slice(0, maxVisible)
  const hasMore = sortedProgress.length > maxVisible

  const handleRetry = (fileName: string) => {
    // TODO: Implement retry functionality
    console.log("Retry file:", fileName)
  }

  const handleCancel = (fileName: string) => {
    // TODO: Implement cancel functionality
    console.log("Cancel file:", fileName)
  }

  return (
    <div className="space-y-3 min-h-[200px] transition-all duration-300 ease-in-out">
      {/* Header - Always visible */}
      <div className="flex items-center justify-between min-h-[24px]">
        <h4 className="text-sm font-medium text-white flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-400"
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
          File Progress ({sortedProgress.length})
        </h4>

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-neutral-400 hover:text-white transition-colors duration-200"
          >
            {expanded ? "Show Less" : `Show All (${sortedProgress.length})`}
          </button>
        )}
      </div>

      {/* Progress Items or Empty State */}
      <div className="space-y-2 min-h-[120px] max-h-96 overflow-y-auto">
        {sortedProgress.length === 0 ? (
          <EmptyProgressState hasStartedImport={hasStartedImport} />
        ) : (
          <>
            {displayProgress.map((progress, index) => (
              <div
                key={progress.fileName}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <FileProgressItem
                  progress={progress}
                  onRetry={() => handleRetry(progress.fileName)}
                  onCancel={() => handleCancel(progress.fileName)}
                />
              </div>
            ))}

            {!expanded && hasMore && (
              <div className="text-center py-2">
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  + {sortedProgress.length - maxVisible} more files...
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary - Always visible */}
      <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-600/50 pt-2 min-h-[20px] transition-all duration-200">
        <div>Active: {sortedProgress.filter((p) => p.status === "copying").length}</div>
        <div>Completed: {sortedProgress.filter((p) => p.status === "completed").length}</div>
        <div>Failed: {sortedProgress.filter((p) => p.status === "failed").length}</div>
      </div>
    </div>
  )
}
