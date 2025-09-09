"use client"

import { ExplorerProvider } from "./context/ExplorerContext"
import { Sidebar } from "./sidebar/Sidebar"
import { Toolbar } from "./toolbar/Toolbar"
import { ContentArea } from "./views/ContentArea"

export function ExplorerShell() {
  return (
    <ExplorerProvider>
      <div className="flex h-screen w-full select-none bg-[#1f1f1f] text-[rgb(235,235,235)]">
        <Sidebar />
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <Toolbar />
          <ContentArea />
        </div>
      </div>
    </ExplorerProvider>
  )
}
