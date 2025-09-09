import * as os from "os"
import * as path from "path"
import * as fs from "fs"
import * as crypto from "crypto"
import { app } from "electron"

export interface StoredQuickLink {
  id: string
  name: string
  path: string
  type: "directory"
  isCustom: boolean
  order?: number
}

interface QuickLinksStoreData {
  customQuickLinks: StoredQuickLink[]
  showDefaults: boolean
  version: number
}

const DEFAULT_QUICK_LINKS = (): StoredQuickLink[] => {
  const home = os.homedir()
  const join = (...parts: string[]) => path.join(...parts)
  
  return [
    { id: "default-desktop", name: "Desktop", path: join(home, "Desktop"), type: "directory", isCustom: false },
    { id: "default-documents", name: "Documents", path: join(home, "Documents"), type: "directory", isCustom: false },
    { id: "default-downloads", name: "Downloads", path: join(home, "Downloads"), type: "directory", isCustom: false },
    { id: "default-pictures", name: "Pictures", path: join(home, "Pictures"), type: "directory", isCustom: false },
    { id: "default-music", name: "Music", path: join(home, "Music"), type: "directory", isCustom: false },
    { id: "default-videos", name: "Videos", path: join(home, "Videos"), type: "directory", isCustom: false },
  ]
}

class QuickLinksStore {
  private dataPath: string
  private data: QuickLinksStoreData

  constructor() {
    // Store data in the user's app data directory
    const userDataPath = app.getPath("userData")
    this.dataPath = path.join(userDataPath, "quick-links.json")
    this.data = this.loadData()
  }

  private loadData(): QuickLinksStoreData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const content = fs.readFileSync(this.dataPath, "utf-8")
        return JSON.parse(content)
      }
    } catch (error) {
      console.error("Error loading quick links data:", error)
    }
    
    // Return default data if file doesn't exist or there's an error
    return {
      customQuickLinks: [],
      showDefaults: true,
      version: 1,
    }
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dataPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2))
    } catch (error) {
      console.error("Error saving quick links data:", error)
    }
  }

  getAll(): StoredQuickLink[] {
    const customLinks = this.data.customQuickLinks || []
    const showDefaults = this.data.showDefaults ?? true
    
    if (showDefaults) {
      const defaultLinks = DEFAULT_QUICK_LINKS()
      return [...defaultLinks, ...customLinks].sort((a: StoredQuickLink, b: StoredQuickLink) => {
        const orderA = a.order ?? (a.isCustom ? 1000 : 0)
        const orderB = b.order ?? (b.isCustom ? 1000 : 0)
        return orderA - orderB
      })
    }
    
    return customLinks.sort((a: StoredQuickLink, b: StoredQuickLink) => (a.order ?? 0) - (b.order ?? 0))
  }

  add(name: string, targetPath: string): StoredQuickLink {
    const customLinks = this.data.customQuickLinks || []
    
    // Check if path already exists
    const existingLink = customLinks.find((link: StoredQuickLink) => link.path === targetPath)
    if (existingLink) {
      throw new Error(`A quick link for "${targetPath}" already exists`)
    }
    
    const newLink: StoredQuickLink = {
      id: crypto.randomUUID(),
      name,
      path: targetPath,
      type: "directory",
      isCustom: true,
      order: customLinks.length,
    }
    
    this.data.customQuickLinks.push(newLink)
    this.saveData()
    
    return newLink
  }

  remove(id: string): boolean {
    const customLinks = this.data.customQuickLinks || []
    const filteredLinks = customLinks.filter((link: StoredQuickLink) => link.id !== id)
    
    if (filteredLinks.length === customLinks.length) {
      return false // Link not found
    }
    
    // Reorder remaining links
    filteredLinks.forEach((link: StoredQuickLink, index: number) => {
      link.order = index
    })
    
    this.data.customQuickLinks = filteredLinks
    this.saveData()
    return true
  }

  update(id: string, updates: Partial<Pick<StoredQuickLink, "name" | "path">>): StoredQuickLink | null {
    const customLinks = this.data.customQuickLinks || []
    const linkIndex = customLinks.findIndex((link: StoredQuickLink) => link.id === id)
    
    if (linkIndex === -1) {
      return null
    }
    
    // Check if new path already exists (if path is being updated)
    if (updates.path && updates.path !== customLinks[linkIndex].path) {
      const existingLink = customLinks.find((link: StoredQuickLink) => link.path === updates.path)
      if (existingLink) {
        throw new Error(`A quick link for "${updates.path}" already exists`)
      }
    }
    
    customLinks[linkIndex] = {
      ...customLinks[linkIndex],
      ...updates,
    }
    
    this.data.customQuickLinks = customLinks
    this.saveData()
    return customLinks[linkIndex]
  }

  reorder(orderedIds: string[]): void {
    const customLinks = this.data.customQuickLinks || []
    const linkMap = new Map(customLinks.map((link: StoredQuickLink) => [link.id, link]))
    
    const reorderedLinks = orderedIds
      .map(id => linkMap.get(id))
      .filter((link): link is StoredQuickLink => link !== undefined)
      .map((link, index) => ({ ...link, order: index }))
    
    this.data.customQuickLinks = reorderedLinks
    this.saveData()
  }

  setShowDefaults(show: boolean): void {
    this.data.showDefaults = show
    this.saveData()
  }

  getShowDefaults(): boolean {
    return this.data.showDefaults ?? true
  }

  reset(): void {
    this.data.customQuickLinks = []
    this.data.showDefaults = true
    this.saveData()
  }
}

export const quickLinksStore = new QuickLinksStore()