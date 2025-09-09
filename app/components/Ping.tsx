"use client"

import { useEffect, useState } from "react"

export default function Ping() {
  const [response, setResponse] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (window?.electronAPI?.ping) {
      window.electronAPI.ping().then((res) => {
        if (mounted) setResponse(res)
      })
    }
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="mt-6 text-sm text-gray-400">
      Electron IPC ping: <span className="font-mono">{response ?? "..."}</span>
    </div>
  )
}
