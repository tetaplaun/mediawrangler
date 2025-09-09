export type MediaInfo = {
  dimensions?: { width: number; height: number }
  frameRate?: number
  encodedDate?: string
  duration?: number // in seconds
  bitRate?: number // in bps
  format?: string
  codec?: string
}

export type Entry = {
  name: string
  path: string
  type: "file" | "directory" | "drive"
  size: number | null
  modifiedMs: number | null
  ext: string | null
  mediaInfo?: MediaInfo
}

export type ViewMode = "icons" | "details"

export type SortKey = "name" | "type" | "size" | "modifiedMs"
export type SortDir = "asc" | "desc"

export type SortState = { key: SortKey; dir: SortDir }

export type Drive = { name: string; path: string; type: "drive" }
export type QuickLink = { 
  id: string
  name: string
  path: string
  type: "directory"
  isCustom: boolean
}

export type ListDirResult = {
  path: string
  entries: Entry[]
  error?: string
}
