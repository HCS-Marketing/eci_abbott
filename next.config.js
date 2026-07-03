// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/sos": ["./base_prov/**/*.xlsx"],
  },
  async redirects() {
    return [
      { source: '/ecommerce-index', destination: '/share-of-shelf', permanent: true },
    ]
  },
}

module.exports = nextConfig
