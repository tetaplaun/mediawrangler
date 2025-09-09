import { create } from "zustand"
import { devtools, persist, createJSONStorage } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { shallow } from "zustand/shallow"
import type { Entry, SortState, ViewMode, Drive, QuickLink } from "../types/explorer"
import { fsService } from "../services/fs"
import { sortEntries } from "../utils/sort"
import { getParentPath } from "../utils/path"

interface ExplorerState {
  // Navigation state
  currentPath: string
  backStack: string[]
  forwardStack: string[]

  // File system data
  entries: Entry[]
  quickLinks: QuickLink[]
  drives: Drive[]

  // Media info cache
  mediaInfoCache: Record<string, any>
  mediaInfoLoading: Record<string, boolean>

  // UI state
  loading: boolean
  error: string | null
  viewMode: ViewMode
  filter: string
  sort: SortState

  // Computed values
  filteredEntries: Entry[]
  sortedEntries: Entry[]
}

interface ExplorerActions {
  // Navigation actions
  navigateTo: (path: string, pushHistory?: boolean) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  goUp: () => Promise<void>
  refresh: () => Promise<void>

  // UI actions
  setViewMode: (mode: ViewMode) => void
  setFilter: (filter: string) => void
  setSort: (sort: SortState) => void

  // Quick link actions
  addQuickLink: (name: string, path: string) => Promise<boolean>
  removeQuickLink: (id: string) => Promise<boolean>
  updateQuickLink: (id: string, updates: { name?: string; path?: string }) => Promise<boolean>
  reorderQuickLinks: (orderedIds: string[]) => Promise<boolean>
  setShowDefaultQuickLinks: (show: boolean) => Promise<boolean>
  resetQuickLinks: () => Promise<boolean>
  refreshQuickLinks: () => Promise<void>

  // Media info actions
  loadMediaInfo: () => Promise<void>

  // Internal actions
  load: (path: string) => Promise<void>
  initialize: () => Promise<void>
}

type ExplorerStore = ExplorerState & ExplorerActions

