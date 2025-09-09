"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Entry, SortState, ViewMode, Drive, QuickLink } from "../types/explorer"
import { fsService } from "../services/fs"
import { sortEntries } from "../utils/sort"
import { getParentPath } from "../utils/path"

type ExplorerState = {
  currentPath: string
  entries: Entry[]
  loading: boolean
  error: string | null
  quickLinks: QuickLink[]
  drives: Drive[]
  viewMode: ViewMode
  filter: string
  sort: SortState
  backStack: string[]
  forwardStack: string[]
}

type ExplorerActions = {
  navigateTo: (path: string, pushHistory?: boolean) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  goUp: () => Promise<void>
  refresh: () => Promise<void>
  setViewMode: (v: ViewMode) => void
  setFilter: (f: string) => void
  setSort: (s: SortState) => void
}

const ExplorerStateContext = createContext<ExplorerState | null>(null)
const ExplorerActionsContext = createContext<ExplorerActions | null>(null)

export function ExplorerProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>("::drives")
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [drives, setDrives] = useState<Drive[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("details")
  const [filter, setFilter] = useState<string>("")
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" })
  const [backStack, setBackStack] = useState<string[]>([])
  const [forwardStack, setForwardStack] = useState<string[]>([])

  const load = useCallback(async (pathTarget: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fsService.listDir(pathTarget)
      setCurrentPath(res.path)
      setEntries(res.entries)
    } catch (e) {
      setError((e as any)?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const navigateTo = useCallback(
    async (path: string, pushHistory = true) => {
      if (pushHistory) setBackStack((prev) => [...prev, currentPath])
      setForwardStack([])
      await load(path)
    },
    [currentPath, load]
  )

  const goBack = useCallback(async () => {
    setBackStack((prev) => {
      const copy = [...prev]
      const last = copy.pop()
      if (last != null) {
        setForwardStack((fwd) => [currentPath, ...fwd])
        load(last)
      }
      return copy
    })
  }, [currentPath, load])

  const goForward = useCallback(async () => {
    setForwardStack((prev) => {
      const copy = [...prev]
      const next = copy.shift()
      if (next != null) {
        setBackStack((back) => [...back, currentPath])
        load(next)
      }
      return copy
    })
  }, [currentPath, load])

  const goUp = useCallback(async () => {
    if (currentPath === "::drives") return
    const parent = getParentPath(currentPath)
    if (!parent) return
    await navigateTo(parent)
  }, [currentPath, navigateTo])

  const refresh = useCallback(async () => {
    await load(currentPath)
  }, [currentPath, load])

  // Initial load
  useEffect(() => {
    ;(async () => {
      const [q, d] = await Promise.all([fsService.getQuickLinks(), fsService.getDrives()])
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

  const sortedEntries = useMemo(() => sortEntries(filteredEntries, sort), [filteredEntries, sort])

  const stateValue = useMemo(
    () => ({
      currentPath,
      entries: sortedEntries,
      loading,
      error,
      quickLinks,
      drives,
      viewMode,
      filter,
      sort,
      backStack,
      forwardStack,
    }),
    [
      currentPath,
      sortedEntries,
      loading,
      error,
      quickLinks,
      drives,
      viewMode,
      filter,
      sort,
      backStack,
      forwardStack,
    ]
  )

  const actionsValue = useMemo(
    () => ({
      navigateTo,
      goBack,
      goForward,
      goUp,
      refresh,
      setViewMode,
      setFilter,
      setSort,
    }),
    [navigateTo, goBack, goForward, goUp, refresh]
  )

  return (
    <ExplorerStateContext.Provider value={stateValue}>
      <ExplorerActionsContext.Provider value={actionsValue}>
        {children}
      </ExplorerActionsContext.Provider>
    </ExplorerStateContext.Provider>
  )
}

export function useExplorerState() {
  const ctx = useContext(ExplorerStateContext)
  if (!ctx) throw new Error("useExplorerState must be used within ExplorerProvider")
  return ctx
}

export function useExplorerActions() {
  const ctx = useContext(ExplorerActionsContext)
  if (!ctx) throw new Error("useExplorerActions must be used within ExplorerProvider")
  return ctx
}

export function useExplorer() {
  const state = useExplorerState()
  const actions = useExplorerActions()
  return { ...state, ...actions }
}
