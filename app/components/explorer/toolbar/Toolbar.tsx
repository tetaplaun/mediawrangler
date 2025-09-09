"use client"

import { useRef, useState, useEffect } from "react"
import { getParentPath } from "../utils/path"
import { useDebounce } from "../hooks/useDebounce"
import { formatDisplayPath } from "../utils/format"
import { QuickLinkEditor } from "../sidebar/QuickLinkEditor"
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
  const addQuickLink = useExplorerStore((state) => state.addQuickLink)
  const quickLinks = useExplorerStore((state) => state.quickLinks)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [addressValue, setAddressValue] = useState(formatDisplayPath(currentPath))
  const [searchValue, setSearchValue] = useState("")
  const [showQuickLinkDialog, setShowQuickLinkDialog] = useState(false)
  const debouncedSearchValue = useDebounce(searchValue, 300)

  useEffect(() => {
    setAddressValue(formatDisplayPath(currentPath))
  }, [currentPath])

  useEffect(() => {
    setFilter(debouncedSearchValue)
  }, [debouncedSearchValue, setFilter])

  const handleAddQuickLink = async () => {
    // Don't add if it's the drives view or already in quick links
    if (currentPath === "::drives") return
    
    const alreadyExists = quickLinks.some(link => link.path === currentPath)
    if (alreadyExists) return
    
    // Open dialog with current path pre-filled
    setShowQuickLinkDialog(true)
  }

  const isInQuickLinks = quickLinks.some(link => link.path === currentPath)
  const canAddQuickLink = currentPath !== "::drives" && !isInQuickLinks

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
          if (v) {
            // Convert display path back to internal path for navigation
            const internalPath = v === "Drives" ? "::drives" : v
            navigateTo(internalPath)
          }
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
        <button
          className="rounded px-2 py-1 text-sm hover:bg-[#2a2a2a] disabled:opacity-40"
          onClick={handleAddQuickLink}
          disabled={!canAddQuickLink}
          title={isInQuickLinks ? "Already in quick access" : "Add to quick access"}
        >
          ⭐
        </button>
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search"
          className="w-44 rounded border border-[#3a3a3a] bg-[#1c1c1c] px-2 py-1 text-sm outline-none focus:border-[#4a4a4a]"
        />
      </div>
      
      {showQuickLinkDialog && (
        <QuickLinkDialogWithCurrentPath
          currentPath={currentPath}
          onClose={() => setShowQuickLinkDialog(false)}
        />
      )}
    </div>
  )
}

// Helper component to open QuickLinkEditor with pre-filled path
function QuickLinkDialogWithCurrentPath({ currentPath, onClose }: { currentPath: string; onClose: () => void }) {
  const addQuickLink = useExplorerStore((state) => state.addQuickLink)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    // Auto-populate name from current path
    const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || "Folder"
    setName(folderName)
  }, [currentPath])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    
    try {
      const trimmedName = name.trim()
      if (!trimmedName) {
        setError("Please provide a name")
        setIsSubmitting(false)
        return
      }
      
      const success = await addQuickLink(trimmedName, currentPath)
      if (success) {
        onClose()
      } else {
        setError("Failed to add quick link. It may already exist.")
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a2a] rounded-lg shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold mb-4">Add to Quick Access</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded focus:outline-none focus:border-blue-500"
              placeholder="e.g., My Projects"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Path
            </label>
            <div className="px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-gray-400">
              {currentPath}
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-900/20 border border-red-700 rounded text-sm text-red-400">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] rounded transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
