"use client"

import { useState } from "react"
import useExplorerStore, { useQuickLinks, useDrives } from "../store/explorerStore"
import { QuickLinkEditor } from "./QuickLinkEditor"

export function Sidebar() {
  const quickLinks = useQuickLinks()
  const drives = useDrives()
  const navigateTo = useExplorerStore((state) => state.navigateTo)
  const removeQuickLink = useExplorerStore((state) => state.removeQuickLink)
  const [hoveredQuickLink, setHoveredQuickLink] = useState<string | null>(null)
  const [editingQuickLink, setEditingQuickLink] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const handleRemoveQuickLink = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await removeQuickLink(id)
  }

  const handleEditQuickLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingQuickLink(id)
  }

  const handleAddQuickLink = () => {
    setShowAddDialog(true)
  }

  return (
    <div className="w-60 shrink-0 overflow-y-auto border-r border-[#2b2b2b] bg-[#202020]">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Quick access
      </div>
      <ul>
        {quickLinks.map((q) => (
          <li 
            key={q.id}
            onMouseEnter={() => setHoveredQuickLink(q.id)}
            onMouseLeave={() => setHoveredQuickLink(null)}
          >
            <div className="flex items-center group">
              <button
                className="flex-1 px-3 py-1.5 text-left hover:bg-[#2a2a2a]"
                onClick={() => navigateTo(q.path)}
                title={`${q.name} (${q.path})`}
              >
                {q.name}
              </button>
              {q.isCustom && hoveredQuickLink === q.id && (
                <div className="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleEditQuickLink(q.id, e)}
                    className="p-1 hover:bg-[#3a3a3a] rounded"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleRemoveQuickLink(q.id, e)}
                    className="p-1 hover:bg-[#3a3a3a] rounded ml-1"
                    title="Remove"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="px-3 py-2">
        <button
          onClick={handleAddQuickLink}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-[#2a2a2a] rounded flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add folder
        </button>
      </div>
      <div className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Drives
      </div>
      <ul className="pb-2">
        {drives.map((d) => (
          <li key={d.path}>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-[#2a2a2a]"
              onClick={() => navigateTo(d.path)}
              title={`Drive ${d.name} (${d.path})`}
            >
              {d.name}
            </button>
          </li>
        ))}
      </ul>
      
      {/* Quick Link Editor Dialog */}
      {(showAddDialog || editingQuickLink) && (
        <QuickLinkEditor
          editingId={editingQuickLink}
          onClose={() => {
            setShowAddDialog(false)
            setEditingQuickLink(null)
          }}
        />
      )}
    </div>
  )
}