"use client"

interface ProgressBarProps {
  progress: number
  total: number
  className?: string
  showText?: boolean
}

export function ProgressBar({
  progress,
  total,
  className = "",
  showText = true,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0

  if (total === 0) return null

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Loading metadata...</span>
        {showText && (
          <span className="text-xs text-gray-400">
            {progress} / {total} ({percentage}%)
          </span>
        )}
      </div>
      <div className="w-full bg-[#2b2b2b] rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
