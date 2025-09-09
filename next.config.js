/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"
const nextConfig = {
  output: "export",
  distDir: ".next",
  images: { unoptimized: true },
  assetPrefix: isProd ? "./" : undefined,
  experimental: {
    esmExternals: false,
  },
}

module.exports = nextConfig
