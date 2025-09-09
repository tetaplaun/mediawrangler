"use client"

import { useCallback } from "react"
import useExplorerStore, { useSortedEntries } from "../store/explorerStore"
import type { Entry } from "../types/explorer"

export function IconsView() {
  const entries = useSortedEntries()
  const navigateTo = useExplorerStore((state) => state.navigateTo)

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

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-1">
      {entries.map((e) => (
        <button
          key={e.path}
          onDoubleClick={() => openEntry(e)}
          className="rounded p-2 text-left hover:bg-[#2a2a2a]"
          title={e.name}
        >
          <div className="mb-1 flex h-16 items-center justify-center rounded border border-[#3a3a3a] bg-[#252525]">
            <span className="text-2xl">
              {e.type === "directory" || e.type === "drive" ? "📁" : "📄"}
            </span>
          </div>
          <div className="truncate text-xs text-gray-200" title={e.name}>
            {e.name}
          </div>
        </button>
      ))}
    </div>
  )
}
