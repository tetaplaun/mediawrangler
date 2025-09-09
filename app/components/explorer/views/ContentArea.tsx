"use client"

import { useExplorer } from "../context/ExplorerContext"
import { IconsView } from "./IconsView"
import { DetailsView } from "./DetailsView"

export function ContentArea() {
  const { loading, error, viewMode } = useExplorer()
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
