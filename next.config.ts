import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Optimize for mobile
  experimental: {
    optimizeCss: true,
  },

   eslint: {
    // Warning: This allows production builds to successfully complete even if your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate'
          }
        ]
      }
    ]
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