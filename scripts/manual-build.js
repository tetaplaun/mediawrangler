const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true })
  }

  fs.readdirSync(from).forEach((element) => {
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

console.log("🔧 Starting manual Windows build...")

const rootDir = path.join(__dirname, "..")
const releaseDir = path.join(rootDir, "release")
const winUnpackedDir = path.join(releaseDir, "win-unpacked")
const distDir = path.join(rootDir, "dist")
const electronPath = path.join(rootDir, "node_modules", "electron", "dist")

// Clean previous build
console.log("📁 Cleaning previous build...")
cleanDirectory(winUnpackedDir)
fs.mkdirSync(winUnpackedDir, { recursive: true })

// Copy Electron executable and resources
console.log("📋 Copying Electron executable and resources...")
if (fs.existsSync(electronPath)) {
  // Copy electron.exe as MediaWrangler.exe
  const electronExe = path.join(electronPath, "electron.exe")
  const targetExe = path.join(winUnpackedDir, "MediaWrangler.exe")
  if (fs.existsSync(electronExe)) {
    fs.copyFileSync(electronExe, targetExe)
    console.log("✅ Copied electron.exe as MediaWrangler.exe")
  } else {
    console.error("❌ Error: electron.exe not found")
    process.exit(1)
  }

  // Copy all other Electron resources
  fs.readdirSync(electronPath).forEach(file => {
    if (file !== "electron.exe") {
      const sourcePath = path.join(electronPath, file)
      const targetPath = path.join(winUnpackedDir, file)

      if (fs.lstatSync(sourcePath).isDirectory()) {
        copyFolderSync(sourcePath, targetPath)
      } else {
        fs.copyFileSync(sourcePath, targetPath)
      }
    }
  })
  console.log("✅ Copied Electron resources")
} else {
  console.error("❌ Error: Electron not found in node_modules")
  console.log("Installing Electron...")
  execSync("npm install electron", { stdio: "inherit" })
  process.exit(1)
}

// Create resources/app directory
const appDir = path.join(winUnpackedDir, "resources", "app")
fs.mkdirSync(appDir, { recursive: true })

// Copy Electron files
console.log("📋 Copying Electron main process files...")
const electronDistDir = path.join(distDir, "electron")
if (fs.existsSync(electronDistDir)) {
  copyFolderSync(electronDistDir, appDir)
} else {
  console.error("❌ Error: Electron dist directory not found")
  process.exit(1)
}

// Copy Next.js renderer files
console.log("📋 Copying renderer files...")
const rendererDistDir = path.join(distDir, "renderer")
if (fs.existsSync(rendererDistDir)) {
  const rendererTargetDir = path.join(appDir, "dist", "renderer")
  fs.mkdirSync(rendererTargetDir, { recursive: true })
  copyFolderSync(rendererDistDir, rendererTargetDir)
} else {
  console.error("❌ Error: Renderer dist directory not found")
  process.exit(1)
}

// Copy package.json for production
console.log("📋 Copying package.json...")
const packageJson = require(path.join(rootDir, "package.json"))
const prodPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  author: packageJson.author,
  main: "main.js",
  dependencies: packageJson.dependencies,
}
fs.writeFileSync(
  path.join(appDir, "package.json"),
  JSON.stringify(prodPackageJson, null, 2)
)

// Copy package-lock.json
const packageLockPath = path.join(rootDir, "package-lock.json")
if (fs.existsSync(packageLockPath)) {
  fs.copyFileSync(packageLockPath, path.join(appDir, "package-lock.json"))
}

// Install production dependencies
console.log("📦 Installing production dependencies...")
try {
  execSync("npm ci --production", {
    cwd: appDir,
    stdio: "inherit",
  })
} catch (error) {
  console.error("❌ Error installing dependencies:", error.message)
  process.exit(1)
}

console.log("✅ Manual Windows build completed successfully!")
console.log(`📁 Output directory: ${winUnpackedDir}`)
console.log(`🚀 You can now run: "${winUnpackedDir}\\MediaWrangler.exe"`)
