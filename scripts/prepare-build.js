const fs = require('fs')
const path = require('path')

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true })
  }
  
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element)
    const toPath = path.join(to, element)
    
    if (fs.lstatSync(fromPath).isFile()) {
      fs.copyFileSync(fromPath, toPath)
    } else {
      copyFolderSync(fromPath, toPath)
    }
  })
}

function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

console.log('🔧 Preparing build directories...')

const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const rendererDir = path.join(distDir, 'renderer')
const outDir = path.join(rootDir, 'out')

// Clean and create dist/renderer
console.log('📁 Cleaning dist/renderer...')
cleanDirectory(rendererDir)
fs.mkdirSync(rendererDir, { recursive: true })

// Copy Next.js export to dist/renderer
if (fs.existsSync(outDir)) {
  console.log('📋 Copying Next.js build from out/ to dist/renderer/...')
  copyFolderSync(outDir, rendererDir)
  console.log('✅ Renderer files copied successfully')
} else {
  console.error('❌ Error: out/ directory not found. Run "npm run build:web" first.')
  process.exit(1)
}

// Verify electron build exists
const electronDir = path.join(distDir, 'electron')
if (!fs.existsSync(path.join(electronDir, 'main.js'))) {
  console.error('❌ Error: dist/electron/main.js not found. Run "npm run build:electron" first.')
  process.exit(1)
}

console.log('✅ Build preparation complete!')