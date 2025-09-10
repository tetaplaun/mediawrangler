"use client"

import { useEffect } from "react"
import { MenuBar } from "./menu/MenuBar"
import { Sidebar } from "./sidebar/Sidebar"
import { Toolbar } from "./toolbar/Toolbar"
import { ButtonBar } from "./toolbar/ButtonBar"
import { ContentArea } from "./views/ContentArea"
import { KeyboardHandler } from "./KeyboardHandler"
import useExplorerStore from "./store/explorerStore"

export function ExplorerShell() {
  const initialize = useExplorerStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="flex flex-col h-screen w-full select-none bg-[#1f1f1f] text-[rgb(235,235,235)]">
      <KeyboardHandler />
      <MenuBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <Toolbar />
          <ButtonBar />
          <ContentArea />
        </div>
      </div>
    </div>
  )
}
