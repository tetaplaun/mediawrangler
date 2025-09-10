"use client"

import React from "react"
import { formatBytes } from "../utils/format"

interface FileCopyProgress {
  fileName: string
  transferred: number
  total: number
  percentage: number
  speed: number
  eta: number
  status: "copying" | "completed" | "failed" | "retrying"
}

interface FileProgressItemProps {
  progress: FileCopyProgress
  onRetry?: () => void
  onCancel?: () => void
}

export const FileProgressItem = React.memo(function FileProgressItem({
  progress,
  onRetry,
  onCancel,
}: FileProgressItemProps) {
  const formatSpeed = (speed: number) => {
    if (speed === 0) return "0 B/s"
    if (speed < 1024) return `${speed} B/s`
    if (speed < 1024 * 1024) return `${(speed / 1024).toFixed(1)} KB/s`
    return `${(speed / (1024 * 1024)).toFixed(1)} MB/s`
  }

  const formatTime = (seconds: number) => {
    if (seconds === 0) return ""
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusColor = () => {
    switch (progress.status) {
      case "copying":
        return "text-blue-400"
      case "completed":
        return "text-green-400"
      case "failed":
        return "text-red-400"
      case "retrying":
        return "text-yellow-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case "copying":
        return (
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
        )
      case "completed":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
      case "failed":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        )
      case "retrying":
        return (
          <svg
            className="w-4 h-4 animate-pulse"
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
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-neutral-700/30 rounded-lg p-3 border border-neutral-600/50 transition-all duration-200 ease-in-out">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`flex-shrink-0 transition-colors duration-300 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">{progress.fileName}</div>
            <div className="text-xs text-neutral-400">
              {progress.status === "completed"
                ? `${formatBytes(progress.total)}`
                : `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {progress.status === "copying" && progress.speed > 0 && (
            <div className="text-xs text-neutral-400">{formatSpeed(progress.speed)}</div>
          )}
          {progress.status === "copying" && progress.eta > 0 && (
            <div className="text-xs text-blue-400">{formatTime(progress.eta)}</div>
          )}
          {progress.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
            >
              Retry
            </button>
          )}
          {progress.status === "copying" && onCancel && (
            <button
              onClick={onCancel}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-600 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            progress.status === "completed"
              ? "bg-green-500"
              : progress.status === "failed"
                ? "bg-red-500"
                : progress.status === "retrying"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
          }`}
          style={{
            width: `${Math.min(progress.percentage, 100)}%`,
            transition: progress.status === "copying" ? "width 0.5s ease-out" : "all 0.3s ease-out",
          }}
        />
      </div>

      {/* Percentage */}
      <div className="flex justify-between items-center mt-1">
        <div className={`text-xs font-medium transition-colors duration-300 ${getStatusColor()}`}>
          {progress.percentage}%
        </div>
        {progress.status === "completed" && (
          <div className="text-xs text-green-400 animate-in fade-in duration-300">✓ Complete</div>
        )}
        {progress.status === "failed" && (
          <div className="text-xs text-red-400 animate-in fade-in duration-300">✗ Failed</div>
        )}
        {progress.status === "retrying" && (
          <div className="text-xs text-yellow-400 animate-in fade-in duration-300">
            ⟳ Retrying...
          </div>
        )}
      </div>
    </div>
  )
})
