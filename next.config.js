/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"
const nextConfig = {
  output: "export",
  distDir: "out",
  images: { unoptimized: true },
  assetPrefix: isProd ? "./" : undefined,
  trailingSlash: true,
}

module.exports = nextConfig
