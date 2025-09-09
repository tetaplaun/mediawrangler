"use client"

import { useExplorer } from "../context/ExplorerContext"

export function Sidebar() {
  const { quickLinks, drives, navigateTo } = useExplorer()
  return (
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
              title={`${q.name} (${q.path})`}
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
              title={`Drive ${d.name} (${d.path})`}
            >
              {d.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
