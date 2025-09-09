"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Entry = {
  name: string
  path: string
  type: "file" | "directory" | "drive"
  size: number | null
  modifiedMs: number | null
  ext: string | null
}

type ViewMode = "icons" | "details"

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

export default function Explorer() {
  const [currentPath, setCurrentPath] = useState<string>("::drives")
  const [stackBack, setStackBack] = useState<string[]>([])
  const [stackForward, setStackForward] = useState<string[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [quickLinks, setQuickLinks] = useState<Array<{ name: string; path: string }>>([])
  const [drives, setDrives] = useState<Array<{ name: string; path: string }>>([])
  const [viewMode, setViewMode] = useState<ViewMode>("details")
  const [filter, setFilter] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const addressRef = useRef<HTMLInputElement | null>(null)

  const canGoUp = useMemo(() => {
    if (currentPath === "::drives") return false
    if (currentPath.match(/^[A-Z]:\\?$/i)) return true
    return true
  }, [currentPath])

  const load = useCallback(async (pathTarget: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.fs.listDir(pathTarget)
      setCurrentPath(res.path)
      setEntries(res.entries)
      if (addressRef.current) addressRef.current.value = res.path
    } catch (e) {
      setError((e as any)?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const navigateTo = useCallback(
    async (nextPath: string, pushHistory = true) => {
      if (pushHistory) setStackBack((prev) => [...prev, currentPath])
      setStackForward([])
      await load(nextPath)
    },
    [currentPath, load]
  )

  const goBack = useCallback(async () => {
    setStackBack((prev) => {
      const copy = [...prev]
      const last = copy.pop()
      if (last != null) {
        setStackForward((fwd) => [currentPath, ...fwd])
        load(last)
      }
      return copy
    })
  }, [currentPath, load])

  const goForward = useCallback(async () => {
    setStackForward((prev) => {
      const copy = [...prev]
      const next = copy.shift()
      if (next != null) {
        setStackBack((back) => [...back, currentPath])
        load(next)
      }
      return copy
    })
  }, [currentPath, load])

  const goUp = useCallback(async () => {
    if (currentPath === "::drives") return
    const parsed = currentPath.replace(/\\+$/, "")
    const sep = parsed.includes("\\") || /^[A-Za-z]:/.test(parsed) ? "\\" : "/"
    const parent = parsed.includes(sep) ? parsed.slice(0, parsed.lastIndexOf(sep)) : "::drives"
    await navigateTo(parent)
  }, [currentPath, navigateTo])

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

  const onSubmitAddress = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault()
      const value = addressRef.current?.value?.trim()
      if (!value) return
      await navigateTo(value)
    },
    [navigateTo]
  )

  useEffect(() => {
    ;(async () => {
      const [q, d] = await Promise.all([
        window.electronAPI.fs.getQuickLinks(),
        window.electronAPI.fs.getDrives(),
      ])
      setQuickLinks(q)
      setDrives(d)
      await load("::drives")
    })()
  }, [load])

  const filteredEntries = useMemo(() => {
    if (!filter) return entries
    const term = filter.toLowerCase()
    return entries.filter((e) => e.name.toLowerCase().includes(term))
  }, [entries, filter])

  return (
    <div className="flex h-screen w-full select-none bg-[#1f1f1f] text-[rgb(235,235,235)]">
      {/* Sidebar */}
      <div className="w-60 shrink-0 overflow-y-auto border-r border-[#2b2b2b] bg-[#202020]">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Quick access
        </div>
        <ul>
          {quickLinks.map((q) => (
            <li key={q.path}>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-[#2a2a2a]"
                onClick={() => navigateTo(q.path)}
              >
                {q.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Drives
        </div>
        <ul className="pb-2">
          {drives.map((d) => (
            <li key={d.path}>
              <button
                className="w-full px-3 py-1.5 text-left hover:bg-[#2a2a2a]"
                onClick={() => navigateTo(d.path)}
              >
                {d.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main area */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-[#2b2b2b] bg-[#202020] px-2 py-1">
          <button
            className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
            onClick={goBack}
            disabled={stackBack.length === 0}
          >
            ◀
          </button>
          <button
            className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
            onClick={goForward}
            disabled={stackForward.length === 0}
          >
            ▶
          </button>
          <button
            className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
            onClick={goUp}
            disabled={!canGoUp}
          >
            ↑
          </button>
          <form onSubmit={onSubmitAddress} className="mx-2 flex min-w-0 flex-1">
            <input
              ref={addressRef}
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
            >
              ☐
            </button>
            <button
              className={`rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] ${
                viewMode === "details" ? "bg-[#2a2a2a]" : ""
              }`}
              onClick={() => setViewMode("details")}
            >
              ☰
            </button>
          </div>
          <div className="ml-2 flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search"
              className="w-44 rounded border border-[#3a3a3a] bg-[#1c1c1c] px-2 py-1 text-sm outline-none focus:border-[#4a4a4a]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e] p-2">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-400">{error}</div>
          ) : viewMode === "icons" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-1">
              {filteredEntries.map((e) => (
                <button
                  key={e.path}
                  onDoubleClick={() => openEntry(e)}
                  className="rounded p-2 text-left hover:bg-[#2a2a2a]"
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
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-[#202020]">
                <tr>
                  <th className="w-1/2 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
                    Name
                  </th>
                  <th className="w-1/6 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
                    Type
                  </th>
                  <th className="w-1/6 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
                    Size
                  </th>
                  <th className="w-1/6 border-b border-[#2b2b2b] px-2 py-1 text-left font-medium">
                    Date modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => (
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
                    <td className="border-b border-[#2b2b2b] px-2 py-1">
                      {formatDate(e.modifiedMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
