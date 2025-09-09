# MediaWrangler

Basic Next.js + Tailwind CSS + Electron scaffold.

## Develop

```bash
npm install
npm run dev
```

- Next.js: `http://localhost:3000`
- Electron auto-launches when Next is ready.

## Build

```bash
npm run build
```

- Static export to `dist/renderer/`
- Packaged app in `release/`

## Structure

- `app/` Next.js (App Router)
- `electron/` Electron main & preload
- `types/` Ambient typings
