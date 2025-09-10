import "./globals.css"
import React from "react"

export const metadata = {
  title: "Media Wrangler",
  description: "Next.js + Tailwind + Electron starter",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">{children}</body>
    </html>
  )
}
