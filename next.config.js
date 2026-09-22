// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/sos": ["./base_prov/**/*.xlsx", "./base_prov_co/**/*.xlsx"],
    "/api/sos/route": ["./base_prov/**/*.xlsx", "./base_prov_co/**/*.xlsx"],
    "/api/provider": ["./base_prov/**/*.xlsx", "./base_prov_co/**/*.xlsx"],
    "/api/provider/route": ["./base_prov/**/*.xlsx", "./base_prov_co/**/*.xlsx"],
  },
  async redirects() {
    return [
      { source: '/ecommerce-index', destination: '/share-of-shelf', permanent: true },
    ]
  },
}

module.exports = nextConfig
