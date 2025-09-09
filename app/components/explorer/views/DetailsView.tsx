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

export function DetailsView() {
  const entries = useSortedEntries()
  const navigateTo = useExplorerStore((state) => state.navigateTo)
  const sort = useExplorerStore((state) => state.sort)
  const setSort = useExplorerStore((state) => state.setSort)

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
    <table className="w-full table-fixed border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-[#202020]">
        <tr>
          <th className="w-1/2 border-b border-[#2b2b2b] p-0">
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
          <th className="w-1/6 border-b border-[#2b2b2b] p-0">
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
          <th className="w-1/6 border-b border-[#2b2b2b] p-0">
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
          <th className="w-1/6 border-b border-[#2b2b2b] p-0">
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
        {entries.map((e) => (
          <tr
            key={e.path}
            className="cursor-default hover:bg-[#2a2a2a]"
            onDoubleClick={() => openEntry(e)}
          >
            <td className="truncate border-b border-[#2b2b2b] px-2 py-1">
              <span className="mr-2">
                {e.type === "directory" || e.type === "drive" ? "📁" : "📄"}
              </span>
              <span title={e.name}>{e.name}</span>
            </td>
            <td className="border-b border-[#2b2b2b] px-2 py-1">{e.type}</td>
            <td className="border-b border-[#2b2b2b] px-2 py-1">{formatBytes(e.size)}</td>
            <td className="border-b border-[#2b2b2b] px-2 py-1">{formatDate(e.modifiedMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
