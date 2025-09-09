"use client"

import { useCallback } from "react"
import useExplorerStore, { useSortedEntries } from "../store/explorerStore"
import type { Entry } from "../types/explorer"

function formatBytes(size: number | null) {
  if (size == null) return ""
  const units = ["B", "KB", "MB", "GB", "TB"]
  let s = size
  let u = 0
  while (s >= 1024 && u < units.length - 1) {
    s /= 1024
    u++
  }
  return `${s.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
}

function formatDate(ms: number | null) {
  if (!ms) return ""
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return ""
  }
}

function formatDuration(seconds: number | undefined) {
  if (!seconds) return ""
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatBitRate(bps: number | undefined) {
  if (!bps) return ""
  const mbps = bps / 1_000_000
  return `${mbps.toFixed(1)} Mbps`
}

function formatDimensions(dimensions: { width: number; height: number } | undefined) {
  if (!dimensions) return ""
  return `${dimensions.width}×${dimensions.height}`
}

function formatFrameRate(fps: number | undefined) {
  if (!fps) return ""
  return `${fps.toFixed(1)} fps`
}

export function DetailsView() {
  const entries = useSortedEntries()
  const navigateTo = useExplorerStore((state) => state.navigateTo)
  const sort = useExplorerStore((state) => state.sort)
  const setSort = useExplorerStore((state) => state.setSort)
  const mediaInfoLoading = useExplorerStore((state) => state.mediaInfoLoading)

  const openEntry = useCallback(
    async (e: Entry) => {
      if (e.type === "directory" || e.type === "drive") {
        await navigateTo(e.path)
        return
      }
      await window.electronAPI.fs.openPath(e.path)
    },
    [navigateTo]
  )

  const toggleSort = (key: "name" | "type" | "size" | "modifiedMs") => {
    setSort({
      key,
      dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc",
    })
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full table-auto border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#202020]">
          <tr>
            <th className="min-w-[200px] border-b border-[#2b2b2b] p-0">
              <button
                onClick={() => toggleSort("name")}
                className="flex w-full items-center justify-between px-2 py-1 text-left font-medium hover:bg-[#262626]"
                title={`Sort by name ${sort.key === "name" ? `(${sort.dir})` : ""}`}
              >
                <span>Name</span>
                <span className="text-xs opacity-70">
                  {sort.key === "name" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </span>
              </button>
            </th>
            <th className="w-20 border-b border-[#2b2b2b] p-0">
              <button
                onClick={() => toggleSort("type")}
                className="flex w-full items-center justify-between px-2 py-1 text-left font-medium hover:bg-[#262626]"
                title={`Sort by type ${sort.key === "type" ? `(${sort.dir})` : ""}`}
              >
                <span>Type</span>
                <span className="text-xs opacity-70">
                  {sort.key === "type" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </span>
              </button>
            </th>
            <th className="w-24 border-b border-[#2b2b2b] p-0">
              <button
                onClick={() => toggleSort("size")}
                className="flex w-full items-center justify-between px-2 py-1 text-left font-medium hover:bg-[#262626]"
                title={`Sort by size ${sort.key === "size" ? `(${sort.dir})` : ""}`}
              >
                <span>Size</span>
                <span className="text-xs opacity-70">
                  {sort.key === "size" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </span>
              </button>
            </th>
            <th className="w-28 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              Dimensions
            </th>
            <th className="w-20 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              Duration
            </th>
            <th className="w-20 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              FPS
            </th>
            <th className="w-24 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              Bit Rate
            </th>
            <th className="w-20 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              Format
            </th>
            <th className="w-20 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
              Codec
            </th>
            <th className="w-36 border-b border-[#2b2b2b] p-0">
              <button
                onClick={() => toggleSort("modifiedMs")}
                className="flex w-full items-center justify-between px-2 py-1 text-left font-medium hover:bg-[#262626]"
                title={`Sort by date modified ${sort.key === "modifiedMs" ? `(${sort.dir})` : ""}`}
              >
                <span>Date modified</span>
                <span className="text-xs opacity-70">
                  {sort.key === "modifiedMs" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isMedia = !!e.mediaInfo
            const isLoading = mediaInfoLoading[e.path]
            const icon = e.type === "directory" || e.type === "drive" 
              ? "📁" 
              : isMedia && e.mediaInfo?.dimensions
              ? "🖼️"
              : isMedia && e.mediaInfo?.duration
              ? "🎬"
              : "📄"
              
            // Check if this is a media file that could have info
            const mediaExts = [
              'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mpg', 'mpeg', 'wmv', 'flv',
              'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico', 'heic', 'heif'
            ]
            const couldHaveMediaInfo = e.type === "file" && e.ext && mediaExts.includes(e.ext.toLowerCase())
            
            return (
              <tr
                key={e.path}
                className="cursor-default hover:bg-[#2a2a2a]"
                onDoubleClick={() => openEntry(e)}
              >
                <td className="truncate border-b border-[#2b2b2b] px-2 py-1">
                  <span className="mr-2">{icon}</span>
                  <span title={e.name}>{e.name}</span>
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1">{e.type}</td>
                <td className="border-b border-[#2b2b2b] px-2 py-1">{formatBytes(e.size)}</td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : formatDimensions(e.mediaInfo?.dimensions)}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : formatDuration(e.mediaInfo?.duration)}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : formatFrameRate(e.mediaInfo?.frameRate)}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : formatBitRate(e.mediaInfo?.bitRate)}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : (e.mediaInfo?.format || "")}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1 text-gray-400">
                  {isLoading && couldHaveMediaInfo ? "..." : (e.mediaInfo?.codec || "")}
                </td>
                <td className="border-b border-[#2b2b2b] px-2 py-1">{formatDate(e.modifiedMs)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}