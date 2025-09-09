"use client"

import useExplorerStore, { useViewMode } from "../store/explorerStore"
import { IconsView } from "./IconsView"
import { DetailsView } from "./DetailsView"

export function ContentArea() {
  const loading = useExplorerStore((state) => state.loading)
  const error = useExplorerStore((state) => state.error)
  const viewMode = useViewMode()

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e]">
      {loading ? (
        <div className="p-4 text-sm text-gray-400">Loading...</div>
      ) : error ? (
        <div className="p-4 text-sm text-red-400">{error}</div>
      ) : viewMode === "icons" ? (
        <IconsView />
      ) : (
        <DetailsView />
      )}
    </div>
  )
}
