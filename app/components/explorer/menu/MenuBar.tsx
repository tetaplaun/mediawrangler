"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import useExplorerStore, {
  useNavigateTo,
  useRefresh,
  useSortedEntries,
} from "../store/explorerStore"
import { ImportDialog } from "../dialogs/ImportDialog"

interface MenuItem {
  label?: string
  action?: () => void
  shortcut?: string
  divider?: boolean
  disabled?: boolean
}

interface Menu {
  label: string
  items: MenuItem[]
}

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [_hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigateTo = useNavigateTo()
  const refresh = useRefresh()
  const entries = useSortedEntries()
  const setViewMode = useExplorerStore((state) => state.setViewMode)
  const viewMode = useExplorerStore((state) => state.viewMode)
  const showHiddenFiles = useExplorerStore((state) => state.showHiddenFiles)
  const setShowHiddenFiles = useExplorerStore((state) => state.setShowHiddenFiles)
  const setSelectedEntries = useExplorerStore((state) => state.setSelectedEntries)
  const selectedEntries = useExplorerStore((state) => state.selectedEntries)
  const showImportDialog = useExplorerStore((state) => state.showImportDialog)
  const setShowImportDialog = useExplorerStore((state) => state.setShowImportDialog)
  const currentPath = useExplorerStore((state) => state.currentPath)

  const handleNewWindow = () => {
    // Open new window functionality - to be implemented
    // For now, just open a new tab/window with the same URL
    if (typeof window !== "undefined") {
      window.open(window.location.href, "_blank")
    }
  }

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.fs.selectFolder()
    if (result.ok && result.path) {
      navigateTo(result.path)
    }
  }

  const handleExit = () => {
    window.close()
  }

  const handleImport = () => {
    setShowImportDialog(true)
  }

  const handleImportComplete = () => {
    refresh()
  }

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handleToggleHiddenFiles = useCallback(() => {
    setShowHiddenFiles(!showHiddenFiles)
  }, [setShowHiddenFiles, showHiddenFiles])

  const handleAbout = () => {
    if (typeof window !== "undefined" && window.electronAPI?.showMessageBox) {
      window.electronAPI.showMessageBox({
        type: "info",
        title: "About Media Wrangler",
        message: "Media Wrangler v0.1.0",
        detail: "A media file explorer and organizer",
      })
    }
  }

  const areDatesDifferent = (
    encodedDateStr: string | undefined,
    modifiedMs: number | null
  ): boolean => {
    if (!encodedDateStr || !modifiedMs) return false

    try {
      const encodedDate = new Date(encodedDateStr)
      const modifiedDate = new Date(modifiedMs)

      if (isNaN(encodedDate.getTime()) || isNaN(modifiedDate.getTime())) return false

      // Compare dates at day level (ignore time within same day)
      const encodedDay = new Date(
        encodedDate.getFullYear(),
        encodedDate.getMonth(),
        encodedDate.getDate()
      )
      const modifiedDay = new Date(
        modifiedDate.getFullYear(),
        modifiedDate.getMonth(),
        modifiedDate.getDate()
      )

      // Return true if dates are different days
      return encodedDay.getTime() !== modifiedDay.getTime()
    } catch {
      return false
    }
  }

  const handleSelectAll = useCallback(() => {
    setSelectedEntries([...entries])
  }, [entries, setSelectedEntries])

  const handleInvertSelection = () => {
    const inverted = entries.filter(
      (entry) => !selectedEntries.some((selected) => selected.path === entry.path)
    )
    setSelectedEntries(inverted)
  }

  const handleSelectAllWithDifferentDate = () => {
    const filesWithDifferentDate = entries.filter((entry) =>
      areDatesDifferent(entry.mediaInfo?.encodedDate, entry.modifiedMs)
    )
    setSelectedEntries(filesWithDifferentDate)
  }

  const handleDeselectAll = useCallback(() => {
    setSelectedEntries([])
  }, [setSelectedEntries])

  const handleCorrectSelectedFileDates = async () => {
    if (selectedEntries.length === 0) {
      if (typeof window !== "undefined" && window.electronAPI?.showMessageBox) {
        window.electronAPI.showMessageBox({
          type: "warning",
          title: "No Files Selected",
          message: "Please select files first before correcting dates.",
        })
      }
      return
    }

    // Filter selected entries that have different dates
    const filesToCorrect = selectedEntries.filter((entry) =>
      areDatesDifferent(entry.mediaInfo?.encodedDate, entry.modifiedMs)
    )

    if (filesToCorrect.length === 0) {
      if (typeof window !== "undefined" && window.electronAPI?.showMessageBox) {
        window.electronAPI.showMessageBox({
          type: "info",
          title: "No Files to Correct",
          message: "All selected files already have matching dates.",
        })
      }
      return
    }

    // Confirm the operation
    let confirmed = false
    if (typeof window !== "undefined" && window.electronAPI?.showMessageBox) {
      const result = await window.electronAPI.showMessageBox({
        type: "question",
        title: "Confirm Date Correction",
        message: `Correct file dates for ${filesToCorrect.length} selected file(s)?`,
        detail:
          "This will update the file modification dates to match the encoded dates from the media metadata.",
        buttons: ["Cancel", "Correct Dates"],
        defaultId: 1,
        cancelId: 0,
      })
      confirmed = result.response === 1
    }

    if (!confirmed) return

    let successCount = 0
    let errorCount = 0

    // Process each file
    for (const entry of filesToCorrect) {
      if (entry.mediaInfo?.encodedDate) {
        try {
          const result = await window.electronAPI.fs.updateFileDate(
            entry.path,
            entry.mediaInfo.encodedDate
          )
          if (result.ok) {
            successCount++
          } else {
            console.error(`Failed to update date for ${entry.path}:`, result.error)
            errorCount++
          }
        } catch (error) {
          console.error(`Error updating date for ${entry.path}:`, error)
          errorCount++
        }
      }
    }

    // Refresh the current directory to show updated dates
    refresh()

    // Show results
    if (typeof window !== "undefined" && window.electronAPI?.showMessageBox) {
      if (errorCount === 0) {
        window.electronAPI.showMessageBox({
          type: "info",
          title: "Success",
          message: `Successfully corrected dates for ${successCount} file(s).`,
        })
      } else {
        window.electronAPI.showMessageBox({
          type: "warning",
          title: "Partial Success",
          message: `Corrected dates for ${successCount} file(s).`,
          detail: `Failed to correct ${errorCount} file(s). Check console for details.`,
        })
      }
    }
  }

  const menus: Menu[] = [
    {
      label: "File",
      items: [
        { label: "New Window", action: handleNewWindow, shortcut: "Ctrl+N" },
        { label: "Open Folder...", action: handleOpenFolder, shortcut: "Ctrl+O" },
        { divider: true },
        { label: "Import Media...", action: handleImport, shortcut: "Ctrl+I" },
        { divider: true },
        { label: "Exit", action: handleExit, shortcut: "Alt+F4" },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Copy", action: () => {}, shortcut: "Ctrl+C", disabled: true },
        { label: "Cut", action: () => {}, shortcut: "Ctrl+X", disabled: true },
        { label: "Paste", action: () => {}, shortcut: "Ctrl+V", disabled: true },
        { divider: true },
        { label: "Select All", action: handleSelectAll, shortcut: "Ctrl+A" },
        {
          label: "Deselect All",
          action: handleDeselectAll,
          shortcut: "Ctrl+D",
          disabled: selectedEntries.length === 0,
        },
        {
          label: "Invert Selection",
          action: handleInvertSelection,
          disabled: selectedEntries.length === 0,
        },
        {
          label: "Select All Files with Different Date",
          action: handleSelectAllWithDifferentDate,
          disabled: entries.length === 0,
        },
        { divider: true },
        {
          label: "Correct Selected File Dates",
          action: handleCorrectSelectedFileDates,
          disabled: selectedEntries.length === 0,
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: viewMode === "icons" ? "✓ Large Icons" : "Large Icons",
          action: () => setViewMode("icons"),
        },
        {
          label: viewMode === "details" ? "✓ Details" : "Details",
          action: () => setViewMode("details"),
        },
        { divider: true },
        {
          label: showHiddenFiles ? "✓ Show Hidden Files" : "Show Hidden Files",
          action: handleToggleHiddenFiles,
          shortcut: "Ctrl+H",
        },
        { divider: true },
        { label: "Refresh", action: handleRefresh, shortcut: "F5" },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "About MediaWrangler", action: handleAbout },
        { label: "Documentation", action: () => {}, disabled: true },
      ],
    },
  ]

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) {
        setActiveMenu(null)
      }
    }

    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [activeMenu])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input field
      const target = event.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return
      }

      const isCtrl = event.ctrlKey || event.metaKey

      // Ctrl+A: Select All
      if (isCtrl && event.key === "a") {
        event.preventDefault()
        handleSelectAll()
        return
      }

      // Ctrl+H: Toggle Hidden Files
      if (isCtrl && event.key === "h") {
        event.preventDefault()
        handleToggleHiddenFiles()
        return
      }

      // Ctrl+D: Deselect All
      if (isCtrl && event.key === "d") {
        event.preventDefault()
        handleDeselectAll()
        return
      }

      // F5: Refresh
      if (event.key === "F5") {
        event.preventDefault()
        handleRefresh()
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleSelectAll, handleToggleHiddenFiles, handleDeselectAll, handleRefresh])

  const handleMenuClick = (menuLabel: string) => {
    setActiveMenu(activeMenu === menuLabel ? null : menuLabel)
  }

  const handleMenuHover = (menuLabel: string) => {
    if (activeMenu) {
      setActiveMenu(menuLabel)
    }
    setHoveredMenu(menuLabel)
  }

  const handleMenuItemClick = (item: MenuItem) => {
    if (!item.disabled && item.action) {
      item.action()
      setActiveMenu(null)
    }
  }

  return (
    <>
      <div
        ref={menuRef}
        className="flex items-center bg-[#2d2d2d] border-b border-[#3a3a3a] select-none"
      >
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              className={`px-4 py-1.5 text-sm hover:bg-[#3a3a3a] transition-colors ${
                activeMenu === menu.label ? "bg-[#3a3a3a]" : ""
              }`}
              onClick={() => handleMenuClick(menu.label)}
              onMouseEnter={() => handleMenuHover(menu.label)}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              {menu.label}
            </button>

            {activeMenu === menu.label && (
              <div className="absolute left-0 top-full z-50 min-w-[200px] bg-[#2d2d2d] border border-[#3a3a3a] shadow-lg">
                {menu.items.map((item, index) =>
                  item.divider ? (
                    <div key={index} className="my-1 border-t border-[#3a3a3a]" />
                  ) : (
                    <button
                      key={index}
                      className={`w-full px-4 py-1.5 text-sm text-left flex justify-between items-center hover:bg-[#3a3a3a] transition-colors ${
                        item.disabled ? "opacity-50 cursor-default" : ""
                      }`}
                      onClick={() => handleMenuItemClick(item)}
                      disabled={item.disabled}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-gray-400 ml-8">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
        currentPath={currentPath}
      />
    </>
  )
}
