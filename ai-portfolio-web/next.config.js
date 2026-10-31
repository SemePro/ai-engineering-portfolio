/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // The site's only raster image is a small logo. Disabling the optimizer removes the
  // /_next/image endpoint and its advisories (see SECURITY notes in the PR) at no visual cost.
  images: { unoptimized: true },
}

module.exports = nextConfig
