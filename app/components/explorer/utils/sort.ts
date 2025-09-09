import type { Entry, SortState } from "../types/explorer"

export function sortEntries(entries: Entry[], sort: SortState, foldersFirst = false): Entry[] {
  const copy = [...entries]
  const dirMul = sort.dir === "asc" ? 1 : -1
  copy.sort((a, b) => {
    if (foldersFirst && a.type !== b.type) return a.type === "directory" ? -1 : 1
    const key = sort.key
    if (key === "name") {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dirMul
    }
    if (key === "type") {
      const typeA = a.type || ""
      const typeB = b.type || ""
      const cmp = typeA.localeCompare(typeB, undefined, { sensitivity: "base" })
      if (cmp !== 0) return cmp * dirMul
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dirMul
    }
    if (key === "size") {
      const av = a.size ?? -1
      const bv = b.size ?? -1
      if (av === bv)
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dirMul
      return (av < bv ? -1 : 1) * dirMul
    }
    // modifiedMs
    const av = a.modifiedMs ?? 0
    const bv = b.modifiedMs ?? 0
    if (av === bv) return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dirMul
    return (av < bv ? -1 : 1) * dirMul
  })
  return copy
}
