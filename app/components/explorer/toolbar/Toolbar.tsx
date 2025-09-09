"use client"

import { useRef } from "react"
import { useExplorer } from "../context/ExplorerContext"

export function Toolbar() {
  const {
    goBack,
    goForward,
    goUp,
    backStack,
    forwardStack,
    setViewMode,
    viewMode,
    setFilter,
    navigateTo,
    currentPath,
  } = useExplorer()
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="flex items-center gap-1 border-b border-[#2b2b2b] bg-[#202020] px-2 py-1">
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goBack}
        disabled={backStack.length === 0}
        title="Back"
      >
        ◀
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goForward}
        disabled={forwardStack.length === 0}
        title="Forward"
      >
        ▶
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
        onClick={goUp}
        disabled={currentPath === "::drives"}
        title="Up"
      >
        ↑
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = inputRef.current?.value?.trim()
          if (v) navigateTo(v)
        }}
        className="mx-2 flex min-w-0 flex-1"
      >
        <input
          ref={inputRef}
          defaultValue={currentPath}
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
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search"
          className="w-44 rounded border border-[#3a3a3a] bg-[#1c1c1c] px-2 py-1 text-sm outline-none focus:border-[#4a4a4a]"
        />
      </div>
    </div>
  )
}
