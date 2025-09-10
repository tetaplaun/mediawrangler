"use client"

import { useState } from "react"
import useExplorerStore, {
  useRefresh,
  useCurrentPath,
  useSelectedEntries,
} from "../store/explorerStore"

export function ButtonBar() {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const currentPath = useCurrentPath()
  const refresh = useRefresh()
  const selectedEntries = useSelectedEntries()
  const sortBy = useExplorerStore((state) => state.sortBy)
  const sortOrder = useExplorerStore((state) => state.sortOrder)
  const setSortBy = useExplorerStore((state) => state.setSortBy)
  const setSortOrder = useExplorerStore((state) => state.setSortOrder)
  const showHiddenFiles = useExplorerStore((state) => state.showHiddenFiles)
  const setShowHiddenFiles = useExplorerStore((state) => state.setShowHiddenFiles)

  const hasSelection = selectedEntries.length > 0
  const canModifyFolder = currentPath !== "::drives"

  const handleNewFolder = async () => {
    if (!canModifyFolder) return

    const folderName = prompt("Enter folder name:")
    if (!folderName) return

    try {
      const folderPath = await window.electronAPI.fs.joinPath(currentPath, folderName)
      await window.electronAPI.fs.createFolder?.(folderPath)
      refresh()
    } catch (error) {
      console.error("Failed to create folder:", error)
      alert("Failed to create folder")
    }
  }

  const handleDelete = async () => {
    if (!hasSelection) return

    const count = selectedEntries.length
    const message =
      count === 1 ? `Delete "${selectedEntries[0].name}"?` : `Delete ${count} selected items?`

    if (!confirm(message)) return

    try {
      for (const entry of selectedEntries) {
        await window.electronAPI.fs.deleteItem?.(entry.path)
      }
      refresh()
    } catch (error) {
      console.error("Failed to delete items:", error)
      alert("Failed to delete some items")
    }
  }

  const handleCopy = () => {
    if (!hasSelection) return
    console.log("Copy:", selectedEntries)
  }

  const handleCut = () => {
    if (!hasSelection) return
    console.log("Cut:", selectedEntries)
  }

  const handlePaste = () => {
    console.log("Paste to:", currentPath)
  }

  const handleSortChange = (field: string) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field as any)
      setSortOrder("asc")
    }
    setShowSortMenu(false)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[#252525] border-b border-[#2b2b2b]">
      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1"
        onClick={refresh}
        title="Refresh (F5)"
      >
        <span className="text-base">⟳</span>
        <span>Refresh</span>
      </button>

      <div className="w-px h-5 bg-[#3a3a3a] mx-1" />

      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 disabled:opacity-40"
        onClick={handleNewFolder}
        disabled={!canModifyFolder}
        title="New Folder"
      >
        <span className="text-base">📁</span>
        <span>New Folder</span>
      </button>

      <div className="w-px h-5 bg-[#3a3a3a] mx-1" />

      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 disabled:opacity-40"
        onClick={handleCopy}
        disabled={!hasSelection}
        title="Copy (Ctrl+C)"
      >
        <span className="text-base">📋</span>
        <span>Copy</span>
      </button>

      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 disabled:opacity-40"
        onClick={handleCut}
        disabled={!hasSelection}
        title="Cut (Ctrl+X)"
      >
        <span className="text-base">✂</span>
        <span>Cut</span>
      </button>

      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 disabled:opacity-40"
        onClick={handlePaste}
        disabled={true}
        title="Paste (Ctrl+V)"
      >
        <span className="text-base">📄</span>
        <span>Paste</span>
      </button>

      <button
        className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 disabled:opacity-40"
        onClick={handleDelete}
        disabled={!hasSelection}
        title="Delete (Del)"
      >
        <span className="text-base">🗑</span>
        <span>Delete</span>
      </button>

      <div className="w-px h-5 bg-[#3a3a3a] mx-1" />

      <button
        className={`rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1 ${
          showHiddenFiles ? "bg-[#2a2a2a]" : ""
        }`}
        onClick={() => setShowHiddenFiles(!showHiddenFiles)}
        title="Toggle Hidden Files (Ctrl+H)"
      >
        <span className="text-base">{showHiddenFiles ? "👁" : "👁‍🗨"}</span>
        <span>Hidden Files</span>
      </button>

      <div className="w-px h-5 bg-[#3a3a3a] mx-1" />

      <div className="relative">
        <button
          className="rounded px-3 py-1 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-1"
          onClick={() => setShowSortMenu(!showSortMenu)}
          title="Sort Options"
        >
          <span className="text-base">↕</span>
          <span>Sort by {sortBy}</span>
          <span className="text-xs">▼</span>
        </button>

        {showSortMenu && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[150px] bg-[#2d2d2d] border border-[#3a3a3a] shadow-lg">
            {["name", "size", "modified", "type"].map((field) => (
              <button
                key={field}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-[#3a3a3a] transition-colors flex items-center justify-between"
                onClick={() => handleSortChange(field)}
              >
                <span className="capitalize">{field}</span>
                {sortBy === field && <span>{sortOrder === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
