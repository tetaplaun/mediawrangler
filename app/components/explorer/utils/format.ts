export function formatBytes(size: number | null) {
  if (size == null) return ""
  const units = ["B", "KB", "MB", "GB", "TB"]
  let s = size
  let u = 0
  while (s >= 1024 && u < units.length - 1) {
    s /= 1024
    u++
  }
  return `${s.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
}

export function formatDate(ms: number | null) {
  if (!ms) return ""
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return ""
  }
}
