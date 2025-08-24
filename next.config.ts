import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *; default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:"
          }
        ],
      },
    ]
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allows all HTTPS domains
      },
    ],
    // Or if you prefer to be more specific with domains:
    domains: [
      'res.cloudinary.com',
      'imagedelivery.net', 
      'cdn.stamp.fyi',
      'i.imgur.com',
      'api.dicebear.com',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
      // Add other common Farcaster PFP domains
    ],
  },
}

export default nextConfig