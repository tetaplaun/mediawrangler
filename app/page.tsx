import Ping from "./components/Ping"

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">MediaWrangler</h1>
        <p className="mt-2 text-gray-400">Next.js + Tailwind + Electron</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Dev server waiting for Electron on port 3000!"!!!"
        </div>
        <Ping />
      </div>
    </main>
  )
}
