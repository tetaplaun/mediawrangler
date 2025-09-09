export function inferSeparator(p: string): "\\" | "/" {
  // Treat Windows drive paths or backslash presence as Windows
  return /^[A-Za-z]:/.test(p) || p.includes("\\") ? "\\" : "/"
}

export function isDriveRoot(p: string): boolean {
  return /^[A-Za-z]:\\?$/.test(p)
}

export function getParentPath(p: string): string | null {
  if (p === "::drives") return null
  const sep = inferSeparator(p)
  if (sep === "\\") {
    const trimmed = p.replace(/\\+$/, "")
    if (trimmed.length <= 2) return "::drives" // "C:" or shorter
    const idx = trimmed.lastIndexOf("\\")
    if (idx < 0) return "::drives"
    if (idx === 2) return trimmed.slice(0, 2) + "\\" // drive root
    return trimmed.slice(0, idx)
  }
  // POSIX
  const t = p.replace(/\/+$/, "")
  if (t === "/") return "::drives"
  const idx = t.lastIndexOf("/")
  return idx > 0 ? t.slice(0, idx) : "/"
}
