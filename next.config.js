// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/ecommerce-index', destination: '/share-of-shelf', permanent: true },
    ]
  },
}

module.exports = nextConfig
