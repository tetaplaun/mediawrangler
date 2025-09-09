"use client"

import { useState, useEffect, useRef } from "react"
import useExplorerStore, { useQuickLinks } from "../store/explorerStore"
import { fsService } from "../services/fs"

interface QuickLinkEditorProps {
  editingId: string | null
  onClose: () => void
}

export function QuickLinkEditor({ editingId, onClose }: QuickLinkEditorProps) {
  const quickLinks = useQuickLinks()
  const addQuickLink = useExplorerStore((state) => state.addQuickLink)
  const updateQuickLink = useExplorerStore((state) => state.updateQuickLink)
  
  const editingLink = editingId ? quickLinks.find(q => q.id === editingId) : null
  
  const [name, setName] = useState(editingLink?.name || "")
  const [path, setPath] = useState(editingLink?.path || "")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus the name input when dialog opens
    nameInputRef.current?.focus()
  }, [])

  useEffect(() => {
    // Handle escape key to close dialog
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  useEffect(() => {
    // Handle click outside to close dialog
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const trimmedName = name.trim()
      const trimmedPath = path.trim()

      if (!trimmedName || !trimmedPath) {
        setError("Please provide both name and path")
        setIsSubmitting(false)
        return
      }

      let success = false
      if (editingId) {
        success = await updateQuickLink(editingId, { 
          name: trimmedName, 
          path: trimmedPath 
        })
      } else {
        success = await addQuickLink(trimmedName, trimmedPath)
      }

      if (success) {
        onClose()
      } else {
        setError("Failed to save quick link. The path may already exist.")
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBrowse = async () => {
    try {
      const result = await fsService.selectFolder()
      if (result.ok && result.path) {
        setPath(result.path)
        // Auto-populate name if it's empty
        if (!name.trim()) {
          const folderName = result.path.split(/[/\\]/).filter(Boolean).pop() || "Folder"
          setName(folderName)
        }
        setError(null)
      }
    } catch (err: any) {
      setError("Failed to open folder picker")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={dialogRef} className="bg-[#2a2a2a] rounded-lg shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? "Edit Quick Link" : "Add Quick Link"}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              ref={nameInputRef}
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded focus:outline-none focus:border-blue-500"
              placeholder="e.g., My Projects"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="path" className="block text-sm font-medium mb-1">
              Path
            </label>
            <div className="flex gap-2">
              <input
                id="path"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded focus:outline-none focus:border-blue-500"
                placeholder="e.g., C:\Users\Documents"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="px-3 py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] rounded transition-colors"
                disabled={isSubmitting}
              >
                Browse
              </button>
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
              {isSubmitting ? "Saving..." : (editingId ? "Update" : "Add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}