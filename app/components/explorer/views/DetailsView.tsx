"use client"

import { useExplorer } from "../context/ExplorerContext"
import { formatBytes, formatDate } from "../utils/format"

export function DetailsView() {
  const { entries, viewMode, sort, setSort, navigateTo } = useExplorer()
  if (viewMode !== "details") return null

  const toggleSort = (key: typeof sort.key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    )
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
            onDoubleClick={() => navigateTo(e.path)}
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
