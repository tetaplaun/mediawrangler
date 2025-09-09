export type Entry = {
  name: string
  path: string
  type: "file" | "directory" | "drive"
  size: number | null
  modifiedMs: number | null
  ext: string | null
}

export type ViewMode = "icons" | "details"

export type SortKey = "name" | "type" | "size" | "modifiedMs"
export type SortDir = "asc" | "desc"

export type SortState = { key: SortKey; dir: SortDir }

export type Drive = { name: string; path: string; type: "drive" }
export type QuickLink = { name: string; path: string; type: "directory" }

export type ListDirResult = {
  path: string
  entries: Entry[]
  error?: string
}
