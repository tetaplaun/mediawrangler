"use client"

import { useRef, useState, useEffect } from "react"
import { getParentPath } from "../utils/path"
import { useDebounce } from "../hooks/useDebounce"
import useExplorerStore, {
  useGoBack,
  useGoForward,
  useGoUp,
  useNavigateTo,
  useCanGoBack,
  useCanGoForward,
  useCanGoUp,
  useCurrentPath,
  useViewMode,
} from "../store/explorerStore"

export function Toolbar() {
  const currentPath = useCurrentPath()
  const viewMode = useViewMode()
  const goBack = useGoBack()
  const goForward = useGoForward()
  const goUp = useGoUp()
  const navigateTo = useNavigateTo()
  const canGoBack = useCanGoBack()
  const canGoForward = useCanGoForward()
  const canGoUp = useCanGoUp()
  const setViewMode = useExplorerStore((state) => state.setViewMode)
  const setFilter = useExplorerStore((state) => state.setFilter)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [addressValue, setAddressValue] = useState(currentPath)
  const [searchValue, setSearchValue] = useState("")
  const debouncedSearchValue = useDebounce(searchValue, 300)

  useEffect(() => {
    setAddressValue(currentPath)
  }, [currentPath])

  useEffect(() => {
    setFilter(debouncedSearchValue)
  }, [debouncedSearchValue, setFilter])

  return (
    <div className="flex items-center gap-1 border-b border-[#2b2b2b] bg-[#202020] px-2 py-1">
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goBack}
        disabled={!canGoBack}
        title="Back"
      >
        ◀
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goForward}
        disabled={!canGoForward}
        title="Forward"
      >
        ▶
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goUp}
        disabled={!canGoUp}
        title="Up"
      >
        ↑
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = addressValue.trim()
          if (v) navigateTo(v)
        }}
        className="mx-2 flex min-w-0 flex-1"
      >
        <input
          ref={inputRef}
          value={addressValue}
          onChange={(e) => setAddressValue(e.target.value)}
          className="min-w-0 flex-1 rounded border border-[#3a3a3a] bg-[#1c1c1c] px-2 py-1 text-sm outline-none focus:border-[#4a4a4a]"
        />
      </form>
      <div className="flex items-center gap-1">
        <button
          className={`rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] ${
            viewMode === "icons" ? "bg-[#2a2a2a]" : ""
          }`}
          onClick={() => setViewMode("icons")}
          title="Large icons"
        >
          ☐
        </button>
        <button
          className={`rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] ${
            viewMode === "details" ? "bg-[#2a2a2a]" : ""
          }`}
          onClick={() => setViewMode("details")}
          title="Details"
        >
          ☰
        </button>
      </div>
      <div className="ml-2 flex items-center gap-2">
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search"
          className="w-44 rounded border border-[#3a3a3a] bg-[#1c1c1c] px-2 py-1 text-sm outline-none focus:border-[#4a4a4a]"
        />
      </div>
    </div>
  )
}
