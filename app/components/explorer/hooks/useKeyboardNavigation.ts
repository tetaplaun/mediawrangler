import { useEffect, useRef } from "react"
import { useExplorerActions } from "../context/ExplorerContext"

export function useKeyboardNavigation() {
  const { goBack, goForward, goUp } = useExplorerActions()
  const addressInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Navigation shortcuts
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault()
        goBack()
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault()
        goForward()
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault()
        goUp()
      } else if (e.key === "Backspace") {
        e.preventDefault()
        goUp()
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault()
        // Focus address bar
        const addressBar = document.querySelector<HTMLInputElement>(
          'input[placeholder*="path"], input[value*=":"], input[value*="/"], input[value*="\\\\"]'
        )
        if (addressBar) {
          addressBar.focus()
          addressBar.select()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goBack, goForward, goUp])

  return { addressInputRef }
}