const useExplorerStore = create<ExplorerStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        currentPath: "::drives",
        backStack: [],
        forwardStack: [],
        entries: [],
        quickLinks: [],
        drives: [],
        mediaInfoCache: {},
        mediaInfoLoading: {},
        loading: false,
        error: null,
        viewMode: "details",
        filter: "",
        sort: { key: "name", dir: "asc" },
        filteredEntries: [],
        sortedEntries: [],

        // Load directory contents
        load: async (pathTarget: string) => {
          set((state) => {
            state.loading = true
            state.error = null
            // Clear media info cache when changing directories
            state.mediaInfoCache = {}
            state.mediaInfoLoading = {}
          })

          try {
            const res = await fsService.listDir(pathTarget)
            set((state) => {
              state.currentPath = res.path
              state.entries = res.entries
              state.loading = false

              // Update computed values
              const filtered = state.filter
                ? res.entries.filter((e) =>
                    e.name.toLowerCase().includes(state.filter.toLowerCase())
                  )
                : res.entries
              state.filteredEntries = filtered
              state.sortedEntries = sortEntries(filtered, state.sort)
            })

            // Start loading media info asynchronously
            get().loadMediaInfo()
          } catch (e) {
            set((state) => {
              state.error = (e as any)?.message || String(e)
              state.loading = false
            })
          }
        },

        // Navigate to a path
        navigateTo: async (path: string, pushHistory = true) => {
          const { currentPath, load } = get()

          set((state) => {
            if (pushHistory) {
              state.backStack.push(currentPath)
            }
            state.forwardStack = []
          })

          await load(path)
        },

        // Go back in history
        goBack: async () => {
          const { backStack, currentPath, load } = get()
          if (backStack.length === 0) return

          const last = backStack[backStack.length - 1]
          set((state) => {
            state.backStack.pop()
            state.forwardStack.unshift(currentPath)
          })

          await load(last)
        },

        // Go forward in history
        goForward: async () => {
          const { forwardStack, currentPath, load } = get()
          if (forwardStack.length === 0) return

          const next = forwardStack[0]
          set((state) => {
            state.forwardStack.shift()
            state.backStack.push(currentPath)
          })

          await load(next)
        },

        // Go up one directory
        goUp: async () => {
          const { currentPath, navigateTo } = get()
          if (currentPath === "::drives") return

          const parent = getParentPath(currentPath)
          if (!parent) return

          await navigateTo(parent)
        },

        // Refresh current directory
        refresh: async () => {
          const { currentPath, load } = get()
          await load(currentPath)
        },

        // Set view mode
        setViewMode: (mode: ViewMode) => {
          set((state) => {
            state.viewMode = mode
          })
        },

        // Set filter
        setFilter: (filter: string) => {
          set((state) => {
            state.filter = filter

            // Update computed values
            const filtered = filter
              ? state.entries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
              : state.entries
            state.filteredEntries = filtered
            state.sortedEntries = sortEntries(filtered, state.sort)
          })
        },

        // Set sort
        setSort: (sort: SortState) => {
          set((state) => {
            state.sort = sort
            state.sortedEntries = sortEntries(state.filteredEntries, sort)
          })
        },

        // Initialize the store
        initialize: async () => {
          try {
            const [quickLinks, drives] = await Promise.all([
              fsService.getQuickLinks(),
              fsService.getDrives(),
            ])

            set((state) => {
              state.quickLinks = quickLinks
              state.drives = drives
            })

            await get().load("::drives")
          } catch (e) {
            set((state) => {
              state.error = (e as any)?.message || String(e)
            })
          }
        },

        // Quick link management actions
        addQuickLink: async (name: string, path: string) => {
          const result = await fsService.addQuickLink(name, path)
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        removeQuickLink: async (id: string) => {
          const result = await fsService.removeQuickLink(id)
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        updateQuickLink: async (id: string, updates: { name?: string; path?: string }) => {
          const result = await fsService.updateQuickLink(id, updates)
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        reorderQuickLinks: async (orderedIds: string[]) => {
          const result = await fsService.reorderQuickLinks(orderedIds)
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        setShowDefaultQuickLinks: async (show: boolean) => {
          const result = await fsService.setShowDefaultQuickLinks(show)
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        resetQuickLinks: async () => {
          const result = await fsService.resetQuickLinks()
          if (result.ok) {
            await get().refreshQuickLinks()
          }
          return result.ok
        },

        refreshQuickLinks: async () => {
          try {
            const quickLinks = await fsService.getQuickLinks()
            set((state) => {
              state.quickLinks = quickLinks
            })
          } catch (e) {
            console.error("Failed to refresh quick links:", e)
          }
        },

        // Load media info for files progressively
        loadMediaInfo: async () => {
          const { entries, mediaInfoCache, mediaInfoLoading } = get()
          
          // Filter entries that are media files and don't have cached info
          const mediaFiles = entries.filter((entry) => {
            if (entry.type !== "file" || !entry.ext) return false
            
            const mediaExts = [
              'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mpg', 'mpeg', 'wmv', 'flv',
              'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico', 'heic', 'heif'
            ]
            
            return mediaExts.includes(entry.ext.toLowerCase()) && 
                   !mediaInfoCache[entry.path] && 
                   !mediaInfoLoading[entry.path]
          })

          if (mediaFiles.length === 0) return

          // Process in batches of 20 files
          const batchSize = 20
          for (let i = 0; i < mediaFiles.length; i += batchSize) {
            const batch = mediaFiles.slice(i, i + batchSize)
            const paths = batch.map(f => f.path)

            // Mark as loading
            set((state) => {
              paths.forEach(path => {
                state.mediaInfoLoading[path] = true
              })
            })

            try {
              const result = await fsService.getMediaInfoBatch(paths)
              if (result.ok && result.data) {
                set((state) => {
                  // Update cache and entries
                  result.data.forEach(({ path, mediaInfo }) => {
                    if (mediaInfo) {
                      state.mediaInfoCache[path] = mediaInfo
                      
                      // Update the entry with media info
                      const entryIndex = state.entries.findIndex(e => e.path === path)
                      if (entryIndex !== -1) {
                        state.entries[entryIndex].mediaInfo = mediaInfo
                      }
                    }
                    delete state.mediaInfoLoading[path]
                  })

                  // Update computed values with new media info
                  const filtered = state.filter
                    ? state.entries.filter((e) =>
                        e.name.toLowerCase().includes(state.filter.toLowerCase())
                      )
                    : state.entries
                  state.filteredEntries = filtered
                  state.sortedEntries = sortEntries(filtered, state.sort)
                })
              }
            } catch (e) {
              console.error("Failed to load media info batch:", e)
              set((state) => {
                paths.forEach(path => {
                  delete state.mediaInfoLoading[path]
                })
              })
            }

            // Small delay between batches to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        },
      })),
      {
        name: "explorer-preferences",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          viewMode: state.viewMode,
          sort: state.sort,
        }),
      }
    ),
    {
      name: "explorer-store",
    }
  )
)

// Selectors for common use cases
export const useCurrentPath = () => useExplorerStore((state) => state.currentPath)
export const useSortedEntries = () => useExplorerStore((state) => state.sortedEntries)
export const useViewMode = () => useExplorerStore((state) => state.viewMode)
export const useQuickLinks = () => useExplorerStore((state) => state.quickLinks)
export const useDrives = () => useExplorerStore((state) => state.drives)

// Navigation selectors - individual stable selectors to prevent infinite loops
export const useGoBack = () => useExplorerStore((state) => state.goBack)
export const useGoForward = () => useExplorerStore((state) => state.goForward)
export const useGoUp = () => useExplorerStore((state) => state.goUp)
export const useNavigateTo = () => useExplorerStore((state) => state.navigateTo)
export const useCanGoBack = () => useExplorerStore((state) => state.backStack.length > 0)
export const useCanGoForward = () => useExplorerStore((state) => state.forwardStack.length > 0)
export const useCanGoUp = () =>
  useExplorerStore((state) => getParentPath(state.currentPath) !== null)

// Combined navigation hook using stable selectors
export const useNavigation = () => ({
  goBack: useGoBack(),
  goForward: useGoForward(),
  goUp: useGoUp(),
  navigateTo: useNavigateTo(),
  canGoBack: useCanGoBack(),
  canGoForward: useCanGoForward(),
  canGoUp: useCanGoUp(),
})

export default useExplorerStore
