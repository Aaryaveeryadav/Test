/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse must run in the Node runtime (it reads PDFs from buffers).
  serverExternalPackages: ['pdf-parse'],
  // Server actions carry PDF uploads to the ingestion pipeline.
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb'
    }
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' }
        ]
      }
    ]
  }
}

export default nextConfig
